export { runCommand }

import { exec, ExecException } from 'child_process'
import path from 'path'

function runCommand(
  cmd: string,
  {
    swallowError,
    timeout = 5000,
    cwd = process.cwd(),
    printProgress,
  }: { swallowError?: true; timeout?: number; cwd?: string; printProgress?: true | string } = {},
): Promise<string> {
  const { promise, resolvePromise, rejectPromise } = genPromise<string>()

  let cwdResolved = cwd
  if (cwdResolved.startsWith('.')) {
    cwdResolved = path.join(process.cwd(), cwdResolved)
  }

  const t = setTimeout(() => {
    rejectPromise(new Error(`Command \`${cmd}\` (cwd: ${cwdResolved}) timed out (after ${timeout / 1000} seconds).`))
  }, timeout)

  if (printProgress) {
    process.stdout.write(`Running \`${cmd}\` (cwd: \`${cwd}\`)...`)
  }
  exec(cmd, { cwd: cwdResolved }, (err: ExecException | null, stdout, stderr) => {
    clearTimeout(t)
    if (err || stderr) {
      if (swallowError) {
        resolvePromise('SWALLOWED_ERROR')
      } else {
        const errMsg = stderr || err?.message || stdout
        rejectPromise(
          new Error(
            [
              `Command \`${cmd}\` (${cwdResolved}) failed. Error:`,
              `============== ERROR ==============`,
              errMsg.trim(),
              `===================================`,
            ].join('\n'),
          ),
        )
      }
    } else {
      if (printProgress) {
        console.log(' done')
      }
      resolvePromise(stdout)
    }
  })

  return promise
}

function genPromise<T>() {
  let resolvePromise!: (value: T) => void
  let rejectPromise!: (err: Error) => void
  const promise: Promise<T> = new Promise((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolvePromise, rejectPromise }
}

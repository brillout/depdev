export { runCommand }

import { exec, ExecException } from 'child_process'

function runCommand(
  cmd: string,
  { swallowError, timeout = 5000, cwd }: { swallowError?: true; timeout?: number; cwd?: string } = {},
): Promise<string> {
  const { promise, resolvePromise, rejectPromise } = genPromise<string>()

  const t = setTimeout(() => {
    rejectPromise(new Error(`Command \`${cmd}\` (${cwd}) timeout [${timeout / 1000} seconds].`))
  }, timeout)

  const options = { cwd }
  exec(cmd, options, (err: ExecException | null, stdout, stderr) => {
    clearTimeout(t)
    if (err || stderr) {
      if (swallowError) {
        resolvePromise('SWALLOWED_ERROR')
      } else {
        const errMsg = stderr || err?.message || stdout
        rejectPromise(
          new Error(
            [
              `Command \`${cmd}\` (${cwd}) failed. Error:`,
              `============== ERROR ==============`,
              errMsg.trim(),
              `===================================`,
            ].join('\n'),
          ),
        )
      }
    } else {
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

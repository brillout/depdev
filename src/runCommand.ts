export { runCommand }

import { exec, spawn, ExecException } from 'child_process'
import path from 'path'

function runCommand(
  cmd: string,
  {
    swallowError,
    timeout = 5000,
    cwd = process.cwd(),
    print
  }: { swallowError?: true; timeout?: null | number; cwd?: string; print?: 'overview' | 'all' } = {}
): Promise<null | string> {
  const { promise, resolvePromise /*, rejectPromise*/ } = genPromise<null | string>()

  let cwdResolved = cwd
  if (cwdResolved.startsWith('.')) {
    cwdResolved = path.join(process.cwd(), cwdResolved)
  }

  let resolveTimeout: undefined | (() => void)
  if (timeout !== null) {
    const t = setTimeout(() => {
      onError(`Timeout (after ${timeout / 1000} seconds).`)
    }, timeout)
    resolveTimeout = () => clearTimeout(t)
  }

  const onError = (errMsg: string) => {
    const err = new Error(
      [
        `Command \`${cmd}\` failed (cwd: ${cwdResolved}). Error:`,
        `============== ERROR ==============`,
        errMsg.trim(),
        `===================================`
      ].join('\n')
    )
    // rejectPromise(err)
    console.error(err)
    process.exit(1)
  }

  if (print === 'all') {
    const [cmdProgramm, ...cmdOptions] = cmd.split(' ')
    console.log(`=== Start \`${cmd}\` (cwd: \`${cwd}\`) ===`)
    const proc = spawn(cmdProgramm, cmdOptions, { cwd: cwdResolved, stdio: 'inherit' })
    proc.on('close', (code) => {
      resolveTimeout?.()
      if (code === 0) {
        console.log(`=== Done \`${cmd}\` (cwd: \`${cwd}\`) ===`)
        resolvePromise(null)
      } else {
        onError(`Command ${cmd} exited with code ${code}`)
      }
    })
  } else {
    if (print) {
      process.stdout.write(`Running \`${cmd}\` (cwd: \`${cwd}\`)...`)
    }
    exec(cmd, { cwd: cwdResolved }, (err: ExecException | null, stdout, stderr) => {
      resolveTimeout?.()
      if (err || stderr) {
        if (swallowError) {
          resolvePromise('SWALLOWED_ERROR')
        } else {
          const errMsg = stderr || err?.message || stdout
          onError(errMsg)
        }
      } else {
        if (print === 'overview') {
          console.log(' done')
        }
        resolvePromise(stdout)
      }
    })
  }

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

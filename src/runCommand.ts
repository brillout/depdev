export { runCommand }
export { setProjectRoot }

import { exec, spawn, ExecException } from 'child_process'
import path from 'path'
import { cwdReal, pathRelativeFromProjectRoot } from './utils'

function runCommand(
  cmd: string,
  {
    swallowError,
    timeout = 5000,
    cwd = cwdReal,
    print
  }: { swallowError?: true; timeout?: null | number; cwd?: string; print?: 'overview' | 'all' } = {}
): Promise<null | string> {
  const { promise, resolvePromise /*, rejectPromise*/ } = genPromise<null | string>()

  let cwdResolved = cwd
  if (cwdResolved.startsWith('.')) {
    cwdResolved = path.join(cwdReal, cwdResolved)
  }
  const cwdHumanReadable = !projectRoot ? cwd : pathRelativeFromProjectRoot(projectRoot, cwdResolved)

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
        `Command \`${cmd}\` failed (cwd: ${cwdHumanReadable}). Error:`,
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
    console.log(`=== Start \`${cmd}\` (cwd \`${cwdHumanReadable}\`) ===`)
    const proc = spawn(cmdProgramm, cmdOptions, { cwd: cwdResolved, stdio: 'inherit' })
    proc.on('close', (code) => {
      resolveTimeout?.()
      if (code === 0) {
        console.log(`=== Done \`${cmd}\` (cwd \`${cwdHumanReadable}\`) ===`)
        resolvePromise(null)
      } else {
        onError(`Command ${cmd} exited with code ${code}`)
      }
    })
  } else {
    if (print) {
      process.stdout.write(`${cmd} (cwd \`${cwdHumanReadable}\`)...`)
    }
    exec(cmd, { cwd: cwdResolved }, (err: ExecException | null, stdout, stderr) => {
      resolveTimeout?.()
      // err !== null <=> exit status !== 0
      //  - https://stackoverflow.com/questions/32874316/node-js-accessing-the-exit-code-and-stderr-of-a-system-command/43077917#43077917
      //  - For some commands, such as `git`: `stderr !== ''` doesn't mean that command failed
      //    - https://stackoverflow.com/questions/57016157/how-to-stop-git-from-writing-non-errors-to-stderr/57016167#57016167
      if (err !== null) {
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

let projectRoot: string | null = null
function setProjectRoot(projectRoot_: string) {
  projectRoot = projectRoot_
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

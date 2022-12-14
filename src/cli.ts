import { link } from './link'
import { clear } from './clear'
import { postinstall } from './postinstall'

const { command, pkgName } = parseArgs()

if (command === null) {
  link(pkgName)
}
if (command === 'clear') {
  clear(pkgName)
}
if (command === 'postinstall') {
  postinstall()
}

function parseArgs():
  | { command: null; pkgName: string }
  | { command: 'clear' | 'postinstall'; pkgName: null | string } {
  const { numberOfArgs, arg1, arg2 } = getArgs()
  if (arg1 === 'postinstall' && numberOfArgs === 1) {
    return { command: 'postinstall', pkgName: null }
  }
  if (numberOfArgs === 1) {
    return { command: null, pkgName: arg1 }
  }
  if (arg1 === 'clear' && numberOfArgs <= 2) {
    const pkgName = arg2 ?? null
    return { command: 'clear', pkgName }
  }
  console.log(
    [
      'Commands:',
      '  dev-my-dep <npm-package-name>',
      '  dev-my-dep clear [npm-package-name]',
      '  dev-my-dep postinstall'
    ].join('\n')
  )
  process.exit(0)
}

function getArgs() {
  const args = process.argv.slice(2)
  const numberOfArgs = args.length
  const [arg1, arg2] = args
  return { numberOfArgs, arg1, arg2 }
}

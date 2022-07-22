import { link } from './link'
import { clear } from './clear'

const { command, pkgName } = parseArgs()

if (command === null) {
  link(pkgName)
}
if (command === 'clear') {
  clear(pkgName)
}

function parseArgs(): { command: null; pkgName: string } | { command: 'clear'; pkgName: null | string } {
  const args = process.argv.slice(2)
  if (args.length === 1) {
    return { command: null, pkgName: args[0] }
  }
  const command = args[0]
  if (command === 'clear' && args.length <= 2) {
    const pkgName = args[1] ?? null
    return { command, pkgName }
  }
  console.log(
    [
      // prettier-ignore
      'Commands:',
      '  $ pnpm exec depdev <npm-package-name>',
      '  $ pnpm exec depdev clear [npm-package-name]'
    ].join('\n')
  )
  process.exit(0)
}

import { link } from './link'
import { unlink } from './unlink'

const { command, pkgName } = parseArgs()

if (command === 'link') {
  link(pkgName)
}
if (command === 'unlink') {
  unlink(pkgName)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const command = args[0]
  const pkgName = args[1]
  if (args.length !== 2 || !['link', 'unlink'].includes(command)) {
    console.log(
      [
        // prettier-ignore
        'Commands:',
        '  link <npm-package-name>',
        '  unlink <npm-package-name>',
      ].join('\n'),
    )
    process.exit(0)
  }
  return { command, pkgName }
}

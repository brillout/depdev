export { link }

import { loadPackageJson } from './loadPackageJson'
import { runCommand } from './runCommand'
import path from 'path'
import { mkdirp } from './utils'

async function link(pkgName: string) {
  const { owner, repo } = getGitRepo(pkgName)
  const depDirRelative = `./deps/${repo}/`
  const depDirAbsolute = path.join(process.cwd(), depDirRelative)

  mkdirp('deps')

  // `-q` to avoid `git clone` to write progress messages to stderr, see https://stackoverflow.com/questions/32685568/git-clone-writes-to-sderr-fine-but-why-cant-i-redirect-to-stdout
  await runCommand(`git clone git@github.com:${owner}/${repo} -q`, {
    cwd: './deps/',
    timeout: 15 * 1000,
    printProgress: true
  })

  // `pnpm link` also runs `pnpm install`
  await runCommand(`pnpm link ${depDirAbsolute}`, {
    timeout: 120 * 1000,
    printProgress: true
  })

  await runCommand('pnpm run dev', {
    cwd: depDirRelative,
    timeout: 60 * 1000,
    printProgress: true
  })
}

function getGitRepo(pkgName: string) {
  const pkgJson = loadPackageJson(pkgName)
  const { repository } = pkgJson
  if (typeof repository !== 'string') {
    throw new Error(
      `The \`package.json\` of the npm package \`${pkgName}\` is missing the \`package.json#repository\` field.`
    )
  }
  const gitRepo = parsePackageJsonRepository(repository, pkgName)
  return gitRepo
}

function parsePackageJsonRepository(repository: string, pkgName: string): { owner: string; repo: string } {
  const wrongFormat = `The \`package.json#repository\` value of \`${pkgName}\` is \`${repository}\` but only values with the format \`https://github.com/\${owner}/\${repo}\` or \`github:\${owner}\`:\${repo}\` are supported. PR welcome to add support for more formats.`

  let repoPath: string | null = null
  for (const prefix of ['https://github.com/', 'github:']) {
    if (repository.startsWith(prefix)) {
      repoPath = repository.slice(prefix.length)
    }
  }
  if (!repoPath) {
    throw new Error(wrongFormat)
  }

  const paths = repoPath.split('/')
  if (paths.length !== 2) {
    throw new Error(wrongFormat)
  }
  const [owner, repo] = paths
  return { owner, repo }
}

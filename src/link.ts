export { link }

import { loadPackageJson } from './loadPackageJson'
import { runCommand } from './runCommand'
import path from 'path'
import fs from 'fs'
import assert from 'assert'
import { mkdirp } from './utils'

async function link(pkgName: string) {
  const workspaceRoot = findWorkspaceRoot()

  const pnpmLockFile = path.join(workspaceRoot, 'pnpm-lock.yaml')
  if (!fs.existsSync(pnpmLockFile)) {
    throw new Error(`Missing \`pnpm-lock.yaml\` at ${workspaceRoot}`)
  }
  const lockFileIsDirty = async () => (await runCommand(`git status --porcelain ${pnpmLockFile}`)) !== ''
  if (await lockFileIsDirty()) {
    throw new Error(`\`pnpm-lock.yaml\` is dirty: make sure \`pnpm-lock.yaml\` has no uncommitted changes (${pnpmLockFile})`)
  }

  mkdirp('deps', workspaceRoot)

  const { owner, repo } = getGitRepo(pkgName)
  const pkgDir = path.join(workspaceRoot, `./deps/${repo}/`)

  if (!fs.existsSync(pkgDir)) {
    // `-q` to avoid `git clone` to write progress messages to stderr, see https://stackoverflow.com/questions/32685568/git-clone-writes-to-sderr-fine-but-why-cant-i-redirect-to-stdout
    await runCommand(`git clone git@github.com:${owner}/${repo} -q`, {
      cwd: path.join(workspaceRoot, `./deps/`),
      timeout: 15 * 1000,
      print: 'overview'
    })
  } else {
    const cwd = pkgDir
    const stdout = await runCommand(`git status --porcelain`, { cwd })
    assert(stdout !== null)
    const isDirty = stdout !== ''
    if (isDirty) {
      console.log(`Uncommitted changes at ${pkgDir}`)
    } else {
      const print = 'overview'
      await runCommand(`git fetch`, { cwd, print, timeout: 15 * 1000 })
      await runCommand(`git merge`, { cwd, print })
    }
  }
  assert(fs.existsSync(pkgDir))

  assert(!(await lockFileIsDirty()))
  // `pnpm link` also runs `pnpm install`
  await runCommand(`pnpm link ${pkgDir}`, {
    timeout: 120 * 1000,
    print: 'overview'
  })
  await runCommand(`git checkout ${pnpmLockFile}`)
  assert(!(await lockFileIsDirty()))

  /*
  await runCommand('pnpm run dev', {
    cwd: pkgDir,
    timeout: null,
    print: 'all'
  })
  //*/
}

function findWorkspaceRoot(): string {
  const dirCurrent = process.cwd()
  let dir = dirCurrent
  const filesystemRoot = getFilesystemRoot()
  while (dir !== filesystemRoot) {
    try {
      return path.dirname(require.resolve(path.join(dir, 'pnpm-workspace.yaml')))
    } catch {}
    dir = path.dirname(dir)
  }
  return dirCurrent
}

function getFilesystemRoot() {
  // https://stackoverflow.com/questions/9652043/identifying-the-file-system-root-with-node-js/50299531#50299531
  return path.parse(process.cwd()).root
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

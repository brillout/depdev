export { link }

import { loadPackageJson } from './loadPackageJson'
import { runCommand, setProjectRoot } from './runCommand'
import path from 'path'
import fs from 'fs'
import assert from 'assert'
import { mkdirp, pathRelativeFromProjectRoot } from './utils'

async function link(depName: string) {
  assertIsDep(depName)

  const workspaceRoot = findWorkspaceRoot()
  setProjectRoot(workspaceRoot)

  const pnpmLockFile = path.join(workspaceRoot, 'pnpm-lock.yaml')
  if (!fs.existsSync(pnpmLockFile)) {
    throw new Error(`Missing \`pnpm-lock.yaml\` at ${workspaceRoot}`)
  }
  const lockFileIsDirty = async () => (await runCommand(`git status --porcelain ${pnpmLockFile}`)) !== ''
  if (await lockFileIsDirty()) {
    throw new Error(
      `\`pnpm-lock.yaml\` is dirty. Make sure \`pnpm-lock.yaml\` (${pnpmLockFile}) has no uncommitted changes.`
    )
  }

  mkdirp('deps', workspaceRoot)

  const { owner, repo } = getGitRepo(depName)
  const depRepoDir = path.join(workspaceRoot, `./deps/${repo}/`)

  const gitRepoAlreadyFetched = fs.existsSync(depRepoDir)
  if (!gitRepoAlreadyFetched) {
    await runCommand(`git clone git@github.com:${owner}/${repo}`, {
      cwd: path.join(workspaceRoot, `./deps/`),
      timeout: 15 * 1000,
      print: 'overview'
    })
  } else {
    const cwd = depRepoDir
    const stdout = await runCommand(`git status --porcelain`, { cwd })
    assert(stdout !== null)
    const isDirty = stdout !== ''
    if (isDirty) {
      console.log(`Uncommitted changes at ${depRepoDir}`)
    } else {
      const print = 'overview'
      await runCommand(`git fetch`, { cwd, print, timeout: 15 * 1000 })
      await runCommand(`git merge`, { cwd, print })
    }
  }
  assert(fs.existsSync(depRepoDir))

  assert(!(await lockFileIsDirty()))
  const symlinkSource = path.join(process.cwd(), 'node_modules', depName)
  let symlink = getSymlink(symlinkSource)
  if (
    !getSymlink(symlinkSource) ||
    // We run `pnpm link` in order to install dependencies of `depName`
    !gitRepoAlreadyFetched
  ) {
    await runCommand(`pnpm link ${depRepoDir}`, {
      timeout: 120 * 1000,
      print: 'overview'
    })
    await runCommand(`git checkout ${pnpmLockFile}`)
    assert(!(await lockFileIsDirty()))
    symlink = getSymlink(symlinkSource)
    if (!symlink) {
      throw new Error(`Something went wrong: ${symlinkSource} should be a symlink but it isn't.`)
    }
  }
  {
    assert(symlink)
    const { symlinkTarget } = symlink
    const sourcePath = pathRelativeFromProjectRoot(workspaceRoot, symlinkSource)
    const targetPath = pathRelativeFromProjectRoot(workspaceRoot, symlinkTarget)
    console.log(`Symlink: ${targetPath} <- ${sourcePath}`)
  }

  showDepVersion(depName, depRepoDir)
}

function showDepVersion(depName: string, depRepoDir: string) {
  const version = findDepVersionLatest(depRepoDir)
  const { semver } = findDepVersionCurrent(depName)
  assert(semver)
  console.log(`Current semver: ${depName}@${semver}`)
  console.log(`Latest version: ${depName}@${version}`)
}

function findDepVersionLatest(depRepoDir: string) {
  const pkgJsonPath = path.join(depRepoDir, 'package.json')
  const pkgJson = require(pkgJsonPath)
  const { version } = pkgJson
  assert(version)
  assert(typeof version === 'string')
  return version
}

function findDepVersionCurrent(depName: string) {
  const pkgJsonPath = path.join(process.cwd(), 'package.json')
  const pkgJson = require(pkgJsonPath)
  const dependencies: Record<string, string> = pkgJson.dependencies
  const devDependencies: Record<string, string> = pkgJson.devDependencies
  for (const dep of [...Object.entries(dependencies || {}), ...Object.entries(devDependencies || {})]) {
    const [name, semver] = dep
    if (name === depName) {
      return { pkgJsonPath, semver }
    }
  }
  return { pkgJsonPath, semver: null }
}

function assertIsDep(depName: string) {
  const { semver, pkgJsonPath } = findDepVersionCurrent(depName)
  if (semver === null) {
    throw new Error(
      `\`${depName}\` missing in \`package.json#dependencies\`/\`package.json#devDependencies\` of ${pkgJsonPath}`
    )
  }
}

function getSymlink(symlinkSource: string): null | { symlinkValue: string; symlinkTarget: string } {
  if (!fs.lstatSync(symlinkSource).isSymbolicLink()) {
    return null
  }
  const symlinkValue = fs.readlinkSync(symlinkSource)
  const symlinkTarget = path.resolve(path.dirname(symlinkSource), symlinkValue)
  return { symlinkValue, symlinkTarget }
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

function getGitRepo(depName: string) {
  const { packageJson, packageJsonPath } = loadPackageJson(depName)
  const { repository } = packageJson
  if (typeof repository !== 'string') {
    throw new Error(`Missing \`package.json#repository\` at ${packageJsonPath}`)
  }
  const gitRepo = parsePackageJsonRepository(repository, depName)
  return gitRepo
}

function parsePackageJsonRepository(repository: string, depName: string): { owner: string; repo: string } {
  const wrongFormat = `The \`package.json#repository\` value of \`${depName}\` is \`${repository}\` but only values with the format \`https://github.com/\${owner}/\${repo}\` or \`github:\${owner}\`:\${repo}\` are supported. PR welcome to add support for more formats.`

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

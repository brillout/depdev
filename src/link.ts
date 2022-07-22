export { link }

import { loadPackageJson } from './loadPackageJson'
import { runCommand } from './runCommand'
import path from 'path'
import fs from 'fs'
import assert from 'assert'
import { mkdirp } from './utils'

async function link(pkgName: string) {
  checkPkgIsDep(pkgName)

  const workspaceRoot = findWorkspaceRoot()

  const pnpmLockFile = path.join(workspaceRoot, 'pnpm-lock.yaml')
  if (!fs.existsSync(pnpmLockFile)) {
    throw new Error(`Missing \`pnpm-lock.yaml\` at ${workspaceRoot}`)
  }
  const lockFileIsDirty = async () => (await runCommand(`git status --porcelain ${pnpmLockFile}`)) !== ''
  if (await lockFileIsDirty()) {
    throw new Error(
      `\`pnpm-lock.yaml\` is dirty. Make sure \`pnpm-lock.yaml\` (${pnpmLockFile}) has no uncommitted changes.`,
    )
  }

  mkdirp('deps', workspaceRoot)

  const { owner, repo } = getGitRepo(pkgName)
  const pkgRepoDir = path.join(workspaceRoot, `./deps/${repo}/`)

  const gitRepoAlreadyFetched = fs.existsSync(pkgRepoDir)
  if (!gitRepoAlreadyFetched) {
    await runCommand(`git clone git@github.com:${owner}/${repo}`, {
      cwd: path.join(workspaceRoot, `./deps/`),
      timeout: 15 * 1000,
      print: 'overview',
    })
  } else {
    const cwd = pkgRepoDir
    const stdout = await runCommand(`git status --porcelain`, { cwd })
    assert(stdout !== null)
    const isDirty = stdout !== ''
    if (isDirty) {
      console.log(`Uncommitted changes at ${pkgRepoDir}`)
    } else {
      const print = 'overview'
      await runCommand(`git fetch`, { cwd, print, timeout: 15 * 1000 })
      await runCommand(`git merge`, { cwd, print })
    }
  }
  assert(fs.existsSync(pkgRepoDir))

  assert(!(await lockFileIsDirty()))
  const pkgLink = path.join(process.cwd(), 'node_modules', pkgName)
  if (
    !getSymlinkTarget(pkgLink) ||
    // We run `pnpm link` in order to install dependencies of `pkgName`
    !gitRepoAlreadyFetched
  ) {
    await runCommand(`pnpm link ${pkgRepoDir}`, {
      timeout: 120 * 1000,
      print: 'overview',
    })
    await runCommand(`git checkout ${pnpmLockFile}`)
    assert(!(await lockFileIsDirty()))
    if (!getSymlinkTarget(pkgLink)) {
      throw new Error(`Something went wrong: ${pkgLink} should be a symlink but it isn't.`)
    }
  }
  const linkTarget = getSymlinkTarget(pkgLink)
  assert(linkTarget)
  console.log(
    `Symlink: ${path.relative(process.cwd(), pkgLink)} -> ${linkTarget} (${pkgLink} -> ${path.resolve(
      path.dirname(pkgLink),
      linkTarget,
    )})`,
  )

  showPkgVersionStatus(pkgName, pkgRepoDir)
}

function showPkgVersionStatus(pkgName: string, pkgRepoDir: string) {
  const version = findPkgVersionLatest(pkgRepoDir)
  const { semver } = findPkgVersionCurrent(pkgName)
  assert(semver)
  console.log(`Current semver: ${pkgName}@${semver}`)
  console.log(`Latest version: ${pkgName}@${version}`)
}

function findPkgVersionLatest(pkgRepoDir: string) {
  const pkgJsonPath = path.join(pkgRepoDir, 'package.json')
  const pkgJson = require(pkgJsonPath)
  const { version } = pkgJson
  assert(version)
  assert(typeof version === 'string')
  return version
}

function findPkgVersionCurrent(pkgName: string) {
  const pkgJsonPath = path.join(process.cwd(), 'package.json')
  const pkgJson = require(pkgJsonPath)
  const dependencies: Record<string, string> = pkgJson.dependencies
  const devDependencies: Record<string, string> = pkgJson.devDependencies
  for (const dep of [...Object.entries(dependencies || {}), ...Object.entries(devDependencies || {})]) {
    const [depName, semver] = dep
    if (depName === pkgName) {
      return { pkgJsonPath, semver }
    }
  }
  return { pkgJsonPath, semver: null }
}

function checkPkgIsDep(pkgName: string) {
  const { semver, pkgJsonPath } = findPkgVersionCurrent(pkgName)
  if (semver === null) {
    throw new Error(
      `Couldn't find \`${pkgName}\` in \`package.json#dependencies\` nor \`package.json#devDependencies\` of ${pkgJsonPath}`,
    )
  }
}

function getSymlinkTarget(pkgLink: string): string | null {
  if (!fs.lstatSync(pkgLink).isSymbolicLink()) {
    return null
  }
  const linkTarget = fs.readlinkSync(pkgLink)
  return linkTarget
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
      `The \`package.json\` of the npm package \`${pkgName}\` is missing the \`package.json#repository\` field.`,
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

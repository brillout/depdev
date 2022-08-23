export { pathRelativeFromProjectRoot }

import path from 'path'

function pathRelativeFromProjectRoot(projectRoot: string, pathAbsolute: string) {
  if (!path.isAbsolute(pathAbsolute)) throw new Error(`Path ${pathAbsolute} is not an absolute path but it should be`)
  const pathRelative = path.relative(projectRoot, pathAbsolute)
  if (pathRelative.startsWith('.')) throw new Error(`Path ${pathAbsolute} should be contained in path ${projectRoot}`)
  const pathFromProjectRoot = `|${pathRelative}`
  return pathFromProjectRoot
}

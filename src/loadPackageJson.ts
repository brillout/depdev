export { loadPackageJson }

// https://stackoverflow.com/questions/10111163/in-node-js-how-can-i-get-the-path-of-a-module-i-have-loaded-via-require-that-is/63441056#63441056
// https://stackoverflow.com/questions/44315087/how-to-require-resolve-the-package-directory/72203525#72203525

// Seems like Yarn PnP can be supported: https://github.com/stefanpenner/resolve-package-path/blob/613dab18dc30a1d53f9cae29c4e3882b7da8af46/src/index.ts#L113-L117

import path from 'path'
import assert from 'assert'

function loadPackageJson(dep: string) {
  const depMain = require.resolve(dep)
  const dirStart = path.dirname(depMain)
  let dir = dirStart
  while (true) {
    try {
      return require(path.join(dir, 'package.json'))
    } catch {}
    const dirNew = path.dirname(dir)
    if (dirNew === dir) {
      assert(dir === getFilesystemRoot())
      throw new Error("Couldn't find `package.json` between `/` and `" + dirStart + '`')
    }
    dir = dirNew
  }
}

function getFilesystemRoot() {
  // https://stackoverflow.com/questions/9652043/identifying-the-file-system-root-with-node-js/50299531#50299531
  return path.parse(process.cwd()).root
}

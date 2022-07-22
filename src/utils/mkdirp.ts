export { mkdirp }

import fs from 'fs'
import path from 'path'

async function mkdirp(dirName: string, cwd: string) {
  const dirPath = path.join(cwd, dirName)
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath)
  }
}

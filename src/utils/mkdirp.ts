export { mkdirp }

import fs from 'fs'

async function mkdirp(dirName: string) {
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName)
  }
}

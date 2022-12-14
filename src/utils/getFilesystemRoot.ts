import path from 'path'
export function getFilesystemRoot() {
  // https://stackoverflow.com/questions/9652043/identifying-the-file-system-root-with-node-js/50299531#50299531
  return path.parse(process.cwd()).root
}


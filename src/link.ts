import { loadPackageJson } from './loadPackageJson'

export { link }

function link(pkgName: string) {
  const pkgJson = loadPackageJson(pkgName)
  console.log('link', pkgName, pkgJson)
}

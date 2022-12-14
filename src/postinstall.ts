export { postinstall }

import { getConfig, loadConfig } from './config'
import { link } from './link'

async function postinstall() {
  console.log('postinstall()')
  console.log('process.cwd()', process.cwd())
  console.log('process.env.INIT_CWD', process.env.INIT_CWD)
  await loadConfig()
  const config = getConfig()
  const { inlinedDependencies } = config
  if (!inlinedDependencies) return
  for (const dep of inlinedDependencies) {
    await link(dep)
  }
}

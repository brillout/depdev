export { postinstall }

import { getConfig, loadConfig } from './config'
import { link } from './link'

async function postinstall() {
  await loadConfig()
  const config = getConfig()
  const { inlinedDependencies } = config
  if (!inlinedDependencies) return
  for (const dep of inlinedDependencies) {
    await link(dep)
  }
}

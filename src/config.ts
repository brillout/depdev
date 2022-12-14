export { getConfig }
export { loadConfig }

import path from 'path'
import fs from 'fs'
import { assert, assertUsage, fsWindowsBugWorkaround, isObject } from './utils'

const configFileName = 'dev-my-dep.config.mjs'
const errPrefix = `Config file ${configFileName} `

type Config = {
  inlinedDependencies?: string[]
}

let config: null | Config = null

function getConfig(): Config {
  assert(config)
  return config
}

async function loadConfig(): Promise<void> {
  const configFilePath = find()
  assertUsage(configFilePath, errPrefix + 'not found')
  const configFileExports = (await import(fsWindowsBugWorkaround(configFilePath))) as Record<string, unknown>
  assertUsage('default' in configFileExports, errPrefix + 'should have a default export')
  assertConfig(configFileExports.default)
  config = configFileExports.default
}

function assertConfig(config: unknown): asserts config is Config {
  assertUsage(isObject(config), errPrefix + 'default export should be an object')
  if ('inlinedDependencies' in config) {
    const { inlinedDependencies } = config
    assertUsage(
      Array.isArray(inlinedDependencies) && inlinedDependencies.every((e) => typeof e === 'string'),
      errPrefix + '`inlinedDependencies` should be a list of strings'
    )
  }
}

function find(): null | string {
  let dir = process.cwd()
  while (true) {
    const configFilePath = path.join(dir, configFileName)
    if (fs.existsSync(configFilePath)) {
      return configFilePath
    }
    const dirPrevious = dir
    dir = path.dirname(dir)
    if (dir === dirPrevious) {
      return null
    }
  }
}

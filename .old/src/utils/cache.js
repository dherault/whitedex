const path = require('path')

const { readJson, writeJson } = require('./json')

const defaultDuration = 1000 * 60 * 60 * 24 // 1 day

async function cache(callback, key, duration = defaultDuration) {
  const cacheLocation = path.resolve(__dirname, `../../cache/${key}.json`)
  const cached = await readJson(cacheLocation)

  if (cached && cached.timestamp + duration > Date.now()) {
    return cached.data
  }

  const data = await callback()

  await writeJson(cacheLocation, { timestamp: Date.now(), data })

  return data
}

module.exports = cache

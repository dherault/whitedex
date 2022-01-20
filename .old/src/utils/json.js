const { readFile, writeFile } = require('fs/promises')
const path = require('path')

async function readJson(location) {
  try {
    return JSON.parse(await readFile(path.resolve(location)))
  }
  catch (error) {
    return null
  }
}

async function writeJson(location, data) {
  return writeFile(path.resolve(location), JSON.stringify(data, null, 2), 'utf8')
}

module.exports = {
  readJson,
  writeJson,
}

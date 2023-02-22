import fs from 'fs'

export function readSyncJson (path) {
  return JSON.parse(fs.readFileSync(path).toString())
}

export function writeJsonSync (path, data) {
  return fs.writeFileSync(path, JSON.stringify(data, null, 2))
}

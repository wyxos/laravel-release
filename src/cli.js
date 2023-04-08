import { info } from './logging.js'
import { execSync } from 'child_process'

function toolCommand(tool, command) {
  info(`Executing: ${tool} ${command}`)

  execSync(`${tool} ${command}`, { stdio: 'inherit' })
}

export function npm(command) {
  toolCommand('npm', command)
}

export function git(command) {
  toolCommand('git', command)
}

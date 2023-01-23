#!/usr/bin/env node
import { execSync } from 'child_process'
import { NodeSSH } from 'node-ssh'
import * as fs from 'fs'
import chalk from 'chalk'
import inquirer from 'inquirer'

function checkRepoChanges () {
  return execSync('git diff-index HEAD --').toString()
}

function logger (color, message) {
  console.log(chalk[color](...message))
}

function info (...message) {
  logger('yellow', message)
}

function success (...message) {
  logger('green', message)
}

function toolCommand (tool, command) {
  info(`Executing: ${tool} ${command}`)

  execSync(`${tool} ${command}`, { stdio: 'inherit' })
}

function npm (command) {
  toolCommand('npm', command)
}

function git (command) {
  toolCommand('git', command)
}

console.log('diff', checkRepoChanges().length)

throw Error('test')

const branches = execSync('git branch')
  .toString()
  .split(/\n/)
  .filter(Boolean)
  .map(value => value
    .replace('* ', '')
    .replace(/\s/g, '')
  )

/** TODO merge updates from a repo to another */
const { releaseRepo } = await inquirer.prompt({
  name: 'releaseRepo',
  type: 'list',
  choices: branches,
  message: 'Which branch to release?'
})

const { updatedRepo } = await inquirer.prompt({
  name: 'updatedRepo',
  type: 'list',
  message: 'Which branch to merge from?',
  choices: branches.filter(value => value !== releaseRepo)
})

git(`checkout ${updatedRepo}`)

// check file not committed
// if file(s) not committed: request for message to stage files
// if file(s) committed: proceed
// lint
const untrackedFiles = execSync('git ls-files --other --exclude-standard').toString()

const uncommittedFiles = checkRepoChanges()

if(untrackedFiles || uncommittedFiles){
  const {message} = await inquirer.prompt({
    name: 'message',
    message: 'There are untracked/uncommitted files. Provide a commit message',
    default(){
      return 'feat: pre-release'
    }
  })

  git('add .')

  git(`commit -m "${message}"`)

  git('push')
}

const files = execSync('git diff --name-only origin/master master').toString()

let databaseChange = 0

let composerChange = 0

let nodeChange = 0

let javascriptChange = 0


if (files.length) {
  const items = files.split(/\n/).filter(Boolean)

  databaseChange = items.filter(value => value.indexOf('migrations') > -1).length

  composerChange = items.filter(value => value.indexOf('composer.json') > -1).length

  nodeChange = items.filter(value => value.indexOf('package.json') > -1).length

  javascriptChange = items.filter(value => /\.(js|vue|mjs|css|json)/.test(value)).length
}

npm('run lint')

if(checkRepoChanges()){
  git('add .')

  git(`commit -m "lint"`)

  git('push')
}

// change version of package.json
const json = JSON.parse(fs.readFileSync('./package.json').toString())

const currentVersion = json.version || '1.0.0'

let defaultVersion = currentVersion.split('.')

defaultVersion[defaultVersion.length - 1] =
  Number(defaultVersion[defaultVersion.length - 1]) + 1

defaultVersion = defaultVersion.join('.')

const { version } = await inquirer.prompt([
  {
    name: 'version',
    message: `Enter the version to publish (current ${currentVersion})`,
    default: defaultVersion
  }
])

json.version = version

fs.writeFileSync('./package.json', JSON.stringify(json, null, 2))

const tagVersion = `v${version}`

const message = `feat: release ${tagVersion}`

// commit with release message

if(checkRepoChanges()){
  git('add .')

  git(`commit -m "${message}"`)

  git('push')
}

if(javascriptChange){
  npm('run build')
}

git(`checkout ${releaseRepo}`)

git('pull')

git(`merge ${updatedRepo}`)

git('push')

// ssh into server

const sshConfigPath = 'ssh-config.json'

if (!fs.existsSync(sshConfigPath)) {
  // asks for environment, suggest development
  const { host } = await inquirer.prompt({
    type: 'input',
    name: 'host',
    message: 'SSH host/IP?',
    default () {
      return '192.168.100.10'
    }
  })

  const { username } = await inquirer.prompt({
    type: 'input',
    name: 'username',
    message: 'SSH with username?',
    default () {
      return 'runcloud'
    }
  })

  const { privateKeyPath } = await inquirer.prompt({
    type: 'input',
    name: 'privateKeyPath',
    message: 'SSH private key location?',
    default () {
      return 'C:\\Users\\joeyj\\.ssh\\id_rsa_wyxos'
    }
  })

  const { cwd } = await inquirer.prompt({
    type: 'input',
    name: 'cwd',
    message: 'SSH private key location?',
    default () {
      return '/home/runcloud/webapps/my-app'
    }
  })

  const sshConfigJson = {
    development: {
      host,
      username,
      privateKeyPath,
      cwd
    }
  }

  info('Creating ssh-config.json')

  fs.writeFileSync(sshConfigPath, JSON.stringify(sshConfigJson, null, 2))
}

const sshConfig = JSON.parse(fs.readFileSync(sshConfigPath).toString())

const ssh = new NodeSSH()

const { host, privateKeyPath, username, cwd } = sshConfig.development

await ssh.connect({
  host,
  privateKeyPath,
  username
})

// execute git pull
async function projectCommand (command) {
  info('executing:', `"${command}"...`)

  const result = await ssh.execCommand(command, { cwd })

  success(result.stdout)

  return result
}

await projectCommand('git pull')

if(composerChange){
  await projectCommand('composer install')
}

if(databaseChange){
  await projectCommand('php artisan migrate --force')
}

// execute npm i && npm run build
if(nodeChange){
  await projectCommand('npm i')
}

if(javascriptChange){
  await projectCommand('npm run build')
}

ssh.dispose()

success('Release complete.')

git(`checkout ${updatedRepo}`)

import { execSync } from 'child_process'
import inquirer from 'inquirer'
import SimpleGit from 'simple-git'
import fs from 'fs'
import { info, success } from './src/logging.js'

const execSyncOut = (command) => {
  execSync(command, { stdio: 'inherit' })
}

const readPackageJson = () => {
  return JSON.parse(fs.readFileSync('./package.json', 'utf8'))
}

const writePackageJson = (json) => {
  fs.writeFileSync('./package.json', JSON.stringify(json, null, 2))
}

const promptForNewVersion = async (currentVersion, defaultVersion) => {
  const { version } = await inquirer.prompt([
    {
      name: 'version',
      message: `Enter the version to publish (current ${currentVersion})`,
      default: defaultVersion
    }
  ])

  return version
}

const projectDir = process.cwd()
const git = SimpleGit(projectDir)

const untrackedFiles = git.status().not_added.length > 0

if (untrackedFiles) {
  info(
    'The following files are not part of the repository:' +
      status.not_added.join('\n')
  )

  if (!untrackedFiles) {
    throw Error('Cannot proceed. Please resolve the untracked files.')
  }
}

execSyncOut('npm run lint')

const status = await git.status()

if (status.modified.length > 0) {
  await git.add('.')
  await git.commit('fix: lint')
}

const json = readPackageJson()

const currentVersion = json.version || '1.0.0.alpha.0'

let defaultVersion = currentVersion.split('.')

defaultVersion[defaultVersion.length - 1] =
  Number(defaultVersion[defaultVersion.length - 1]) + 1

defaultVersion = defaultVersion.join('.')

const version = await promptForNewVersion(currentVersion, defaultVersion)

json.version = version
writePackageJson(json)

const tagVersion = `v${version}`
const message = `"feat: release ${tagVersion}"`

info('Pushing package.json update...')
await git.add('.')
await git.commit(message, '.')
await git.push()

info(`Creating tag version v${version}...`)
await git.addTag(tagVersion)
await git.push('origin', tagVersion)

success('Release complete.')

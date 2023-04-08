#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import simpleGit from 'simple-git'
import prompts from 'prompts'
import { execSync } from 'child_process'
import { NodeSSH } from 'node-ssh'
import yargs from 'yargs'
import { error, info, success } from './src/logging.js'

const argv = yargs(process.argv.slice(2)).options({
  server: {
    type: 'string',
    description: 'Server label to skip server label prompt',
    alias: 's'
  }
}).argv
const projectDir = process.cwd()
const git = simpleGit(projectDir)
const ssh = new NodeSSH()

const configFile = 'ssh-config.json'

function excludeConfigFromRepo() {
  const gitignoreFile = path.join(projectDir, '.gitignore')

  const gitignoreContent = fs.readFileSync(gitignoreFile, 'utf-8')

  if (!gitignoreContent.includes(configFile)) {
    info('Excluding ssh-config.json from repo...')
    fs.appendFileSync(gitignoreFile, `\n${configFile}\n`)
  }
}

async function untrackedFilesCheck() {
  const status = await git.status()

  const untrackedFiles = status.not_added.length > 0

  if (untrackedFiles) {
    info(
      'The following files are not part of the repository:' +
        status.not_added.join('\n')
    )

    const { addUntrackedFiles } = await prompts({
      type: 'confirm',
      name: 'addUntrackedFiles',
      message: 'Enter a commit message:'
    })

    if (!addUntrackedFiles) {
      throw Error('Cannot proceed. Please resolve the untracked files.')
    }

    await git.add(status.not_added)
  }

  const uncommittedChanges = status.modified.length > 0

  if (uncommittedChanges) {
    info('The following files have been modified:' + status.modified.join('\n'))

    const { commitMessage } = await prompts({
      type: 'text',
      name: 'commitMessage',
      message: 'Enter a commit message:'
    })

    await git.commit(commitMessage, '.')

    await git.push()
  }
}

async function loadSshConfig() {
  let sshConfig = {}

  if (fs.existsSync(configFile)) {
    sshConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'))
  }

  let serverLabel = argv.server

  if (!serverLabel) {
    let serverLabelPrompt = {}

    if (Object.keys(sshConfig).length) {
      serverLabelPrompt = {
        type: 'select',
        name: 'serverLabel',
        message: 'Select the server to deploy:',
        choices: [
          ...Object.keys(sshConfig).map((label) => ({
            item: label,
            value: label
          })),
          { item: 'new', value: 'new' }
        ]
      }
    } else {
      serverLabelPrompt = {
        type: 'text',
        name: 'serverLabel',
        message: 'Enter the label for the server:'
      }
    }

    let response = await prompts(serverLabelPrompt)

    serverLabel = response.serverLabel

    if (serverLabel === 'new') {
      const response = await prompts({
        type: 'text',
        name: 'serverLabel',
        message: 'Enter the label for the server:'
      })

      serverLabel = response.serverLabel
    }
  }

  if (!sshConfig[serverLabel]) {
    error(`The server configuration '${serverLabel}' does not exist.`)
    // Fetch list of branches
    const branches = await git.branch()
    const choices = branches.all.map((branch) => ({
      title: branch,
      value: branch
    }))

    // Prompt user for branches to release and merge
    const { releaseBranch } = await prompts({
      type: 'select',
      name: 'releaseBranch',
      message: 'Select the branch to release:',
      choices
    })

    const filteredChoices = choices.filter(
      (branch) => branch.value !== releaseBranch
    )

    const { mergeBranch } = await prompts({
      type: 'select',
      name: 'mergeBranch',
      message: 'Select the branch to merge from:',
      choices: filteredChoices
    })

    const serverDetails = await prompts([
      {
        type: 'text',
        name: 'ip',
        message: 'Enter the IP of the server:'
      },
      {
        type: 'text',
        name: 'privateKeyPath',
        message: 'Enter the path to the private key on your local machine:'
      },
      {
        type: 'text',
        name: 'projectPath',
        message: 'Enter the path of the project on the server:'
      },
      {
        type: 'text',
        name: 'username',
        message: 'Enter the username to use to SSH into the server:'
      }
    ])

    sshConfig[serverLabel] = {
      ...serverDetails,
      releaseBranch,
      mergeBranch
    }

    fs.writeFileSync(configFile, JSON.stringify(sshConfig, null, 2))
  }

  // Add shortcut to release to an environment
  const serverLabels = Object.keys(sshConfig)

  const packageJsonPath = './package.json'
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString())

  serverLabels.forEach((label) => {
    const scriptKey = `release:${label}`
    if (!packageJson.scripts[scriptKey]) {
      packageJson.scripts[scriptKey] = `npm run release -- --server=${label}`
    }
  })

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))

  return sshConfig[serverLabel]
}

async function deploy({ serverConfig, changes }) {
  // SSH into server
  info('Logging into server...')
  await ssh.connect({
    host: serverConfig.ip,
    username: serverConfig.username,
    privateKeyPath: serverConfig.privateKeyPath
  })

  let options = {
    cwd: serverConfig.projectPath,
    onStdout(chunk) {
      info('stdoutChunk', chunk.toString('utf8'))
    },
    onStderr(chunk) {
      error('stderrChunk', chunk.toString('utf8'))
    }
  }

  // Execute git pull on server
  info('Deploying...')

  await ssh.execCommand('git pull', options)

  // Perform necessary actions based on changed files
  if (changes.composer) {
    info('Composer modifications detected. Executing relevant scripts...')

    await ssh.execCommand('composer update', options)
  }

  if (changes.php) {
    info('PHP modifications detected. Executing relevant scripts...')

    await ssh.execCommand(
      'php artisan view:clear && php artisan config:clear && php artisan horizon:terminate',
      { cwd: serverConfig.projectPath }
    )
  }

  if (changes.packageJson) {
    info(
      'Node dependencies modifications detected. Executing relevant scripts...'
    )

    await ssh.execCommand('npm i', options)
  }

  if (changes.build) {
    info(
      'Front-end assets modifications detected. Executing relevant scripts...'
    )

    await ssh.execCommand('npm run build', options)
  }

  // Close SSH connection and notify the user
  ssh.dispose()
}

async function build(changes) {
  if (changes.frontEnd) {
    const packageJsonPath = path.join(projectDir, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    const currentVersion = packageJson.version

    const suggestedVersion = currentVersion.split('.')

    suggestedVersion[suggestedVersion.length - 1]++

    const { newVersion } = await prompts({
      type: 'text',
      name: 'newVersion',
      message: 'Enter the new version for the release:',
      initial: suggestedVersion.join('.')
    })

    if (!newVersion) {
      throw Error('New version required.')
    }

    execSync('npm run build', { stdio: 'inherit' })

    packageJson.version = newVersion
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))

    await git.add('package.json')
    await git.commit(`feat: release v${newVersion}`, '.')
    await git.push()

    changes.build = true
  }
}

async function lint(modifiedFiles) {
  if (modifiedFiles.length) {
    execSync('eslint --fix ' + modifiedFiles.join(','), { stdio: 'inherit' })

    execSync('prettier --write ' + modifiedFiles.join(','), {
      stdio: 'inherit'
    })

    const lintStatus = await git.status()

    if (lintStatus.modified.length > 0 || lintStatus.not_added.length > 0) {
      await git.commit('fix: code lint', '.')

      await git.push()
    }
  }
}

async function merge(serverConfig) {
  await git.checkout(serverConfig.releaseBranch)
  await git.pull()
  await git.merge([serverConfig.mergeBranch])
  await git.push()
}

function scanChanges(modifiedFiles) {
  return {
    php: modifiedFiles.some((file) =>
      /^(app|config|database|routes|views)\/.+\.php$/.test(file)
    ),
    composer: modifiedFiles.includes('composer.json'),
    packageJson: modifiedFiles.includes('package.json'),
    frontEnd: modifiedFiles.some((file) =>
      /^resources\/.+(\.js|\.vue|\.json)$/.test(file)
    )
  }
}

async function main() {
  excludeConfigFromRepo()

  // Check for uncommitted changes
  await untrackedFilesCheck()

  // Load or create SSH config
  const serverConfig = await loadSshConfig()

  await git.checkout(serverConfig.mergeBranch)

  await git.pull()

  // Perform git comparison and determine modified files
  const diffSummary = await git.diffSummary([
    serverConfig.releaseBranch,
    serverConfig.mergeBranch
  ])

  const modifiedFiles = diffSummary.files.map((file) => file.file)

  // Check for changes in specific folders and files
  const changes = scanChanges(modifiedFiles)

  // Run npm lint and commit if needed
  await lint(modifiedFiles)

  // Check for changes in JavaScript, Vue, or JSON files
  await build(changes)

  // Perform git checkout, pull, and merge
  await merge(serverConfig)

  await deploy({
    serverConfig,
    changes
  })

  info('Restoring branch...')
  await git.checkout(serverConfig.mergeBranch)

  success('Deployment completed.')
}

main()

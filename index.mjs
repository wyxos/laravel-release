#!/usr/bin/env node
// import { execSync } from 'child_process'
// import { NodeSSH } from 'node-ssh'
// import * as fs from 'fs'
// import inquirer from 'inquirer'
// import { info, success } from './src/logging.js'
// import { readSyncJson, writeJsonSync } from './src/file-helpers.js'
// import { git, npm } from './src/cli.js'
//
// function checkRepoChanges () {
//   info('checking repo changes')
//
//   const output = execSync('git diff-index HEAD --').toString().length
//
//   info(`output from repo changes check: ${output}`)
//
//   return output
// }
//
// const branches = execSync('git branch')
//   .toString()
//   .split(/\n/)
//   .filter(Boolean)
//   .map(value => value
//     .replace('* ', '')
//     .replace(/\s/g, '')
//   )
//
// const { releaseRepo } = await inquirer.prompt({
//   name: 'releaseRepo',
//   type: 'list',
//   choices: branches,
//   message: 'Which branch to release?'
// })
//
// const { updatedRepo } = await inquirer.prompt({
//   name: 'updatedRepo',
//   type: 'list',
//   message: 'Which branch to merge from?',
//   choices: branches.filter(value => value !== releaseRepo)
// })
//
// git(`checkout ${updatedRepo}`)
//
// git('pull')
//
// const gitIgnore = fs.readFileSync('.gitignore').toString()
//
// const doesIgnoreContainConfig = gitIgnore.indexOf('ssh-config.json') > -1
//
// if (!doesIgnoreContainConfig) {
//   info('including ssh-config.json in .gitignore')
//   fs.appendFileSync('.gitignore', 'ssh-config.json')
// }
//
// const packageJson = JSON.parse(fs.readFileSync('package.json').toString())
//
// if (!packageJson.scripts.release) {
//   info('adding "release" to package.json scripts')
//
//   packageJson.scripts.release = 'npx wyxos/laravel-release'
//
//   fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2))
// }
//
// const untrackedFiles = execSync('git ls-files --other --exclude-standard').toString()
//
// const uncommittedFiles = checkRepoChanges()
//
// if (untrackedFiles || uncommittedFiles) {
//   const { message } = await inquirer.prompt({
//     name: 'message',
//     message: 'There are untracked/uncommitted files. Provide a commit message',
//     default () {
//       return 'feat: pre-release'
//     }
//   })
//
//   git('add .')
//
//   git(`commit -m "${message}"`)
// }
//
// const files = execSync(`git diff --name-only origin/${releaseRepo} ${updatedRepo}`).toString()
//
// let phpChanges = 0
//
// let databaseChange = 0
//
// let composerChange = 0
//
// let nodeChange = 0
//
// let javascriptChange = 0
//
// if (files.length) {
//   const items = files.split(/\n/).filter(Boolean)
//
//   /** TODO adjust php check to pick up files only within certain directories
//    * such as app, routes, config, and .env
//    * @type {number}
//    */
//   phpChanges = items.filter(value => /\.(php)/.test(value)).length
//
//   info('php changes detected')
//
//   databaseChange = items.filter(value => value.indexOf('migrations') > -1).length
//
//   info(databaseChange ? 'migration changes detected' : 'no migration changes detected')
//
//   composerChange = items.filter(value => value.indexOf('composer.json') > -1).length
//
//   info(composerChange ? 'composer.json changes detected' : 'no composer.json changes detected')
//
//   nodeChange = items.filter(value => value.indexOf('package.json') > -1).length
//
//   info(nodeChange ? 'package.json changes detected' : 'no package.json changes detected')
//
//   javascriptChange = items.filter(value => /\.(js|vue|mjs|css|scss|pcss|json)/.test(value) && ['composer.json', 'package.json'].indexOf(value) === -1).length
//
//   info(javascriptChange ? 'front-end changes detected' : 'no front-end changes detected')
// }
//
// npm('run lint')
//
// if (checkRepoChanges()) {
//   git('add .')
//
//   if (checkRepoChanges()) {
//     git(`commit -m "lint"`)
//   }
// }
//
// // change version of package.json
// const json = JSON.parse(fs.readFileSync('./package.json').toString())
//
// const currentVersion = json.version || '1.0.0'
//
// let defaultVersion = currentVersion.split('.')
//
// defaultVersion[defaultVersion.length - 1] =
//   Number(defaultVersion[defaultVersion.length - 1]) + 1
//
// defaultVersion = defaultVersion.join('.')
//
// const { version } = await inquirer.prompt([
//   {
//     name: 'version',
//     message: `Enter the version to publish (current ${currentVersion})`,
//     default: defaultVersion
//   }
// ])
//
// json.version = version
//
// fs.writeFileSync('./package.json', JSON.stringify(json, null, 2))
//
// const tagVersion = `v${version}`
//
// const message = `feat: release ${tagVersion}`
//
// // commit with release message
//
// git('add .')
//
// git(`commit -m "${message}"`)
//
// npm('run build')
//
// git('push')
//
// // update repo to release
// git(`checkout ${releaseRepo}`)
//
// git('pull')
//
// git(`merge ${updatedRepo} -m "feat: merge release"`)
//
// git('push')
//
// // ssh into server
//
// const sshConfigPath = 'ssh-config.json'
//
// if (!fs.existsSync(sshConfigPath)) {
//   // asks for environment, suggest development
//   const { environment } = await inquirer.prompt({
//     type: 'input',
//     name: 'environment',
//     message: 'Environment for the config?',
//     default () {
//       return 'development'
//     }
//   })
//
//   const { host } = await inquirer.prompt({
//     type: 'input',
//     name: 'host',
//     message: 'SSH host/IP?',
//     default () {
//       return '192.168.100.10'
//     }
//   })
//
//   const { username } = await inquirer.prompt({
//     type: 'input',
//     name: 'username',
//     message: 'SSH with username?',
//     default () {
//       return 'runcloud'
//     }
//   })
//
//   const { privateKeyPath } = await inquirer.prompt({
//     type: 'input',
//     name: 'privateKeyPath',
//     message: 'SSH private key location?',
//     default () {
//       return 'C:\\Users\\your-user-name\\.ssh\\id_rsa'
//     }
//   })
//
//   const { cwd } = await inquirer.prompt({
//     type: 'input',
//     name: 'cwd',
//     message: 'Project location on server?',
//     default () {
//       return '/home/runcloud/webapps/my-app'
//     }
//   })
//
//   const sshConfigJson = {
//     [environment]: {
//       host,
//       username,
//       privateKeyPath,
//       cwd
//     }
//   }
//
//   info('Creating ssh-config.json')
//
//   writeJsonSync(sshConfigPath, sshConfigJson)
// }
//
// let sshConfig = readSyncJson(sshConfigPath)
//
// const ssh = new NodeSSH()
//
// const { environment } = await inquirer.prompt({
//   name: 'environment',
//   message: 'Environment config to use for SSH?',
//   default () {
//     return 'development'
//   }
// })
//
// if (!sshConfig[environment]) {
//   // generate and save config
//   info('The environment chosen does not exist in the config.')
//
//   const { host } = await inquirer.prompt({
//     type: 'input',
//     name: 'host',
//     message: 'SSH host/IP?',
//     default () {
//       return '192.168.100.10'
//     }
//   })
//
//   const { username } = await inquirer.prompt({
//     type: 'input',
//     name: 'username',
//     message: 'SSH with username?',
//     default () {
//       return 'runcloud'
//     }
//   })
//
//   const { privateKeyPath } = await inquirer.prompt({
//     type: 'input',
//     name: 'privateKeyPath',
//     message: 'SSH private key location?',
//     default () {
//       return 'C:\\Users\\your-user-name\\.ssh\\id_rsa'
//     }
//   })
//
//   const { cwd } = await inquirer.prompt({
//     type: 'input',
//     name: 'cwd',
//     message: 'Project location on server?',
//     default () {
//       return '/home/runcloud/webapps/my-app'
//     }
//   })
//
//   sshConfig = {
//     ...sshConfig,
//     [environment]: {
//       host,
//       username,
//       privateKeyPath,
//       cwd
//     }
//   }
//
//   info('Updated ssh-config.json')
//
//   fs.writeFileSync(sshConfigPath, JSON.stringify(sshConfig, null, 2))
// }
//
// const { host, privateKeyPath, username, cwd } = sshConfig[environment]
//
// await ssh.connect({
//   host,
//   privateKeyPath,
//   username
// })
//
// // execute git pull
// async function projectCommand (command) {
//   info('executing:', `"${command}"...`)
//
//   const result = await ssh.execCommand(command, { cwd })
//
//   success(result.stdout)
//
//   return result
// }
//
// await projectCommand('git pull')
//
// if (phpChanges) {
//   await projectCommand('php artisan horizon:terminate')
// }
//
// if (composerChange) {
//   await projectCommand('composer update --no-dev')
// } else {
//   info('no composer changes found.')
// }
//
// if (databaseChange) {
//   await projectCommand('php artisan migrate --force')
// } else {
//   info('no database changes found.')
// }
//
// // execute npm i && npm run build
// if (nodeChange) {
//   await projectCommand('npm i')
// } else {
//   info('no node dependency changes found.')
// }
//
// if (javascriptChange) {
//   await projectCommand('npm run build')
// } else {
//   info('no front end changes found.')
// }
//
// ssh.dispose()
//
// success('Release complete.')
//
// git(`checkout ${updatedRepo}`)

import fs from 'fs'
import path from 'path'
import simpleGit from 'simple-git'
import prompts from 'prompts'
import { execSync } from 'child_process'
import { NodeSSH } from 'node-ssh'
import { info, success } from './src/logging.js'

const projectDir = process.cwd()
const git = simpleGit(projectDir)
const ssh = new NodeSSH()

const configFile = 'ssh-config.json'

async function main() {
  // Check for uncommitted changes
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

  // Load or create SSH config
  let sshConfig = {}

  if (fs.existsSync(configFile)) {
    sshConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'))
  }

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
        { item: 'manual', value: 'manual' }
      ]
    }
  } else {
    serverLabelPrompt = {
      type: 'text',
      name: 'serverLabel',
      message: 'Enter the label for the server:'
    }
  }

  let { serverLabel } = await prompts(serverLabelPrompt)

  console.log('selected', serverLabel)

  if (serverLabel === 'manual') {
    let response = await prompts({
      type: 'text',
      name: 'serverLabel',
      message: 'Enter the label for the server:'
    })

    serverLabel = response.serverLabel
  }

  if (!sshConfig[serverLabel]) {
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
      (branch) => branch.value !== serverDetails.releaseBranch
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

  const serverConfig = sshConfig[serverLabel]

  await git.checkout(serverConfig.mergeBranch)

  await git.pull()

  // Perform git comparison and determine modified files
  const diffSummary = await git.diffSummary([
    serverConfig.releaseBranch,
    serverConfig.mergeBranch
  ])
  const modifiedFiles = diffSummary.files.map((file) => file.file)

  // Check for changes in specific folders and files
  const phpChanges = modifiedFiles.some((file) =>
    /^(app|config|database|routes|views)\/.+\.php$/.test(file)
  )

  const jsVueJsonChanges = modifiedFiles.some(
    (file) =>
      /^resources\/.+(\.js|\.vue|\.json)$/.test(file) || file === 'package.json'
  )

  const composerJsonChanges = modifiedFiles.includes('composer.json')

  const packageJsonChanges = modifiedFiles.includes('package.json')

  // Run npm lint and commit if needed
  execSync('npm run lint', { stdio: 'inherit' })

  const lintStatus = await git.status()
  if (lintStatus.modified.length > 0 || lintStatus.not_added.length > 0) {
    await git.commit('fix: code lint', '.')

    await git.push()
  }

  // Check for changes in JavaScript, Vue, or JSON files
  let npmBuildExecuted = false
  if (jsVueJsonChanges) {
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

    npmBuildExecuted = true
  }

  // Perform git checkout, pull, and merge
  await git.checkout(serverConfig.releaseBranch)
  await git.pull()
  await git.merge([serverConfig.mergeBranch])
  await git.push()

  // SSH into server
  info('Logging into server...')
  await ssh.connect({
    host: serverConfig.ip,
    username: serverConfig.username,
    privateKeyPath: serverConfig.privateKeyPath
  })

  // Execute git pull on server
  info('Deploying...')
  await ssh.execCommand('git pull', { cwd: serverConfig.projectPath })

  // Perform necessary actions based on changed files
  if (composerJsonChanges) {
    info('Composer modifications detected. Executing relevant scripts...')

    await ssh.execCommand('composer update', { cwd: serverConfig.projectPath })
  }

  if (phpChanges) {
    info('PHP modifications detected. Executing relevant scripts...')

    await ssh.execCommand(
      'php artisan view:clear && php artisan config:clear && php artisan horizon:terminate',
      { cwd: serverConfig.projectPath }
    )
  }

  if (packageJsonChanges) {
    info(
      'Node dependencies modifications detected. Executing relevant scripts...'
    )

    await ssh.execCommand('npm i', {
      cwd: serverConfig.projectPath
    })
  }

  if (npmBuildExecuted) {
    info(
      'Front-end assets modifications detected. Executing relevant scripts...'
    )

    await ssh.execCommand('npm run build', {
      cwd: serverConfig.projectPath
    })
  }

  // Close SSH connection and notify the user
  ssh.dispose()

  await git.checkout(sshConfig.mergeBranch)

  success('Deployment completed.')
}

main()

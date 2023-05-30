import yargs from 'yargs'
import fs from 'fs'
import prompts from './prompts.mjs'
import { error, info } from './logging.mjs'
import { git } from './git.mjs'
import path from 'path'
import * as os from 'os'

const projectDir = process.cwd()

const configFile = 'ssh-config.json'

const argv = yargs(process.argv.slice(2)).options({
  server: {
    type: 'string',
    description: 'Server label to skip server label prompt',
    alias: 's'
  }
}).argv

export async function getPrivateKeyPaths() {
  let sshDir
  if (os.platform() === 'win32') {
    sshDir = path.join(os.homedir(), '.ssh')
  } else {
    sshDir = path.join(os.homedir(), '.ssh')
  }

  try {
    const files = await fs.promises.readdir(sshDir)

    return files
      .filter((file) => file.includes('id_rsa'))
      .filter(
        (file) =>
          file.endsWith('.pem') ||
          file.endsWith('.key') ||
          file.indexOf('.') === -1
      )
      .map((file) => path.join(sshDir, file))
  } catch (err) {
    console.error('Error reading SSH directory:', err.message)
    return []
  }
}

export async function loadConfig() {
  let sshConfig = {}

  if (fs.existsSync(configFile)) {
    sshConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'))
  }

  let serverLabel = argv.server

  if (!serverLabel) {
    if (Object.keys(sshConfig).length) {
      const serverLabelPrompt = {
        type: 'autocomplete',
        name: 'serverLabel',
        message: 'Select the server or type manually:',
        choices: Object.keys(sshConfig).map((label) => ({
          title: label,
          value: label
        }))
      }

      const response = await prompts(serverLabelPrompt)

      serverLabel = response.serverLabel
    }

    if (serverLabel === undefined) {
      const manualInputPrompt = {
        type: 'text',
        name: 'manualInput',
        message: 'Enter the server label manually:'
      }
      const manualResponse = await prompts(manualInputPrompt)

      serverLabel = manualResponse.manualInput
    }
  }

  if (!sshConfig[serverLabel]) {
    error(
      `The server configuration '${serverLabel}' does not exist. Generating the config...`
    )
    // Fetch list of branches
    const branches = await git.branch()

    const choices = branches.all
      .map((branch) => ({
        title: branch,
        value: branch
      }))
      .filter((branch) => !branch.includes('remotes'))

    // Prompt user for branches to release and merge
    const { releaseBranch } = await prompts({
      type: 'select',
      name: 'releaseBranch',
      message: 'Select the branch to release:',
      choices
    })

    // const filteredChoices = choices.filter(
    //   (branch) => branch.value !== releaseBranch
    // )

    const { mergeBranch } = await prompts({
      type: 'select',
      name: 'mergeBranch',
      message: 'Select the branch to merge from:',
      choices
    })

    const privateKeyPaths = await getPrivateKeyPaths()

    console.log('keys', privateKeyPaths)

    const serverDetails = await prompts([
      {
        type: 'text',
        name: 'ip',
        message: 'Enter the IP of the server:'
      },
      {
        type: 'autocomplete',
        name: 'privateKeyPath',
        message: 'Select the path to the private key on your local machine:',
        choices: privateKeyPaths
          .map((path) => ({ title: path, value: path }))
          .concat({
            title: 'Type manually',
            value: null
          }),
        suggest: (input, choices) =>
          Promise.resolve(
            choices
              .filter((choice) =>
                choice.title.toLowerCase().includes(input.toLowerCase())
              )
              .concat({
                title: `Type manually: ${input}`,
                value: input
              })
          )
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

    fs.writeFileSync(
      configFile,
      JSON.stringify(sshConfig, null, 2).replace(/\n/g, os.EOL)
    )
  }

  // Add shortcut to release to an environment
  const serverLabels = Object.keys(sshConfig)

  const packageJsonPath = './package.json'
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString())

  const missingScripts = serverLabels.filter(
    (label) => !packageJson.scripts[`release:${label}`]
  )

  if (missingScripts.length) {
    missingScripts.forEach((label) => {
      const scriptKey = `release:${label}`
      if (!packageJson.scripts[scriptKey]) {
        packageJson.scripts[scriptKey] = `npm run release -- --server=${label}`
      }
    })

    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2).replace(/\n/g, os.EOL)
    )

    await git.commit('fix: scripts updated', '.')

    await git.push()
  }

  return sshConfig[serverLabel]
}

export function excludeConfig() {
  const gitignoreFile = path.join(projectDir, '.gitignore')

  const gitignoreContent = fs.readFileSync(gitignoreFile, 'utf-8')

  if (!gitignoreContent.includes(configFile)) {
    info('Excluding ssh-config.json from repo...')
    fs.appendFileSync(gitignoreFile, `\n${configFile}\n`)
  }
}

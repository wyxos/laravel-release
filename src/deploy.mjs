import { error, info } from './logging.js'
import path from 'path'
import fs from 'fs'
import prompts from './prompts'
import { execSync } from 'child_process'
import { git } from './git.mjs'
import { NodeSSH } from 'node-ssh'
import * as os from 'os'

const projectDir = process.cwd()

export async function deploy({ serverConfig, changes }) {
  const ssh = new NodeSSH()

  // SSH into server
  info('Logging into server...')
  const sshConfig = {
    host: serverConfig.ip,
    username: serverConfig.username,
    privateKeyPath: serverConfig.privateKeyPath
  }

  await ssh.connect(sshConfig)

  const options = {
    cwd: serverConfig.projectPath,
    onStdout(chunk) {
      info(chunk.toString('utf8'))
    },
    onStderr(chunk) {
      error(chunk.toString('utf8'))
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
      options
    )
  }

  if (changes.database) {
    info('Database changes have been detected')

    const { action } = await prompts({
      type: 'select',
      name: 'action',
      message: 'Confirm which action to run following the database changes:',
      choices: [
        { title: 'php artisan migrate', value: 'migrate' },
        {
          title: 'php artisan migrate:fresh -f',
          value: 'php artisan migrate:fresh -f'
        },
        {
          title: 'php artisan migrate:fresh --seed -f',
          value: 'php artisan migrate:fresh --seed -f'
        }
      ]
    })

    const handlers = {
      migrate: () => 'php artisan migrate -f',
      'migrate-refresh': () => 'php artisan migrate:fresh -f',
      'migrate-fresh-seed': () => 'php artisan migrate:fresh --seed -f'
    }

    if (handlers[action]) {
      const { proceed } = await prompts({
        name: 'proceed',
        message: `Are you sure you want to proceed with ${handlers[action]}`,
        type: 'confirm'
      })

      if (proceed) {
        await ssh.execCommand(handlers[action], options)
      }
    }
  }

  const folderCheck = await ssh.execCommand(
    `test -d ${serverConfig.projectPath}/node_modules && echo 'exists' || echo 'not exists'`
  )

  const nodeModulesExists = folderCheck.stdout.trim() === 'exists'

  if (changes.packageJson || !nodeModulesExists) {
    info('Installing node module dependencies...')

    await ssh.execCommand('npm i', options)
  }

  if (changes.build || !nodeModulesExists) {
    info('Building front-end assets...')

    await ssh.execCommand('npm run build', options)
  }

  // Close SSH connection and notify the user
  ssh.dispose()
}

export async function build(changes) {
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

    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2).replace(/\n/g, os.EOL)
    )

    await git.add('.')

    const buildStatus = await git.status()

    if (buildStatus.modified.length) {
      await git.commit(`feat: release v${newVersion}`, '.')

      await git.push()
    }

    changes.build = true
  }
}

export async function lint(modifiedFiles, changes) {
  if (modifiedFiles.length) {
    info('Initiating lint process...')

    if (changes.frontEnd) {
      execSync(
        'eslint --fix ' +
          modifiedFiles
            .filter((file) => /\.(js|vue|json)$/.test(file))
            .join(' '),
        {
          stdio: 'inherit'
        }
      )

      execSync(
        'prettier --write ' +
          modifiedFiles
            .filter((file) => /\.(js|vue|json|html)$/.test(file))
            .join(' '),
        {
          stdio: 'inherit'
        }
      )
    }

    if (changes.php) {
      execSync(
        'prettier --config .prettierrc.php.json --write ' +
          modifiedFiles.filter((file) => /\.(php)$/.test(file)).join(' '),
        {
          stdio: 'inherit'
        }
      )
    }

    await git.add('.')

    const status = await git.status()

    if (status.modified.length > 0) {
      info('Changes found after linting. Generating a commit...')

      await git.commit('fix: code lint', '.')

      await git.push()
    }
  }
}

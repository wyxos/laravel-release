import { error, info, success } from './logging.mjs'
import path from 'path'
import fs from 'fs'
import prompts from './prompts.mjs'
import { execSync } from 'child_process'
import { git } from './git.mjs'
import { NodeSSH } from 'node-ssh'
import * as os from 'os'

function parseGitDiff(diffOutput) {
  const changes = {
    php: [],
    ui: [],
    database: [],
    composer: false,
    packageJson: false
  }

  const lines = diffOutput.split('\n')

  for (const line of lines) {
    if (!line.includes('\t')) {
      continue
    }

    const [status, path] = line.split('\t')

    if (status === 'D') continue // Skip deleted files

    if (path.endsWith('.php')) {
      changes.php.push(path)
    }

    if (
      path.endsWith('.vue') ||
      path.endsWith('.js') ||
      path.endsWith('.json') ||
      path.endsWith('.css') ||
      path.endsWith('.scss')
    ) {
      if (path.startsWith('resources') || path.startsWith('ui')) {
        changes.ui.push(path)
      }
    }

    if (path.startsWith('database')) {
      changes.database.push(path)
    }

    if (path.startsWith('composer.json')) {
      changes.composer = true
    }

    if (path.startsWith('package.json')) {
      changes.packageJson = true
    }
  }

  return changes
}

const projectDir = process.cwd()

export async function deploy({ serverConfig }) {
  const ssh = new NodeSSH()

  // SSH into server
  info('Logging into server...')
  const sshConfig = {
    host: serverConfig.ip,
    username: serverConfig.username,
    privateKeyPath: serverConfig.privateKeyPath
  }

  const options = {
    cwd: serverConfig.projectPath,
    onStdout(chunk) {
      info(chunk.toString('utf8'))
    },
    onStderr(chunk) {
      error(chunk.toString('utf8'))
    }
  }

  await ssh.connect(sshConfig)

  await ssh.execCommand(
    `git fetch origin ${serverConfig.releaseBranch}`,
    options
  )

  // Determine the changes between the current and latest states of the branch
  const diffResult = await ssh.execCommand(
    `git diff --name-status origin/${serverConfig.releaseBranch}`,
    options
  )

  // Parse the output of the git diff command into a changes object
  const changes = parseGitDiff(diffResult.stdout)

  console.log('changes detected', changes)

  // Execute git pull on server
  info('Initiating deployment process...')

  if (changes.php.length) {
    info('Applying maintenance mode...')

    await ssh.execCommand('php artisan down', options)

    success('App offline.')
  }

  await ssh.execCommand('git pull', options)

  // Perform necessary actions based on changed files
  const vendorFolderCheck = await ssh.execCommand(
    `test -d ${serverConfig.projectPath}/vendor && echo 'exists' || echo 'not exists'`
  )

  const vendorExists = vendorFolderCheck.stdout.trim() === 'exists'

  if (changes.composer || !vendorExists) {
    info('Composer modifications detected. Executing relevant scripts...')

    await ssh.execCommand('composer update --no-dev', options)
  }

  if (changes.php.length) {
    info('PHP modifications detected. Executing relevant scripts...')

    await ssh.execCommand(
      'php artisan view:clear && php artisan config:clear && php artisan horizon:terminate',
      options
    )
  }

  if (changes.database.length) {
    info('Database changes have been detected')

    const { action } = await prompts({
      type: 'select',
      name: 'action',
      message: 'Confirm which action to run following the database changes:',
      choices: [
        { title: 'skip', value: 'skip' },
        { title: 'php artisan migrate --force', value: 'migrate' },
        {
          title: 'php artisan migrate:fresh --force',
          value: 'migrate-refresh'
        },
        {
          title: 'php artisan migrate:fresh --seed --force',
          value: 'migrate-fresh-seed'
        }
      ]
    })

    const handlers = {
      skip: null,
      migrate: () => 'php artisan migrate --force',
      'migrate-refresh': () => 'php artisan migrate:fresh --force',
      'migrate-fresh-seed': () => 'php artisan migrate:fresh --seed --force'
    }

    if (handlers[action]) {
      const { proceed } = await prompts({
        name: 'proceed',
        message: `Are you sure you want to proceed with ${handlers[
          action
        ]()}? (You better know what you're doing)`,
        type: 'confirm'
      })

      if (proceed) {
        await ssh.execCommand(handlers[action](), options)
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

  if (changes.ui.length && nodeModulesExists) {
    info('Building front-end assets...')

    await ssh.execCommand('npm run build', options)
  }

  if (changes.php.length) {
    info('Restoring app from maintenance mode...')

    await ssh.execCommand('php artisan up', options)

    success('App online.')
  }

  // Close SSH connection and notify the user
  ssh.dispose()

  success('SSH session closed.')
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
      execSync('eslint --fix "**/*.{js,vue,json}"', {
        stdio: 'inherit'
      })

      execSync('prettier --write "**/*.{js,vue,json,html}"', {
        stdio: 'inherit'
      })
      // execSync(
      //   'eslint --fix ' +
      //     modifiedFiles
      //       .filter((file) => /\.(js|vue|json)$/.test(file))
      //       .join(' '),
      //   {
      //     stdio: 'inherit'
      //   }
      // )
      //
      // execSync(
      //   'prettier --write ' +
      //     modifiedFiles
      //       .filter((file) => /\.(js|vue|json|html)$/.test(file))
      //       .join(' '),
      //   {
      //     stdio: 'inherit'
      //   }
      // )
    }

    if (changes.php) {
      const phpFiles = modifiedFiles
        .filter((file) => /\.(php)$/.test(file))
        .join(' ')

      info('linting php files ' + phpFiles)

      if (phpFiles.length) {
        execSync(
          'prettier --config .prettierrc.php.json **/*.php --write --ignore-unknown',
          {
            stdio: 'inherit'
          }
        )
        // execSync('prettier --config .prettierrc.php.json --write ' + phpFiles, {
        //   stdio: 'inherit'
        // })
      }
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

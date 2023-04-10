import simpleGit from 'simple-git'
import { info } from './logging.js'
import prompts from 'prompts'

const projectDir = process.cwd()
export const git = simpleGit(projectDir)

export async function checkModifiedFiles() {
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
      message: 'Add the file(s) to the repo?:'
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

export async function merge(serverConfig) {
  await git.checkout(serverConfig.releaseBranch)
  await git.pull()
  await git.merge([serverConfig.mergeBranch])
  await git.push()
}

export async function syncWithRemote(serverConfig) {
  await git.fetch()

  const localCommit = await git.revparse([serverConfig.mergeBranch])
  const remoteCommit = await git.revparse([
    `origin/${serverConfig.mergeBranch}`
  ])

  const filesToPush = localCommit !== remoteCommit

  if (filesToPush) {
    info(`Updating origin/${serverConfig.mergeBranch}...`)
    await git.push()
  }
}

export async function checkForChanges(serverConfig) {
  // Perform git comparison and determine modified files
  const diffSummary = await git.diffSummary([
    serverConfig.releaseBranch,
    serverConfig.mergeBranch
  ])

  const modifiedFiles = diffSummary.files.map((file) => file.file)

  return {
    modifiedFiles,
    changes: {
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
}

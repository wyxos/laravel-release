import { simpleGit } from 'simple-git'
import { info } from './logging.mjs'
import prompts from './prompts.mjs'

process.on('SIGINT', () => {
  console.log('\nAborting...')
  process.exit()
})

const projectDir = process.cwd()
export const git = simpleGit(projectDir)

export async function checkModifiedFiles() {
  let status = await git.status()

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

  await git.add('.')

  status = await git.status()

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
  info(`Switching to ${serverConfig.releaseBranch}...`)

  await git.checkout(serverConfig.releaseBranch, ['-f'])
  await git.pull()

  info(
    `Merging changes from ${serverConfig.mergeBranch} into ${serverConfig.releaseBranch}...`
  )

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

  const modifiedAndNonDeletedFiles = diffSummary.files
    .filter((file) => !(file.deletions === file.changes)) // Exclude deleted files
    .map((file) => file.file)

  return {
    modifiedFiles,
    filesToLint: modifiedAndNonDeletedFiles,
    changes: {
      php: modifiedFiles.some((file) =>
        /^(app|config|database|routes|views)\/.+\.php$/.test(file)
      ),
      database: modifiedAndNonDeletedFiles.some((file) =>
        /^database\/.+\.php$/.test(file)
      ),
      composer: modifiedFiles.includes('composer.json'),
      packageJson: modifiedFiles.includes('package.json'),
      frontEnd: modifiedFiles.some((file) =>
        /^resources\/.+(\.js|\.vue|\.json)$/.test(file)
      )
    }
  }
}

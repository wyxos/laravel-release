#!/usr/bin/env node
import { info, success } from './src/logging.mjs'
import {
  checkForChanges,
  checkModifiedFiles,
  git,
  merge,
  syncWithRemote
} from './src/git.mjs'
import { build, deploy, lint } from './src/deploy.mjs'
import { excludeConfig, loadConfig } from './src/config.mjs'

async function main() {
  excludeConfig()

  // Check for uncommitted changes
  await checkModifiedFiles()

  // Load or create SSH config
  const serverConfig = await loadConfig()

  // Checkout and update the branch to be merged from
  await git.checkout(serverConfig.mergeBranch)
  await git.pull()

  // Check for changes in specific folders and files
  const { filesToLint, changes } = await checkForChanges(serverConfig)

  // Run npm lint and commit if needed
  await lint(filesToLint, changes)

  // Check for changes in JavaScript, Vue, or JSON files
  await build(changes)

  // Fetch the latest changes from the remote repository
  await syncWithRemote(serverConfig)

  // Perform git checkout, pull, and merge
  await merge(serverConfig)

  // Run relevant scripts on the server
  await deploy({
    serverConfig,
    changes
  })

  info('Restoring branch...')
  await git.checkout(serverConfig.mergeBranch)

  success('Deployment completed.')
}

main()

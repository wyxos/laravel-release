Here is a `README.md` file describing the `index.mjs` script for deployment:

---

# Laravel Release & Deployment Script

This repository contains the `index.mjs` script, which helps automate the process of releasing and deploying a Laravel application. This script checks for uncommitted changes, prompts the user for necessary information, merges branches, and deploys the application to the server.

## Features

- Check for uncommitted changes and untracked files, prompting the user to commit and add them if necessary.
- Fetch available branches and prompt the user for the branch to release and the branch to merge from.
- Compare branches and determine if specific file types have been modified (PHP, JS, Vue, JSON).
- Run code linting and automatically commit any changes.
- Increment package version, build assets, and commit if necessary.
- Perform a git checkout, pull, and merge operation.
- Allow the user to deploy the application to the server using an SSH configuration stored in a JSON file.
- Execute server-side commands, such as `git pull`, `composer update`, `npm run build`, and various Laravel artisan commands.

## Usage

To use this script, make sure you have Node.js installed on your system. Then, run the following command:

```bash
npx run wyxos/laravel-release
```

The script will guide you through the process, prompting you for the necessary information as needed.

## Prerequisites

- Node.js (v14+ recommended)
- An SSH key and corresponding server access configuration

## Disclaimer

Please use this script at your own risk. We recommend testing the script in a safe environment before using it on production systems. Always create backups of your data and verify server configurations before using this script.

---
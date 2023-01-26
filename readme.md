A script to perform the following tasks on a typical laravel project
- lint
- build assets (when javascript/css modifications have been modified)
- merge changes from current repo to specified repo
- update package.json version
- ssh on server
- git pull target repo
- run composer update (when composer.json has been modified)
- run php artisan migrate --force (when database/migrations has been modified)
- run npm install (when package.json has been modified)
- run npm run build (when javascript/css files have been modified)

This script runs in conjunction with <a href="https://github.com/wyxos/laravel-setup">wyxos/laravel-setup</a> which prepares the necessary scaffold

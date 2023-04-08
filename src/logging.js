import chalk from 'chalk'

function logger(color, message) {
  console.log(chalk[color](...message))
}

export function info(...message) {
  logger('yellow', message)
}

export function success(...message) {
  logger('green', message)
}

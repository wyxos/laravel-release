import prompts from 'prompts'

process.on('SIGINT', () => {
  console.log('\nAborting...')
  process.exit()
})
export default (command, options) =>
  prompts(command, {
    onCancel: () => {
      console.log('User canceled the prompt. Exiting...')
      process.exit()
      return false
    },
    ...options
  })

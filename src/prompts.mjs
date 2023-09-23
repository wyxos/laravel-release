import prompts from 'prompts'

export default (command, options) =>
  prompts(command, {
    onCancel: () => {
      console.log('User canceled the prompt. Exiting...')
      process.exit()
      return false
    },
    ...options
  })

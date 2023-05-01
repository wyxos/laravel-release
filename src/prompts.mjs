import prompts from 'prompts'

export default (command, options) =>
  prompts(command, {
    onCancel: () => false,
    ...options
  })

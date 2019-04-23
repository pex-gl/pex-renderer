const path = require('path')
const glob = require('glob')

// Mock webpack require.context
if (!require.context) require.context = () => ({ keys: () => false })

const examples =
  require.context('../', false, /.js$/).keys() ||
  glob
    .sync('*.js', {
      cwd: path.resolve(__dirname, '../')
    })
    .map(example => `./${example}`)

module.exports = examples
  .filter(example => !['./helpers.js'].includes(example))
  .map(example => path.basename(example, path.extname(example)))

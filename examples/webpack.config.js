const path = require('path')

module.exports = {
  entry: './index.js',
  output: {
    filename: 'build/[name].js',
    path: path.join(__dirname, './')
  },
  externals: ['puppeteer', 'request'],
  node: { fs: 'empty' }
}

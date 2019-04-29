const path = require('path')

module.exports = {
  entry: './scripts/index.js',
  output: {
    filename: 'build/[name].js',
    path: path.join(__dirname, '../')
  },
  plugins: [
  ],
  externals: ['puppeteer', 'request'],
  node: { fs: 'empty' }
}

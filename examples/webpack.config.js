const webpack = require('webpack')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')

module.exports = {
  entry: './index.js',
  output: {
    filename: 'build/[name].js',
    path: __dirname
  },
  resolve: {
    fallback: {
      fs: false,
      child_process: false,
      worker_threads: false,
      net: false,
      tls: false,
      ws: false
    }
  },
  devServer: { static: { directory: __dirname }, open: true },
  plugins: [
    new NodePolyfillPlugin(),
    new webpack.ProvidePlugin({
      process: require.resolve('process/browser')
    })
  ]
}

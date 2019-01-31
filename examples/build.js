require('./examples.js')

const browserify = require('browserify')
const fs = require('fs')

const b = browserify(global.EXAMPLES.map(example => `${example}.js`))
b.plugin('factor-bundle', {
  outputs: global.EXAMPLES.map(example => `${example}.bundle.js`)
})
b.bundle().pipe(fs.createWriteStream('common.js'))

var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/ScreenImage.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/ScreenImage.frag', 'utf8')

function ScreenImage (regl) {
  this.attributes = {
    aPosition: regl.buffer([[-1, -1], [1, -1], [1, 1], [-1, 1]]),
    aTexCoord0: regl.buffer([[ 0, 0], [1, 0], [1, 1], [ 0, 1]])
  }
  this.elements = regl.elements([[0, 1, 2], [0, 2, 3]])
  this.program = {
    vert: VERT,
    frag: FRAG
  }
}

module.exports = ScreenImage

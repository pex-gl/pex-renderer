var fs = require('fs')

var SKYBOX_VERT = fs.readFileSync(__dirname + '/glsl/Skybox.vert', 'utf8')
var SKYBOX_FRAG = fs.readFileSync(__dirname + '/glsl/Skybox.frag', 'utf8')

function Skybox (regl, envMap) {
  this._regl = regl
  var skyboxPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  var skyboxFaces = [ [0, 1, 2], [0, 2, 3]]

  this._envMap = envMap

  this._drawCommand = regl({
    vert: SKYBOX_VERT,
    frag: SKYBOX_FRAG,
    uniforms: {
      uEnvMap: regl.prop('envMap'),
      uFlipEnvMap: regl.prop('flipEnvMap'),
      uProjectionMatrix: regl.context('projectionMatrix'),
      uViewMatrix: regl.context('viewMatrix')
    },
    attributes: {
      aPosition: regl.buffer({
        size: 2,
        data: skyboxPositions
      })
    },
    elements: skyboxFaces,
    depth: {
      enable: false
    }
  })
}

Skybox.prototype.setEnvMap = function (envMap) {
  this._envMap = envMap
}

Skybox.prototype.draw = function () {
  this._drawCommand({
    envMap: this._envMap,
    flipEnvMap: -1 // TODO: this._envMap.getFlipEnvMap ? this._envMap.getFlipEnvMap() : -1
  })
}

module.exports = Skybox

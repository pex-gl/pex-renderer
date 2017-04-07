const glsl = require('glslify')

const SKYBOX_VERT = glsl(__dirname + '/glsl/Skybox.vert')
const SKYBOX_FRAG = glsl(__dirname + '/glsl/Skybox.frag')

function Skybox (ctx, envMap) {
  this._ctx = ctx
  var skyboxPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  var skyboxFaces = [ [0, 1, 2], [0, 2, 3]]

  this._envMap = envMap

  this._drawCommand = {
    name: 'draw skybox',
    pipeline: ctx.pipeline({
      vert: SKYBOX_VERT,
      frag: SKYBOX_FRAG,
      depthEnabled: true
    }),
    uniforms: {
      uEnvMap: this._envMap,
      uFlipEnvMap: this._envMap.getFlipEnvMap ? this._envMap.getFlipEnvMap() : -1
    },
    attributes: {
      aPosition: ctx.vertexBuffer(skyboxPositions)
    },
    indices: ctx.indexBuffer(skyboxFaces)
  }
}

Skybox.prototype.setEnvMap = function (envMap) {
  this._envMap = envMap
}

Skybox.prototype.draw = function (camera) {
  var ctx = this._ctx

  // TODO: can we somehow avoid creating an object every frame here?
  ctx.submit(this._drawCommand, {
    uniforms: {
      uProjectionMatrix: camera.projectionMatrix,
      uViewMatrix: camera.viewMatrix,
      uEnvMap: this._envMap,
      //TODO:  uFlipEnvMap: this._envMap.getFlipEnvMap ? this._envMap.getFlipEnvMap() : -1
      uFlipEnvMap: 1
    }
  })
}

module.exports = Skybox

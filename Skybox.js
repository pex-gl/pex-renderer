var fs = require('fs')

var SKYBOX_VERT = fs.readFileSync(__dirname + '/glsl/Skybox.vert', 'utf8')
var SKYBOX_FRAG = fs.readFileSync(__dirname + '/glsl/Skybox.frag', 'utf8')

function Skybox (cmdQueue, envMap) {
  this._cmdQueue = cmdQueue
  var ctx = cmdQueue.getContext()
  var skyboxPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  var skyboxFaces = [ [0, 1, 2], [0, 2, 3]]
  var skyboxAttributes = [
    { data: skyboxPositions, location: ctx.ATTRIB_POSITION }
  ]
  var skyboxIndices = { data: skyboxFaces }
  this._fsqMesh = ctx.createMesh(skyboxAttributes, skyboxIndices)

  this._skyboxProgram = ctx.createProgram(SKYBOX_VERT, SKYBOX_FRAG)

  this._envMap = envMap

  this._drawCommand = cmdQueue.createDrawCommand({
    depthTest: false,
    program: this._skyboxProgram,
    mesh: this._fsqMesh,
    textures: {
      '0': this._envMap 
    },
    uniforms: {
      uEnvMap: 0,
      uFlipEnvMap: this._envMap.getFlipEnvMap ? this._envMap.getFlipEnvMap() : -1
    }
  })
  this._drawCommand._type = 'draw skybox'
}

Skybox.prototype.setEnvMap = function (envMap) {
  this._envMap = envMap
}

Skybox.prototype.draw = function () {
  var cmdQueue = this._cmdQueue

  // TODO: can we somehow avoid creating an object every frame here?
  cmdQueue.submit(this._drawCommand, {
    textures: {
      '0': this._envMap
    },
    uniforms: {
      uEnvMap: 0,
      uFlipEnvMap: this._envMap.getFlipEnvMap ? this._envMap.getFlipEnvMap() : -1
    }
  })
}

module.exports = Skybox

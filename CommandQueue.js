function CommandQueue (ctx) {
  this._ctx = ctx
  this._commands = []
  this._prevUniforms = {}
  this._prevProgram = null
  this._prevTextures = []

  this.debug = false
  this.profile = false
}

var ID = 0

var updatedUniforms = 0
var createdCommands = 0

CommandQueue.prototype.getContext = function () {
  return this._ctx
}

// currenlty this doesn't do anything but in the future it can provide:
// - defaults
// - validation
CommandQueue.prototype.createDrawCommand = function (obj) {
  createdCommands++
  obj._type = 'draw'
  obj._id = ID++
  return obj
}

CommandQueue.prototype.createClearCommand = function (obj) {
  createdCommands++
  obj._type = 'clear'
  obj._id = ID++
  return obj
}

CommandQueue.prototype.createTextureUpdateCommand = function (obj) {
}

CommandQueue.prototype.createVertexArrayUpdateCommand = function (obj) {
}

function applyUniforms (ctx, program, uniforms, prevUniforms, prevTextures, debug) {
  if (debug) {
    // verify if we provide all uniforms required by the shader
    for (var requiredUniform in program._uniforms) {
      if (requiredUniform === 'uProjectionMatrix') continue
      if (requiredUniform === 'uViewMatrix') continue
      if (requiredUniform === 'uInverseViewMatrix') continue
      if (requiredUniform === 'uModelMatrix') continue
      if (requiredUniform === 'uNormalMatrix') continue
      if (uniforms[requiredUniform] === undefined) {
        console.log('missing uniform', requiredUniform)
      }
    }
  }

  var textureOffset = 0
  // console.log(Object.keys(uniforms).length)
  for (var uniformName in uniforms) {
    // TODO: can i do array index check instead of function call?
    // if (debug) console.log('  setUniform', uniformName, '' + uniforms[uniformName])
    // if (!program.hasUniform(uniformName)) {
    if (!program._uniforms[uniformName]) {
      // console.log('Unnecessary uniform', uniformName)
      continue
    }
    var value = uniforms[uniformName]
    if (debug) {
      if (value === null || value === undefined) {
        if (program._uniforms[uniformName]) {
          throw new Error('Null uniform value for ' + uniformName + ' in PBRMaterial')
        } else {
          // console.log('Unnecessary uniform', uniformName)
          continue
        }
      }
    }
    // if (value.getTarget && (value.getTarget() === ctx.TEXTURE_2D || value.getTarget() === ctx.TEXTURE_CUBE_MAP)) {
    if (value.getTarget) {
      if (prevTextures[textureOffset] !== value) {
        ctx.bindTexture(value, textureOffset)
        prevTextures[textureOffset] = value
      }
      value = textureOffset++
    }
    var shouldUpdate = false
    if (!prevUniforms) {
      shouldUpdate = true
    } else {
      var prevValue = prevUniforms[uniformName]
      if (!prevValue) {
        shouldUpdate = true
      } else if (value !== prevValue) {
        shouldUpdate = true
      } else {
        if (Array.isArray(value)) {
          shouldUpdate = true
          // for (var i = 0; i < value.length; i++) {
            // if (value[i] !== prevValue[i]) {
              // shouldUpdate = true
              // break
            // }
          // }
        }
      }
    }
    if (shouldUpdate) {
      program.setUniform(uniformName, value)
      updatedUniforms++
    }
  }
  return textureOffset
}

// cmd - a command to submit to the queue, the immediate execution is not guaranteed and will
// depend on the curren optimization strategy
// opts - submit call specific command overrides Object or Array of Objects
// subContextCallback - all submit calls within this callback will
// inherit defaults from the currently executing cmd
CommandQueue.prototype.submit = function (cmd, opts, subCommanDraw) {
  this._commands.push([cmd, opts, subCommanDraw])
  // if (this.debug) console.log('submit', cmd._type, cmd._id)

  if (!cmd._type) {
    if (this.debug) console.log(cmd.toString())
    throw new Error('Unknown cmd type')
  }
  if (opts) {
    // TODO: optimize this
    cmd = Object.assign({}, cmd, opts)
    if (cmd.uniforms && opts.uniforms) {
      cmd.uniforms = Object.assign({}, cmd.uniforms, opts.uniforms)
    }
  }

  var pushedStates = 0

  var ctx = this._ctx
  if (cmd.framebuffer) {
    ctx.pushState(ctx.FRAMEBUFFER_BIT)
    ctx.bindFramebuffer(cmd.framebuffer)
    pushedStates++
    if (cmd.framebufferColorAttachments) {
      // FIXME: this modifies the framebuffer permamently after the call
      for (var attachmentIndex in cmd.framebufferColorAttachments) {
        var colorAttachment = cmd.framebufferColorAttachments[attachmentIndex]
        var index = parseInt(attachmentIndex, 10)
        cmd.framebuffer.setColorAttachment(index, colorAttachment.target, colorAttachment.handle, colorAttachment.level)
      }
    }
    if (cmd.framebufferDepthAttachment) {
      // FIXME: this modifies the framebuffer permamently after the call
      var depthAttachment = cmd.framebufferDepthAttachment
      cmd.framebuffer.setDepthAttachment(depthAttachment.target, depthAttachment.handle, depthAttachment.level)
    }
  }

  var clearFlags = 0
  if (cmd.color !== undefined) {
    ctx.pushState(ctx.COLOR_BIT)
    pushedStates++
    ctx.setClearColor(cmd.color[0], cmd.color[1], cmd.color[2], cmd.color[3])
    clearFlags |= ctx.COLOR_BIT
  }
  if (cmd.depth !== undefined) {
    ctx.pushState(ctx.DEPTH_BIT)
    pushedStates++
    ctx.setClearDepth(cmd.depth)
    clearFlags |= ctx.DEPTH_BIT
  }
  if (clearFlags) {
    ctx.clear(clearFlags)
  }

  if (cmd.program !== undefined) {
    if (this._prevProgram !== cmd.program) {
      ctx.bindProgram(cmd.program)
      this._prevProgram = cmd.program
      this._prevUniforms = null
    }
  }

  if (cmd.uniforms !== undefined) {
    applyUniforms(ctx, cmd.program, cmd.uniforms, this._prevUniforms, this._prevTextures, this.debug)
    this._prevUniforms = cmd.uniforms
  }

  if (cmd.projectionMatrix !== undefined) {
    ctx.pushState(ctx.MATRIX_PROJECTION_BIT)
    pushedStates++
    ctx.setProjectionMatrix(cmd.projectionMatrix)
  }

  if (cmd.viewMatrix !== undefined) {
    ctx.pushState(ctx.MATRIX_VIEW_BIT)
    pushedStates++
    ctx.setViewMatrix(cmd.viewMatrix)
  }

  if (cmd.modelMatrix !== undefined) {
    ctx.pushState(ctx.MATRIX_MODEL_BIT)
    pushedStates++
    ctx.setModelMatrix(cmd.modelMatrix)
  }

  if (cmd.viewport !== undefined) {
    ctx.pushState(ctx.VIEWPORT_BIT)
    pushedStates++
    ctx.setViewport(cmd.viewport[0], cmd.viewport[1], cmd.viewport[2], cmd.viewport[3])
  }

  if (cmd.depthTest !== undefined) {
    ctx.pushState(ctx.DEPTH_BIT)
    pushedStates++
    ctx.setDepthTest(cmd.depthTest)
  }

  if (cmd.cullFace !== undefined) {
    ctx.pushState(ctx.CULL_BIT)
    pushedStates++
    ctx.setCullFace(cmd.cullFace)
  }

  if (cmd.cullFaceMode !== undefined) {
    ctx.pushState(ctx.CULL_BIT)
    pushedStates++
    ctx.setCullFaceMode(cmd.cullFaceMode)
  }

  if (cmd.colorMask !== undefined) {
    ctx.pushState(ctx.COLOR_BIT)
    pushedStates++
    ctx.setColorMask(cmd.colorMask[0], cmd.colorMask[1], cmd.colorMask[2], cmd.colorMask[3])
  }

  if (cmd.mesh) {
    ctx.bindMesh(cmd.mesh)
    ctx.drawMesh()
  }

  if (subCommanDraw) {
    subCommanDraw()
  }

  // if (this.debug) console.log(' ', 'pushedStates', pushedStates)
  for (var i = 0; i < pushedStates; i++) {
    ctx.popState()
  }
}

// force execute of all commands in the queue
CommandQueue.prototype.flush = function () {
  if (this.profile) {
    console.log('CommandQueue', 'numCommands', this._commands.length, 'updatedUniforms', updatedUniforms, 'createdCommands', createdCommands)
  }
  this._prevProgram = null
  this._prevUniforms = null
  this._prevTextures.length = 0
  this._commands.length = 0
  updatedUniforms = 0
  createdCommands = 0
}

module.exports = CommandQueue

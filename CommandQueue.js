function CommandQueue (ctx) {
  this._ctx = ctx
  this._commands = []
}

var ID = 0

CommandQueue.prototype.getContext = function () {
  return this._ctx
}

// currenlty this doesn't do anything but in the future it can provide:
// - defaults
// - validation
CommandQueue.prototype.createDrawCommand = function (obj) {
  obj._type = 'draw'
  obj._id = ID++
  return obj
}

CommandQueue.prototype.createClearCommand = function (obj) {
  obj._type = 'clear'
  obj._id = ID++
  return obj
}

CommandQueue.prototype.createTextureUpdateCommand = function (obj) {
}

CommandQueue.prototype.createVertexArrayUpdateCommand = function (obj) {
}

function applyUniforms (ctx, program, uniforms, textureOffset, debug) {
  var numTextures = textureOffset
  for (var uniformName in uniforms) {
    // TODO: can i do array index check instead of function call?
    if (debug) console.log('  setUniform', uniformName, uniforms[uniformName])
    if (!program.hasUniform(uniformName)) {
      // console.log('Unnecessary uniform', uniformName)
      continue
    }
    var value = uniforms[uniformName]
    if (value === null || value === undefined) {
      if (program._uniforms[uniformName]) {
        throw new Error('Null uniform value for ' + uniformName + ' in PBRMaterial')
      } else {
        // console.log('Unnecessary uniform', uniformName)
        continue
      }
    }
    if (value.getTarget && (value.getTarget() === ctx.TEXTURE_2D || value.getTarget() === ctx.TEXTURE_CUBE_MAP)) {
      ctx.bindTexture(value, numTextures)
      value = numTextures++
    }
    program.setUniform(uniformName, value)
  }
  return numTextures
}

// cmd - a command to submit to the queue, the immediate execution is not guaranteed and will
// depend on the curren optimization strategy
// opts - submit call specific command overrides Object or Array of Objects
// subContextCallback - all submit calls within this callback will
// inherit defaults from the currently executing cmd
CommandQueue.prototype.submit = function (cmd, opts, subCommanDraw) {
  if (this.debug) console.log('submit', cmd._type, cmd._id)

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
    if (cmd.textures && opts.textures) {
      cmd.textures = Object.assign({}, cmd.textures, opts.textures)
    }
  }

  var pushedStates = 0

  var ctx = this._ctx
  if (cmd.framebuffer) {
    if (this.debug) console.log('  bindFramebuffer')
    ctx.pushState(ctx.FRAMEBUFFER_BIT)
    ctx.bindFramebuffer(cmd.framebuffer)
    pushedStates++
    if (cmd.framebufferColorAttachments) {
      for (var attachmentIndex in cmd.framebufferColorAttachments) {
        var attachment = cmd.framebufferColorAttachments[attachmentIndex]
        var index = parseInt(attachmentIndex, 10)
        cmd.framebuffer.setColorAttachment(index, attachment.target, attachment.handle, attachment.level)
      }
    }
  } else {
    // ctx.bindFramebuffer(null)
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

  if (cmd.program) {
    ctx.pushState(ctx.PROGRAM_BIT)
    pushedStates++
    ctx.bindProgram(cmd.program)
  } else {
    // ctx.bindProgram(null)
  }

  if (cmd.uniforms) {
    applyUniforms(ctx, cmd.program, cmd.uniforms, 0)
  }

  if (cmd.projectionMatrix) {
    ctx.pushState(ctx.MATRIX_PROJECTION_BIT)
    pushedStates++
    ctx.setProjectionMatrix(cmd.projectionMatrix)
  }

  if (cmd.viewMatrix) {
    ctx.pushState(ctx.MATRIX_VIEW_BIT)
    pushedStates++
    ctx.setViewMatrix(cmd.viewMatrix)
  }

  if (cmd.viewport) {
    ctx.pushState(ctx.VIEWPORT_BIT)
    pushedStates++
    ctx.setViewport(cmd.viewport[0], cmd.viewport[1], cmd.viewport[2], cmd.viewport[3])
  }

  if (cmd.textures) {
    ctx.pushState(ctx.TEXTURE_BIT)
    pushedStates++
    for (var textureIndex in cmd.textures) {
      ctx.bindTexture(cmd.textures[textureIndex], textureIndex | 0)
      if (this.debug) console.log('  bindTexture', textureIndex)
    }
  }

  if (cmd.mesh) {
    ctx.bindMesh(cmd.mesh)
    ctx.drawMesh()
  }


  if (subCommanDraw) {
    subCommanDraw()
  }

  if (this.debug) console.log(' ', 'pushedStates', pushedStates)
  for (var i = 0; i < pushedStates; i++) {
    ctx.popState()
  }
}

// force execute of all commands in the queue
CommandQueue.prototype.flush = function () {
}

module.exports = CommandQueue

function CommandQueue (ctx) {
  this._ctx = ctx
  this._commands = []
}

CommandQueue.prototype.getContext = function () {
  return this._ctx
}

// currenlty this doesn't do anything but in the future it can provide:
// - defaults
// - validation
CommandQueue.prototype.createDrawCommand = function (obj) {
  obj._type = 'draw'
  return obj
}

CommandQueue.prototype.createClearCommand = function (obj) {
  obj.type = 'clear'
  return obj
}

CommandQueue.prototype.createTextureUpdateCommand = function (obj) {
}

CommandQueue.prototype.createVertexArrayUpdateCommand = function (obj) {
}

function applyUniforms (ctx, program, uniforms, textureOffset) {
  var numTextures = textureOffset
  for (var uniformName in uniforms) {
    // TODO: can i do array index check instead of function call?
    if (!program.hasUniform(uniformName)) {
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
CommandQueue.prototype.submit = function (cmd, opts, subContextCallback) {
  if (opts) {
    // TODO: optimize this
    cmd = Object.assign({}, cmd, opts)
  }

  var pushedStates = 0

  var ctx = this._ctx
  if (cmd._type === 'cear') {
    if (cmd.framebuffer) {
      ctx.pushState(ctx.FRAMEBUFFER_BIT)
      ctx.bindFramebuffer(cmd.framebuffer)
      pushedStates++
    } else {
      ctx.bindFramebuffer(null)
    }

    var flags = 0
    if (cmd.color !== undefined) {
      ctx.setClearColor(cmd.color[0], cmd.color[1], cmd.color[2], cmd.color[3])
      flags |= ctx.COLOR_BIT
    }
    if (cmd.depth !== undefined) {
      ctx.setClearDepth(cmd.depth)
      flags |= ctx.DEPTH_BIT
    }
    ctx.clear(flags)

  } else if (cmd._type === 'draw') {
    if (cmd.framebuffer) {
      ctx.pushState(ctx.FRAMEBUFFER_BIT)
      ctx.bindFramebuffer(cmd.framebuffer)
      pushedStates++
    } else {
      ctx.bindFramebuffer(null)
    }

    if (cmd.program) {
      ctx.bindProgram(cmd.program)
    } else {
      ctx.bindProgram(null)
    }

    if (cmd.uniforms) {
      applyUniforms(ctx, cmd.program, cmd.uniforms, 0)
    }

    if (cmd.viewport) {
      ctx.pushState(ctx.VIEWPORT_BIT)
      ctx.setViewport(cmd.viewport[0], cmd.viewport[1], cmd.viewport[2], cmd.viewport[3])
      pushedStates++
    }

    if (cmd.mesh) {
      ctx.bindMesh(cmd.mesh)
      ctx.drawMesh()
    }
  }

  for (var i = 0; i < pushedStates; i++) {
    ctx.popState()
  }
}

// force execute of all commands in the queue
CommandQueue.prototype.flush = function () {
}

module.exports = CommandQueue

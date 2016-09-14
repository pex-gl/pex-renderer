var FXResourceMgr = require('./FXResourceMgr')
var ScreenImage = require('./ScreenImage')
var FXStageCount = 0
var remap = require('pex-math/Utils').map

function FXStage (regl, source, resourceMgr, fullscreenQuad) {
  this.id = FXStageCount++
  this.regl = regl
  this.source = source || null
  this.resourceMgr = resourceMgr || new FXResourceMgr(regl)
  this.fullscreenQuad = fullscreenQuad || new ScreenImage(regl)
  this.defaultBPP = 8
}

FXStage.prototype.reset = function () {
  this.resourceMgr.markAllAsNotUsed()
  return this
}

FXStage.prototype.getOutputSize = function (width, height) {
  if (width && height) {
    return {
      width: width,
      height: height
    }
  } else if (this.source && this.source.width) {
    return {
      width: this.source.width,
      height: this.source.height
    }
  } else if (this.source && this.source.getWidth) {
    return {
      width: this.source.getWidth(),
      height: this.source.getHeight()
    }
  } else {
    // TODO: implement viewport getter in regl
    // var viewport = this.ctx.getViewport()
    // return {
      // width: viewport[2],
      // height: viewport[3]
    // }
  }
}

FXStage.prototype.getRenderTarget = function (w, h, depth, bpp) {
  var regl = this.regl
  depth = depth || false
  bpp = bpp || this.defaultBPP
  var resProps = {
    w: w,
    h: h,
    depth: depth,
    bpp: bpp
  }
  var res = this.resourceMgr.getResource('RenderTarget', resProps)
  if (!res) {
    var renderTarget = regl.framebuffer({
      width: w,
      height: h,
      stencil: false,
      depth: false // FIXME, what if depth is a texture and not just a bool
    })
    /*
    var type = ctx.UNSIGNED_BYTE
    if (bpp === 16) type = ctx.HALF_FLOAT
    if (bpp === 32) type = ctx.FLOAT
    var colorTex = ctx.createTexture2D(null, w, h, { magFilter: ctx.LINEAR, minFilter: ctx.LINEAR, type: type })
    var colorAttachments = [{
      texture: colorTex
    }]

    var depthAttachment = null
    if (depth) {
      var depthTex = ctx.createTexture2D(null, w, h, { magFilter: ctx.NEAREST, minFilter: ctx.NEAREST, format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT })
      depthAttachment = {
        texture: depthTex
      }
    }
    var renderTarget = ctx.createFramebuffer(colorAttachments, depthAttachment)
    */
    res = this.resourceMgr.addResource('RenderTarget', renderTarget, resProps)
  }
  res.used = true
  return res.obj
}

FXStage.prototype.getCommand = function (vert, frag) {
  var resProps = {
    vert: vert,
    frag: frag
  }
  var res = this.resourceMgr.getResource('Command', resProps)
  return res ? res.obj : null
}

FXStage.prototype.addCommand = function (vert, frag, cmd) {
  var resProps = {
    vert: vert,
    frag: frag
  }
  // we don't mark cmd as used, they can be reused as many times as we like in the frame as they are stateless
  var res = this.resourceMgr.addResource('Command', cmd, resProps)
  return res.obj
}

FXStage.prototype.getFXStage = function (name) {
  var resProps = {}
  var res = this.resourceMgr.getResource('FXStage', resProps)
  if (!res) {
    var fxState = new FXStage(this.regl, null, this.resourceMgr, this.fullscreenQuad)
    res = this.resourceMgr.addResource('FXStage', fxState, resProps)
  }
  res.used = true
  return res.obj
}

FXStage.prototype.asFXStage = function (source, name) {
  var stage = this.getFXStage(name)
  stage.source = source
  stage.name = name + '_' + stage.id
  return stage
}

FXStage.prototype.getSourceTexture = function (source) {
  if (source) {
    if (source.source) {
      return this.getSourceTexture(source.source)
    } if (source.color) {
      if (source.color.length) {
        return source.color[0]
      } else {
        return source.color // TODO: test if that's ever valid
      }
    } else {
      return source
    }
  } else if (this.source) {
    if (this.source.color) {
      return this.source.color[0]
    } else return this.source
  } else {
    throw new Error('FXStage.getSourceTexture() No source texture!')
  }
}

FXStage.prototype.drawFullScreenQuad = function (width, height, image, program) {
  this.drawFullScreenQuadAt(0, 0, width, height, image, program)
}

FXStage.prototype.drawFullScreenQuadAt = function (x, y, width, height, image, program) {
  var regl = this.regl
  program = program || this.fullscreenQuad.program
  if (!this.blitCmd) {
    this.blitCmd = regl({
      depth: { enable: false },
      // viewport: regl.prop('viewport'),
      attributes: this.fullscreenQuad.attributes,
      elements: this.fullscreenQuad.elements,
      vert: regl.prop('vert'),
      frag: regl.prop('frag'),
      uniforms: {
        image: regl.prop('image'),
        uOffset: function (context, props) {
          // move from screen pos 0..W to normalized device pos -1..1
          return [
            remap(props.offset[0], 0, context.viewportWidth, 0, 2),
            remap(props.offset[1], 0, context.viewportHeight, 0, 2)
          ]
        },
        uSize: function (context, props) {
          return [
            remap(props.size[0], 0, context.viewportWidth, 0, 1),
            remap(props.size[1], 0, context.viewportHeight, 0, 1)
          ]
        }
      }
    })
  }
  this.blitCmd({
    // viewport: { x: x, y: y, width: width, height: height },
    vert: program.vert,
    frag: program.frag,
    image: image,
    imageSize: [image.width, image.height],
    offset: [ x, y ],
    size: [ width, height ]
  })
}

FXStage.prototype.getImage = function (path) {
  throw new Error('FXStage.getImage is not implemented!')
  // var resProps = { path: path }
  // var res = this.resourceMgr.getResource('Image', resProps)
  // if (!res) {
  //    var image = Texture2D.load(path)
  //    res = this.resourceMgr.addResource('Image', image, resProps)
  // }
  // res.used = false
  // // can be shared so no need for locking
  // return res.obj
}

FXStage.prototype.getFullScreenQuad = function () {
  return this.fullscreenQuad
}

module.exports = FXStage

var isPlask = require('is-plask')
var GUIControl = require('./GUIControl')
var Renderer = isPlask ? require('./SkiaRenderer') : require('./HTMLCanvasRenderer')
var Rect = require('pex-geom/Rect')
var KeyboardEvent = require('pex-sys/KeyboardEvent')

var VERT = '\
attribute vec2 aPosition; \
attribute vec2 aTexCoord0; \
uniform vec2 uWindowSize; \
uniform vec4 uRect; \
varying vec2 vTexCoord0; \
void main() { \
vTexCoord0 = aTexCoord0; \
vec2 pos = aPosition.xy * 0.5 + 0.5; \
pos.x = uRect.x + pos.x * (uRect.z - uRect.x); \
pos.y = uRect.y + pos.y * (uRect.w - uRect.y); \
pos.x /= uWindowSize.x; \
pos.y /= uWindowSize.y; \
pos = (pos - 0.5) * 2.0; \
gl_Position = vec4(pos, 0.0, 1.0); \
}'

var TEXTURE_2D_FRAG = `
uniform sampler2D uTexture;
uniform float uHDR;
varying vec2 vTexCoord0;
void main() {
gl_FragColor = texture2D(uTexture, vec2(vTexCoord0.x, vTexCoord0.y));
if (uHDR == 1.0) {
gl_FragColor.rgb = gl_FragColor.rgb / (gl_FragColor.rgb + 1.0);
gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0/2.2));
}
}`

// we want normal (not fliped) cubemaps maps to be represented same way as
// latlong panoramas so we flip by -1.0 by default
// render target dynamic cubemaps should be not flipped
var TEXTURE_CUBE_FRAG = '\
const float PI = 3.1415926; \
varying vec2 vTexCoord0; \
uniform samplerCube uTexture; \
uniform float uHDR; \
uniform float uFlipEnvMap; \
uniform float uLevel; \
void main() { \
float theta = vTexCoord0.x * 2.0 * PI - PI/2.0; \
float phi = vTexCoord0.y * PI; \
float x = cos(theta) * sin(phi); \
float y = -cos(phi); \
float z = sin(theta) * sin(phi); \
vec3 N = normalize(vec3(uFlipEnvMap * x, y, z)); \
gl_FragColor = textureCubeLod(uTexture, N, uLevel); \
if (uHDR == 1.0) { \
gl_FragColor.rgb = gl_FragColor.rgb / (gl_FragColor.rgb + 1.0); \
gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0/2.2)); \
}\
}'

if (!isPlask) {
  TEXTURE_2D_FRAG = 'precision highp float;\n\n' + TEXTURE_2D_FRAG
  TEXTURE_CUBE_FRAG = 'precision highp float;\n\n' + TEXTURE_CUBE_FRAG
  TEXTURE_CUBE_FRAG = '#extension GL_EXT_shader_texture_lod : require\n' + TEXTURE_CUBE_FRAG
  TEXTURE_CUBE_FRAG = '#define textureCubeLod textureCubeLodEXT\n' + TEXTURE_CUBE_FRAG
} else {
  TEXTURE_CUBE_FRAG = '#extension GL_ARB_shader_texture_lod : require\n' + TEXTURE_CUBE_FRAG
}

TEXTURE_2D_FRAG = TEXTURE_2D_FRAG.split(';').join(';\n')

/**
 * [GUI description]
 * @param {[type]} ctx          [description]
 * @param {[type]} windowWidth  [description]
 * @param {[type]} windowHeight [description]
 */
function GUI (regl, windowWidth, windowHeight, pixelRatio) {
  console.log('GUI+', windowWidth, windowHeight, pixelRatio)
  pixelRatio = pixelRatio || 1
  this._regl = regl
  this._pixelRatio = pixelRatio
  this._windowWidth = windowWidth
  this._windowHeight = windowHeight
  this._windowSize = [this._windowWidth, this._windowHeight]
  this._textureRect = [0, 0, windowWidth, windowHeight]
  this._textureTmpRect = [0, 0, 0, 0]
  this.x = 0
  this.y = 0
  this.mousePos = [0, 0]
  this.scale = 1

  var rectPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  var rectTexCoords = [[0, 0], [1, 0], [1, 1], [ 0, 1]]
  var rectIndices = [[0, 1, 2], [0, 2, 3]]

  /*
  ctx.pushState(ctx.DEPTH_BIT | ctx.BLEND_BIT)
  ctx.setDepthTest(false)
  ctx.setBlend(true)
  ctx.setBlendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA)
  ctx.bindProgram(this.texture2DProgram)
  this.texture2DProgram.setUniform('uTexture', 0)
  this.texture2DProgram.setUniform('uWindowSize', this._windowSize)
  this.texture2DProgram.setUniform('uRect', this._textureRect)
  ctx.bindMesh(this.rectMesh)
  ctx.bindTexture(this.renderer.getTexture())
  ctx.drawMesh()
  ctx.bindProgram(this.textureCubeProgram)
  this.textureCubeProgram.setUniform('uTexture', 0)
  this.textureCubeProgram.setUniform('uWindowSize', this._windowSize)
  */
  this.drawTexture2d = regl({
    vert: VERT,
    frag: TEXTURE_2D_FRAG,
    attributes: {
      aPosition: rectPositions,
      aTexCoord0: rectTexCoords
    },
    elements: rectIndices,
    uniforms: {
      uTexture: regl.prop('texture'),
      uWindowSize: this._windowSize,
      uRect: regl.prop('rect'),
      uHDR: regl.prop('hdr')
    },
    depth: {
      enable: false
    },
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      }
    }
  })

  this.drawTextureCube = regl({
    vert: VERT,
    frag: TEXTURE_CUBE_FRAG,
    attributes: {
      aPosition: rectPositions,
      aTexCoord0: rectTexCoords
    },
    elements: rectIndices,
    uniforms: {
      uTexture: regl.prop('texture'),
      uWindowSize: this._windowSize,
      uRect: regl.prop('rect'),
      uHDR: regl.prop('hdr'),
      uFlipEnvMap: regl.prop('flipEnvMap'),
      uLevel: regl.prop('level')
    },
    depth: {
      enable: false
    },
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      }
    }
  })

  this.renderer = new Renderer(regl, windowWidth, windowHeight, pixelRatio)

  this.screenBounds = [0, 0, windowWidth, windowHeight]

  this.items = []
  this.enabled = true
}

/**
 * [onMouseDown description]
 * @param  {[type]} e [description]
 * @return {[type]}   [description]
 */
GUI.prototype.onMouseDown = function (e) {
  if (!this.enabled) return

  this.items.forEach(function (item) {
    if (item.type === 'text') {
      if (item.focus) {
        item.focus = false
        item.dirty = true
      }
    }
  })

  this.activeControl = null
  this.mousePos[0] = e.x / this._pixelRatio - this.x
  this.mousePos[1] = e.y / this._pixelRatio - this.y
  for (var i = 0; i < this.items.length; i++) {
    if (Rect.containsPoint(this.items[i].activeArea, this.mousePos)) {
      this.activeControl = this.items[i]
      var aa = this.activeControl.activeArea
      var aaWidth = aa[1][0] - aa[0][0]
      var aaHeight = aa[1][1] - aa[0][1]
      this.activeControl.active = true
      this.activeControl.dirty = true
      if (this.activeControl.type === 'button') {
        if (this.activeControl.onclick) this.activeControl.onclick()
      } else if (this.activeControl.type === 'toggle') {
        this.activeControl.contextObject[this.activeControl.attributeName] = !this.activeControl.contextObject[this.activeControl.attributeName]
        if (this.activeControl.onchange) {
          this.activeControl.onchange(this.activeControl.contextObject[this.activeControl.attributeName])
        }
      } else if (this.activeControl.type === 'radiolist') {
        var hitY = this.mousePos[1] - aa[0][1]
        var hitItemIndex = Math.floor(this.activeControl.items.length * hitY / aaHeight)
        if (hitItemIndex < 0) {
          continue
        }
        if (hitItemIndex >= this.activeControl.items.length) {
          continue
        }
        this.activeControl.contextObject[this.activeControl.attributeName] = this.activeControl.items[hitItemIndex].value
        if (this.activeControl.onchange) {
          this.activeControl.onchange(this.activeControl.items[hitItemIndex].value)
        }
      } else if (this.activeControl.type === 'texturelist') {
        var clickedItem = null
        this.activeControl.items.forEach(function (item) {
          if (Rect.containsPoint(item.activeArea, this.mousePos)) {
            clickedItem = item
          }
        }.bind(this))

        if (!clickedItem) {
          continue
        }

        this.activeControl.contextObject[this.activeControl.attributeName] = clickedItem.value
        if (this.activeControl.onchange) {
          this.activeControl.onchange(clickedItem.value)
        }
      } else if (this.activeControl.type === 'color') {
        if (this.activeControl.options.palette) {
          var iw = this.activeControl.options.paletteImage.width
          var ih = this.activeControl.options.paletteImage.height
          var y = e.y / this._pixelRatio - aa[0][1]
          var imageDisplayHeight = aaWidth * ih / iw
          var imageStartY = aaHeight - imageDisplayHeight

          if (y > imageStartY) {
            var u = (e.x / this._pixelRatio - aa[0][0]) / aaWidth
            var v = (y - imageStartY) / imageDisplayHeight
            var x = Math.floor(iw * u)
            y = Math.floor(ih * v)
            var color = this.renderer.getImageColor(this.activeControl.options.paletteImage, x, y)
            this.activeControl.dirty = true

            this.activeControl.contextObject[this.activeControl.attributeName][0] = color[0]
            this.activeControl.contextObject[this.activeControl.attributeName][1] = color[1]
            this.activeControl.contextObject[this.activeControl.attributeName][2] = color[2]
            if (this.activeControl.onchange) {
              this.activeControl.onchange(this.activeControl.contextObject[this.activeControl.attributeName])
            }
            continue
          }
        }
      } else if (this.activeControl.type === 'text') {
        this.activeControl.focus = true
      }
      e.stopPropagation()
      this.onMouseDrag(e)
      break
    }
  }
}

/**
 * [onMouseDrag description]
 * @param  {[type]} e [description]
 * @return {[type]}   [description]
 */
GUI.prototype.onMouseDrag = function (e) {
  if (!this.enabled) return

  if (this.activeControl) {
    var aa = this.activeControl.activeArea
    var aaWidth = aa[1][0] - aa[0][0]
    var aaHeight = aa[1][1] - aa[0][1]
    var val
    var idx
    if (this.activeControl.type === 'slider') {
      val = (e.x / this._pixelRatio - aa[0][0]) / aaWidth
      val = Math.max(0, Math.min(val, 1))
      this.activeControl.setNormalizedValue(val)
      if (this.activeControl.onchange) {
        this.activeControl.onchange(this.activeControl.contextObject[this.activeControl.attributeName])
      }
      this.activeControl.dirty = true
    } else if (this.activeControl.type === 'multislider') {
      val = (e.x / this._pixelRatio - aa[0][0]) / aaWidth
      val = Math.max(0, Math.min(val, 1))
      idx = Math.floor(this.activeControl.getValue().length * (e.y / this._pixelRatio - aa[0][1]) / aaHeight)
      if (!isNaN(this.activeControl.clickedSlider)) {
        idx = this.activeControl.clickedSlider
      } else {
        this.activeControl.clickedSlider = idx
      }
      this.activeControl.setNormalizedValue(val, idx)
      if (this.activeControl.onchange) {
        this.activeControl.onchange(this.activeControl.contextObject[this.activeControl.attributeName])
      }
      this.activeControl.dirty = true
    } else if (this.activeControl.type === 'color') {
      var numSliders = this.activeControl.options.alpha ? 4 : 3
      var slidersHeight = aaHeight
      if (this.activeControl.options.palette) {
        var iw = this.activeControl.options.paletteImage.width
        var ih = this.activeControl.options.paletteImage.height
        var y = e.y / this._pixelRatio - aa[0][1]
        slidersHeight = aaHeight - aaWidth * ih / iw
        var imageDisplayHeight = aaWidth * ih / iw
        var imageStartY = aaHeight - imageDisplayHeight
        if (y > imageStartY && isNaN(this.activeControl.clickedSlider)) {
          var u = (e.x / this._pixelRatio - aa[0][0]) / aaWidth
          var v = (y - imageStartY) / imageDisplayHeight
          var x = Math.floor(iw * u)
          y = Math.floor(ih * v)
          var color = this.renderer.getImageColor(this.activeControl.options.paletteImage, x, y)
          this.activeControl.dirty = true
          this.activeControl.contextObject[this.activeControl.attributeName][0] = color[0]
          this.activeControl.contextObject[this.activeControl.attributeName][1] = color[1]
          this.activeControl.contextObject[this.activeControl.attributeName][2] = color[2]
          if (this.activeControl.onchange) {
            this.activeControl.onchange(this.activeControl.contextObject[this.activeControl.attributeName])
          }
          e.stopPropagation()
          return
        }
      }

      val = (e.x / this._pixelRatio - aa[0][0]) / aaWidth
      val = Math.max(0, Math.min(val, 1))
      idx = Math.floor(numSliders * (e.y / this._pixelRatio - aa[0][1]) / slidersHeight)
      if (!isNaN(this.activeControl.clickedSlider)) {
        idx = this.activeControl.clickedSlider
      } else {
        this.activeControl.clickedSlider = idx
      }
      this.activeControl.setNormalizedValue(val, idx)
      if (this.activeControl.onchange) {
        this.activeControl.onchange(this.activeControl.contextObject[this.activeControl.attributeName])
      }
      this.activeControl.dirty = true
    }
    e.stopPropagation()
  }
}

/**
 * [onMouseUp description]
 * @param  {[type]} e [description]
 * @return {[type]}   [description]
 */
GUI.prototype.onMouseUp = function (e) {
  if (!this.enabled) return

  if (this.activeControl) {
    this.activeControl.active = false
    this.activeControl.dirty = true
    this.activeControl.clickedSlider = undefined
    this.activeControl = null
  }
}

/**
 * [onKeyDown description]
 * @param  {[type]} e [description]
 * @return {[type]}   [description]
 */
GUI.prototype.onKeyDown = function (e) {
  var focusedItem = this.items.filter(function (item) { return item.type === 'text' && item.focus})[0]
  if (!focusedItem) {
    return
  }

  switch (e.keyCode) {
    case KeyboardEvent.VK_BACKSPACE:
      var str = focusedItem.contextObject[focusedItem.attributeName]
    focusedItem.contextObject[focusedItem.attributeName] = str.substr(0, Math.max(0, str.length - 1))
    focusedItem.dirty = true
    if (focusedItem.onchange) {
      focusedItem.onchange(focusedItem.contextObject[focusedItem.attributeName])
    }
    e.stopPropagation()
    break

  }
}

/**
 * [onKeyPress description]
 * @param  {[type]} e [description]
 * @return {[type]}   [description]
 */
GUI.prototype.onKeyPress = function (e) {
  var focusedItem = this.items.filter(function (item) { return item.type === 'text' && item.focus})[0]
  if (!focusedItem) {
    return
  }

  var c = e.str.charCodeAt(0)
  if (c >= 32 && c <= 126) {
    focusedItem.contextObject[focusedItem.attributeName] += e.str
    focusedItem.dirty = true
    if (focusedItem.onchange) {
      focusedItem.onchange(focusedItem.contextObject[focusedItem.attributeName])
    }
    e.stopPropagation()
  }
}

/**
 * [addHeader description]
 * @param {[type]} title [description]
 */
GUI.prototype.addHeader = function (title) {
  var ctrl = new GUIControl({
    type: 'header',
    title: title,
    dirty: true,
    activeArea: [[0, 0], [0, 0]],
    setTitle: function (title) {
      this.title = title
      this.dirty = true
    }
  })
  this.items.push(ctrl)
  return ctrl
}

/**
 * [addSeparator description]
 * @param {[type]} title [description]
 */
GUI.prototype.addSeparator = function (title) {
  var ctrl = new GUIControl({
    type: 'separator',
    dirty: true,
    activeArea: [[0, 0], [0, 0]]
  })
  this.items.push(ctrl)
  return ctrl
}

/**
 * [addLabel description]
 * @param {[type]} title [description]
 */
GUI.prototype.addLabel = function (title) {
  var ctrl = new GUIControl({
    type: 'label',
    title: title,
    dirty: true,
    activeArea: [[0, 0], [0, 0]],
    setTitle: function (title) {
      this.title = title
      this.dirty = true
    }
  })
  this.items.push(ctrl)
  return ctrl
}

/**
 * [addParam description]
 * @param {[type]} title         [description]
 * @param {[type]} contextObject [description]
 * @param {[type]} attributeName [description]
 * @param {[type]} options       [description]
 * @param {[type]} onchange      [description]
 */
GUI.prototype.addParam = function (title, contextObject, attributeName, options, onchange) {
  options = options || {}
  var ctrl
  if (typeof (options.min) === 'undefined') options.min = 0
  if (typeof (options.max) === 'undefined') options.max = 1
  if (contextObject[attributeName] === false || contextObject[attributeName] === true) {
    ctrl = new GUIControl({
      type: 'toggle',
      title: title,
      contextObject: contextObject,
      attributeName: attributeName,
      activeArea: [[0, 0], [0, 0]],
      options: options,
      onchange: onchange,
      dirty: true
    })
    this.items.push(ctrl)
    return ctrl
  } else if (!isNaN(contextObject[attributeName])) {
    ctrl = new GUIControl({
      type: 'slider',
      title: title,
      contextObject: contextObject,
      attributeName: attributeName,
      activeArea: [[0, 0], [0, 0]],
      options: options,
      onchange: onchange,
      dirty: true
    })
    this.items.push(ctrl)
    return ctrl
  } else if ((contextObject[attributeName] instanceof Array) && (options && options.type === 'color')) {
    ctrl = new GUIControl({
      type: 'color',
      title: title,
      contextObject: contextObject,
      attributeName: attributeName,
      activeArea: [[0, 0], [0, 0]],
      options: options,
      onchange: onchange,
      dirty: true
    })
    this.items.push(ctrl)
    return ctrl
  } else if (contextObject[attributeName] instanceof Array) {
    ctrl = new GUIControl({
      type: 'multislider',
      title: title,
      contextObject: contextObject,
      attributeName: attributeName,
      activeArea: [[0, 0], [0, 0]],
      options: options,
      onchange: onchange,
      dirty: true
    })
    this.items.push(ctrl)
    return ctrl
  } else if (typeof contextObject[attributeName] === 'string') {
    ctrl = new GUIControl({
      type: 'text',
      title: title,
      contextObject: contextObject,
      attributeName: attributeName,
      activeArea: [[0, 0], [0, 0]],
      options: options,
      onchange: onchange,
      dirty: true
    })
    this.items.push(ctrl)
    return ctrl
  }
}

/**
 * [addButton description]
 * @param {[type]} title   [description]
 * @param {[type]} onclick [description]
 */
GUI.prototype.addButton = function (title, onclick) {
  var ctrl = new GUIControl({
    type: 'button',
    title: title,
    onclick: onclick,
    activeArea: [[0, 0], [0, 0]],
    dirty: true,
    options: {}
  })
  this.items.push(ctrl)
  return ctrl
}

/**
 * [addRadioList description]
 * @param {[type]} title         [description]
 * @param {[type]} contextObject [description]
 * @param {[type]} attributeName [description]
 * @param {[type]} items         [description]
 * @param {[type]} onchange      [description]
 */
GUI.prototype.addRadioList = function (title, contextObject, attributeName, items, onchange) {
  var ctrl = new GUIControl({
    type: 'radiolist',
    title: title,
    contextObject: contextObject,
    attributeName: attributeName,
    activeArea: [[0, 0], [0, 0]],
    items: items,
    onchange: onchange,
    dirty: true
  })
  this.items.push(ctrl)
  return ctrl
}

/**
 * [addTexture2DList description]
 * @param {[type]} title         [description]
 * @param {[type]} contextObject [description]
 * @param {[type]} attributeName [description]
 * @param {[type]} items         [description]
 * @param {[type]} itemsPerRow   [description]
 * @param {[type]} onchange      [description]
 */
GUI.prototype.addTexture2DList = function (title, contextObject, attributeName, items, itemsPerRow, onchange) {
  var ctrl = new GUIControl({
    type: 'texturelist',
    title: title,
    contextObject: contextObject,
    attributeName: attributeName,
    activeArea: [[0, 0], [0, 0]],
    items: items,
    itemsPerRow: itemsPerRow || 4,
    onchange: onchange,
    dirty: true
  })
  this.items.push(ctrl)
  return ctrl
}

/**
 * [addTexture2D description]
 * @param {[type]} title   [description]
 * @param {[type]} texture [description]
 * @param {[type]} options [description]
 */
GUI.prototype.addTexture2D = function (title, texture, options) {
  var ctrl = new GUIControl({
    type: 'texture2D',
    title: title,
    texture: texture,
    options: options,
    activeArea: [[0, 0], [0, 0]],
    dirty: true
  })
  this.items.push(ctrl)
  return ctrl
}

GUI.prototype.addTextureCube = function (title, texture, options) {
  var ctrl = new GUIControl({
    type: 'textureCube',
    title: title,
    texture: texture,
    options: options,
    activeArea: [[0, 0], [0, 0]],
    dirty: true,
    flipZ: 1
  })
  this.items.push(ctrl)
  return ctrl
}

/**
 * [dispose description]
 * @return {[type]} [description]
 */
GUI.prototype.dispose = function () {
}

/**
 * [function description]
 * @param  {[type]} items [description]
 * @return {[type]}       [description]
 */
GUI.prototype.isAnyItemDirty = function (items) {
  var dirty = false
  items.forEach(function (item) {
    if (item.dirty) {
      item.dirty = false
      dirty = true
    }
  })
  return dirty
}

/**
 * [draw description]
 * @return {[type]} [description]
 */
GUI.prototype.draw = function () {
  if (!this.enabled) {
    return
  }

  if (this.items.length === 0) {
    return
  }

  if (this.isAnyItemDirty(this.items)) {
    this.renderer.draw(this.items, this.scale)
  }

  this.drawTexture2d({
    texture: this.renderer.getTexture(),
    rect: this._textureRect,
    hdr: 0
  })

  this.drawTextures()
}

/**
 * [drawTextures description]
 * @return {[type]} [description]
 */
GUI.prototype.drawTextures = function () {
  var ctx = this._ctx
  for (var i = 0; i < this.items.length; i++) {
    var item = this.items[i]
    var scale = this.scale * this._pixelRatio
    var bounds
    if (item.type === 'texture2D') {
      // we are trying to match flipped gui texture which 0,0 starts at the top with window coords that have 0,0 at the bottom
      bounds = [item.activeArea[0][0] * scale, this._windowHeight - item.activeArea[1][1] * scale, item.activeArea[1][0] * scale, this._windowHeight - item.activeArea[0][1] * scale]
      this.drawTexture2d({
        texture: item.texture,
        rect: bounds,
        hdr: item.options && item.options.hdr ? 1 : 0
      })
    }
    if (item.type === 'texturelist') {
      ctx.bindProgram(this.texture2DProgram)
      item.items.forEach(function (textureItem) {
        // var bounds = [item.activeArea[0][0] * scale, this._windowHeight - item.activeArea[1][1] * scale, item.activeArea[1][0] * scale, this._windowHeight - item.activeArea[0][1] * scale]
        bounds = [textureItem.activeArea[0][0] * scale, this._windowHeight - textureItem.activeArea[1][1] * scale, textureItem.activeArea[1][0] * scale, this._windowHeight - textureItem.activeArea[0][1] * scale]
        this.drawTexture2d({
          texture: textureItem.texture,
          rect: bounds,
          hdr: item.options && item.options.hdr ? 1 : 0
        })
      }.bind(this))
    }
    if (item.type === 'textureCube') {
      var level = (item.options && item.options.level !== undefined) ? item.options.level : 0
      // we are trying to match flipped gui texture which 0,0 starts at the top with window coords that have 0,0 at the bottom
      bounds = [item.activeArea[0][0] * scale, this._windowHeight - item.activeArea[1][1] * scale, item.activeArea[1][0] * scale, this._windowHeight - item.activeArea[0][1] * scale]
      this.drawTextureCube({
        texture: item.texture,
        rect: bounds,
        hdr: item.options && item.options.hdr ? 1 : 0,
        level: level,
        flipEnvMap: 1 // FIXME: how to handle item.texture.getFlipEnvMap()
      })
    }
  }
  // this.screenImage.setBounds(this.screenBounds)
  // this.screenImage.setImage(this.renderer.getTexture())
}

/**
 * [serialize description]
 * @return {[type]} [description]
 */
GUI.prototype.serialize = function () {
  var data = {}
  this.items.forEach(function (item, i) {
    data[item.title] = item.getSerializedValue()
  })
  return data
}

/**
 * [deserialize description]
 * @param  {[type]} data [description]
 * @return {[type]}      [description]
 */
GUI.prototype.deserialize = function (data) {
  this.items.forEach(function (item, i) {
    if (data[item.title] !== undefined) {
      item.setSerializedValue(data[item.title])
      item.dirty = true
    }
  })
}

/**
 * [function description]
 * @param  {[type]} state [description]
 * @return {[type]}       [description]
 */
GUI.prototype.setEnabled = function (state) {
  this.enabled = state
}

/**
 * [function description]
 * @return {[type]} [description]
 */
GUI.prototype.isEnabled = function () {
  return this.enabled
}

/**
 * [function description]
 * @return {[type]} [description]
 */
GUI.prototype.toggleEnabled = function () {
  this.enabled = !this.enabled
  return this.enabled
}

module.exports = GUI

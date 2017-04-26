const Signal = require('signals')
const Mat4 = require('pex-math/Mat4')
const glsl = require('glslify')
const hammersley = require('hammersley')

function ReflectionProbe (opts) {
  this.type = 'ReflectionProbe'
  this.changed = new Signal()

  this.set(opts)

  const ctx = opts.ctx
  this._ctx = ctx
  this.dirty = true

  const CUBEMAP_SIZE = 512
  const dynamicCubemap = ctx.textureCube({
    width: CUBEMAP_SIZE, height: CUBEMAP_SIZE
  })

  const sides = [
    { bg: [0.5, 0.0, 0.0, 1.0], eye: [0, 0, 0], target: [1, 0, 0], up: [0, -1, 0] },
    { bg: [0.25, 0.0, 0.0, 1.0], eye: [0, 0, 0], target: [-1, 0, 0], up: [0, -1, 0] },
    { bg: [0.0, 0.5, 0.0, 1.0], eye: [0, 0, 0], target: [0, 1, 0], up: [0, 0, 1] },
    { bg: [0.0, 0.25, 0.0, 1.0], eye: [0, 0, 0], target: [0, -1, 0], up: [0, 0, -1] },
    { bg: [0.0, 0.0, 0.5, 1.0], eye: [0, 0, 0], target: [0, 0, 1], up: [0, -1, 0] },
    { bg: [0.0, 0.0, 0.25, 1.0], eye: [0, 0, 0], target: [0, 0, -1], up: [0, -1, 0] }
  ].map((side, i) => {
    side.projectionMatrix = Mat4.perspective(Mat4.create(), 90, 1, 0.1, 100) // TODO: change this to radians
    side.viewMatrix = Mat4.lookAt(Mat4.create(), side.eye, side.target, side.up)
    side.drawPassCmd = {
      pass: ctx.pass({
        color: [{ texture: dynamicCubemap, target: ctx.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i }],
        clearColor: side.bg,
        clearDepth: 1
      })
    }
    return side
  })
  const quadPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const quadTexCoords = [[0, 0], [1, 0], [1, 1], [0, 1]]
  const quadFaces = [[0, 1, 2], [0, 2, 3]]

  const octMap = ctx.texture2D({
    width: 1024,
    height: 1024
  })

  const irradianceOctMapSize = 32
  const irradianceOctMap = ctx.texture2D({
    width: irradianceOctMapSize,
    height: irradianceOctMapSize,
    min: ctx.Filter.Linear,
    mag: ctx.Filter.Linear
  })

  const cubemapToOctMap = {
    pass: ctx.pass({
      color: [ octMap ]
    }),
    pipeline: ctx.pipeline({
      vert: glsl(__dirname + '/glsl/FullscreenQuad.vert'),
      frag: glsl(__dirname + '/glsl/CubemapToOctmap.frag')
    }),
    attributes: {
      aPosition: ctx.vertexBuffer(quadPositions),
      aTexCoord: ctx.vertexBuffer(quadTexCoords)
    },
    indices: ctx.indexBuffer(quadFaces),
    uniforms: {
      uTextureSize: irradianceOctMap.width,
      uCubemap: null
    }
  }

  const convolveOctmapAtlasToOctMap = {
    pass: ctx.pass({
      // color: [ irradianceOctMap ]
      color: [ octMap ]
    }),
    pipeline: ctx.pipeline({
      vert: glsl(__dirname + '/glsl/FullscreenQuad.vert'),
      frag: glsl(__dirname + '/glsl/ConvolveOctMapAtlasToOctMap.frag')
    }),
    attributes: {
      aPosition: ctx.vertexBuffer(quadPositions),
      aTexCoord: ctx.vertexBuffer(quadTexCoords)
    },
    indices: ctx.indexBuffer(quadFaces),
    uniforms: {
      uTextureSize: irradianceOctMap.width,
      uSource: null,
      uSourceSize: null
    }
  }

  const octMapAtlas = this._reflectionMap = ctx.texture2D({
    width: 2 * 1024,
    height: 2 * 1024,
    min: ctx.Filter.Linear,
    mag: ctx.Filter.Linear
  })

  const clearOctMapAtlasCmd = {
    pass: ctx.pass({
      color: [ octMapAtlas ],
      clearColor: [0, 0, 0, 0]
    })
  }

  const blitToOctMapAtlasCmd = {
    pass: ctx.pass({
      color: [ octMapAtlas ]
    }),
    pipeline: ctx.pipeline({
      vert: glsl(__dirname + '/glsl/FullscreenQuad.vert'),
      frag: glsl(__dirname + '/glsl/BlitToOctMapAtlas.frag')
    }),
    uniforms: {
      uSource: octMap,
      uSourceSize: octMap.width
    },
    attributes: {
      aPosition: ctx.vertexBuffer(quadPositions),
      aTexCoord: ctx.vertexBuffer(quadTexCoords)
    },
    indices: ctx.indexBuffer(quadFaces)
  }

  const downsampleFromOctMapAtlasCmd = {
    pass: ctx.pass({
      color: [ octMap ],
      clearColor: [0, 1, 0, 1]
    }),
    pipeline: ctx.pipeline({
      vert: glsl(__dirname + '/glsl/FullscreenQuad.vert'),
      frag: glsl(__dirname + '/glsl/DownsampleFromOctMapAtlas.frag')
    }),
    uniforms: {
      uSource: octMapAtlas,
      uSourceSize: octMapAtlas.width
    },
    attributes: {
      aPosition: ctx.vertexBuffer(quadPositions),
      aTexCoord: ctx.vertexBuffer(quadTexCoords)
    },
    indices: ctx.indexBuffer(quadFaces)
  }

  const prefilterFromOctMapAtlasCmd = {
    pass: ctx.pass({
      color: [ octMap ],
      clearColor: [0, 1, 0, 1]
    }),
    pipeline: ctx.pipeline({
      vert: glsl(__dirname + '/glsl/FullscreenQuad.vert'),
      frag: glsl(__dirname + '/glsl/PrefilterFromOctMapAtlas.frag')
    }),
    uniforms: {
      uSource: octMapAtlas,
      uSourceSize: octMapAtlas.width
    },
    attributes: {
      aPosition: ctx.vertexBuffer(quadPositions),
      aTexCoord: ctx.vertexBuffer(quadTexCoords)
    },
    indices: ctx.indexBuffer(quadFaces)
  }

  const numSamples = 128
  const hammersleyPointSet = new Float32Array(4 * numSamples)
  for (let i = 0; i < numSamples; i++) {
    const p = hammersley(i, numSamples)
    hammersleyPointSet[i * 4] = p[0]
    hammersleyPointSet[i * 4 + 1] = p[1]
    hammersleyPointSet[i * 4 + 2] = 0
    hammersleyPointSet[i * 4 + 3] = 0
  }

  const hammersleyPointSetMap = ctx.texture2D({
    data: hammersleyPointSet,
    width: 1,
    height: numSamples,
    format: ctx.PixelFormat.RGBA32F
  })

  function blitToOctMapAtlasLevel (mipmapLevel, roughnessLevel, sourceRegionSize) {
    const width = octMapAtlas.width
    const levelSize = Math.max(64, width / (2 << mipmapLevel + roughnessLevel))
    const roughnessLevelWidth = width / (2 << roughnessLevel)
    const vOffset = width - Math.pow(2, Math.log2(width) - roughnessLevel)
    const hOffset = 2 * roughnessLevelWidth - Math.pow(2, Math.log2(2 * roughnessLevelWidth) - mipmapLevel)
    ctx.submit(blitToOctMapAtlasCmd, {
      viewport: [hOffset, vOffset, levelSize, levelSize],
      uniforms: {
        uLevelSize: levelSize,
        uSourceRegionSize: sourceRegionSize
      }
    })
  }

  function downsampleFromOctMapAtlasLevel (mipmapLevel, roughnessLevel, targetRegionSize) {
    ctx.submit(downsampleFromOctMapAtlasCmd, {
      uniforms: {
        uMipmapLevel: mipmapLevel,
        uRoughnessLevel: roughnessLevel
      }
    })
  }

  function prefilterFromOctMapAtlasLevel (sourceMipmapLevel, sourceRoughnessLevel, roughnessLevel, targetRegionSize) {
    ctx.submit(prefilterFromOctMapAtlasCmd, {
      uniforms: {
        uSourceMipmapLevel: sourceMipmapLevel,
        uSourceRoughnessLevel: sourceRoughnessLevel,
        uRoughnessLevel: roughnessLevel,
        uNumSamples: numSamples,
        uHammersleyPointSetMap: hammersleyPointSetMap
      }
    })
  }

  this.update = function (drawScene) {
    if (!drawScene) return
    this.dirty = false
    sides.forEach((side) => {
      ctx.submit(side.drawPassCmd, () => drawScene(side))
    })

    ctx.submit(cubemapToOctMap, {
      uniforms: {
        uCubemap: dynamicCubemap
      }
    })

    ctx.submit(clearOctMapAtlasCmd)

    // mipmap levels go horizontally
    // roughness levels go vertically

    const maxLevel = 5
    blitToOctMapAtlasLevel(0, 0, octMap.width)

    for (let i = 0; i < maxLevel - 1; i++) {
      downsampleFromOctMapAtlasLevel(i, 0, octMap.width / Math.pow(2, i + 1))
      blitToOctMapAtlasLevel(i + 1, 0, octMap.width / Math.pow(2, 1 + i))
    }
    blitToOctMapAtlasLevel(maxLevel, 0, 64)

    for (let i = 1; i <= maxLevel; i++) {
      // prefilterFromOctMapAtlasLevel(i, 0, i, Math.max(64, octMap.width / Math.pow(2, i + 1)))
      prefilterFromOctMapAtlasLevel(0, Math.max(0, i - 1), i, Math.max(64, octMap.width / Math.pow(2, i + 1)))
      blitToOctMapAtlasLevel(0, i, Math.max(64, octMap.width / Math.pow(2, 1 + i)))
    }

    ctx.submit(cubemapToOctMap, {
      uniforms: {
        uCubemap: dynamicCubemap
      }
    })

    ctx.submit(convolveOctmapAtlasToOctMap, {
      uniforms: {
        uSource: octMapAtlas,
        uSourceSize: octMapAtlas.width,
        uCubemap: dynamicCubemap
      }
    })

    ctx.submit(blitToOctMapAtlasCmd, {
      viewport: [octMapAtlas.width - irradianceOctMapSize, octMapAtlas.height - irradianceOctMapSize, irradianceOctMapSize, irradianceOctMapSize],
      uniforms: {
        uLevelSize: irradianceOctMapSize,
        uSourceRegionSize: irradianceOctMapSize
      }
    })
  }
}

ReflectionProbe.prototype.init = function (entity) {
  this.entity = entity
}

ReflectionProbe.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

module.exports = function (opts) {
  return new ReflectionProbe(opts)
}

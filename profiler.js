import isBrowser from 'is-browser'
const log = require('debug')('profiler')

let canvas = null
let ctx2d = null
const W = 250
const H = 800
const M = 10
const LINE_H = 16
const FONT_H = 11
const FONT = `${FONT_H}px Droid Sans Mono, Andale Mono, monospace`

function ms(time) {
  const f = Math.floor(time * 10) / 10
  let s = `${f}`
  if (f % 1 === 0) s += '.0'
  if (f < 10) s = ` ${s}`
  return `${s}`
}

function pa3(f) {
  if (f < 10) return `  ${f}`
  if (f < 100) return ` ${f}`
  return f
}

function createProfiler(ctx, renderer) {
  const gl = ctx.gl
  if (isBrowser && !canvas) {
    canvas = document.createElement('canvas')
    canvas.id = 'pex-renderer-profiler'
    canvas.width = W * 2
    canvas.height = H * 2
    document.body.appendChild(canvas)
    canvas.style.position = 'fixed'
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    canvas.style.top = `${M}px`
    canvas.style.right = `${M}px`
    canvas.style.zIndex = 1000
    ctx2d = canvas.getContext('2d')
  }

  const profiler = {
    canvas,
    frame: 0,
    flush: true,
    measurements: {},
    commands: [],
    ctx2d,
    bufferCount: 0,
    totalBufferCount: 0,
    textureCount: 0,
    totalTextureCount: 0,
    programCount: 0,
    totalProgramCount: 0,
    framebufferCount: 0,
    totalFramebufferCount: 0,
    bindTextureCount: 0,
    useProgramCount: 0,
    setUniformCount: 0,
    trianglesCount: 0,
    drawElementsCount: 0,
    drawElementsInstancedCount: 0,
    drawArraysCount: 0,
    drawArraysInstancedCount: 0,
    linesCount: 0,
    time(label, gpu) {
      if (this.flush) gl.finish()
      if (this.flush) gl.flush()
      let m = this.measurements[label]
      if (!m) {
        m = this.measurements[label] = {
          begin: 0,
          end: 0,
          last: 0,
          total: 0,
          count: 0,
          avg: 0,
          max: 0
        }
        if (gpu) {
          m.query = ctx.query()
        }
      }
      this.measurements[label].start = window.performance ? window.performance.now() : Date.now()
      if (m.query && m.query.result) m.gpu = m.query.result / 1000000
      if (m.query) ctx.beginQuery(m.query)
    },
    timeEnd(label) {
      if (this.flush) gl.finish()
      if (this.flush) gl.flush()
      const m = this.measurements[label]
      if (!m) {
        return
      }
      m.end = window.performance ? window.performance.now() : Date.now()
      m.last = m.end - m.start
      m.total += m.last
      m.max = Math.max(m.max, m.last)
      m.count++
      m.avg = (m.avg * 9 + m.last * 1) / 10
      if (m.query) ctx.endQuery(m.query)
    },
    add(command, label) {
      let callStack = null
      try {
        throw new Error('Call stack capture')
      } catch (e) {
        callStack = e.stack
      }
      this.commands.push({
        command,
        stack: callStack,
        label
      })
    },
    setFlush(state) {
      this.flush = state
    },
    summary() {
      let lines = []
      const frameMeasurement = this.measurements['Frame']
      if (frameMeasurement) {
        lines.push(`FPS: ${(1000 / frameMeasurement.avg).toFixed(3)}`)
      }
      const frameRAFMeasurement = this.measurements['FrameRAF']
      if (frameRAFMeasurement) {
        lines.push(`FPS (RAF): ${(1000 / frameRAFMeasurement.avg).toFixed(3)}`)
      }
      lines.push('------')
      lines = lines.concat(
        Object.keys(this.measurements)
          .sort((a, b) => {
            return this.measurements[a].start - this.measurements[b].start
          })
          .map(label => {
            const m = this.measurements[label]
            return `${label}: ${ms(m.avg)} ${
              m.gpu ? ` / ${(Math.floor(m.gpu * 10) / 10).toFixed(1)}` : ''
            }`
          })
      )
      lines.push('------')
      lines.push(`Entities: ${pa3(renderer.entities.length)}`)
      lines.push(`Geometries: ${pa3(renderer.getComponents('Geometry').length)}`)
      lines.push(`Materials: ${pa3(renderer.getComponents('Material').length)}`)
      lines.push(`Skins: ${pa3(renderer.getComponents('Skin').length)}`)
      lines.push(`Animations: ${pa3(renderer.getComponents('Animation').length)}`)
      lines.push(`Morphs: ${pa3(renderer.getComponents('Morph').length)}`)
      lines.push(`Cameras: ${pa3(renderer.getComponents('Camera').length)}`)
      lines.push(`Reflection Probes: ${pa3(renderer.getComponents('ReflectionProbe').length)}`)
      lines.push(`Skyboxes: ${pa3(renderer.getComponents('Skybox').length)}`)
      lines.push(`Point Lights: ${pa3(renderer.getComponents('PointLight').length)}`)
      lines.push(`Directional Lights: ${pa3(renderer.getComponents('DirectionalLight').length)}`)
      lines.push(`Spot Lights: ${pa3(renderer.getComponents('SpotLight').length)}`)
      lines.push(`Area Lights: ${pa3(renderer.getComponents('AreaLight').length)}`)
      lines.push('------')
      lines.push(
        `Programs: ${pa3(renderer._ctx.resources.filter(r => r.class === 'program').length)}`
      )
      lines.push(`Passes: ${pa3(renderer._ctx.resources.filter(r => r.class === 'passe').length)}`)
      lines.push(
        `Pipelines: ${pa3(renderer._ctx.resources.filter(r => r.class === 'pipeline').length)}`
      )
      lines.push(
        `Textures 2D: ${pa3(renderer._ctx.resources.filter(r => r.class === 'texture2D').length)}`
      )
      lines.push(
        `Textures Cube: ${pa3(
          renderer._ctx.resources.filter(r => r.class === 'textureCube').length
        )}`
      )
      lines.push('------')
      lines.push(`Buffers: ${pa3(profiler.bufferCount)} / ${pa3(profiler.totalBufferCount)}`)
      lines.push(`Textures: ${pa3(profiler.textureCount)} / ${pa3(profiler.totalTextureCount)}`)
      lines.push(`Programs: ${pa3(profiler.programCount)} / ${pa3(profiler.totalProgramCount)}`)
      lines.push(`FBOs: ${pa3(profiler.framebufferCount)} / ${pa3(profiler.totalFramebufferCount)}`)
      lines.push('------')
      lines.push(`Lines: ${profiler.linesCount}`)
      lines.push(`Triangles: ${profiler.trianglesCount}`)
      lines.push(`Instanced Lines: ${profiler.instancedLinesCount}`)
      lines.push(`Instanced Triangles: ${profiler.instancedTrianglesCount}`)
      lines.push('------')
      lines.push(`Bind Texture: ${pa3(profiler.bindTextureCount)}`)
      lines.push(`Use Program: ${pa3(profiler.useProgramCount)}`)
      lines.push(`Set Uniform: ${pa3(profiler.setUniformCount)}`)
      lines.push(`Draw Elements : ${pa3(profiler.drawElementsCount)}`)
      lines.push(`Instanced Draw Elements: ${pa3(profiler.drawElementsInstancedCount)}`)
      lines.push(`Draw Arrays : ${pa3(profiler.drawArraysCount)}`)
      lines.push(`Instanced Draw Arrays: ${pa3(profiler.drawArraysInstancedCount)}`)
      lines.push('------')
      lines = lines.concat(
        this.commands.map(cmd => {
          // const cpu = cmd.command.stats.cpuTime / cmd.command.stats.count
          // const gpu = cmd.command.stats.gpuTime / cmd.command.stats.count
          // if (cmd.command.stats.count >= 30) {
          // cmd.command.stats.gpuTime = 0
          // cmd.command.stats.cpuTime = 0
          // cmd.command.stats.count = 0
          // }
          // return `${cmd.label}: ${ms(cpu)} ${ms(gpu)}`
          return `${cmd.label}: N/A`
        })
      )
      return lines
    },
    setEnabled(state) {
      if (isBrowser) {
        canvas.style.display = state ? 'block' : 'none'
      }
    },
    startFrame() {
      this.timeEnd('FrameRAF')
      this.time('FrameRAF')
      this.time('Frame')
      resetFrameStats()
    },
    endFrame() {
      this.timeEnd('Frame')
      draw()
    }
  }

  function draw() {
    profiler.frame++
    if (!ctx2d) {
      if (profiler.frame % 30 === 0) {
        log(profiler.summary())
      }
      return
    }
    const lines = profiler.summary()
    ctx2d.save()
    ctx2d.scale(2, 2)
    ctx2d.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx2d.clearRect(0, 0, canvas.width, canvas.height)
    ctx2d.fillRect(0, 0, canvas.width, canvas.height)
    ctx2d.font = FONT
    ctx2d.fillStyle = '#FFF'
    lines.forEach((line, index) => {
      const w = ctx2d.measureText(line).width
      ctx2d.fillText(line, W - M - w, M + FONT_H + LINE_H * index)
    })
    ctx2d.restore()
  }

  // function wrapRes (fn, counter) {
  // const ctxFn = ctx[fn]
  // ctx[fn] = function () {
  // profiler[counter]++
  // return ctxFn.apply(this, arguments)
  // }
  // }

  // TODO:
  // pipelines, passes, etc
  // wrapRes('vertexBuffer', 'bufferCount')
  // wrapRes('elementsBuffer', 'elementsCount')
  // wrapRes('texture2D', 'text')
  // wrapRes('cube', 'totalTextureCubeCount')
  // wrapRes('framebuffer', 'totalFramebufferCount')

  function wrapGLCall(fn, callback) {
    const glFn = gl[fn]
    gl[fn] = function() {
      callback(arguments)
      return glFn.apply(this, arguments)
    }
  }

  // TODO
  wrapGLCall('createBuffer', () => {
    profiler.bufferCount++
    profiler.totalBufferCount++
  })
  wrapGLCall('deleteBuffer', () => {
    profiler.bufferCount--
  })

  wrapGLCall('createProgram', () => {
    profiler.programCount++
    profiler.totalProgramCount++
  })
  wrapGLCall('deleteProgram', () => {
    profiler.programCount--
  })

  wrapGLCall('createTexture', () => {
    profiler.textureCount++
    profiler.totalTextureCount++
  })
  wrapGLCall('deleteTexture', () => {
    profiler.textureCount--
  })

  wrapGLCall('createFramebuffer', () => {
    profiler.framebufferCount++
    profiler.totalFramebufferCount++
  })
  wrapGLCall('deleteFramebuffer', () => {
    profiler.framebufferCount--
  })

  wrapGLCall('bindTexture', () => profiler.bindTextureCount++)
  wrapGLCall('useProgram', () => profiler.useProgramCount++)

  wrapGLCall('drawElements', args => {
    const mode = args[0]
    const count = args[1]
    if (mode === gl.LINES) profiler.linesCount += count
    if (mode === gl.TRIANGLES) profiler.trianglesCount += count
    profiler.drawElementsCount++
  })
  wrapGLCall('drawArrays', args => {
    const mode = args[0]
    const count = args[2]
    if (mode === gl.LINES) profiler.linesCount += count
    if (mode === gl.TRIANGLES) profiler.trianglesCount += count
    profiler.drawArraysCount++
  })

  for (let prop in gl) {
    if (prop.indexOf('uniform') === 0) {
      wrapGLCall(prop, () => profiler.setUniformCount++)
    }
  }

  function wrapGLExtCall(ext, fn, callback) {
    if (!ext) {
      console.log(`Ext ${ext} it not available`)
      return
    }
    const extFn = ext[fn]
    ext[fn] = function() {
      callback(arguments)
      return extFn.apply(ext, arguments)
    }
  }

  // TODO: what about webgl2?
  wrapGLExtCall(gl.getExtension('ANGLE_instanced_arrays'), 'drawElementsInstancedANGLE', args => {
    const mode = args[0]
    const count = args[1]
    const primcount = args[4]
    if (mode === gl.LINES) profiler.instancedLinesCount += count * primcount // assuming divisor 1
    if (mode === gl.TRIANGLES) profiler.instancedTrianglesCount += count * primcount // assuming divisor 1
    profiler.drawElementsInstancedCount++
  })
  wrapGLExtCall(gl.getExtension('ANGLE_instanced_arrays'), 'drawArraysInstancedANGLE', args => {
    const mode = args[0]
    const count = args[2]
    const primcount = args[3]
    if (mode === gl.LINES) profiler['instancedLinesCount'] += count * primcount // assuming divisor 1
    if (mode === gl.TRIANGLES) profiler['instancedTrianglesCount'] += count * primcount // assuming divisor 1
    profiler.drawArraysInstancedCount++
  })

  function resetFrameStats() {
    profiler.bindTextureCount = 0
    profiler.useProgramCount = 0
    profiler.setUniformCount = 0
    profiler.linesCount = 0
    profiler.trianglesCount = 0
    profiler.instancedLinesCount = 0
    profiler.instancedTrianglesCount = 0
    profiler.drawElementsCount = 0
    profiler.drawElementsInstancedCount = 0
    profiler.drawArraysCount = 0
    profiler.drawArraysInstancedCount = 0
  }

  return profiler
}

export default createProfiler

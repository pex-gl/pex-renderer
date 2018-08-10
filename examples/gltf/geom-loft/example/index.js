'use strict'
const gl = require('pex-gl')(1280, 720)
const regl = require('regl')(gl)
const mat4 = require('pex-math/mat4')
const vec2 = require('pex-math/vec2')
const createCube = require('primitive-cube')
const camera = require('pex-cam/perspective')({
  fov: Math.PI / 3,
  aspect: gl.canvas.width / gl.canvas.height,
  near: 0.1,
  far: 100
})
const orbiter = require('pex-cam/orbiter')({ camera: camera })
const extrude = require('extrude-by-path')
const createLoft = require('../')
const computeNormals = require('angle-normals')
const triangulate = require('geom-triangulate')
const splinePoints = require('../../geom-spline-points')

const modelMatrix = mat4.create()

const shape = [[-1, -1], [1, -1], [1, 1], [-1, 1]]

const path = []
for (var i = 0; i < 10; i++) {
  path.push([0.3 * Math.sin(i / 10 * 4 * Math.PI), 2 * (i / 10 - 0.5), 0.3 * Math.cos(i / 10 * 4 * Math.PI)])
}
const smoothPath = splinePoints(path, { segmentLength: 1 / 20 })
let radius = smoothPath.map((p, i, points) => [ 0.08 + 0.07 * Math.sin(i / points.length * Math.PI * 4), 0.05])

let g = createLoft(smoothPath, shape, { caps: true, radius: radius })
g.cells = triangulate(g.cells)

const line = {
  positions: g.debugLines
}

const drawMesh = regl({
  attributes: {
    aPosition: g.positions,
    // aNormal: g.positions,
    aNormal: computeNormals(g.cells, g.positions)
  },
  elements: g.cells,
  // count: g.positions.length,
  // primitive: 'lines',
  vert: `
    #ifdef GL_ES
    #pragma glslify: transpose = require(glsl-transpose)
    #endif
    #pragma glslify: inverse = require(glsl-inverse)

    attribute vec3 aPosition;
    attribute vec3 aNormal;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    varying vec3 vNormal;

    void main () {
      mat4 modelViewMatrix = uViewMatrix * uModelMatrix;
      mat3 normalMatrix = mat3(transpose(inverse(modelViewMatrix)));
      vNormal = normalMatrix * aNormal;
      gl_Position = uProjectionMatrix * modelViewMatrix * vec4(aPosition, 1.0);
    }
  `,
  frag: `
    #ifdef GL_ES
    precision highp float;
    #endif

    varying vec3 vNormal;

    void main () {
      gl_FragColor.rgb = vNormal * 0.5 + 0.5;
      // gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);
      gl_FragColor.a = 1.0;
    }
  `,
  uniforms: {
    uProjectionMatrix: () => camera.projectionMatrix,
    uViewMatrix: () => camera.viewMatrix,
    uModelMatrix: modelMatrix
  }
})

const drawLine = regl({
  attributes: {
    aPosition: line.positions
  },
  primitive: 'line',
  count: line.positions.length,
  depth: {
    enable: false
  },
  vert: glsl`
    attribute vec3 aPosition;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    void main () {
      mat4 modelViewMatrix = uViewMatrix * uModelMatrix;
      gl_Position = uProjectionMatrix * modelViewMatrix * vec4(aPosition, 1.0);
    }
  `,
  frag: `
    #ifdef GL_ES
    precision highp float;
    #endif

    uniform vec4 uColor;

    void main () {
      gl_FragColor.rgb = uColor.rgb;
      gl_FragColor.a = 1.0;
    }
  `,
  uniforms: {
    uProjectionMatrix: () => camera.projectionMatrix,
    uViewMatrix: () => camera.viewMatrix,
    uModelMatrix: mat4.create(),
    uColor: [1, 0, 0, 1]
  }
})

regl.frame(() => {
  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })
  drawMesh()
  drawLine()
})

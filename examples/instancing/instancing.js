const createCube = require('primitive-cube')
const bunny = require('bunny')
const normals = require('normals')
const centerAndNormalize = require('geom-center-and-normalize')
const Vec3 = require('pex-math/Vec3')
const Mat4 = require('pex-math/Mat4')
const Quat = require('pex-math/Quat')
const SimplexNoise = require('simplex-noise')
const R = require('ramda')
const random = require('pex-random')

const createContext = require('../../pex-context')
const raf = require('raf')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const glsl = require('glslify')

const ctx = createContext()

let elapsedSeconds = 0
let prevTime = Date.now()
const noise = new SimplexNoise()

const camera = createCamera({
  fov: 45, // TODO: change fov to radians
  aspect: ctx.gl.canvas.width / ctx.gl.canvas.height,
  position: [3, 0.5, 3],
  target: [0, 0, 0]
})

createOrbiter({ camera: camera, distance: 10 })

const lightCamera = createCamera({
  fov: 45, // TODO: change fov to radians,
  aspect: 1,
  near: 1,
  far: 50,
  position: [1, 14, 1],
  target: [0, 0, 0]
})

const depthMapSize = 1024
const depthMap = ctx.texture2D({
  width: depthMapSize,
  height: depthMapSize,
  format: ctx.PixelFormat.Depth
})
const colorMap = ctx.texture2D({ width: depthMapSize, height: depthMapSize })

const depthPassCmd = {
  name: 'depthPass',
  pass: ctx.pass({
    color: [ colorMap ],
    depth: depthMap,
    clearColor: [1, 0, 0, 1],
    clearDepth: 1
  })
}

const drawPassCmd = {
  name: 'drawPass',
  pass: ctx.pass({
    clearColor: [1, 0, 0, 1],
    clearDepth: 1
  })
}

const showNormalsVert = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
varying vec4 vColor;

void main() {
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
  vColor = vec4(aNormal / 2.0 + 0.5, 1.0);
}
`

const showNormalsInstancedVert = glsl`
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aOffset;
attribute vec3 aScale;
attribute vec4 aRotation;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
varying vec4 vColor;

#pragma glslify: quatToMat4=require(./assets/quat2mat4.glsl)

void main() {
  vec4 position = vec4(aPosition, 1.0);
  position = quatToMat4(aRotation) * position;
  position.xyz *= aScale;
  position.xyz += aOffset;
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * position;
  vColor = vec4(aNormal / 2.0 + 0.5, 1.0);
}
`

const showNormalsFrag = `
#ifdef GL_ES
precision highp float;
#endif

varying vec4 vColor;

void main() {
  gl_FragColor = vColor;
}
`
const shadowMappedVert = `
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform vec4 uDiffuseColor;
attribute vec3 aPosition;
attribute vec3 aNormal;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec4 vColor;

void main() {
  mat4 modelView = uViewMatrix * uModelMatrix;
  gl_Position = uProjectionMatrix * modelView * vec4(aPosition, 1.0);
  vWorldPosition = (uModelMatrix * vec4(aPosition, 1.0)).xyz;
  vNormal = mat3(modelView) * aNormal;
  vColor = uDiffuseColor;
}
`

const shadowMappedInstancedVert = glsl`
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aOffset;
attribute vec3 aScale;
attribute vec4 aRotation;
attribute vec4 aColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec4 vColor;

#pragma glslify: quatToMat4=require(./assets/quat2mat4.glsl)

void main() {
  mat4 modelView = uViewMatrix * uModelMatrix;
  vec4 position = vec4(aPosition, 1.0);
  position = quatToMat4(aRotation) * position;
  position.xyz *= aScale;
  position.xyz += aOffset;
  gl_Position = uProjectionMatrix * modelView * position;
  vWorldPosition = (uModelMatrix * position).xyz;
  vNormal = mat3(modelView) * aNormal;
  vColor = aColor;
}
`

const shadowMappedFrag = glsl`
#ifdef GL_ES
precision highp float;
#endif
uniform vec4 uAmbientColor;
uniform vec3 uLightPos;
uniform float uWrap;
uniform float uLightNear;
uniform float uLightFar;
uniform sampler2D uDepthMap;
uniform mat4 uLightProjectionMatrix;
uniform mat4 uLightViewMatrix;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec4 vColor;

#pragma glslify: toLinear=require(glsl-gamma/in)
#pragma glslify: toGamma=require(glsl-gamma/out)

//fron depth buf normalized z to linear (eye space) z
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
float ndcDepthToEyeSpace(float ndcDepth) {
  return 2.0 * uLightNear * uLightFar / (uLightFar + uLightNear - ndcDepth * (uLightFar - uLightNear));
}

//fron depth buf normalized z to linear (eye space) z
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
float readDepth(sampler2D depthMap, vec2 coord) {
  float z_b = texture2D(depthMap, coord).r;
  float z_n = 2.0 * z_b - 1.0;
  return ndcDepthToEyeSpace(z_n);
}

void main() {
  vec3 L = normalize(uLightPos);
  vec3 N = normalize(vNormal);
  float NdotL = max(0.0, (dot(N, L) + uWrap) / (1.0 + uWrap));
  vec3 ambient = toLinear(uAmbientColor.rgb);
  vec3 diffuse = toLinear(vColor.rgb);

  vec4 lightViewPosition = uLightViewMatrix * vec4(vWorldPosition, 1.0);
  float lightDist1 = -lightViewPosition.z;
  vec4 lightDeviceCoordsPosition = uLightProjectionMatrix * lightViewPosition;
  vec2 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xy / lightDeviceCoordsPosition.w;
  vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;
  float bias = 0.1;
  float lightDist2 = readDepth(uDepthMap, lightUV);
  
  gl_FragColor.rgb = ambient + NdotL * diffuse;

  if (lightDist1 < lightDist2 + bias)
    gl_FragColor = min(gl_FragColor,  gl_FragColor * vec4(1.0, 1.0, 1.0, 1.0));
  else
    gl_FragColor = min(gl_FragColor, gl_FragColor * vec4(0.05, 0.05, 0.05, 1.0));

  gl_FragColor.rgb = toGamma(gl_FragColor.rgb);

  gl_FragColor.a = 1.0;
}
`

const floor = createCube(5, 0.1, 5)
const drawFloorCmd = {
  name: 'drawFloor',
  pipeline: ctx.pipeline({
    vert: shadowMappedVert,
    frag: shadowMappedFrag,
    depthEnabled: true
  }),
  uniforms: {
    uProjectionMatrix: camera.projectionMatrix,
    uViewMatrix: camera.viewMatrix,
    uModelMatrix: Mat4.create(),
    uWrap: 0,
    uLightNear: lightCamera.near,
    uLightFar: lightCamera.far,
    uLightProjectionMatrix: lightCamera.projectionMatrix,
    uLightViewMatrix: lightCamera.viewMatrix,
    uLightPos: lightCamera.position,
    uDepthMap: depthMap,
    uAmbientColor: [0, 0, 0, 1],
    uDiffuseColor: [1, 1, 1, 1]
  },
  attributes: {
    aPosition: {
      buffer: ctx.vertexBuffer(floor.positions)
    },
    aNormal: {
      buffer: ctx.vertexBuffer(floor.normals)
    }
  },
  indices: {
    buffer: ctx.indexBuffer(floor.cells)
  }
}

const drawFloorDepthCmd = {
  name: 'drawFloorDepth',
  pipeline: ctx.pipeline({
    vert: showNormalsVert,
    frag: showNormalsFrag,
    depthEnabled: true
  }),
  uniforms: {
    uProjectionMatrix: lightCamera.projectionMatrix,
    uViewMatrix: lightCamera.viewMatrix,
    uModelMatrix: Mat4.create()
  },
  attributes: {
    aPosition: {
      buffer: ctx.vertexBuffer(floor.positions)
    },
    aNormal: {
      buffer: ctx.vertexBuffer(floor.normals)
    }
  },
  // FIXME: rename this to indexBuffer?
  indices: {
    buffer: ctx.indexBuffer(floor.cells)
  }
}

const offsets = []
const rotations = []
const scales = []
const colors = []
const numBunnies = 200 // for some reason this is much slower than batching
for (let i = 0; i < numBunnies; i++) {
  const pos = [random.float(-5, 5), random.float(0, 5), random.float(-5, 5)]
  const rotation = Quat.fromDirection(Quat.create(), random.vec3())
  const scale = [0.2, 0.2, 0.2]
  const color = [random.float(), random.float(), random.float(), 1.0]

  offsets.push(pos)
  rotations.push(rotation)
  scales.push(scale)
  colors.push(color)
}

const bunnyBaseVertices = centerAndNormalize(bunny.positions).map((p) => Vec3.scale(p, 2))
const bunnyBaseNormals = normals.vertexNormals(bunny.cells, bunny.positions)
const bunnyNoiseVertices = centerAndNormalize(bunny.positions).map((p) => Vec3.scale(p, 2))

const bunnyPositionBuffer = ctx.vertexBuffer(bunnyBaseVertices)
const bunnyNormalBuffer = ctx.vertexBuffer(bunnyBaseNormals)
const bunnyOffsetsBuffer = ctx.vertexBuffer(offsets)
const bunnyRotationsBuffer = ctx.vertexBuffer(rotations)
const bunnyScalesBuffer = ctx.vertexBuffer(scales)
const bunnyColorsBuffer = ctx.vertexBuffer(colors)

const drawBunnyCmd = {
  name: 'drawBunny',
  pipeline: ctx.pipeline({
    vert: shadowMappedInstancedVert,
    frag: shadowMappedFrag,
    depthEnabled: true
  }),
  uniforms: {
    uProjectionMatrix: camera.projectionMatrix,
    // FIXME: because we pass by reference this matrix will keep updating without us
    // doing anything, is that but or a feature? Should i cache and force uViewMatrix: () => camera.viewMatrix
    // to mark the uniform as "dynamic" ?
    uViewMatrix: camera.viewMatrix,
    uModelMatrix: Mat4.translate(Mat4.create(), [0, 1, 0]),
    uWrap: 0,
    uLightNear: lightCamera.near,
    uLightFar: lightCamera.far,
    uLightProjectionMatrix: lightCamera.projectionMatrix,
    uLightViewMatrix: lightCamera.viewMatrix,
    uLightPos: lightCamera.position,
    uDepthMap: depthMap,
    uAmbientColor: [0, 0, 0, 1],
    uDiffuseColor: [1, 1, 1, 1]
  },
  attributes: {
    aPosition: { buffer: bunnyPositionBuffer },
    aNormal: { buffer: bunnyNormalBuffer },
    aOffset: { buffer: bunnyOffsetsBuffer, divisor: 1 },
    aRotation: { buffer: bunnyRotationsBuffer, divisor: 1 },
    aScale: { buffer: bunnyScalesBuffer, divisor: 1 },
    aColor: { buffer: bunnyColorsBuffer, divisor: 1 }
  },
  // FIXME: rename this to indexBuffer?
  indices: {
    buffer: ctx.indexBuffer(bunny.cells)
  },
  instances: offsets.length
}

const drawBunnyDepthCmd = {
  name: 'drawBunnyDepth',
  pipeline: ctx.pipeline({
    vert: showNormalsInstancedVert,
    frag: showNormalsFrag,
    depthEnabled: true
  }),
  uniforms: {
    uProjectionMatrix: lightCamera.projectionMatrix,
    uViewMatrix: lightCamera.viewMatrix,
    uModelMatrix: Mat4.translate(Mat4.create(), [0, 1, 0])
  },
  attributes: {
    aPosition: { buffer: bunnyPositionBuffer },
    aNormal: { buffer: bunnyNormalBuffer },
    aOffset: { buffer: bunnyOffsetsBuffer, divisor: 1 },
    aRotation: { buffer: bunnyRotationsBuffer, divisor: 1 },
    aScale: { buffer: bunnyScalesBuffer, divisor: 1 },
  },
  // FIXME: rename this to indexBuffer?
  indices: {
    buffer: ctx.indexBuffer(bunny.cells)
  },
  instances: offsets.length
}

function updateTime () {
  const now = Date.now()
  const deltaTime = (now - prevTime) / 1000
  elapsedSeconds += deltaTime
  prevTime = now
}

function updateCamera () {
  const t = elapsedSeconds / 10
  const x = 6 * Math.cos(Math.PI * t)
  const y = 3
  const z = 6 * Math.sin(Math.PI * t)
  camera({ position: [x, y, z] })
}

function updateBunny (ctx) {
  const noiseFrequency = 1
  const noiseScale = 0.1
  for (let i = 0; i < bunnyBaseVertices.length; i++) {
    const v = bunnyNoiseVertices[i]
    const n = bunnyBaseNormals[i]
    Vec3.set(v, bunnyBaseVertices[i])
    const f = noise.noise3D(v[0] * noiseFrequency, v[1] * noiseFrequency, v[2] * noiseFrequency + elapsedSeconds)
    v[0] += n[0] * noiseScale * (f + 1)
    v[1] += n[1] * noiseScale * (f + 1)
    v[2] += n[2] * noiseScale * (f + 1)
  }

  ctx.update(bunnyPositionBuffer, { data: bunnyNoiseVertices })

  const normalData = normals.vertexNormals(bunny.cells, bunnyNoiseVertices)
  ctx.update(bunnyNormalBuffer, { data: normalData })
}

const drawFullscreenQuadCmd = {
  name: 'drawFullscreenQuad',
  pipeline: ctx.pipeline({
    vert: glsl(__dirname + '/glsl/screen-image.vert'),
    frag: glsl(__dirname + '/glsl/screen-image.frag'),
    depthEnabled: false
  }),
  attributes: {
    aPosition: { buffer: ctx.vertexBuffer(new Float32Array(R.flatten([[-1, -1], [-2 / 4, -1], [-2 / 4, -1 / 3], [-1, -1 / 3]]))) },
    aTexCoord0: { buffer: ctx.vertexBuffer(new Float32Array(R.flatten([[0, 0], [1, 0], [1, 1], [0, 1]]))) }
  },
  indices: {
    buffer: ctx.indexBuffer(new Uint16Array(R.flatten([[0, 1, 2], [0, 2, 3]])))
  },
  uniforms: {
    uTexture: depthMap
  }
}

let frameNumber = 0
raf(function frame () {
  updateTime()
  updateCamera()
  updateBunny(ctx)
  if (frameNumber < 3) console.log('frameNumber', frameNumber)
  ctx.debug((++frameNumber) < 3)

  ctx.submit(depthPassCmd, () => {
    ctx.submit(drawFloorDepthCmd)
    ctx.submit(drawBunnyDepthCmd)
  })
  ctx.submit(drawPassCmd, () => {
    ctx.submit(drawFloorCmd)
    ctx.submit(drawBunnyCmd)
    ctx.submit(drawFullscreenQuadCmd)
  })

  raf(frame)
})

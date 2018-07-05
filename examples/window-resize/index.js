const ctx = require('pex-context')()

const renderer = require('../../')({
  ctx: ctx,
  shadowQuality: 4
})
const vec3 = require('pex-math/vec3')
const createCube = require('primitive-cube')

const camera = require('pex-cam/perspective')({
  aspect: ctx.gl.canvas.width / ctx.gl.canvas.height,
  fov: Math.PI / 3,
  near: 0.1,
  far: 100,
  position: [0, 0, -5],
  target: [0, 0, 0]
})

require('pex-cam/orbiter')({ camera: camera })

const cameraEnt = renderer.add(renderer.entity([
  renderer.camera({
    camera: camera,
    ssao: true,
    ssaoRadius: 3,
    ssaoIntensity: 0.5,
    bilateralBlur: true,
    dof: true,
    dofDepth: 4,
    dofRange: 2,
    fxaa: true
  })
]))

renderer.add(renderer.entity([
  renderer.directionalLight({
    direction: vec3.normalize([-1, -1, -1]),
    castShadows: true
  }),
  renderer.skybox({
    sunPosition: [1, 1, 1]
  }),
  renderer.reflectionProbe({
  })
]))

renderer.add(renderer.entity([
  renderer.transform({
    position: [0, -0.55, 0]
  }),
  renderer.geometry(createCube(10, 0.1, 10)),
  renderer.material({
    receiveShadows: true,
    castShadows: true
  })
]))

renderer.add(renderer.entity([
  renderer.geometry(createCube(1, 1, 1)),
  renderer.material({
    baseColor: [1, 1, 1, 1],
    receiveShadows: true,
    castShadows: true
  })
]))

window.addEventListener('resize', () => {
  const W = window.innerWidth
  const H = window.innerHeight
  ctx.gl.canvas.width = W
  ctx.gl.canvas.height = H
  cameraEnt.getComponent('Camera').set({
    viewport: [0, 0, W, H]
  })
})

ctx.frame(() => {
  cameraEnt.getComponent('Camera').set({
    dofDepth: vec3.length(camera.position)
  })
  renderer.draw()
})

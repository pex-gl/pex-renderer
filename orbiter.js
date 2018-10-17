const Signal = require('signals')
const mat4 = require('pex-math/mat4')
const vec3 = require('pex-math/vec3')
const quat = require('pex-math/quat')
const ray = require('pex-geom/ray')
const interpolateAngle = require('interpolate-angle')
const clamp = require('pex-math/utils').clamp
const lerp = require('pex-math/utils').lerp
const toRadians = require('pex-math/utils').toRadians
const toDegrees = require('pex-math/utils').toDegrees
const latLonToXyz = require('latlon-to-xyz')
const xyzToLatLon = require('xyz-to-latlon')
const eventOffset = require('mouse-event-offset')

function offset (e, target) {
  if (e.touches) return eventOffset(e.touches[0], target)
  else return eventOffset(e, target)
}

function getViewRay (camera, x, y, windowWidth, windowHeight) {
  if (camera.frustum) {
    x += camera.frustum.offset[0]
    y += camera.frustum.offset[1]
    windowWidth = camera.frustum.totalSize[0]
    windowHeight = camera.frustum.totalSize[1]
  }
  let nx = 2 * x / windowWidth - 1
  let ny = 1 - 2 * y / windowHeight

  let hNear = 2 * Math.tan(camera.fov / 2) * camera.near
  let wNear = hNear * camera.aspect

  nx *= (wNear * 0.5)
  ny *= (hNear * 0.5)

  let origin = [0, 0, 0]
  let direction = vec3.normalize([nx, ny, -camera.near])
  let ray = [origin, direction]

  return ray
}

function Orbiter (opts) {
  this.type = 'Orbiter'
  this.entity = null
  this.dirty = false
  this.changed = new Signal()

  const initialState = {
    target: [0, 0, 0],
    position: [0, 0, 5],
    matrix: mat4.create(),
    invViewMatrix: mat4.create(),
    dragging: false,
    lat: 0, // Y
    lon: 0, // XZ
    currentLat: 0,
    currentLon: 0,
    easing: 0.1,
    element: opts.element || window,
    width: 0,
    height: 0,
    clickPosWindow: [0, 0],
    dragPos: [0, 0, 0],
    dragPosWindow: [0, 0],
    distance: 1,
    currentDistance: 1,
    minDistance: 0.1,
    maxDistance: 10,
    zoomSlowdown: 400,
    zoom: true,
    pan: true,
    drag: true,
    dragSlowdown: 4,
    clickTarget: [0, 0, 0],
    clickPosPlane: [0, 0, 0],
    dragPosPlane: [0, 0, 0],
    clickPosWorld: [0, 0, 0],
    dragPosWorld: [0, 0, 0],
    panPlane: null,
    autoUpdate: true
  }

  this.set(initialState)
  this.set(opts)
}

Orbiter.prototype.init = function (entity) {
  this.entity = entity
  this.setup()
}

Orbiter.prototype.set = function (opts) {
  Object.assign(this, opts)
  if (opts.target || opts.position) {
    const distance = vec3.distance(this.position, this.target)
    const latLon = xyzToLatLon(vec3.normalize(vec3.sub(vec3.copy(this.position), this.target)))
    this.lat = latLon[0]
    this.lon = latLon[1]
    this.currentLat = this.lat
    this.currentLon = this.lon
    this.distance = distance
    this.currentDistance = this.distance
    this.minDistance = opts.minDistance || distance / 10
    this.maxDistance = opts.maxDistance || distance * 10
  }
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Orbiter.prototype.update = function () {
  const camera = this.entity.getComponent('Camera')
  this.updateMatrix()
  const transformCmp = this.entity.transform
  const transformRotation = transformCmp.rotation
  quat.fromMat4(transformRotation, this.matrix)

  if (camera) {
    transformCmp.set({
      position: this.position,
      rotation: transformRotation
    })
  } else {
    transformCmp.set({
      rotation: transformRotation
    })
  }
}

Orbiter.prototype.updateWindowSize = function () {
  const width = this.element.clientWidth || this.element.innerWidth
  const height = this.element.clientHeight || this.element.innerHeight
  if (width !== this.width) {
    this.width = width
    this.height = height
    this.radius = Math.min(this.width / 2, this.height / 2)
  }
}

Orbiter.prototype.updateMatrix = function () {
  const camera = this.entity.getComponent('Camera')
  const position = this.position
  const target = this.target

  this.lat = clamp(this.lat, -89.5, 89.5)
  this.lon = this.lon % (360)

  this.currentLat = toDegrees(
    interpolateAngle(
      (toRadians(this.currentLat) + 2 * Math.PI) % (2 * Math.PI),
      (toRadians(this.lat) + 2 * Math.PI) % (2 * Math.PI),
      this.easing
    )
  )
  this.currentLon = toDegrees(
    interpolateAngle(
      (toRadians(this.currentLon) + 2 * Math.PI) % (2 * Math.PI),
      (toRadians(this.lon) + 2 * Math.PI) % (2 * Math.PI),
      this.easing
    )
  )
  this.currentDistance = lerp(this.currentDistance, this.distance, this.easing)

  // set new camera position according to the current
  // rotation at distance relative to target
  latLonToXyz(this.currentLat, this.currentLon, position)
  vec3.scale(position, this.currentDistance)
  vec3.add(position, target)
  mat4.identity(this.matrix)

  var up = [0, 1, 0]
  mat4.lookAt(this.matrix, position, target, up)

  if (camera) {
    mat4.invert(this.matrix)
  }
}

Orbiter.prototype.setup = function () {
  const orbiter = this

  function down (x, y, shift) {
    const camera = orbiter.entity.getComponent('Camera')
    orbiter.dragging = true
    orbiter.dragPos[0] = x
    orbiter.dragPos[1] = y
    if (camera && shift && orbiter.pan) {
      orbiter.clickPosWindow[0] = x
      orbiter.clickPosWindow[1] = y
      vec3.set(orbiter.clickTarget, orbiter.target)
      const targetInViewSpace = vec3.multMat4(vec3.copy(orbiter.clickTarget), camera.viewMatrix)
      orbiter.panPlane = [targetInViewSpace, [0, 0, 1]]
      ray.hitTestPlane(
        getViewRay(camera, orbiter.clickPosWindow[0], orbiter.clickPosWindow[1], orbiter.width, orbiter.height),
        orbiter.panPlane[0],
        orbiter.panPlane[1],
        orbiter.clickPosPlane
      )
      ray.hitTestPlane(
        getViewRay(camera, orbiter.dragPosWindow[0], orbiter.dragPosWindow[1], orbiter.width, orbiter.height),
        orbiter.panPlane[0],
        orbiter.panPlane[1],
        orbiter.dragPosPlane
      )
    } else {
      orbiter.panPlane = null
    }
  }

  function move (x, y, shift) {
    const camera = orbiter.entity.getComponent('Camera')
    if (!orbiter.dragging) {
      return
    }
    if (camera && shift && orbiter.panPlane) {
      orbiter.dragPosWindow[0] = x
      orbiter.dragPosWindow[1] = y
      ray.hitTestPlane(
        getViewRay(camera, orbiter.clickPosWindow[0], orbiter.clickPosWindow[1], orbiter.width, orbiter.height),
        orbiter.panPlane[0],
        orbiter.panPlane[1],
        orbiter.clickPosPlane
      )
      ray.hitTestPlane(
        getViewRay(camera, orbiter.dragPosWindow[0], orbiter.dragPosWindow[1], orbiter.width, orbiter.height),
        orbiter.panPlane[0],
        orbiter.panPlane[1],
        orbiter.dragPosPlane
      )
      mat4.set(orbiter.invViewMatrix, camera.viewMatrix)
      mat4.invert(orbiter.invViewMatrix)
      vec3.multMat4(vec3.set(orbiter.clickPosWorld, orbiter.clickPosPlane), orbiter.invViewMatrix)
      vec3.multMat4(vec3.set(orbiter.dragPosWorld, orbiter.dragPosPlane), orbiter.invViewMatrix)
      const diffWorld = vec3.sub(vec3.copy(orbiter.dragPosWorld), orbiter.clickPosWorld)
      const target = vec3.sub(vec3.copy(orbiter.clickTarget), diffWorld)
      orbiter.set({ target: target })
    } else if (orbiter.drag) {
      const dx = x - orbiter.dragPos[0]
      const dy = y - orbiter.dragPos[1]
      orbiter.dragPos[0] = x
      orbiter.dragPos[1] = y

      orbiter.lat += dy / orbiter.dragSlowdown
      orbiter.lon -= dx / orbiter.dragSlowdown
    }
  }

  function up () {
    orbiter.dragging = false
    orbiter.panPlane = null
  }

  function scroll (dy) {
    if (!orbiter.zoom) {
      return
    }
    orbiter.distance *= 1 + dy / orbiter.zoomSlowdown
    orbiter.distance = clamp(orbiter.distance, orbiter.minDistance, orbiter.maxDistance)
  }

  function onMouseDown (e) {
    orbiter.updateWindowSize()
    const pos = offset(e, window)
    down(
      pos[0],
      pos[1],
      e.shiftKey || (e.touches && e.touches.length === 2)
    )
  }

  function onMouseMove (e) {
    const pos = offset(e, window)
    move(
      pos[0],
      pos[1],
      e.shiftKey || (e.touches && e.touches.length === 2)
    )
  }

  function onMouseUp (e) {
    up()
  }

  function onWheel (e) {
    scroll(e.deltaY)
    e.preventDefault()
  }

  function onTouchStart (e) {
    e.preventDefault()
    onMouseDown(e)
  }

  function onTouchMove (e) {
    e.preventDefault()
    onMouseMove(e)
  }

  this._onMouseDown = onMouseDown
  this._onTouchStart = onTouchStart
  this._onMouseMove = onMouseMove
  this._onTouchMove = onTouchMove
  this._onMouseUp = onMouseUp
  this._onWheel = onWheel

  this.element.addEventListener('mousedown', onMouseDown)
  this.element.addEventListener('touchstart', onTouchStart)
  this.element.addEventListener('wheel', onWheel)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('touchend', onMouseUp)
}

Orbiter.prototype.dispose = function () {
  this.element.removeEventListener('mousedown', this._onMouseDown)
  this.element.removeEventListener('touchstart', this._onTouchStart)
  this.element.removeEventListener('wheel', this._onWheel)
  window.removeEventListener('mousemove', this._onMouseMove)
  window.removeEventListener('touchmove', this._onMouseMove)
  window.removeEventListener('mouseup', this._onMouseUp)
  window.removeEventListener('touchend', this._onMouseUp)
}

module.exports = function createOrbiter (opts) {
  return new Orbiter(opts)
}

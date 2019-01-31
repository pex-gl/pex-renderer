const Signal = require('signals')
const mat4 = require('pex-math/mat4')
const vec2 = require('pex-math/vec2')
const vec3 = require('pex-math/vec3')
const quat = require('pex-math/quat')
const clamp = require('pex-math/utils').clamp
const lerp = require('pex-math/utils').lerp
const toRadians = require('pex-math/utils').toRadians
const toDegrees = require('pex-math/utils').toDegrees
const ray = require('pex-geom/ray')
const interpolateAngle = require('interpolate-angle')
const latLonToXyz = require('latlon-to-xyz')
const xyzToLatLon = require('xyz-to-latlon')
const eventOffset = require('mouse-event-offset')

function Orbiter (opts) {
  this.type = 'Orbiter'
  this.enabled = true
  this.changed = new Signal()

  // User options
  this.element = opts.element || document
  this.position = [0, 0, 2]
  this.target = [0, 0, 0]
  this.easing = 0.1
  this.zoom = true
  this.pan = true
  this.drag = true
  this.minDistance = 0.1
  this.maxDistance = 10
  this.minLat = -89.5
  this.maxLat = 89.5
  this.minLon = -Infinity
  this.maxLon = Infinity
  this.panSlowdown = 4
  this.zoomSlowdown = 400
  this.dragSlowdown = 4

  // Internals
  // Set initially by .set
  this.lat = null // Y
  this.lon = null // XZ
  this.currentLat = null
  this.currentLon = null
  this.distance = null
  this.currentDistance = null

  // Updated by user interaction
  this.matrix = mat4.create()
  this.invViewMatrix = mat4.create()
  this.up = [0, 1, 0]
  this.panning = false
  this.dragging = false
  this.zooming = false
  this.width = 0
  this.height = 0

  this.zoomTouchDistance = null

  this.clickTarget = [0, 0, 0]
  this.clickPosWorld = [0, 0, 0]
  this.clickPosWindow = [0, 0]
  this.clickPosPlane = [0, 0, 0]

  this.dragPos = [0, 0, 0]
  this.dragPosWorld = [0, 0, 0]
  this.dragPosWindow = [0, 0]
  this.dragPosPlane = [0, 0, 0]
  this.panPlane = null

  // TODO: add ability to set lat/lng instead of position/target
  this.set({
    position: this.position,
    target: this.target,
    ...opts
  })
}

Orbiter.prototype.init = function (entity) {
  this.entity = entity
  this.setup()
}

Orbiter.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.position || opts.target) {
    const latLon = xyzToLatLon(vec3.normalize(vec3.sub(vec3.copy(this.position), this.target)))
    const distance = opts.distance || vec3.distance(this.position, this.target)

    this.lat = latLon[0]
    this.lon = latLon[1]
    this.currentLat = this.lat
    this.currentLon = this.lon
    this.distance = distance
    this.currentDistance = this.distance
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Orbiter.prototype.update = function () {
  this.updateMatrix()

  const transformCmp = this.entity.transform
  const rotation = quat.fromMat4([...transformCmp.rotation], this.matrix)

  if (this.entity.getComponent('Camera')) {
    transformCmp.set({
      position: this.position,
      rotation
    })
  } else {
    transformCmp.set({
      rotation
    })
  }
}

Orbiter.prototype.updateMatrix = function () {
  this.lat = clamp(this.lat, this.minLat, this.maxLat)
  this.lon = clamp(this.lon, this.minLon, this.maxLon) % 360

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

  // Set position from lat/lon
  latLonToXyz(this.currentLat, this.currentLon, this.position)

  // Move position according to distance and target
  vec3.scale(this.position, this.currentDistance)
  vec3.add(this.position, this.target)

  // Update matrix
  mat4.identity(this.matrix)
  mat4.lookAt(this.matrix, this.position, this.target, this.up)

  if (this.entity.getComponent('Camera')) {
    mat4.invert(this.matrix)
  }
}

Orbiter.prototype.updateWindowSize = function () {
  const width = this.element.clientWidth || this.element.innerWidth
  const height = this.element.clientHeight || this.element.innerHeight

  if (width !== this.width) {
    this.width = width
    this.height = height
  }
}

// User interaction events
Orbiter.prototype.handleDragStart = function (position) {
  this.dragging = true
  this.dragPos = position
}

Orbiter.prototype.handlePanZoomStart = function (touch0, touch1) {
  this.dragging = false

  if (this.zoom && touch1) {
    this.zooming = true
    this.zoomTouchDistance = vec2.distance(touch1, touch0)
  }

  const camera = this.entity.getComponent('Camera')

  if (this.pan && camera) {
    this.panning = true
    this.updateWindowSize()

    // TODO: use dragPos?
    this.clickPosWindow = touch1 ? [(touch0[0] + touch1[0]) * 0.5, (touch0[1] + touch1[1]) * 0.5] : touch0
    vec3.set(this.clickTarget, this.target)

    const targetInViewSpace = vec3.multMat4(vec3.copy(this.clickTarget), camera.viewMatrix)
    this.panPlane = [targetInViewSpace, [0, 0, 1]]

    ray.hitTestPlane(
      camera.getViewRay(this.clickPosWindow[0], this.clickPosWindow[1], this.width, this.height),
      this.panPlane[0],
      this.panPlane[1],
      this.clickPosPlane
    )
    ray.hitTestPlane(
      camera.getViewRay(this.dragPosWindow[0], this.dragPosWindow[1], this.width, this.height),
      this.panPlane[0],
      this.panPlane[1],
      this.dragPosPlane
    )
  }
}

Orbiter.prototype.handleDragMove = function (position) {
  const dx = position[0] - this.dragPos[0]
  const dy = position[1] - this.dragPos[1]

  this.dragPos = position

  this.lat += dy / this.dragSlowdown
  this.lon -= dx / this.dragSlowdown
}

Orbiter.prototype.handlePanZoomMove = function (touch0, touch1) {
  if (this.zoom && touch1) {
    const distance = vec2.distance(touch1, touch0)
    this.handleZoom(this.zoomTouchDistance - distance)
    this.zoomTouchDistance = distance
  }

  const camera = this.entity.getComponent('Camera')

  if (this.pan && camera) {
    this.dragPosWindow = touch1 ? [(touch0[0] + touch1[0]) * 0.5, (touch0[1] + touch1[1]) * 0.5] : touch0

    ray.hitTestPlane(
      camera.getViewRay(this.clickPosWindow[0], this.clickPosWindow[1], this.width, this.height),
      this.panPlane[0],
      this.panPlane[1],
      this.clickPosPlane
    )
    ray.hitTestPlane(
      camera.getViewRay(this.dragPosWindow[0], this.dragPosWindow[1], this.width, this.height),
      this.panPlane[0],
      this.panPlane[1],
      this.dragPosPlane
    )
    mat4.set(this.invViewMatrix, camera.viewMatrix)
    mat4.invert(this.invViewMatrix)
    vec3.multMat4(vec3.set(this.clickPosWorld, this.clickPosPlane), this.invViewMatrix)
    vec3.multMat4(vec3.set(this.dragPosWorld, this.dragPosPlane), this.invViewMatrix)

    const diffWorld = vec3.sub(vec3.copy(this.dragPosWorld), this.clickPosWorld)
    this.set({
      distance: this.distance,
      target: vec3.sub(vec3.copy(this.clickTarget), diffWorld)
    })
  }
}

Orbiter.prototype.handleZoom = function (dy) {
  this.distance *= 1 + dy / this.zoomSlowdown
  this.distance = clamp(this.distance, this.minDistance, this.maxDistance)
}

Orbiter.prototype.handleEnd = function () {
  this.dragging = false
  this.panning = false
  this.zooming = false
  this.panPlane = null
}

Orbiter.prototype.setup = function () {
  this.onPointerDown = (event) => {
    if (!this.enabled) return

    const pan = (event.ctrlKey || event.metaKey || event.shiftKey) || (event.touches && event.touches.length === 2)

    const touch0 = eventOffset(event.touches ? event.touches[0] : event, this.element)
    if (this.drag && !pan) {
      this.handleDragStart(touch0);
    } else if ((this.pan || this.zoom) && pan) {
      const touch1 = event.touches && eventOffset(event.touches[1], this.element)
      this.handlePanZoomStart(touch0, touch1);
    }
  }

  this.onPointerMove = (event) => {
    if (!this.enabled) return

    const touch0 = eventOffset(event.touches ? event.touches[0] : event, this.element)
    if (this.dragging) {
      this.handleDragMove(touch0)
    } else if (this.panning || this.zooming) {
      const touch1 = event.touches && eventOffset(event.touches[1], this.element)
      this.handlePanZoomMove(touch0, touch1)
    }
  }

  this.onPointerUp = () => {
    if (!this.enabled) return

    this.handleEnd()
  }

  this.onTouchStart = (event) => {
    event.preventDefault()

    if (event.touches.length <= 2) this.onPointerDown(event)
  }

  this.onTouchMove = (event) => {
    event.preventDefault()

    if (event.touches.length <= 2) this.onPointerMove(event)
  }

  this.onWheel = (event) => {
    if (!this.enabled || !this.zoom) return

    event.preventDefault()
    this.handleZoom(event.deltaY)
  }

  this.element.addEventListener('mousedown', this.onPointerDown)
  this.element.addEventListener('wheel', this.onWheel)

  this.element.addEventListener('touchstart', this.onTouchStart)
  this.element.addEventListener('touchmove', this.onTouchMove, { passive: false })
  this.element.addEventListener('touchend', this.onPointerUp)

  document.addEventListener('mousemove', this.onPointerMove)
  document.addEventListener('mouseup', this.onPointerUp)
}

Orbiter.prototype.dispose = function () {
  this.element.removeEventListener('mousedown', this.onPointerDown)
  this.element.removeEventListener('wheel', this.onWheel)

  this.element.removeEventListener('touchstart', this.onTouchStart)
  this.element.removeEventListener('touchmove', this.onPointerMove)
  this.element.removeEventListener('touchend', this.onPointerUp)

  document.removeEventListener('mousemove', this.onPointerMove)
  document.removeEventListener('mouseup', this.onPointerUp)
}

module.exports = function createOrbiter (opts) {
  return new Orbiter(opts)
}

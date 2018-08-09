import Signal from 'signals'
import { mat4, vec3, quat, utils } from 'pex-math'
import { ray } from 'pex-geom'
import interpolateAngle from 'interpolate-angle'
import latLonToXyz from 'latlon-to-xyz'
import xyzToLatLon from 'xyz-to-latlon'
import offset from 'mouse-event-offset'

class Orbiter {
  constructor(opts) {
    this.type = 'Orbiter'
    this.entity = null
    this.dirty = false
    this.changed = new Signal()

    const initialState = {
      target: [0, 0, 0],
      position: [0, 0, 5],
      invViewMatrix: mat4.create(),
      dragging: false,
      lat: 0, // Y
      lon: 0, // XZ
      currentLat: 0,
      currentLon: 0,
      easing: 1,
      element: opts.element || window,
      width: 0,
      height: 0,
      clickPosWindow: [0, 0],
      dragPos: [0, 0, 0],
      dragPosWindow: [0, 0],
      distance: 1,
      currentDistance: 1,
      minDistance: 1,
      maxDistance: 1,
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

  init(entity) {
    this.entity = entity
    this.setup()
  }

  set(opts) {
    console.log('set', opts, this)
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
    Object.keys(opts).forEach(prop => this.changed.dispatch(prop))
  }

  update() {
    this.updateCamera()
    const camera = this.entity.getComponent('Camera')

    const transformCmp = this.entity.transform
    const transformRotation = transformCmp.rotation
    mat4.set(tempmat4, camera.viewMatrix)
    mat4.invert(tempmat4)
    quat.fromMat4(transformRotation, tempmat4)
    transformCmp.set({
      position: this.position,
      rotation: transformRotation
    })
  }

  updateWindowSize() {
    const width = this.element.clientWidth || this.element.innerWidth
    const height = this.element.clientHeight || this.element.innerHeight
    if (width !== this.width) {
      this.width = width
      this.height = height
      this.radius = Math.min(this.width / 2, this.height / 2)
    }
  }

  updateCamera() {
    const position = this.position
    const target = this.target
    const camera = this.entity.getComponent('Camera')

    this.lat = utils.clamp(this.lat, -89.5, 89.5)
    this.lon = this.lon % 360

    this.currentLat = utils.toDegrees(
      interpolateAngle(
        (utils.toRadians(this.currentLat) + 2 * Math.PI) % (2 * Math.PI),
        (utils.toRadians(this.lat) + 2 * Math.PI) % (2 * Math.PI),
        this.easing
      )
    )
    this.currentLon = utils.toDegrees(
      interpolateAngle(
        (utils.toRadians(this.currentLon) + 2 * Math.PI) % (2 * Math.PI),
        (utils.toRadians(this.lon) + 2 * Math.PI) % (2 * Math.PI),
        this.easing
      )
    )
    this.currentDistance = utils.lerp(this.currentDistance, this.distance, this.easing)

    // set new camera position according to the current
    // rotation at distance relative to target
    latLonToXyz(this.currentLat, this.currentLon, position)
    vec3.scale(position, this.currentDistance)
    vec3.add(position, target)
    mat4.identity(camera.viewMatrix)

    const up = [0, 1, 0]
    mat4.lookAt(camera.viewMatrix, position, target, up)
  }

  setup() {
    const orbiter = this
    const camera = this.entity.getComponent('Camera')

    function down(x, y, shift) {
      orbiter.dragging = true
      orbiter.dragPos[0] = x
      orbiter.dragPos[1] = y
      if (shift && orbiter.pan) {
        orbiter.clickPosWindow[0] = x
        orbiter.clickPosWindow[1] = y
        vec3.set(orbiter.clickTarget, orbiter.target)
        const targetInViewSpace = vec3.multMat4(vec3.copy(orbiter.clickTarget), camera.viewMatrix)
        orbiter.panPlane = [targetInViewSpace, [0, 0, 1]]
        ray.hitTestPlane(
          camera.getViewRay(
            orbiter.clickPosWindow[0],
            orbiter.clickPosWindow[1],
            orbiter.width,
            orbiter.height
          ),
          orbiter.panPlane[0],
          orbiter.panPlane[1],
          orbiter.clickPosPlane
        )
        ray.hitTestPlane(
          camera.getViewRay(
            orbiter.dragPosWindow[0],
            orbiter.dragPosWindow[1],
            orbiter.width,
            orbiter.height
          ),
          orbiter.panPlane[0],
          orbiter.panPlane[1],
          orbiter.dragPosPlane
        )
      } else {
        orbiter.panPlane = null
      }
    }

    function move(x, y, shift) {
      if (!orbiter.dragging) {
        return
      }
      if (shift && orbiter.panPlane) {
        orbiter.dragPosWindow[0] = x
        orbiter.dragPosWindow[1] = y
        ray.hitTestPlane(
          camera.getViewRay(
            orbiter.clickPosWindow[0],
            orbiter.clickPosWindow[1],
            orbiter.width,
            orbiter.height
          ),
          orbiter.panPlane[0],
          orbiter.panPlane[1],
          orbiter.clickPosPlane
        )
        ray.hitTestPlane(
          camera.getViewRay(
            orbiter.dragPosWindow[0],
            orbiter.dragPosWindow[1],
            orbiter.width,
            orbiter.height
          ),
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
        orbiter.set({ target })
        orbiter.updateCamera()
      } else if (orbiter.drag) {
        const dx = x - orbiter.dragPos[0]
        const dy = y - orbiter.dragPos[1]
        orbiter.dragPos[0] = x
        orbiter.dragPos[1] = y

        orbiter.lat += dy / orbiter.dragSlowdown
        orbiter.lon -= dx / orbiter.dragSlowdown

        // TODO: how to have resolution independed scaling? will this code behave differently with retina/pixelRatio=2?
        orbiter.updateCamera()
      }
    }

    function up() {
      orbiter.dragging = false
      orbiter.panPlane = null
    }

    function scroll(dy) {
      if (!orbiter.zoom) {
        return
      }
      orbiter.distance *= 1 + dy / orbiter.zoomSlowdown
      orbiter.distance = utils.clamp(orbiter.distance, orbiter.minDistance, orbiter.maxDistance)
      orbiter.updateCamera()
    }

    function onMouseDown(e) {
      orbiter.updateWindowSize()
      const pos = offset(e, window)
      down(pos[0], pos[1], e.shiftKey || (e.touches && e.touches.length === 2))
    }

    function onMouseMove(e) {
      const pos = offset(e, window)
      move(pos[0], pos[1], e.shiftKey || (e.touches && e.touches.length === 2))
    }

    function onMouseUp(e) {
      up()
    }

    function onWheel(e) {
      scroll(e.deltaY)
      e.preventDefault()
    }

    function onTouchStart(e) {
      e.preventDefault()
      onMouseDown(e)
    }

    this._onMouseDown = onMouseDown
    this._onTouchStart = onTouchStart
    this._onMouseMove = onMouseMove
    this._onMouseUp = onMouseUp
    this._onWheel = onWheel

    this.element.addEventListener('mousedown', onMouseDown)
    this.element.addEventListener('touchstart', onTouchStart)
    this.element.addEventListener('wheel', onWheel)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('touchmove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchend', onMouseUp)

    this.updateCamera()
  }

  dispose() {
    this.element.removeEventListener('mousedown', this._onMouseDown)
    this.element.removeEventListener('touchstart', this._onTouchStart)
    this.element.removeEventListener('wheel', this._onWheel)
    window.removeEventListener('mousemove', this._onMouseMove)
    window.removeEventListener('touchmove', this._onMouseMove)
    window.removeEventListener('mouseup', this._onMouseUp)
    window.removeEventListener('touchend', this._onMouseUp)
  }
}

const tempmat4 = mat4.create()

export default function createOrbiter(opts) {
  return new Orbiter(opts)
}

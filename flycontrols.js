const Signal = require('signals')
const mat4 = require('pex-math/mat4')
const vec3 = require('pex-math/vec3')
const quat = require('pex-math/quat')
const euler = require('pex-math/euler')


function Flycontrols (opts) {
  this.type = 'Flycontrols'
  this.enabled = true
  this.changed = new Signal()
  this.entity = null
  this.dirty = false
  this.camera =  false
  this.currentYaw = [0,0,0,1]
  this.currentPitch = [0,0,0,1]

  this.isLocked = false

  this.moveForward = false 
  this.moveLeft = false
  this.moveBackward = false
  this.moveRight = false
  this.moveUp = false
  this.moveDown = false

  const initialState = {
    position: [0, 1, 0],
    element: opts.element || document,
    flySpeed : 0.1,
    sensitivityX : 0.005,
    sensitivityY : 0.005,
    developerMode : false
  }

  this.set(initialState)
  this.set(opts)
}

Flycontrols.prototype.init = function (entity) {
  this.entity = entity
  this.setup()
}

Flycontrols.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Flycontrols.prototype.update = function () {
  if(this.moveForward || 
    this.moveBackward || 
    this.moveLeft || 
    this.moveRight ||
    this.moveUp || 
    this.moveDown ){
    let dir = [0,0,0]; 

    if(this.moveForward ) vec3.add(dir,[0,0,-1])
    if(this.moveBackward) vec3.add(dir,[0,0,1])
    if(this.moveLeft) vec3.add(dir,[-1,0,0])
    if(this.moveRight) vec3.add(dir,[1,0,0])

    let vec = vec3.multQuat(dir,this.entity.transform.rotation)

    if(this.moveUp) vec3.add(vec,[0,1,0])
    if(this.moveDown) vec3.add(vec,[0,-1,0])

    vec3.normalize(vec)
    vec3.scale(vec,this.flySpeed)
    let newPos = vec3.add(this.entity.transform.position,vec)
    this.entity.transform.set({ position : newPos})
  }

}

Flycontrols.prototype.updateWindowSize = function () {

}


Flycontrols.prototype.setup = function () {
  var flycontrols = this;
  if(!this.camera) this.camera = this.entity.getComponent('Camera') || false
  
  this.entity.transform.set({ position : flycontrols.position})

  function onMouseDown (e) {
    if (!flycontrols.enabled) return
    if (flycontrols.developerMode && e.button == 0)document.body.requestPointerLock();

  }

  function onMouseMove (e) {
    if (!flycontrols.enabled) return
    if(document.pointerLockElement){
        var movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
        var movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

        quat.mult(flycontrols.currentYaw, quat.fromAxisAngle(quat.create(), [0,1,0], -movementX * flycontrols.sensitivityX))
        quat.mult(flycontrols.currentPitch, quat.fromAxisAngle(quat.create(), [1,0,0], -movementY * flycontrols.sensitivityY))

        let newRot = quat.mult(quat.mult([0,0,0,1],flycontrols.currentYaw),flycontrols.currentPitch)
        
        flycontrols.entity.transform.set({rotation : newRot})
    }
  }

  function onMouseUp (e) {
    if (!flycontrols.enabled) return
    !flycontrols.developerMode ? document.body.requestPointerLock() :  document.exitPointerLock();
  }

  function onKeyDown(e) {
		e.preventDefault();
		switch ( e.keyCode ) {

			case 38: /*up*/
			case 87: /*W*/ flycontrols.moveForward = true; break;

			case 37: /*left*/
			case 65: /*A*/ flycontrols.moveLeft = true; break;

			case 40: /*down*/
			case 83: /*S*/ flycontrols.moveBackward = true; break;

			case 39: /*right*/
			case 68: /*D*/ flycontrols.moveRight = true; break;

      case 32: /*space*/ flycontrols.moveUp = true; break;

			case 16: /*shift*/ flycontrols.moveDown = true; break;
		}
	}

	function onKeyUp (e) {
		switch (e.keyCode) {
			case 38: /*up*/
			case 87: /*W*/ flycontrols.moveForward = false; break;

			case 37: /*left*/
			case 65: /*A*/ flycontrols.moveLeft = false; break;

			case 40: /*down*/
			case 83: /*S*/ flycontrols.moveBackward = false; break;

			case 39: /*right*/
			case 68: /*D*/ flycontrols.moveRight = false; break;

      case 32: /*space*/ flycontrols.moveUp = false; break;
      
			case 16: /*shift*/ flycontrols.moveDown = false; break;
		}
	};

  this._onMouseDown = onMouseDown
  this._onMouseMove = onMouseMove
  this._onMouseUp = onMouseUp

  this._onKeyUp = onKeyUp
  this._onKeyDown = onKeyDown

  this.element.addEventListener('mousedown', onMouseDown)

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
}

Flycontrols.prototype.dispose = function () {
  this.element.removeEventListener('mousedown', this._onMouseDown)

  this.element.removeEventListener('touchend', this._onMouseUp)

  document.removeEventListener('mousemove', this._onMouseMove)
  document.removeEventListener('mouseup', this._onMouseUp)
}

module.exports = function createFlycontrols (opts) {
  return new Flycontrols(opts)
}

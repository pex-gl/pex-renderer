const quat = require('pex-math/quat')
const vec3 = require('pex-math/vec3')
const vec4 = require('pex-math/vec4')
const utils = require('pex-math/utils')
const Signal = require('signals')

let currentOutputVec3 = vec3.create()
let currentOutputQuat = quat.create()

// Assumptions:
// - all channels have the same time length
// - animation channels can reference other entities
// - currently all animations track time by themselves
function Animation(opts) {
  this.type = 'Animation'
  this.entity = null
  this.enabled = true
  this.playing = false
  this.loop = false
  this.time = 0 // seconds
  this.duration = 0 // seconds
  // Delegate applying transformation of target to the mixer
  this.mixed = false
  // Influence of this action, used to blend between several actions
  this.weight = 1
  this.prevTime = Date.now() // ms
  this.channels = opts.channels || []
  this.changed = new Signal()
  this.needsUpdate = true
  this.set(opts)
}

Animation.prototype.init = function(entity) {
  this.entity = entity
}

Animation.prototype.set = function(opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))

  if (opts.autoplay || opts.playing) {
    this.playing = true
    this.duration = this.channels[0].input[this.channels[0].input.length - 1]
    // reset timer to avoid jumps
    this.time = 0
    this.prevTime = Date.now()
  }

  this.needsUpdate = true
}

Animation.prototype.fadeIn = function(duration) {
  const now = Date.now()
  this.startFadeTime = now
  this.endFadeTime = now + duration
  this.weight = 0
  this.startFadeWeight = this.weight
  this.endFadeWeight = 1
}
Animation.prototype.fadeOut = function(duration) {
  const now = Date.now()
  this.startFadeTime = now
  this.endFadeTime = now + duration
  this.startFadeWeight = this.weight
  this.endFadeWeight = 0
}

Animation.prototype.update = function() {
  if (!this.enabled) return

  // TODO: maybe move all time and loop related code to animation-mixer?
  if (this.playing) {
    const now = Date.now()
    const deltaTime = (now - this.prevTime) / 1000

    this.prevTime = now
    this.time += deltaTime

    if (this.mixed && this.startFadeTime) {
      // Interpolate weight
      const t =
        (now - this.startFadeTime) / (this.endFadeTime - this.startFadeTime)
      const currentWeight =
        this.startFadeWeight + t * (this.endFadeWeight - this.startFadeWeight)

      this.weight = currentWeight


      if (currentWeight >= 1) {
        this.startFadeTime = null
        this.endFadeTime = null
        this.startFadeWeight = null
        this.endFadeWeight = null
        this.weight = 1
      } else if (currentWeight <= 0) {
        this.time = 0
        // TODO: Is this the right place to reset?
        this.set({ playing: false, weight: 1 })

        this.startFadeTime = null
        this.endFadeTime = null
        this.startFadeWeight = null
        this.endFadeWeight = null
      }
    }

    if (this.time > this.duration) {
      if (this.loop) {
        this.time %= this.duration
      } else {
        this.time = 0
        this.set({ playing: false })
      }
    }

    this.needsUpdate = true
  }

  if (!this.needsUpdate) return

  this.needsUpdate = false

  for (let i = 0; i < this.channels.length; i++) {
    const channel = this.channels[i]
    const inputData = channel.input

    let prevIndex
    let nextIndex

    for (let j = 0; j < inputData.length; j++) {
      nextIndex = j
      if (inputData[j] >= this.time) {
        break
      }
      prevIndex = nextIndex
    }

    const isRotation = channel.path === 'rotation'
    const outputData = channel.output
    const prevInput = inputData[prevIndex]
    const nextInput = inputData[nextIndex]
    const scale = nextInput - prevInput || 1

    const t = (this.time - prevInput) / scale

    if (prevIndex !== undefined) {
      switch (channel.interpolation) {
        case 'STEP':
          if (isRotation) {
            quat.set(currentOutputQuat, outputData[prevIndex])
          } else {
            vec3.set(currentOutputVec3, outputData[prevIndex])
          }
          break
        case 'CUBICSPLINE': {
          const vec = isRotation ? vec4 : vec3
          const tt = t * t
          const ttt = tt * t

          // Each input value corresponds to three output values of the same type: in-tangent, data point, and out-tangent.
          // p0
          const prevPosition = vec.copy(outputData[prevIndex * 3 + 1])

          // p1
          const nextPos = vec.copy(outputData[nextIndex * 3 + 1])

          // m0 = (tk+1 - tk)bk
          const prevOutTangent = prevIndex
            ? vec.scale(vec.copy(outputData[prevIndex * 3 + 2]), scale)
            : vec.create()

          // m1 = (tk+1 - tk)ak+1
          const nextInTangent =
            nextIndex !== inputData.length - 1
              ? vec.scale(vec.copy(outputData[prevIndex * 3]), scale)
              : vec.create()

          // p(t) = (2t³ - 3t² + 1)p0 + (t³ - 2t² + t)m0 + (-2t³ + 3t²)p1 + (t³ - t²)m1
          const p0 = vec.scale(prevPosition, 2 * ttt - 3 * tt + 1)
          const m0 = vec.scale(prevOutTangent, ttt - 2 * tt + t)
          const p1 = vec.scale(nextPos, -2 * ttt + 3 * tt)
          const m1 = vec.scale(nextInTangent, ttt - tt)

          if (isRotation) {
            quat.set(
              currentOutputQuat,
              quat.normalize([
                p0[0] + m0[0] + p1[0] + m1[0],
                p0[1] + m0[1] + p1[1] + m1[1],
                p0[2] + m0[2] + p1[2] + m1[2],
                p0[3] + m0[3] + p1[3] + m1[3]
              ])
            )
          } else {
            vec3.set(
              currentOutputVec3,
              vec3.add(vec3.add(vec3.add(p0, m0), p1), m1)
            )
          }

          break
        }
        default:
          // LINEAR
          if (isRotation) {
            quat.slerp(
              quat.set(currentOutputQuat, outputData[prevIndex]),
              outputData[nextIndex],
              t
            )
          } else {
            vec3.set(
              currentOutputVec3,
              outputData[nextIndex].map((output, index) =>
                utils.lerp(outputData[prevIndex][index], output, t)
              )
            )
          }
      }

      if (isRotation) {
        const rotation = quat.copy(currentOutputQuat)
        // TODO: make more general (enforcing animation mixer?)
        if (this.mixed) {
          // They need to be reset on every frame (done in mixer)
          channel.target.rotations = channel.target.rotations || []
          // TODO: adding value to array object, this is ugly
          rotation.weight = this.weight
          channel.target.rotations.push(rotation)
        } else {
          channel.target.transform.set({
            rotation
          })
        }
      } else if (channel.path === 'translation') {
        const position = vec3.copy(currentOutputVec3)
        if (this.mixed) {
          channel.target.positions = channel.target.positions || []
          position.weight = this.weight
          channel.target.positions.push(position)
        } else {
          channel.target.transform.set({
            position
          })
        }
      } else if (channel.path === 'scale') {
        const scale = vec3.copy(currentOutputVec3)
        if (this.mixed) {
          channel.target.scales = channel.target.scales || []
          scale.weight = this.weight
          channel.target.scales.push(scale)
        } else {
          channel.target.transform.set({
            scale
          })
        }
      } else if (channel.path === 'weights') {
        const weights = outputData[nextIndex].slice()
        if (this.mixed) {
          channel.target.weights = channel.target.weights || []
          channel.target.weights.push(weights)
        } else {
          channel.target.getComponent('Morph').set({
            weights
          })
        }
      }
    }
  }
}

module.exports = function createMorph(opts) {
  return new Animation(opts)
}

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
function Animation (opts) {
  this.type = 'Animation'
  this.entity = null
  this.enabled = true
  this.playing = false
  this.loop = false
  this.time = 0 // seconds
  this.prevTime = Date.now() // ms
  this.channels = opts.channels || []
  this.changed = new Signal()
  this.set(opts)
}

Animation.prototype.init = function (entity) {
  this.entity = entity
}

Animation.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))

  if (opts.autoplay || opts.playing) {
    this.playing = true
    // reset timer to avoid jumps
    this.time = 0
    this.prevTime = Date.now()
  }
}

Animation.prototype.update = function () {
  if (!this.playing || !this.enabled) return

  // assuming same length for all
  const animationLength = this.channels[0].input[this.channels[0].input.length - 1]

  const now = Date.now()
  const deltaTime = (now - this.prevTime) / 1000
  this.prevTime = now
  this.time += deltaTime

  if (this.time > animationLength) {
    if (this.loop) {
      this.time %= animationLength
    } else {
      this.time = 0
      this.set({ playing: false })
    }
  }

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

    if (prevIndex === undefined) return

    const isRotation = channel.path === 'rotation'
    const outputData = channel.output
    const prevInput = inputData[prevIndex]
    const nextInput = inputData[nextIndex]
    const prevOutput = outputData[prevIndex]
    const nextOutput = outputData[nextIndex]

    const t = (this.time - prevInput) / (nextInput - prevInput)

    switch (channel.interpolation) {
      case 'STEP':
        if (isRotation) {
          currentOutputQuat = quat.copy(outputData[prevIndex])
        } else {
          currentOutputVec3 = vec3.copy(outputData[prevIndex])
        }
        break
      case 'CUBICSPLINE':
        // intangent = index
        // position = index+1
        // outtangent = index+2

        let prevOutTangent = isRotation ? vec4.create() : vec3.create()
        let prevPosition = isRotation ? vec4.create() : vec3.create()
        let nextInTangent = isRotation ? vec4.create() : vec3.create()
        let nextPos = isRotation ? vec4.create() : vec3.create()

        if (prevIndex) {
          // m0 = (tk+1 - tk)bk
          prevOutTangent = isRotation ? vec4.scale(outputData[(prevIndex * 3) + 2].slice(), (nextInput - prevInput)) : vec3.scale(outputData[(prevIndex * 3) + 2].slice(), (nextInput - prevInput))
        } else {
          prevOutTangent = isRotation ? vec4.scale([0, 0, 0, 0], (nextInput - prevInput)) : vec3.scale([0, 0, 0], (nextInput - prevInput))
        }
        // p0
        prevPosition = outputData[(prevIndex * 3) + 1].slice()

        if (nextIndex !== (inputData.length - 1)) {
          // m1 = (tk+1 - tk)ak+1
          nextInTangent = isRotation ? vec4.scale(outputData[(prevIndex * 3)].slice(), (nextInput - prevInput)) : vec3.scale(outputData[(prevIndex * 3)].slice(), (nextInput - prevInput))
        } else {
          nextInTangent = isRotation ? vec4.scale([0, 0, 0, 0], (nextInput - prevInput)) : vec3.scale([0, 0, 0], (nextInput - prevInput))
        }
        // p1
        nextPos = outputData[(nextIndex * 3) + 1].slice()

        // p(t) =
        //  (2t^3 - 3t^2 + 1)p0 + //p0Calc
        //  (t^3 - 2t^2 + t)m0 +  //m0Calc
        //  (-2t^3 + 3t^2)p1 +  //p1Calc
        //  (t^3 - t^2)m1 //m1Calc

        const tt = t * t
        const ttt = tt * t

        if (isRotation) {
          const p0Calc = vec4.scale(prevPosition, ((2 * ttt) - (3 * tt) + 1))
          const m0Calc = vec4.scale(prevOutTangent, (ttt - (2 * tt) + t))
          const p1Calc = vec4.scale(nextPos, ((-2 * ttt) + (3 * tt)))
          const m1Calc = vec4.scale(nextInTangent, (ttt - tt))

          currentOutputQuat = quat.normalize([
            p0Calc[0] + m0Calc[0] + p1Calc[0] + m1Calc[0],
            p0Calc[1] + m0Calc[1] + p1Calc[1] + m1Calc[1],
            p0Calc[2] + m0Calc[2] + p1Calc[2] + m1Calc[2],
            p0Calc[3] + m0Calc[3] + p1Calc[3] + m1Calc[3]
          ])
        } else {
          const p0Calc = vec3.scale(prevPosition, ((2 * ttt) - (3 * tt) + 1))
          const m0Calc = vec3.scale(prevOutTangent, (ttt - (2 * tt) + t))
          const p1Calc = vec3.scale(nextPos, ((-2 * ttt) + (3 * tt)))
          const m1Calc = vec3.scale(nextInTangent, (ttt - tt))

          currentOutputVec3 = vec3.add(vec3.add(vec3.add(p0Calc, m0Calc), p1Calc), m1Calc)
        }

        break
      default: // LINEAR
        if (isRotation) {
          currentOutputQuat = quat.copy(prevOutput)
          quat.slerp(currentOutputQuat, nextOutput, t)
        } else {
          currentOutputVec3 = nextOutput.map((output, index) => utils.lerp(prevOutput[index], output, t))
        }
    }

    if (isRotation) {
      channel.target.transform.set({
        rotation: currentOutputQuat
      })
    } else if (channel.path === 'translation') {
      channel.target.transform.set({
        position: currentOutputVec3
      })
    } else if (channel.path === 'scale') {
      channel.target.transform.set({
        scale: currentOutputVec3
      })
    } else if (channel.path === 'weights') {
      channel.target.getComponent('Morph').set({
        weights: nextOutput
      })
    }
  }
}

module.exports = function createMorph (opts) {
  return new Animation(opts)
}

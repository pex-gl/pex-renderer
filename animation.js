const Quat = require('pex-math/Quat')
const Signal = require('signals')

// Assumptions:
// - all channels have the same time length
// - animation channels can reference other entities
// - currently all animations track time by themselves
function Animation (opts) {
  this.type = 'Animation'
  this.entity = null
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
  if (!this.playing) return

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

  this.channels.forEach((channel) => {
    const inputData = channel.input
    const outputData = channel.output
    const target = channel.target
    const path = channel.path

    let prevInput = null
    let nextInput = null
    let prevOutput = null
    let nextOutput = null

    let prevIndex
    let nextIndex

    for (var i = 0; i < inputData.length; i++) {
      nextIndex = i
      if (inputData[i] >= this.time) {
        break
      }
      prevIndex = nextIndex
    }

    if (prevIndex !== undefined) {
      prevInput = inputData[prevIndex]
      nextInput = inputData[nextIndex]
      prevOutput = outputData[prevIndex]
      nextOutput = outputData[nextIndex]

      const interpolationValue = (this.time - prevInput) / (nextInput - prevInput)

      let currentOutput = null
      // TODO: stop creating new arrays every frame
      if (path === 'rotation') {
        currentOutput = Quat.copy(prevOutput)
        Quat.slerp(currentOutput, nextOutput, interpolationValue)
      } else {
        currentOutput = []
        for (var k = 0; k < nextOutput.length; k++) {
          currentOutput[k] = prevOutput[k] + interpolationValue * (nextOutput[k] - prevOutput[k])
        }
      }

      if (path === 'translation') {
        target.transform.set({
          position: currentOutput
        })
      } else if (path === 'rotation') {
        target.transform.set({
          rotation: currentOutput
        })
      } else if (path === 'scale') {
        target.transform.set({
          scale: currentOutput
        })
      } else if (path === 'weights') {
        target.getComponent('Morph').set({
          weights: nextOutput
        })
      }
    }
  })
}

module.exports = function createMorph (opts) {
  return new Animation(opts)
}

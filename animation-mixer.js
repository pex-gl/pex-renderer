const quat = require('pex-math/quat')
const vec3 = require('pex-math/vec3')

function AnimationMixer(opts) {
  this.type = 'AnimationMixer'
  this.entity = null
  this.blendMode = null
  this.enabled = true
  this.currentAnimation = {}

  this.dirty = false
  this.set(opts)
}

AnimationMixer.prototype.init = function(entity) {
  this.entity = entity
}

// TODO: parameter
const duration = 1000

AnimationMixer.prototype.set = function(opts) {
  Object.assign(this, opts)

  if (this.entity) {
    this.entity.components
      .filter((component) => component.type === 'Animation')
      .forEach((component) => (component.mixed = true))
    const currentAnimation = this.entity.components.find(
      (component) =>
        component.type === 'Animation' &&
        component.name === this.currentAnimation.name
    )
    if (currentAnimation && this.currentAnimation) {
      currentAnimation.set(this.currentAnimation)
      currentAnimation.fadeIn(duration)
    }
  }

  this.dirty = true
}

function averageWeightedQuatArray(quats) {
  const out = quat.create()
  const cumulativeWeight = quats.map((q) => q.weight).reduce((a, b) => a + b, 0)

  for (let i = 0; i < quats.length; i++) {
    const q = quats[i]
    const weight = q.weight
    // Add (mult) q scaled by their weight against the total weight
    quat.slerp(out, q, 0.5 + 0.5 * (weight / cumulativeWeight))
  }
  return out
}

function averageWeightedVec3Array(vec3s) {
  const out = vec3.create()
  const cumulativeWeight = vec3s.map((r) => r.weight).reduce((a, b) => a + b, 0)

  for (let i = 0; i < vec3s.length; i++) {
    const v = vec3s[i]
    const weight = v.weight
    vec3.addScaled(out, v, weight / cumulativeWeight)
  }
  return out
}

// TODO: Advances the global mixer time and updates the animation.
AnimationMixer.prototype.update = function() {
  // if (!this.dirty) return
  // this.dirty = false

  if (!this.enabled) return

  const animations = this.entity.components.filter(
    (component) => component.type === 'Animation'
  )

  if (animations) {
    // Get all animation targets
    // Accumulated channel.target.[positions/rotations/scales/weights] are set in Animation.update
    // TODO: need to make sure animation update is called before so targets properties are set
    let targets = []

    for (let i = 0; i < animations.length; i++) {
      const animation = animations[i]

      if (animation.playing) {
        // Start fade out if not already
        if (
          !animation.startFadeTime &&
          animation.name !== this.currentAnimation.name
        ) {
          animation.fadeOut(duration)
        }

        // Push potentially updated targets
        for (let i = 0; i < animation.channels.length; i++) {
          const channel = animation.channels[i]
          targets.push(channel.target)
        }
      }
    }

    // Filter duplicates
    targets = targets.filter(
      (target, index, targetsArray) =>
        targetsArray.findIndex((t) => t.id === target.id) === index
    )

    // Apply blended transform to targets
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]

      const transform = {}
      if (target.rotations) {
        transform.rotation = averageWeightedQuatArray(target.rotations)
        target.rotations = null
      }
      if (target.scales) {
        transform.scale = averageWeightedVec3Array(target.scales)
        target.scales = null
      }
      if (target.positions) {
        transform.position = averageWeightedVec3Array(target.positions)
        target.positions = null
      }
      // TODO: weights

      if (Object.keys(transform).length) {
        target.transform.set(transform)
      }
    }
  } else {
    console.warn(
      `AnimationMixer: no Animation component in entity:`,
      this.entity
    )
  }
}

AnimationMixer.prototype.play = function(animationName) {}
AnimationMixer.prototype.stop = function(animationName) {}
AnimationMixer.prototype.stopAll = function() {}
AnimationMixer.prototype.setTime = function(time) {}

module.exports = function createAnimationMixer(opts) {
  return new AnimationMixer(opts)
}

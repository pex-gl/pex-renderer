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

AnimationMixer.prototype.set = function(opts) {
  Object.assign(this, opts)
  this.dirty = true
}

AnimationMixer.prototype.update = function() {
  if (!this.dirty) return
  this.dirty = false

  if (!this.enabled) return

  const animations = this.entity.components.filter(
    (component) => component.type === 'Animation'
  )

  if (animations) {
    const currentAnimation = animations.find(
      (component) =>
        component.type === 'Animation' &&
        component.name === this.currentAnimation.name
    )
    for (let i = 0; i < animations.length; i++) {
      // TODO: blend
      const animation = animations[i]
      animation.set({
        playing: false
      })
    }
    if (currentAnimation) {
      currentAnimation.set(this.currentAnimation)
    }
  } else {
    console.warn(
      `AnimationMixer: no Animation component in entity:`,
      this.entity
    )
  }
}

module.exports = function createAnimationMixer(opts) {
  return new AnimationMixer(opts)
}

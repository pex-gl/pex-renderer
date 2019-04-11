const Signal = require('signals')

function Morph (opts) {
  this.type = 'Morph'
  this.enabled = true
  this.changed = new Signal()
  this.entity = null
  this.dirty = false
  this.sources = opts.sources
  this.current = opts.current
  this.targets = opts.targets
  this.weights = opts.weights || []
  this.set(opts)
}

Morph.prototype.init = function (entity) {
  this.entity = entity

  this.current = this.current || Object.keys(this.sources).reduce((current, attribute) => {
    current[attribute] = [...this.sources[attribute]]
    return current;
  }, {});
}

Morph.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
  this.dirty = true
}

Morph.prototype.update = function () {
  if (!this.dirty || !this.enabled) return
  this.dirty = false

  Object.keys(this.sources).forEach(key => {
    const sourceAttributes = this.sources[key]
    const targetAttributes = this.targets[key]

    this.current[key] = sourceAttributes.map((source, i) => {
      let attribute = source.length ? [0, 0, 0] : 0

      targetAttributes.forEach((target, j) => {
        const weight = this.weights[j]
        const targetAttribute = target[i]

        if (source.length) {
          attribute[0] += targetAttribute[0] * weight
          attribute[1] += targetAttribute[1] * weight
          attribute[2] += targetAttribute[2] * weight
        } else {
          attribute += targetAttribute * weight
        }
      })
      if (source.length) {
        attribute[0] += source[0]
        attribute[1] += source[1]
        attribute[2] += source[2]
      } else {
        attribute += source
      }
      return attribute
    })
  })

  this.entity.getComponent('Geometry').set(this.current)
}

module.exports = function createMorph (opts) {
  return new Morph(opts)
}

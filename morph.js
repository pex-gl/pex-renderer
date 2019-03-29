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

  const geometryCmp = this.entity.getComponent('Geometry')

  Object.keys(this.sources).forEach(key => {
    const sources = this.sources[key]
    const targets = this.targets[key]

    this.current[key] = sources.map((source, i) => {
      let newAttribute = source.length ? [0, 0, 0] : 0

      targets.forEach((target, j) => {
        const weight = this.weights[j]
        const targetVertex = target[i]

        if (source.length) {
          newAttribute[0] += targetVertex[0] * weight
          newAttribute[1] += targetVertex[1] * weight
          newAttribute[2] += targetVertex[2] * weight
        } else {
          newAttribute += targetVertex * weight
        }
      })
      if (source.length) {
        newAttribute[0] += source[0]
        newAttribute[1] += source[1]
        newAttribute[2] += source[2]
      } else {
        newAttribute += source
      }
      return newAttribute
    })
  })

  geometryCmp.set(this.current)
}

module.exports = function createMorph (opts) {
  return new Morph(opts)
}

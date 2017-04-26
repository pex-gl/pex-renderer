const createTransform = require('./transform')

let entityId = 0

function Entity (components, parent) {
  this.id = entityId++

  this.components = components ? components.slice(0) : []

  this.transform = this.getComponent('Transform')
  if (!this.transform) {
    this.transform = createTransform({
      parent: parent ? parent.transform : null
    })
    this.components.unshift(this.transform)
  }

  this.transform.set({ parent: parent ? parent.transform : null })

  this.components.forEach((component) => component.init(this))
}

Entity.prototype.dispose = function () {
  // detach from the hierarchy
  this.transform.set({ parent: null })
}

Entity.prototype.getComponent = function (type) {
  return this.components.find((component) => component.type === type)
}

module.exports = function createEntity (components, parent) {
  return new Entity(components, parent)
}

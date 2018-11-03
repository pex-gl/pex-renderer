const createTransform = require('./transform')
const assert = require('assert')

let entityId = 0

function Entity (components, tags, renderer) {
  assert(!tags || Array.isArray(tags), 'Entity tags must be an array or null')
  this.id = entityId++
  this.tags = tags || []
  this.renderer = renderer

  this.components = components ? components.slice(0) : []

  this.componentsMap = new Map()
  this.components.forEach((component) => {
    this.componentsMap.set(component.type, component)
  })

  this.transform = this.getComponent('Transform')
  if (!this.transform) {
    this.transform = createTransform({
      parent: null
    })
    this.components.unshift(this.transform)
  }

  this.components.forEach((component) => component.init(this))
}

Entity.prototype.dispose = function () {
  this.components.forEach((component) => {
    if (component.dispose) {
      component.dispose()
    }
  })
  // detach from the hierarchy
  this.transform.set({ parent: null })
}

Entity.prototype.addComponent = function (component) {
  this.components.push(component)
  this.componentsMap.set(component.type, component)
  component.init(this)
}

Entity.prototype.removeComponent = function (component) {
  var idx = this.components.indexOf(component)
  assert(idx !== -1, 'Removing component that\'s doesn\'t belong to this entity')
  this.components.splice(idx, 1)
  this.componentsMap.delete(component.type)
  this.components.forEach((otherComponent) => {
    if (otherComponent.type === component.type) {
      this.componentsMap.set(otherComponent.type, otherComponent)
    }
  })
}

// Only the last added component of that type will be returned
Entity.prototype.getComponent = function (type) {
  return this.componentsMap.get(type)
}

module.exports = function createEntity (components, parent, tags) {
  return new Entity(components, parent, tags)
}

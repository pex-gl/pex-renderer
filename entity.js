import createTransform from './transform'
import assert from 'assert'

let entityId = 0

class Entity {
  constructor(components, tags) {
    assert(!tags || Array.isArray(tags), 'Entity tags must be an array or null')
    this.id = entityId++
    this.tags = tags || []

    this.components = components ? components.slice(0) : []

    this.transform = this.getComponent('Transform')
    if (!this.transform) {
      this.transform = createTransform({
        parent: null
      })
      this.components.unshift(this.transform)
    }

    this.components.forEach(component => component.init(this))
  }

  dispose() {
    this.components.forEach(component => {
      if (component.dispose) {
        component.dispose()
      }
    })
    // detach from the hierarchy
    this.transform.set({ parent: null })
  }

  addComponent(component) {
    this.components.push(component)
    component.init(this)
  }

  getComponent(type) {
    return this.components.find(component => component.type === type)
  }
}

export default function createEntity(components, parent, tags) {
  return new Entity(components, parent, tags)
}

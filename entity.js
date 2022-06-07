import createTransform from "./components/transform.js";

let entityId = 0;

class Entity {
  constructor(components, tags, renderer) {
    console.assert(
      !tags || Array.isArray(tags),
      "Entity tags must be an array or null"
    );
    this.id = entityId++;
    this.tags = tags || [];
    this.renderer = renderer;

    this.components = components ? components.slice(0) : [];

    this.componentsMap = new Map();
    this.components.forEach((component) => {
      this.componentsMap.set(component.type, component);
    });

    this.transform = this.getComponent("Transform");
    if (!this.transform) {
      this.transform = createTransform({
        parent: null,
      });
      this.addComponent(this.transform);
    }

    this.components.forEach((component) => component.init(this));
  }

  dispose() {
    this.components.forEach((component) => {
      if (component.dispose) {
        component.dispose();
      }
    });
    // detach from the hierarchy
    this.transform.set({ parent: null });
  }

  addComponent(component) {
    this.components.push(component);
    this.componentsMap.set(component.type, component);
    component.init(this);
  }

  removeComponent(component) {
    const idx = this.components.indexOf(component);
    console.assert(
      idx !== -1,
      `Removing component that doesn't belong to this entity`
    );
    this.components.splice(idx, 1);
    this.componentsMap.delete(component.type);
    this.components.forEach((otherComponent) => {
      if (otherComponent.type === component.type) {
        this.componentsMap.set(otherComponent.type, otherComponent);
      }
    });
  }

  // Only the last added component of that type will be returned
  getComponent(type) {
    return this.componentsMap.get(type);
  }
}

export default function createEntity(components = {}) {
  const entity = {
    id: entityId,
    ...components,
  };
  return entity;
}

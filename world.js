export default function createWorld() {
  const world = {
    entities: [],
    systems: [],
    add(entity) {
      this.entities.push(entity);
      return entity;
    },
    addSystem(system) {
      this.systems.push(system);
      return system;
    },
    update(deltaTime = 0) {
      this.systems.forEach((system) => {
        system.update(this.entities, deltaTime);
      });
    },
  };
  return world;
}

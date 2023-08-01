export default function createWorld() {
  let prevTime = Date.now();
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
    update(deltaTime) {
      if (deltaTime == undefined) {
        const now = Date.now();
        deltaTime = (now - prevTime) / 1000;
        prevTime = now;
      }
      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i].update(this.entities, deltaTime);
      }
    },
  };
  return world;
}

export default ({ entities = [], systems = [] } = {}) => {
  let prevTime = Date.now();

  return {
    entities,
    systems,
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
    dispose(entities) {
      const entitiesToDispose = entities
        ? Array.isArray(entities)
          ? entities
          : [entities]
        : this.entities;
      console.log(entitiesToDispose);

      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i].dispose?.(entitiesToDispose);
      }

      this.entities = this.entities.filter(
        (entity) => !entitiesToDispose.includes(entity)
      );

      entitiesToDispose.length = 0;
    },
  };
};

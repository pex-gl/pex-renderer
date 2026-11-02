import type { Entity, System, World, WorldOptions } from "./types.js";

export default ({ entities = [], systems = [] }: WorldOptions = {}): World => {
  let prevTime = performance.now();

  return {
    entities,
    systems,
    add(entity: Entity) {
      this.entities.push(entity);
      return entity;
    },
    addSystem(system: System) {
      this.systems.push(system);
      return system;
    },
    update(deltaTime?: number) {
      if (deltaTime === undefined) {
        const now = performance.now();
        deltaTime = (now - prevTime) / 1000;
        prevTime = now;
      }
      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i]!.update(this.entities, { deltaTime });
      }
    },
    dispose(entities?: Entity | Entity[]) {
      let entitiesToDispose = this.entities;
      if (entities) {
        entitiesToDispose = Array.isArray(entities) ? entities : [entities];
      }

      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i]!.dispose?.(entitiesToDispose);
      }

      this.entities = this.entities.filter(
        (entity) => !entitiesToDispose.includes(entity),
      );

      entitiesToDispose.length = 0;
    },
  };
};

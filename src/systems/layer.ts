import type { Entity } from "../types.js";

/** Layer system */
export default () => ({
  type: "layer-system",
  update(entities: Entity[]) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      if (!entity.transform) continue;

      // Try to find a parent layer if entity is not a layer entity
      if (!entity.layer) {
        let parentTransform = entity.transform.parent;

        entity.layer = undefined;

        // Traverse the hierachy until parent layer is found or root node with no parent reached
        while (parentTransform) {
          const parentLayer = parentTransform.entity?.layer;
          if (parentLayer) {
            entity.layer = parentLayer;
            break;
          }
          parentTransform = parentTransform.parent;
        }
      }
    }
  },
});

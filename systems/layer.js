export default () => ({
  type: "layer-system",
  update(entities) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity.transform) continue;

      // Try to find a parent layer if entity is not a layer entity
      if (!entity.layer) {
        let parentTransform = entity.transform.parent;

        entity.layer = null;

        // Traverse the hierachy until parent layer is found or root node with no parent reached
        while (parentTransform) {
          if (parentTransform.entity.layer) {
            entity.layer = parentTransform.entity.layer;
            break;
          }
          parentTransform = parentTransform.parent;
        }
      }
    }
  },
});

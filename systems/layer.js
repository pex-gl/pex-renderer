export default function createLayerSystem(opts) {
  const layerSystem = {
    type: "layer-system",
  };

  layerSystem.update = (entities, deltaTime) => {
    for (let entity of entities) {
      if (!entity.transform) continue;
      // if entity itself is not a layer entity
      // we will try to find parent layer
      if (!entity.layer) {
        let parentTransform = entity.transform.parent;

        entity.layer = null;

        // traverse up in hierachy until parent layer is found or root node with no parent reached
        while (parentTransform) {
          if (parentTransform.entity.layer) {
            entity.layer = parentTransform.entity.layer;
            break;
          }
          parentTransform = parentTransform.parent;
        }
      }
    }
  };

  return layerSystem;
}

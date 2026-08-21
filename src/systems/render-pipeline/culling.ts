import { isAABBInFrustum } from "../../utils.js";

import type { CullingMethods, Entity } from "../../types.js";

const isEntityInFrustum = (entity: Entity, frustum: any) =>
  entity.geometry!.culled === false ||
  isAABBInFrustum(entity.transform!.worldBounds, frustum);

export default (): CullingMethods => ({
  cullEntities: (entities: Entity[], camera: any) => {
    if (!camera.culling) return entities;

    return entities.filter(
      (entity) =>
        !entity.geometry ||
        (entity.transform && isEntityInFrustum(entity, camera.frustum)),
    );
  },
});

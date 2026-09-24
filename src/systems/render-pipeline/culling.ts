import { isAABBInFrustum } from "../../utils.js";

import type {
  CameraComponentOptions,
  CullingMethods,
  Entity,
} from "../../types.js";

const isEntityInFrustum = (entity: Entity, frustum: Float32Array) =>
  entity.geometry!.culled === false ||
  isAABBInFrustum(entity.transform!.worldBounds!, frustum);

export default (): CullingMethods => ({
  cullEntities: (entities: Entity[], camera: CameraComponentOptions) =>
    camera.culling
      ? entities.filter(
          (entity) =>
            !entity.geometry ||
            (entity.transform && isEntityInFrustum(entity, camera.frustum!)),
        )
      : entities,
});

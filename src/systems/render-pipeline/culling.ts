import { avec4, vec3 } from "pex-math";

import { TEMP_VEC3, TEMP_VEC4 } from "../../utils.js";

import type { Entity, SystemOptions } from "../../types.js";

function isEntityInFrustum(entity: Entity, frustum: any) {
  if (entity.geometry!.culled !== false) {
    const v: any = TEMP_VEC4;
    const worldBounds: any = entity.transform!.worldBounds;
    for (let i = 0; i < 6; i++) {
      avec4.set(TEMP_VEC4 as any, 0, frustum, i);
      TEMP_VEC3[0] = v[0] >= 0 ? worldBounds[1][0] : worldBounds[0][0];
      TEMP_VEC3[1] = v[1] >= 0 ? worldBounds[1][1] : worldBounds[0][1];
      TEMP_VEC3[2] = v[2] >= 0 ? worldBounds[1][2] : worldBounds[0][2];

      // Distance from plane to point
      if (vec3.dot(TEMP_VEC4, TEMP_VEC3) + v[3] < 0) return false;
    }
  }

  return true;
}

export default (
  _options?: Pick<SystemOptions, "renderGraph" | "resourceCache">,
) => ({
  cullEntities: (entities: Entity[], camera: any) => {
    if (!camera.culling) return entities;

    return entities.filter(
      (entity) =>
        !entity.geometry ||
        (entity.transform && isEntityInFrustum(entity, camera.frustum)),
    );
  },
});

import { mat4 } from "pex-math";

import type { Entity } from "../types.js";

function updateSkin(skin: any) {
  for (let i = 0; i < skin.joints.length; i++) {
    const joint = skin.joints[i];
    const m = skin.jointMatrices[i];
    mat4.identity(m);
    if (joint._transform) {
      const modelMatrix = joint._transform.modelMatrix;
      mat4.mult(m, modelMatrix);
      mat4.mult(m, skin.inverseBindMatrices[i]);
    }
  }
}

/** Skin system */
export default () => ({
  type: "skin-system",
  updateSkin,
  update(entities: Entity[]) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;

      if (entity.skin) updateSkin(entity.skin);
    }
  },
});

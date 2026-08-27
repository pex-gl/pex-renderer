import { mat4 } from "pex-math";

import type { Entity } from "../types.js";

function updateSkin(skin: any) {
  // Last frame's, for anything reprojecting a skinned surface between frames.
  // Doubles the block a skinned entity uploads, so it is only ever read by a
  // pass that writes motion vectors.
  const previous = (skin._previousJointMatrices ??= skin.joints.map(() =>
    mat4.create(),
  ));
  // Nothing to carry over on the first update: seeding from the matrices this
  // pass computes is what stops a newly loaded skin reporting a frame of motion
  // out of the bind pose.
  const seed = !skin._hasPreviousJointMatrices;
  skin._hasPreviousJointMatrices = true;

  for (let i = 0; i < skin.joints.length; i++) {
    const joint = skin.joints[i];
    const m = skin.jointMatrices[i];

    mat4.set(previous[i], m);

    mat4.identity(m);
    if (joint._transform) {
      const modelMatrix = joint._transform.modelMatrix;
      mat4.mult(m, modelMatrix);
      mat4.mult(m, skin.inverseBindMatrices[i]);
    }

    if (seed) mat4.set(previous[i], m);
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

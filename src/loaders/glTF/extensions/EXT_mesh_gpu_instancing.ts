import { resolveAttributes } from "../mesh.js";

import type { GpuContext } from "../../../types.js";

/**
 * Resolves per-instance attributes (TRANSLATION/ROTATION/SCALE, plus any
 * application-specific `_`-prefixed ones) into the same descriptor shape as
 * regular vertex attributes, each marked `stepMode: "instance"`. The three spec
 * semantics would step per-instance anyway once loaders/glTF/pex-renderer.ts
 * renames them to offsets/rotations/scales (see the name match in
 * systems/geometry.ts); a custom attribute has no such name, so the descriptor
 * has to say so itself.
 * https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_gpu_instancing
 */
export function resolveMeshGpuInstancing(
  node: any,
  gltf: { bufferViews: any[]; accessors: any[] },
  ctx: GpuContext,
): Record<string, any> {
  const ext = node.extensions?.EXT_mesh_gpu_instancing;
  if (!ext) return {};

  const attributes = resolveAttributes(ext.attributes, gltf, ctx);
  for (const attribute of Object.values(attributes)) {
    attribute.stepMode = "instance";
  }

  // TRANSLATION, ROTATION and SCALE are each optional and, when present, must
  // all have the same count — so the instance count comes from whichever the
  // node actually carries rather than from TRANSLATION alone.
  const counts = Object.values(ext.attributes as Record<string, number>).map(
    (accessor) => gltf.accessors[accessor]?.count ?? 0,
  );
  attributes.instanceCount = counts.length ? Math.max(...counts) : 0;

  return attributes;
}

import { resolveAttributes } from "../mesh.js";

import type { GpuContext } from "../../../types.js";
import type * as GLTF from "types-gltf";
import type { EXT_mesh_gpu_instancing } from "types-gltf/extensions";
import type { ResolvedGeometry, ResolvedGltf } from "../types.js";

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
  node: GLTF.Node,
  gltf: ResolvedGltf,
  ctx: GpuContext,
): ResolvedGeometry {
  const ext = node.extensions?.EXT_mesh_gpu_instancing as
    EXT_mesh_gpu_instancing.GlTF | undefined;
  // The schema marks `attributes` optional, though a node carrying the
  // extension without them instances nothing.
  if (!ext?.attributes) return {};

  const attributes = resolveAttributes(ext.attributes, gltf, ctx);
  // Semantics come off the open index signature, and every one resolveAttributes
  // produced is a descriptor object.
  for (const attribute of Object.values(attributes)) {
    (attribute as { stepMode?: GPUVertexStepMode }).stepMode = "instance";
  }

  // TRANSLATION, ROTATION and SCALE are each optional and, when present, must
  // all have the same count — so the instance count comes from whichever the
  // node actually carries rather than from TRANSLATION alone.
  const counts = Object.values(ext.attributes).map(
    (accessor) => gltf.accessors?.[accessor]?.count ?? 0,
  );
  attributes.instanceCount = counts.length ? Math.max(...counts) : 0;

  return attributes;
}

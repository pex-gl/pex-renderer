import { resolveAttributes } from "../mesh.js";

import type { GpuContext } from "../../../types.js";

/**
 * Resolves per-instance attributes (TRANSLATION/ROTATION/SCALE, ...) into the
 * same descriptor shape as regular vertex attributes. Once
 * loaders/glTF/pex-renderer.ts renames these to offsets/rotations/scales, the
 * geometry system's own instancedAttributes name match (see
 * systems/geometry.ts) is what steps them per-instance — no explicit stepMode
 * needed here.
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

  const translation = ext.attributes.TRANSLATION;
  attributes.instances =
    translation !== undefined ? gltf.accessors[translation].count : 0;

  return attributes;
}

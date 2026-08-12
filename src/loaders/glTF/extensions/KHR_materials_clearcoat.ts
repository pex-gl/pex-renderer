import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_clearcoat#clearcoat */
export function resolveClearcoat(
  material: any,
  gltf: any,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Record<string, any> | null {
  const ext = material.extensions?.KHR_materials_clearcoat;
  if (!ext) return null;

  const result: Record<string, any> = {
    clearcoatFactor: ext.clearcoatFactor ?? 0,
    clearcoatRoughnessFactor: ext.clearcoatRoughnessFactor ?? 0,
  };
  if (ext.clearcoatTexture) {
    result.clearcoatTexture = resolveTexture(
      ext.clearcoatTexture,
      gltf,
      ctx,
      samplerCache,
    );
  }
  if (ext.clearcoatRoughnessTexture) {
    result.clearcoatRoughnessTexture = resolveTexture(
      ext.clearcoatRoughnessTexture,
      gltf,
      ctx,
      samplerCache,
    );
  }
  if (ext.clearcoatNormalTexture) {
    result.clearcoatNormalTexture = resolveTexture(
      ext.clearcoatNormalTexture,
      gltf,
      ctx,
      samplerCache,
    );
    result.clearcoatNormalTextureScale = ext.clearcoatNormalTexture.scale ?? 1;
  }
  return result;
}

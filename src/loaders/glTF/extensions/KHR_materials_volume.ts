import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_volume */
export function resolveVolume(
  material: any,
  gltf: any,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Record<string, any> | null {
  const ext = material.extensions?.KHR_materials_volume;
  if (!ext) return null;

  const result: Record<string, any> = {
    thicknessFactor: ext.thicknessFactor ?? 0,
    attenuationDistance: ext.attenuationDistance ?? Infinity,
    attenuationColor: ext.attenuationColor ?? [1, 1, 1],
  };
  if (ext.thicknessTexture) {
    result.thicknessTexture = resolveTexture(
      ext.thicknessTexture,
      gltf,
      ctx,
      samplerCache,
    );
  }
  return result;
}

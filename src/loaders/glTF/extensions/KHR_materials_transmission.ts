import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_transmission */
export function resolveTransmission(
  material: any,
  gltf: any,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Record<string, any> | null {
  const ext = material.extensions?.KHR_materials_transmission;
  if (!ext) return null;

  const result: Record<string, any> = {
    transmissionFactor: ext.transmissionFactor ?? 0,
  };
  if (ext.transmissionTexture) {
    result.transmissionTexture = resolveTexture(
      ext.transmissionTexture,
      gltf,
      ctx,
      samplerCache,
    );
  }
  return result;
}

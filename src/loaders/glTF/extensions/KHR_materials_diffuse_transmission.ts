import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_diffuse_transmission */
export function resolveDiffuseTransmission(
  material: any,
  gltf: any,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Record<string, any> | null {
  const ext = material.extensions?.KHR_materials_diffuse_transmission;
  if (!ext) return null;

  const result: Record<string, any> = {
    diffuseTransmissionFactor: ext.diffuseTransmissionFactor ?? 0,
    diffuseTransmissionColorFactor: ext.diffuseTransmissionColorFactor ?? [1, 1, 1],
  };
  if (ext.diffuseTransmissionTexture) {
    result.diffuseTransmissionTexture = resolveTexture(
      ext.diffuseTransmissionTexture,
      gltf,
      ctx,
      samplerCache,
    );
  }
  if (ext.diffuseTransmissionColorTexture) {
    result.diffuseTransmissionColorTexture = resolveTexture(
      ext.diffuseTransmissionColorTexture,
      gltf,
      ctx,
      samplerCache,
      "rgba8unorm-srgb",
    );
  }
  return result;
}

import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_specular */
export function resolveSpecular(
  material: any,
  gltf: any,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Record<string, any> | null {
  const ext = material.extensions?.KHR_materials_specular;
  if (!ext) return null;

  const result: Record<string, any> = {
    specularFactor: ext.specularFactor ?? 1,
    specularColorFactor: ext.specularColorFactor ?? [1, 1, 1],
  };
  if (ext.specularTexture) {
    result.specularTexture = resolveTexture(
      ext.specularTexture,
      gltf,
      ctx,
      samplerCache,
    );
  }
  if (ext.specularColorTexture) {
    result.specularColorTexture = resolveTexture(
      ext.specularColorTexture,
      gltf,
      ctx,
      samplerCache,
      "rgba8unorm-srgb",
    );
  }
  return result;
}

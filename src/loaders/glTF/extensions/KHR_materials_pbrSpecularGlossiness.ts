import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";

/**
 * https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Archived/KHR_materials_pbrSpecularGlossiness/schema/glTF.KHR_materials_pbrSpecularGlossiness.schema.json
 */
export function resolvePbrSpecularGlossiness(
  material: any,
  gltf: any,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Record<string, any> | null {
  const ext = material.extensions?.KHR_materials_pbrSpecularGlossiness;
  if (!ext) return null;

  // Prefixed (sg*) to avoid colliding with KHR_materials_specular's
  // specularFactor/specularTexture — the two extensions independently chose
  // the same field names for unrelated data, and both flatten into the same
  // generic material object (see material.ts). Factors stay linear (glTF
  // spec); loaders/glTF/pex-renderer.ts's sRGB conversion is a pex-renderer
  // shader convention, not a generic concern.
  const result: Record<string, any> = {
    sgDiffuseFactor: ext.diffuseFactor ?? [1, 1, 1, 1],
    sgSpecularFactor: ext.specularFactor?.slice(0, 3) ?? [1, 1, 1],
    sgGlossinessFactor: ext.glossinessFactor ?? 1,
  };
  if (ext.diffuseTexture) {
    result.sgDiffuseTexture = resolveTexture(
      ext.diffuseTexture,
      gltf,
      ctx,
      samplerCache,
      "rgba8unorm-srgb",
    );
  }
  if (ext.specularGlossinessTexture) {
    result.sgSpecularGlossinessTexture = resolveTexture(
      ext.specularGlossinessTexture,
      gltf,
      ctx,
      samplerCache,
      "rgba8unorm-srgb",
    );
  }
  return result;
}

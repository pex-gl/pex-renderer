import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";
import type * as GLTF from "types-gltf";
import type { ResolvedGltf, ResolvedMaterial } from "../types.js";

interface PbrSpecularGlossinessExtension {
  diffuseFactor?: number[];
  specularFactor?: number[];
  glossinessFactor?: number;
  diffuseTexture?: GLTF.TextureInfo;
  specularGlossinessTexture?: GLTF.TextureInfo;
}

type PbrSpecularGlossiness = Pick<
  ResolvedMaterial,
  | "sgDiffuseFactor"
  | "sgSpecularFactor"
  | "sgGlossinessFactor"
  | "sgDiffuseTexture"
  | "sgSpecularGlossinessTexture"
>;

/** https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Archived/KHR_materials_pbrSpecularGlossiness/schema/glTF.KHR_materials_pbrSpecularGlossiness.schema.json */
export function resolvePbrSpecularGlossiness(
  material: GLTF.Material,
  gltf: ResolvedGltf,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): PbrSpecularGlossiness | null {
  const ext = material.extensions?.KHR_materials_pbrSpecularGlossiness as
    PbrSpecularGlossinessExtension | undefined;
  if (!ext) return null;

  // Factors stay linear (glTF spec); loaders/glTF/pex-renderer.ts's sRGB
  // conversion is a pex-renderer shader convention, not a generic concern.
  const result: PbrSpecularGlossiness = {
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

import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";
import type * as GLTF from "types-gltf";
import type { KHR_materials_clearcoat } from "types-gltf/extensions";
import type { ResolvedGltf, ResolvedMaterial } from "../types.js";

type Clearcoat = Pick<
  ResolvedMaterial,
  | "clearcoatFactor"
  | "clearcoatRoughnessFactor"
  | "clearcoatTexture"
  | "clearcoatRoughnessTexture"
  | "clearcoatNormalTexture"
  | "clearcoatNormalTextureScale"
>;

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_clearcoat#clearcoat */
export function resolveClearcoat(
  material: GLTF.Material,
  gltf: ResolvedGltf,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Clearcoat | null {
  const ext = material.extensions?.KHR_materials_clearcoat as
    KHR_materials_clearcoat.Material | undefined;
  if (!ext) return null;

  const result: Clearcoat = {
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

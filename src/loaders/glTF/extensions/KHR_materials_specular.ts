import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";
import type * as GLTF from "types-gltf";
import type { KHR_materials_specular } from "types-gltf/extensions";
import type { ResolvedGltf, ResolvedMaterial } from "../types.js";

type Specular = Pick<
  ResolvedMaterial,
  | "specularFactor"
  | "specularColorFactor"
  | "specularTexture"
  | "specularColorTexture"
>;

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_specular */
export function resolveSpecular(
  material: GLTF.Material,
  gltf: ResolvedGltf,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Specular | null {
  const ext = material.extensions?.KHR_materials_specular as
    KHR_materials_specular.Material | undefined;
  if (!ext) return null;

  const result: Specular = {
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

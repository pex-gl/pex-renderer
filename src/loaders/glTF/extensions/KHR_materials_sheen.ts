import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";
import type * as GLTF from "types-gltf";
import type { KHR_materials_sheen } from "types-gltf/extensions";
import type { ResolvedGltf, ResolvedMaterial } from "../types.js";

type Sheen = Pick<
  ResolvedMaterial,
  | "sheenColorFactor"
  | "sheenRoughnessFactor"
  | "sheenColorTexture"
  | "sheenRoughnessTexture"
>;

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen#sheen */
export function resolveSheen(
  material: GLTF.Material,
  gltf: ResolvedGltf,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Sheen | null {
  const ext = material.extensions?.KHR_materials_sheen as
    KHR_materials_sheen.Material | undefined;
  if (!ext) return null;

  const result: Sheen = {
    sheenColorFactor: ext.sheenColorFactor ?? [0, 0, 0],
    sheenRoughnessFactor: ext.sheenRoughnessFactor ?? 0,
  };
  if (ext.sheenColorTexture) {
    result.sheenColorTexture = resolveTexture(
      ext.sheenColorTexture,
      gltf,
      ctx,
      samplerCache,
      "rgba8unorm-srgb",
    );
  }
  // Roughness is packed into the color texture's alpha channel when both
  // fields reference the same texture (see standard.ts's
  // sheenRoughnessFromMainTexture), so a separate texture is only resolved
  // when it's genuinely a different one.
  if (
    ext.sheenRoughnessTexture &&
    ext.sheenColorTexture?.index !== ext.sheenRoughnessTexture.index
  ) {
    result.sheenRoughnessTexture = resolveTexture(
      ext.sheenRoughnessTexture,
      gltf,
      ctx,
      samplerCache,
    );
  }
  return result;
}

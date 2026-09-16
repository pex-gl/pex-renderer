import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";
import type * as GLTF from "types-gltf";
import type { KHR_materials_volume } from "types-gltf/extensions";
import type { ResolvedGltf, ResolvedMaterial } from "../types.js";

type Volume = Pick<
  ResolvedMaterial,
  | "thicknessFactor"
  | "attenuationDistance"
  | "attenuationColor"
  | "thicknessTexture"
>;

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_volume */
export function resolveVolume(
  material: GLTF.Material,
  gltf: ResolvedGltf,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Volume | null {
  const ext = material.extensions?.KHR_materials_volume as
    KHR_materials_volume.Material | undefined;
  if (!ext) return null;

  const result: Volume = {
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

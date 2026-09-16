import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";
import type * as GLTF from "types-gltf";
import type { KHR_materials_transmission } from "types-gltf/extensions";
import type { ResolvedGltf, ResolvedMaterial } from "../types.js";

type Transmission = Pick<
  ResolvedMaterial,
  "transmissionFactor" | "transmissionTexture"
>;

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_transmission */
export function resolveTransmission(
  material: GLTF.Material,
  gltf: ResolvedGltf,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Transmission | null {
  const ext = material.extensions?.KHR_materials_transmission as
    KHR_materials_transmission.Material | undefined;
  if (!ext) return null;

  const result: Transmission = {
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

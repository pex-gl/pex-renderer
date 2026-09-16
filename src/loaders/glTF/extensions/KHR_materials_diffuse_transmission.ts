import { resolveTexture } from "../texture.js";

import type { GpuContext } from "../../../types.js";
import type * as GLTF from "types-gltf";
import type { ResolvedGltf, ResolvedMaterial } from "../types.js";

interface DiffuseTransmissionExtension {
  diffuseTransmissionFactor?: number;
  diffuseTransmissionColorFactor?: number[];
  diffuseTransmissionTexture?: GLTF.TextureInfo;
  diffuseTransmissionColorTexture?: GLTF.TextureInfo;
}

type DiffuseTransmission = Pick<
  ResolvedMaterial,
  | "diffuseTransmissionFactor"
  | "diffuseTransmissionColorFactor"
  | "diffuseTransmissionTexture"
  | "diffuseTransmissionColorTexture"
>;

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_diffuse_transmission */
export function resolveDiffuseTransmission(
  material: GLTF.Material,
  gltf: ResolvedGltf,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): DiffuseTransmission | null {
  const ext = material.extensions?.KHR_materials_diffuse_transmission as
    DiffuseTransmissionExtension | undefined;
  if (!ext) return null;

  const result: DiffuseTransmission = {
    diffuseTransmissionFactor: ext.diffuseTransmissionFactor ?? 0,
    diffuseTransmissionColorFactor: ext.diffuseTransmissionColorFactor ?? [
      1, 1, 1,
    ],
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

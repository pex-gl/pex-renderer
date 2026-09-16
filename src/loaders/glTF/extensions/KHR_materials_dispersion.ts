import type * as GLTF from "types-gltf";
import type { KHR_materials_dispersion } from "types-gltf/extensions";
import type { ResolvedMaterial } from "../types.js";

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_dispersion */
export function resolveDispersion(
  material: GLTF.Material,
): Pick<ResolvedMaterial, "dispersion"> | null {
  const ext = material.extensions?.KHR_materials_dispersion as
    KHR_materials_dispersion.Material | undefined;
  if (!ext) return null;

  return { dispersion: ext.dispersion ?? 0 };
}

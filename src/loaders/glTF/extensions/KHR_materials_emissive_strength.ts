import type * as GLTF from "types-gltf";
import type { KHR_materials_emissive_strength } from "types-gltf/extensions";
import type { ResolvedMaterial } from "../types.js";

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_emissive_strength */
export function resolveEmissiveStrength(
  material: GLTF.Material,
): Pick<ResolvedMaterial, "emissiveStrength"> | null {
  const ext = material.extensions?.KHR_materials_emissive_strength as
    KHR_materials_emissive_strength.Material | undefined;
  return ext ? { emissiveStrength: ext.emissiveStrength ?? 1 } : null;
}

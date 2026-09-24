import type * as GLTF from "types-gltf";
import type { KHR_materials_ior } from "types-gltf/extensions";
import type { ResolvedMaterial } from "../types.js";

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_ior */
export function resolveIor(
  material: GLTF.Material,
): Pick<ResolvedMaterial, "ior"> | null {
  const ext = material.extensions?.KHR_materials_ior as
    KHR_materials_ior.Material | undefined;
  return ext ? { ior: ext.ior ?? 1.5 } : null;
}

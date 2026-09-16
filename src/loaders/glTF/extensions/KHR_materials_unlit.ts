import type * as GLTF from "types-gltf";

/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_unlit */
export function resolveUnlit(material: GLTF.Material): boolean {
  return !!material.extensions?.KHR_materials_unlit;
}

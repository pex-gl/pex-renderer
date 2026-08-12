/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_unlit */
export function resolveUnlit(material: any): boolean {
  return !!material.extensions?.KHR_materials_unlit;
}

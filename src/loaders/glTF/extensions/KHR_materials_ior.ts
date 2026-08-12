/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_ior */
export function resolveIor(material: any): Record<string, any> | null {
  const ext = material.extensions?.KHR_materials_ior;
  if (!ext) return null;

  return { ior: ext.ior ?? 1.5 };
}

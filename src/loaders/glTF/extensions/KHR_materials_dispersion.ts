/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_dispersion */
export function resolveDispersion(material: any): Record<string, any> | null {
  const ext = material.extensions?.KHR_materials_dispersion;
  if (!ext) return null;

  return { dispersion: ext.dispersion ?? 0 };
}

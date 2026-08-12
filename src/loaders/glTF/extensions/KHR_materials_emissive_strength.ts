/** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_emissive_strength */
export function resolveEmissiveStrength(material: any): Record<string, any> | null {
  const ext = material.extensions?.KHR_materials_emissive_strength;
  if (!ext) return null;

  return { emissiveStrength: ext.emissiveStrength ?? 1 };
}

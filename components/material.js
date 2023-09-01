// let MaterialID = 0;

/**
 * Material component
 * @param {import("../types.js").MaterialComponentOptions} [options]
 * @returns {object}
 * @module MaterialComponent
 * @exports module:MaterialComponent
 */
export default (options) => ({
  // id: `Material_${MaterialID++}`,
  type: undefined,
  alphaTest: undefined, //0..1
  baseColor: [1, 1, 1, 1],
  emissiveColor: undefined,
  metallic: 1,
  roughness: 1,
  depthTest: true,
  depthWrite: true,
  // depthFunc: ctx.DepthFunc.Less,
  blend: false,
  blendSrcRGBFactor: undefined,
  blendSrcAlphaFactor: undefined,
  blendDstRGBFactor: undefined,
  blendDstAlphaFactor: undefined,
  castShadows: false,
  receiveShadows: false,
  // unlit: true, // TODO: should that be a type
  // emissiveIntensity: 1,
  // reflectance: 0.5,
  // baseColorTexture,
  // emissiveColorTexture,
  // normalTexture,
  // roughnessTexture,
  // metallicTexture,
  // metallicRoughnessTexture,
  // occlusionTexture,
  // clearCoat,
  // clearCoatRoughness,
  // clearCoatTexture,
  // clearCoatRoughnessTexture,
  // clearCoatNormalTexture,
  // clearCoatNormalTextureScale,
  // sheenColor,
  // sheenColorTexture,
  // sheenRoughness,
  // transmission,
  // reflectance,
  // alphaTexture,
  // pointSize: 1,
  ...options,
});

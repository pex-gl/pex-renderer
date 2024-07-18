// let MaterialID = 0;

/**
 * Material component
 * @param {import("../types.js").MaterialComponentOptions | import("../types.js").LineMaterialComponentOptions} [options]
 * @returns {object}
 * @alias module:components.material
 */
export default (options) => {
  if (options?.type === "line") {
    return {
      baseColor: [1, 1, 1, 1],
      depthTest: true,
      depthWrite: true,
      castShadows: false,
      lineWidth: 1,
      lineResolution: 6,
      perspectiveScaling: true,
      ...options,
    };
  }

  return {
    // id: `Material_${MaterialID++}`,
    type: undefined,
    alphaTest: undefined, //0..1
    baseColor: [1, 1, 1, 1],
    emissiveColor: undefined,
    metallic: 1,
    roughness: 1,
    ior: 1.5,
    // specular: 1,
    // specularTexture,
    // specularColor: [1, 1, 1],
    // specularColorTexture,
    depthTest: true,
    depthWrite: true,
    // depthFunc: ctx.DepthFunc.Less,
    blend: false,
    blendSrcRGBFactor: undefined,
    blendSrcAlphaFactor: undefined,
    blendDstRGBFactor: undefined,
    blendDstAlphaFactor: undefined,
    // cullFace: true,
    // cullFaceMode: ctx.Face.Back,
    castShadows: false,
    receiveShadows: false,
    // unlit: true,
    // emissiveIntensity: 1,
    // baseColorTexture,
    // emissiveColorTexture,
    // normalTexture,
    // normalTextureScale: 1,
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
    // transmissionTexture,
    // thickness,
    // thicknessTexture,
    // attenuationDistance,
    // attenuationColor,
    // dispersion,
    // alphaTexture,
    // pointSize: 1,
    ...options,
  };
};

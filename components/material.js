// let MaterialID = 0;

/**
 * Material component
 * @param {import("../types.js").MaterialComponentOptions | import("../types.js").LineMaterialComponentOptions} [options]
 * @returns {object}
 * @alias module:components.material
 */
export default (options) =>
  options?.type === "line"
    ? {
        baseColor: [1, 1, 1, 1],
        castShadows: false,
        lineWidth: 1,
        lineResolution: 6,
        perspectiveScaling: true,
        ...options,
      }
    : {
        // id: `Material_${MaterialID++}`,
        type: undefined,
        alphaTest: undefined, //0..1
        baseColor: [1, 1, 1, 1],
        emissiveColor: undefined,
        metallic: 1,
        roughness: 1,
        reflectance: 0.5,
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
        // unlit: true,
        // emissiveIntensity: 1,
        // baseColorTexture,
        // emissiveColorTexture,
        // normalTexture,
        normalTextureScale: 1,
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
        // alphaTexture,
        // pointSize: 1,
        ...options,
      };

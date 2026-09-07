// let MaterialID = 0;

import type {
  LineMaterialComponentOptions,
  MaterialComponentOptions,
} from "../types.js";

/** Material component */
export default (
  options?: MaterialComponentOptions | LineMaterialComponentOptions,
) => {
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
    unlit: undefined,
    alphaTest: undefined, //0..1
    alphaTexture: undefined,
    baseColor: [1, 1, 1, 1],
    baseColorTexture: undefined,
    emissiveColor: undefined,
    emissiveColorTexture: undefined,
    // Multiplier on emissiveColor, as KHR_materials_emissive_strength defines
    // it: 1 puts the authored colour at display white, above that is the
    // headroom a bloom pass needs. Unitless, so it means the same thing in a
    // physically lit scene and a relative one.
    emissiveStrength: 1,
    // How much of the camera's exposure emissive receives, applied as
    // mix(1.0, exposure, emissiveExposure). 0 undoes the exposure, so the
    // authored value keeps its screen level whatever the camera does — what
    // makes the multiplier above unitless, and what forces a surface to carry
    // on blooming. 1 meters it like any other light, which only means anything
    // if the product above was authored as a luminance in cd/m².
    emissiveExposure: 0,
    metallic: 1,
    metallicTexture: undefined,
    roughness: 1,
    roughnessTexture: undefined,
    metallicRoughnessTexture: undefined,
    ior: 1.5,
    specular: undefined,
    specularTexture: undefined,
    specularColor: undefined,
    specularColorTexture: undefined,
    normalTexture: undefined,
    normalTextureScale: 1,
    occlusionTexture: undefined,
    depthTest: true,
    depthWrite: true,
    // depthFunc: ctx.DepthFunc.Less,
    blend: false,
    blendMode: undefined,
    responsiveAA: false,
    cullFace: true,
    // cullFaceMode: ctx.Face.Back,
    castShadows: false,
    receiveShadows: false,
    // Clear coat (KHR_materials_clearcoat)
    clearCoat: undefined,
    clearCoatRoughness: undefined,
    clearCoatTexture: undefined,
    clearCoatRoughnessTexture: undefined,
    clearCoatNormalTexture: undefined,
    clearCoatNormalTextureScale: 1,
    // Sheen (KHR_materials_sheen)
    sheenColor: undefined,
    sheenColorTexture: undefined,
    sheenRoughness: undefined,
    sheenRoughnessTexture: undefined,
    // Transmission + volume (KHR_materials_transmission/volume/dispersion)
    transmission: undefined,
    transmissionTexture: undefined,
    dispersion: undefined,
    thickness: undefined,
    thicknessTexture: undefined,
    attenuationDistance: undefined,
    attenuationColor: undefined,
    // Diffuse transmission (KHR_materials_diffuse_transmission)
    diffuseTransmission: undefined,
    diffuseTransmissionTexture: undefined,
    diffuseTransmissionColor: undefined,
    diffuseTransmissionColorTexture: undefined,
    // Specular-glossiness (alternative to the metallic-roughness workflow;
    // active when any sg* field is set)
    sgDiffuse: undefined,
    sgSpecular: undefined,
    sgGlossiness: undefined,
    diffuseTexture: undefined,
    specularGlossinessTexture: undefined,
    // pointSize: 1, // WebGPU render pipelines have no point-primitive size equivalent
    ...options,
  };
};

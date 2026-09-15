// let MaterialID = 0;

import type { MaterialComponentOptions } from "../types.js";

/** Material component */
export default (options?: MaterialComponentOptions) => {
  if (options?.type === "line") {
    return {
      baseColor: [1, 1, 1, 1],
      depthWriteEnabled: true,
      castShadows: false,
      lineWidth: 1,
      lineResolution: 6,
      perspectiveScaling: true,
      ...options,
    };
  }

  // Only fields with a value: an absent one and one set to undefined are the
  // same to the renderers, which read every optional field through the shader
  // field tables (see systems/renderer/base.ts).
  return {
    // id: `Material_${MaterialID++}`,
    baseColor: [1, 1, 1, 1],
    emissiveStrength: 1,
    // Display referred by default: 0 undoes the camera's exposure, which is
    // what keeps emissiveStrength unitless.
    emissiveExposure: 0,
    metallic: 1,
    roughness: 1,
    ior: 1.5,
    normalTextureScale: 1,
    occlusionTextureStrength: 1,
    clearcoatNormalTextureScale: 1,
    responsiveAA: false,
    cullMode: "back",
    castShadows: false,
    receiveShadows: false,
    ...options,
  };
};

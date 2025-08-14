/**
 * Post Processing component
 * @param {import("../types.js").PostProcessingComponentOptions} [options]
 * @returns {object}
 * @alias module:components.postProcessing
 */
const postProcessing = (options) => ({
  // ssao
  // dof
  // aa
  // fog
  // bloom
  // lut
  // colorCorrection
  // vignette
  // filmGrain
  opacity: 1,
  ...options,
});

/**
 * Post Processing SSAO subcomponent
 * @param {import("../types.js").SSAOComponentOptions} [options]
 * @returns {object}
 * @alias module:components.postProcessing.ssao
 */
postProcessing.ssao = (options) => ({
  type: "sao", // "gtao",
  noiseTexture: true,
  mix: 1,
  samples: options?.type === "gtao" ? 6 : 11,
  intensity: 2.2,
  radius: 0.5, // m
  blurRadius: 0.5,
  blurSharpness: 10,
  brightness: 0,
  contrast: 1,
  // SAO
  bias: 0.001, // cm
  spiralTurns: 7,
  // GTAO
  slices: 3,
  colorBounce: true,
  colorBounceIntensity: 1.0,
  ...options,
});

/**
 * Post Processing DoF subcomponent
 * @param {import("../types.js").DoFComponentOptions} [options]
 * @returns {object}
 */
postProcessing.dof = (options) => ({
  type: "gustafsson", // "upitis"
  physical: true,
  focusDistance: 7,
  focusScale: 1,
  focusOnScreenPoint: false,
  screenPoint: [0.5, 0.5],
  chromaticAberration: 0.7,
  luminanceThreshold: 0.7,
  luminanceGain: 1,
  samples: 6,
  shape: "disk", // "pentagon"
  debug: false,
  ...options,
});

/**
 * Post Processing AA subcomponent
 * @param {import("../types.js").AAComponentOptions} [options]
 * @returns {object}
 */
postProcessing.aa = (options) => ({
  msaa: false,
  // FXAA
  type: "fxaa",
  subPixelQuality: 0.75, // (0, 1]
  quality: 2,
  ...options,
});

/**
 * Post Processing Fog subcomponent
 * @param {import("../types.js").FogComponentOptions} [options]
 * @returns {object}
 */
postProcessing.fog = (options) => ({
  color: [0.5, 0.5, 0.5],
  start: 5,
  density: 0.15,

  sunPosition: [1, 1, 1],
  sunDispertion: 0.2,
  sunIntensity: 0.1,
  sunColor: [0.98, 0.98, 0.7],
  inscatteringCoeffs: [0.3, 0.3, 0.3],
  ...options,
});

/**
 * Post Processing Bloom subcomponent
 * @param {import("../types.js").BloomComponentOptions} [options]
 * @returns {object}
 */
postProcessing.bloom = (options) => ({
  quality: 1,
  colorFunction: "luma", // "average" | "luminance"
  threshold: 1,
  source: false, // "color" | "emissive"
  radius: 1,
  intensity: 0.1,
  ...options,
});

/**
 * Post Processing LUT subcomponent
 * @param {import("../types.js").LutComponentOptions} [options]
 * @returns {object}
 */
postProcessing.lut = (options) => ({
  // texture,
  ...options,
});

/**
 * Post Processing Color Correction subcomponent
 * @param {import("../types.js").ColorCorrectionComponentOptions} [options]
 * @returns {object}
 */
postProcessing.colorCorrection = (options) => ({
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
  ...options,
});

/**
 * Post Processing Vignette subcomponent
 * @param {import("../types.js").VignetteComponentOptions} [options]
 * @returns {object}
 */
postProcessing.vignette = (options) => ({
  radius: 0.8,
  intensity: 0.2,
  ...options,
});

/**
 * Post Processing Film Grain subcomponent
 * @param {import("../types.js").FilmGrainComponentOptions} [options]
 * @returns {object}
 */
postProcessing.filmGrain = (options) => ({
  quality: 2,
  size: 1.6,
  intensity: 0.05,
  colorIntensity: 0.6,
  luminanceIntensity: 1,
  speed: 0.5,
  ...options,
});

export default postProcessing;

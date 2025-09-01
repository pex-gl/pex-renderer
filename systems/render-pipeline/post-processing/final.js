import { postProcessing as postprocessingShaders } from "pex-shaders";
import { ssaoMixFlagDefinitions } from "./ssao.js";

const final = ({ resourceCache, descriptors }) => {
  const combinePass = {
    name: "combine",
    frag: postprocessingShaders.combine.frag,
    // blend: true,
    // prettier-ignore
    flagDefinitions: [
      // Camera
      [["camera", "viewMatrix"], "", { uniform: "uViewMatrix" }],
      [["camera", "near"], "", { uniform: "uNear" }],
      [["camera", "far"], "", { uniform: "uFar" }],
      [["camera", "fov"], "", { uniform: "uFov" }],
      [["camera", "exposure"], "", { uniform: "uExposure" }],
      [["camera", "toneMap"], "TONE_MAP", { type: "value" }],
      [["camera", "outputEncoding"], "", { uniform: "uOutputEncoding" }],

      // Fog
      [["postProcessing", "fog"], "USE_FOG"],
      [["postProcessing", "fog", "color"], "", { uniform: "uFogColor", requires: "USE_FOG" }],
      [["postProcessing", "fog", "start"], "", { uniform: "uFogStart", requires: "USE_FOG" }],
      [["postProcessing", "fog", "density"], "", { uniform: "uFogDensity", requires: "USE_FOG" }],
      [["postProcessing", "fog", "sunPosition"], "", { uniform: "uSunPosition", requires: "USE_FOG" }],
      [["postProcessing", "fog", "sunDispertion"], "", { uniform: "uSunDispertion", requires: "USE_FOG" }],
      [["postProcessing", "fog", "sunIntensity"], "", { uniform: "uSunIntensity", requires: "USE_FOG" }],
      [["postProcessing", "fog", "sunColor"], "", { uniform: "uSunColor", requires: "USE_FOG" }],
      [["postProcessing", "fog", "inscatteringCoeffs"], "", { uniform: "uInscatteringCoeffs", requires: "USE_FOG" }],

      // SSAO
      [["postProcessing", "dof"], "USE_DOF"],
      [["postProcessing", "ssao"], "USE_SSAO", { excludes: "USE_DOF" }],
      ...ssaoMixFlagDefinitions,

      // Bloom
      [["postProcessing", "bloom"], "USE_BLOOM"],
      [["postProcessing", "bloom", "intensity"], "", { uniform: "uBloomIntensity", requires: "USE_BLOOM" }],
      [["options", "targets", "bloom.threshold"], "BLOOM_TEXTURE", { type: "texture", uniform: "uBloomTexture", requires: "USE_BLOOM" }],

      // Vignette
      [["postProcessing", "vignette"], "USE_VIGNETTE"],
      [["postProcessing", "vignette", "radius"], "", { uniform: "uVignetteRadius", requires: "USE_VIGNETTE" }],
      [["postProcessing", "vignette", "intensity"], "", { uniform: "uVignetteIntensity", requires: "USE_VIGNETTE" }],

      // LUT
      [["postProcessing", "lut"], "USE_LUT"],
      [["postProcessing", "lut", "texture"], "LUT_TEXTURE", { type: "texture", uniform: "uLUTTexture", requires: "USE_LUT" }],
      [["postProcessing", "lut", "texture", "width"], "", { uniform: "uLUTTextureSize", requires: "USE_LUT" }],

      // Color Correction
      [["postProcessing", "colorCorrection"], "USE_COLOR_CORRECTION"],
      [["postProcessing", "colorCorrection", "brightness"], "", { uniform: "uBrightness", requires: "USE_COLOR_CORRECTION" }],
      [["postProcessing", "colorCorrection", "contrast"], "", { uniform: "uContrast", requires: "USE_COLOR_CORRECTION" }],
      [["postProcessing", "colorCorrection", "saturation"], "", { uniform: "uSaturation", requires: "USE_COLOR_CORRECTION" }],
      [["postProcessing", "colorCorrection", "hue"], "", { uniform: "uHue", requires: "USE_COLOR_CORRECTION" }],
    ],
    source: ({ cameraEntity }) =>
      cameraEntity.postProcessing.dof ? "dof.main" : "color",
    target: ({ viewport }) =>
      resourceCache.texture2D({
        ...descriptors.postProcessing.outputTextureDesc,
        width: viewport[2],
        height: viewport[3],
      }),
  };

  const finalPass = {
    name: "main",
    frag: postprocessingShaders.final.frag,
    // blend: true,
    // prettier-ignore
    flagDefinitions: [
      // AA
      [["postProcessing", "aa"], "USE_AA"],
      [["postProcessing", "aa", "subPixelQuality"], "", { uniform: "uSubPixelQuality", requires: "USE_AA" }],
      [["postProcessing", "aa", "quality"], "AA_QUALITY", { type: "value", requires: "USE_AA" }],

      // Film Grain
      [["postProcessing", "filmGrain"], "USE_FILM_GRAIN"],
      [["postProcessing", "filmGrain", "quality"], "FILM_GRAIN_QUALITY", { type: "value", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "size"], "", { uniform: "uFilmGrainSize", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "intensity"], "", { uniform: "uFilmGrainIntensity", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "colorIntensity"], "", { uniform: "uFilmGrainColorIntensity", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "luminanceIntensity"], "", { uniform: "uFilmGrainLuminanceIntensity", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "speed"], "", { uniform: "uFilmGrainSpeed", requires: "USE_FILM_GRAIN" }],

      // Output
      [["postProcessing", "opacity"], "", { uniform: "uOpacity" }],
    ],
    enabled: ({ cameraEntity }) =>
      cameraEntity.postProcessing.aa ||
      cameraEntity.postProcessing.filmGrain ||
      (Number.isFinite(cameraEntity.postProcessing.opacity) &&
        cameraEntity.postProcessing.opacity !== 0),
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    source: () => "final.combine",
  };

  return [combinePass, finalPass];
};

export default final;

import { postProcessing as postprocessingShaders } from "pex-shaders";
import { ssao, ssaoMixFlagDefinitions } from "./post-processing/ssao.js";

const dof = ({ resourceCache, descriptors }) => [
  {
    name: "main",
    // prettier-ignore
    flagDefinitions: [
      [["camera", "near"], "", { uniform: "uNear" }],
      [["camera", "far"], "", { uniform: "uFar" }],
      [["camera", "exposure"], "", { uniform: "uExposure" }],

      [["postProcessing", "dof"], "USE_DOF"],
      [["postProcessing", "dof", "type"], "USE_DOF_GUSTAFSSON", { compare: "gustafsson", requires: "USE_DOF" }],
      [["postProcessing", "dof", "type"], "USE_DOF_UPITIS", { compare: "upitis", requires: "USE_DOF" }],
      [["postProcessing", "dof", "focusDistance"], "", { uniform: "uFocusDistance", requires: "USE_DOF" }],
      [["postProcessing", "dof", "focusScale"], "", { uniform: "uFocusScale", requires: "USE_DOF" }],
      [["postProcessing", "dof", "samples"], "NUM_SAMPLES", { type: "value", requires: "USE_DOF" }],
      [["postProcessing", "dof", "chromaticAberration"], "", { uniform: "uChromaticAberration", requires: "USE_DOF" }],
      [["postProcessing", "dof", "luminanceThreshold"], "", { uniform: "uLuminanceThreshold", requires: "USE_DOF" }],
      [["postProcessing", "dof", "luminanceGain"], "", { uniform: "uLuminanceGain", requires: "USE_DOF" }],
      [["postProcessing", "dof", "shape"], "USE_SHAPE_PENTAGON", { compare: "pentagon", requires: "USE_DOF_UPITIS" }],

      [["postProcessing", "dof", "physical"], "USE_PHYSICAL", { requires: "USE_DOF" }],
      [["camera", "focalLength"], "", { uniform: "uFocalLength", requires: "USE_PHYSICAL" }],
      [["camera", "fStop"], "", { uniform: "uFStop", requires: "USE_PHYSICAL" }],

      [["postProcessing", "dof", "focusOnScreenPoint"], "USE_FOCUS_ON_SCREEN_POINT"],
      [["postProcessing", "dof", "screenPoint"], "", { uniform: "uScreenPoint", requires: "USE_FOCUS_ON_SCREEN_POINT" }],
      [["postProcessing", "dof", "debug"], "USE_DEBUG", { requires: "USE_DOF" }],
    ],
    frag: postprocessingShaders.dof.frag,
    target: ({ viewport }) =>
      resourceCache.texture2D({
        ...descriptors.postProcessing.outputTextureDesc,
        width: viewport[2],
        height: viewport[3],
      }),
    // TODO: can i draw direct to mainColor?
    // source = target = inputColor
  },
];

const bloom = ({ ctx, resourceCache, descriptors, bloomLevels = 9 }) => [
  {
    name: "threshold",
    frag: postprocessingShaders.threshold.frag,
    // prettier-ignore
    flagDefinitions: [
      [["camera", "exposure"], "", { uniform: "uExposure" }],
      [["postProcessing", "bloom", "threshold"], "", { uniform: "uThreshold" }],
      [["postProcessing", "bloom", "colorFunction"], "COLOR_FUNCTION", { type: "value" }],
      [["postProcessing", "bloom", "source"], "USE_SOURCE_COLOR", { compare: "color" }],
      [["postProcessing", "bloom", "source"], "USE_SOURCE_EMISSIVE", { compare: "emissive" }],
    ],
    // source = inputColor
    target: ({ viewport }) =>
      resourceCache.texture2D({
        ...descriptors.postProcessing.outputTextureDesc,
        width: viewport[2],
        height: viewport[3],
      }),
  },
  // TODO: custom downsample levels based on viewport size
  ...Array.from({ length: bloomLevels }, (_, k) => k).map((i) => ({
    name: `downsample[${i}]`,
    frag: postprocessingShaders.downsample.frag,
    // prettier-ignore
    flagDefinitions: [
      [["postProcessing", "bloom"], "USE_DOWN_SAMPLE"],
      [["postProcessing", "bloom", "quality"], "QUALITY", { type: "value" }],
      [["postProcessing", "bloom", "radius"], "", { uniform: "uIntensity" }],
    ],
    source: () => (i === 0 ? "bloom.threshold" : `bloom.downsample[${i - 1}]`),
    target: ({ viewport }) =>
      resourceCache.texture2D({
        ...descriptors.postProcessing.outputTextureDesc,
        width: Math.max(~~(viewport[2] / 2 ** (i + 1)), 1),
        height: Math.max(~~(viewport[3] / 2 ** (i + 1)), 1),
        min: ctx.capabilities.textureHalfFloatLinear
          ? ctx.Filter.Linear
          : ctx.Filter.Nearest,
        mag: ctx.capabilities.textureHalfFloatLinear
          ? ctx.Filter.Linear
          : ctx.Filter.Nearest,
      }),
    size: ({ viewport }) => [
      Math.max(~~(viewport[2] / 2 ** (i + 1)), 1),
      Math.max(~~(viewport[3] / 2 ** (i + 1)), 1),
    ],
  })),
  ...Array.from({ length: bloomLevels - 1 }, (_, k) => k).map((i) => ({
    name: `main[${i}]`,
    frag: postprocessingShaders.upsample.frag,
    // prettier-ignore
    flagDefinitions: [
      [["postProcessing", "bloom"], "USE_UPSAMPLE"],
      [["postProcessing", "bloom", "quality"], "QUALITY", { type: "value" }],
    ],
    blend: true,
    source: () => `bloom.downsample[${i + 1}]`,
    target: () => "bloom.threshold",
  })),
];

const final = () => [
  {
    name: "main",
    frag: postprocessingShaders.postProcessing.frag.replace(
      /*glsl*/ `vec4 ssao(vec4 color, vec4 aoData, float intensity) {
  #ifdef USE_SSAO_COLORS
    vec3 rgb = mix(color.rgb, color.rgb * gtaoMultiBounce(aoData.a, color.rgb), intensity);
    color.rgb = vec3(rgb + aoData.rgb * color.rgb * 2.0);
    // color.rgb = vec3(color.rgb * (0.25 + 0.75 * aoData.a) + aoData.rgb * color.rgb * 2.0);
  #else
    color.rgb *= mix(vec3(1.0), vec3(aoData.r), intensity);
  #endif

  return color;
}`,
      /*glsl*/ `vec4 ssao(vec4 color, vec4 aoData, float ssaoMix) {
  #ifdef USE_SSAO_COLORS
    vec3 albedoColor = color.rgb; //unlit color of the surface that we don't have ATM
    vec3 colorWithAO = color.rgb * gtaoMultiBounce(aoData.a, albedoColor);
    vec3 colorBounce = albedoColor * aoData.rgb;
    color.rgb = mix(color.rgb, colorWithAO + colorBounce, ssaoMix);
    // color.rgb = vec3(aoData.aaa);
    // color.rgb = vec3(aoData.rgb);
  #else
    color.rgb *= mix(vec3(1.0), vec3(aoData.r), ssaoMix);
  #endif

  return color;
}`,
    ),
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

      // AA
      [["postProcessing", "aa"], "USE_AA"],

      [["postProcessing", "aa", "type"], "USE_FXAA_2", { compare: "fxaa2", requires: "USE_AA" }],
      [["postProcessing", "aa", "spanMax"], "", { uniform: "uFXAASpanMax", requires: "USE_FXAA_2" }],

      [["postProcessing", "aa", "type"], "USE_FXAA_3", { compare: "fxaa3", requires: "USE_AA" }],
      [["postProcessing", "aa", "preset"], "USE_FXAA_3_LOW", { compare: "low", requires: "USE_FXAA_3" }],
      [["postProcessing", "aa", "preset"], "USE_FXAA_3_MEDIUM", { compare: "medium", requires: "USE_FXAA_3" }],
      [["postProcessing", "aa", "preset"], "USE_FXAA_3_HIGH", { compare: "high", requires: "USE_FXAA_3" }],
      [["postProcessing", "aa", "preset"], "USE_FXAA_3_ULTRA", { compare: "ultra", requires: "USE_FXAA_3" }],
      [["postProcessing", "aa", "preset"], "USE_FXAA_3_EXTREME", { compare: "extreme", requires: "USE_FXAA_3" }],

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

      // Film Grain
      [["postProcessing", "filmGrain"], "USE_FILM_GRAIN"],
      [["postProcessing", "filmGrain", "quality"], "FILM_GRAIN_QUALITY", { type: "value", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "size"], "", { uniform: "uFilmGrainSize", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "intensity"], "", { uniform: "uFilmGrainIntensity", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "colorIntensity"], "", { uniform: "uFilmGrainColorIntensity", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "luminanceIntensity"], "", { uniform: "uFilmGrainLuminanceIntensity", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "speed"], "", { uniform: "uFilmGrainSpeed", requires: "USE_FILM_GRAIN" }],

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

      // Vignette
      [["postProcessing", "vignette"], "USE_VIGNETTE"],
      [["postProcessing", "vignette", "radius"], "", { uniform: "uVignetteRadius", requires: "USE_VIGNETTE" }],
      [["postProcessing", "vignette", "intensity"], "", { uniform: "uVignetteIntensity", requires: "USE_VIGNETTE" }],

      // Output
      [["postProcessing", "opacity"], "", { uniform: "uOpacity" }],
    ],
    // uniform: () => ({ uTextureEncoding: uniforms.uTexture.encoding }),
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    source: ({ cameraEntity }) =>
      cameraEntity.postProcessing.dof ? "dof.main" : "color",
  },
];

const getPostProcessingPasses = (options) => [
  { name: "ssao", passes: ssao(options) },
  { name: "dof", passes: dof(options) },
  { name: "bloom", passes: bloom(options) },
  { name: "final", passes: final() },
];

export { ssao, dof, bloom, final, getPostProcessingPasses };

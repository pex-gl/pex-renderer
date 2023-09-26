import { postProcessing as SHADERS } from "pex-shaders";

export default ({ ctx, resourceCache, descriptors, bloomLevels = 9 }) => [
  {
    name: "dof",
    commands: [
      {
        name: "main",
        // prettier-ignore
        flagDefs: [
          [["camera", "near"], "", { uniform: "uNear" }],
          [["camera", "far"], "", { uniform: "uFar" }],
          [["camera", "actualSensorHeight"], "", { uniform: "uSensorHeight" }],
          [["camera", "focalLength"], "", { uniform: "uFocalLength" }],
          [["camera", "fStop"], "", { uniform: "uFStop" }],
          [["camera", "exposure"], "", { uniform: "uExposure" }],

          [["postProcessing", "dof"], "USE_DOF", { type: "boolean" }],
          [["postProcessing", "dof", "type"], "USE_DOF_GUSTAFSSON", { compare: "gustafsson", requires: "USE_DOF" }],
          [["postProcessing", "dof", "type"], "USE_DOF_UPITIS", { compare: "upitis", requires: "USE_DOF" }],
          [["postProcessing", "dof", "focusDistance"], "", { uniform: "uFocusDistance", requires: "USE_DOF" }],
          [["postProcessing", "dof", "samples"], "NUM_SAMPLES", { type: "counter", requires: "USE_DOF" }],
          [["postProcessing", "dof", "chromaticAberration"], "", { uniform: "uChromaticAberration", requires: "USE_DOF" }],
          [["postProcessing", "dof", "luminanceThreshold"], "", { uniform: "uLuminanceThreshold", requires: "USE_DOF" }],
          [["postProcessing", "dof", "luminanceGain"], "", { uniform: "uLuminanceGain", requires: "USE_DOF" }],
          [["postProcessing", "dof", "shape"], "USE_DOF_SHAPE_PENTAGON", { compare: "pentagon", requires: "USE_DOF_UPITIS" }],

          [["postProcessing", "dof", "focusOnScreenPoint"], "USE_DOF_FOCUS_ON_SCREEN_POINT", { type: "boolean" }],
          [["postProcessing", "dof", "screenPoint"], "", { uniform: "uScreenPoint", requires: "USE_DOF_FOCUS_ON_SCREEN_POINT" }],
          [["postProcessing", "dof", "debug"], "USE_DOF_DEBUG", { type: "boolean", requires: "USE_DOF" }],
        ],
        frag: SHADERS.dof.frag,
        target: ({ viewport }) =>
          resourceCache.texture2D({
            ...descriptors.postProcessing.outputTextureDesc,
            width: viewport[2],
            height: viewport[3],
          }),
        // TODO: can i draw direct to mainColor?
        // source = target = inputColor
      },
    ],
  },
  {
    name: "bloom",
    commands: [
      {
        name: "threshold",
        frag: SHADERS.threshold.frag,
        // prettier-ignore
        flagDefs: [
          [["camera", "exposure"], "", { uniform: "uExposure" }],
          [["postProcessing", "bloom", "threshold"], "", { uniform: "uThreshold" }],
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
        name: `downSample[${i}]`,
        frag: SHADERS.downSample.frag,
        // prettier-ignore
        flagDefs: [
          [["postProcessing", "bloom", "radius"], "", { uniform: "uIntensity" }],
        ],
        source: () =>
          i === 0 ? "bloom.threshold" : `bloom.downSample[${i - 1}]`,
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
        frag: SHADERS.bloom.frag,
        blend: true,
        source: () => `bloom.downSample[${i + 1}]`,
        target: () => "bloom.threshold",
      })),
    ],
  },
  {
    name: "blit",
    commands: [
      {
        name: "main",
        frag: SHADERS.postProcessing.frag,
        // blend: true,
        // prettier-ignore
        flagDefs: [
          // Camera
          [["camera", "viewMatrix"], "", { uniform: "uViewMatrix" }],
          [["camera", "near"], "", { uniform: "uNear" }],
          [["camera", "far"], "", { uniform: "uFar" }],
          [["camera", "exposure"], "", { uniform: "uExposure" }],

          // AA
          [["postProcessing", "aa"], "USE_AA", { type: "boolean" }],

          [["postProcessing", "aa", "type"], "USE_FXAA_2", { compare: "fxaa2", requires: "USE_AA" }],
          [["postProcessing", "aa", "spanMax"], "", { uniform: "uFXAASpanMax", requires: "USE_FXAA_2" }],

          [["postProcessing", "aa", "type"], "USE_FXAA_3", { compare: "fxaa3", requires: "USE_AA" }],
          [["postProcessing", "aa", "preset"], "USE_FXAA_3_LOW", { compare: "low", requires: "USE_FXAA_3" }],
          [["postProcessing", "aa", "preset"], "USE_FXAA_3_MEDIUM", { compare: "medium", requires: "USE_FXAA_3" }],
          [["postProcessing", "aa", "preset"], "USE_FXAA_3_HIGH", { compare: "high", requires: "USE_FXAA_3" }],
          [["postProcessing", "aa", "preset"], "USE_FXAA_3_ULTRA", { compare: "ultra", requires: "USE_FXAA_3" }],
          [["postProcessing", "aa", "preset"], "USE_FXAA_3_EXTREME", { compare: "extreme", requires: "USE_FXAA_3" }],

          // Fog
          [["postProcessing", "fog"], "USE_FOG", { type: "boolean" }],
          [["postProcessing", "fog", "color"], "", { uniform: "uFogColor", requires: "USE_FOG" }],
          [["postProcessing", "fog", "start"], "", { uniform: "uFogStart", requires: "USE_FOG" }],
          [["postProcessing", "fog", "density"], "", { uniform: "uFogDensity", requires: "USE_FOG" }],
          [["postProcessing", "fog", "sunPosition"], "", { uniform: "uSunPosition", requires: "USE_FOG" }],
          [["postProcessing", "fog", "sunDispertion"], "", { uniform: "uSunDispertion", requires: "USE_FOG" }],
          [["postProcessing", "fog", "sunIntensity"], "", { uniform: "uSunIntensity", requires: "USE_FOG" }],
          [["postProcessing", "fog", "sunColor"], "", { uniform: "uSunColor", requires: "USE_FOG" }],
          [["postProcessing", "fog", "inscatteringCoeffs"], "", { uniform: "uInscatteringCoeffs", requires: "USE_FOG" }],

          // Bloom
          [["postProcessing", "bloom"], "USE_BLOOM", { type: "boolean" }],
          [["postProcessing", "bloom", "intensity"], "", { uniform: "uBloomIntensity", requires: "USE_BLOOM" }],
          [["options", "targets", "bloom.threshold"], "BLOOM_TEXTURE", { type: "texture", uniform: "uBloomTexture", requires: "USE_BLOOM" }],

          // LUT
          [["postProcessing", "lut"], "USE_LUT", { type: "boolean" }],
          [["postProcessing", "lut", "texture"], "LUT_TEXTURE", { type: "texture", uniform: "uLUTTexture", requires: "USE_LUT" }],
          [["postProcessing", "lut", "texture", "width"], "", { uniform: "uLUTTextureSize", requires: "USE_LUT" }],

          // Color Correction
          [["postProcessing", "colorCorrection"], "USE_COLOR_CORRECTION", { type: "boolean" }],
          [["postProcessing", "colorCorrection", "brightness"], "", { uniform: "uBrightness", requires: "USE_COLOR_CORRECTION" }],
          [["postProcessing", "colorCorrection", "contrast"], "", { uniform: "uContrast", requires: "USE_COLOR_CORRECTION" }],
          [["postProcessing", "colorCorrection", "saturation"], "", { uniform: "uSaturation", requires: "USE_COLOR_CORRECTION" }],
          [["postProcessing", "colorCorrection", "hue"], "", { uniform: "uHue", requires: "USE_COLOR_CORRECTION" }],

          // Vignette
          [["postProcessing", "vignette"], "USE_VIGNETTE", { type: "boolean" }],
          [["postProcessing", "vignette", "radius"], "", { uniform: "uVignetteRadius", requires: "USE_VIGNETTE" }],
          [["postProcessing", "vignette", "intensity"], "", { uniform: "uVignetteIntensity", requires: "USE_VIGNETTE" }],

          // Output
          [["postProcessing", "opacity"], "", { uniform: "uOpacity" }],
        ],
        source: ({ cameraEntity }) =>
          cameraEntity.postProcessing.dof ? "dof.main" : "color",
      },
    ],
  },
];

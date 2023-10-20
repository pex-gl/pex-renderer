import { postProcessing as SHADERS } from "pex-shaders";
import random from "pex-random";
import { BlueNoiseGenerator } from "./blue-noise.js";

export default ({
  ctx,
  resourceCache,
  descriptors,
  bloomLevels = 9,
  aoScale = 1,
  saoMainTarget,
  gtaoMainTarget,
}) => [
  {
    name: "ssao",
    commands: [
      // GTAO
      {
        name: "main",
        frag: SHADERS.gtao.frag,
        // blend: true,
        // frag: SHADERS.sao.frag,
        // prettier-ignore
        flagDefinitions: [
          [["camera", "near"], "", { uniform: "uNear" }],
          [["camera", "far"], "", { uniform: "uFar" }],
          [["camera", "fov"], "", { uniform: "uFov" }],

          [["postProcessing", "ssao"], "USE_SSAO"],

          [["postProcessing", "ssao", "type"], "USE_SSAO_GTAO", { compare: "gtao", requires: "USE_SSAO" }],
          [["postProcessing", "ssao", "slices"], "NUM_SLICES", { type: "value", requires: "USE_SSAO_GTAO" }],
          [["postProcessing", "ssao", "samples"], "NUM_SAMPLES", { type: "value", requires: "USE_SSAO_GTAO" }],
          [["postProcessing", "ssao", "intensity"], "", { uniform: "uIntensity", requires: "USE_SSAO_GTAO" }],
          [["postProcessing", "ssao", "radius"], "", { uniform: "uRadius", requires: "USE_SSAO_GTAO" }],
          [["postProcessing", "ssao", "brightness"], "", { uniform: "uBrightness", requires: "USE_SSAO_GTAO" }],
          [["postProcessing", "ssao", "contrast"], "", { uniform: "uContrast", requires: "USE_SSAO_GTAO" }],
          [["postProcessing", "ssao", "colorBounce"], "USE_COLOR_BOUNCE", { requires: "USE_SSAO_GTAO" }],
          [["postProcessing", "ssao", "colorBounceIntensity"], "", { uniform: "uColorBounceIntensity", requires: "USE_SSAO_GTAO" }],
          [["postProcessing", "ssao", "noiseTexture"], "USE_GTAO_NOISE_TEXTURE", { requires: "USE_SSAO_GTAO" }],
          [["postProcessing", "ssao", "_gtaoNoiseTexture"], "NOISE_TEXTURE", { type: "texture", uniform: "uNoiseTexture", requires: "USE_GTAO_NOISE_TEXTURE" }],
          [["postProcessing", "ssao", "_gtaoNoiseTexture", "width"], "", { uniform: "uNoiseTextureSize", requires: "USE_GTAO_NOISE_TEXTURE" }],
        ],
        disabled: ({ cameraEntity }) => {
          const isEnabled = cameraEntity.postProcessing.ssao.type === "gtao";

          if (
            isEnabled &&
            cameraEntity.postProcessing.ssao.noiseTexture &&
            !cameraEntity.postProcessing.ssao._gtaoNoiseTexture
          ) {
            const generator = new BlueNoiseGenerator();
            generator.size = 32;

            const data = new Uint8Array(generator.size ** 2 * 4);
            for (let i = 0, l = 4; i < l; i++) {
              const result = generator.generate();
              const bin = result.data;
              const maxValue = result.maxValue;

              for (let j = 0, l2 = bin.length; j < l2; j++) {
                const value = 255 * (bin[j] / maxValue);
                data[j * 4 + i] = value;
              }
            }
            cameraEntity.postProcessing.ssao._gtaoNoiseTexture = ctx.texture2D({
              width: generator.size,
              height: generator.size,
              data: data,
              pixelFormat: ctx.PixelFormat.RGBA8,
              encoding: ctx.Encoding.Linear,
              wrap: ctx.Wrap.Repeat,
              mag: ctx.Filter.Linear,
              min: ctx.Filter.Linear,
            });
          }

          return !isEnabled;
        },
        passDesc: () => ({
          clearColor: [0, 0, 0, 1],
        }),
        target: ({ viewport }) => {
          if (!gtaoMainTarget) {
            gtaoMainTarget = ctx.texture2D({
              ...descriptors.postProcessing.outputTextureDesc,
              width: viewport[2] * aoScale,
              height: viewport[3] * aoScale,
            });
          } else {
            ctx.update(gtaoMainTarget, {
              width: viewport[2] * aoScale,
              height: viewport[3] * aoScale,
            });
          }
          return gtaoMainTarget;
        },
        size: ({ viewport }) => [viewport[2] * aoScale, viewport[3] * aoScale],
      },
      // SAO
      {
        name: "main",
        frag: SHADERS.sao.frag,
        // prettier-ignore
        flagDefinitions: [
          [["camera", "near"], "", { uniform: "uNear" }],
          [["camera", "far"], "", { uniform: "uFar" }],
          [["camera", "fov"], "", { uniform: "uFov" }],

          [["postProcessing", "ssao"], "USE_SSAO"],

          [["postProcessing", "ssao", "type"], "USE_SSAO_SAO", { compare: "sao", requires: "USE_SSAO" }],
          [["postProcessing", "ssao", "samples"], "NUM_SAMPLES", { type: "value", requires: "USE_SSAO_SAO" }],
          [["postProcessing", "ssao", "spiralTurns"], "NUM_SPIRAL_TURNS", { type: "value", requires: "USE_SSAO_SAO" }],
          [["postProcessing", "ssao", "intensity"], "", { uniform: "uIntensity", requires: "USE_SSAO_SAO" }],
          [["postProcessing", "ssao", "bias"], "", { uniform: "uBias", requires: "USE_SSAO_SAO" }],
          [["postProcessing", "ssao", "radius"], "", { uniform: "uRadius", requires: "USE_SSAO_SAO" }],
          [["postProcessing", "ssao", "brightness"], "", { uniform: "uBrightness", requires: "USE_SSAO_SAO" }],
          [["postProcessing", "ssao", "contrast"], "", { uniform: "uContrast", requires: "USE_SSAO_SAO" }],
          [["postProcessing", "ssao", "noiseTexture"], "USE_SAO_NOISE_TEXTURE", { requires: "USE_SSAO_SAO" }],
          [["postProcessing", "ssao", "_saoNoiseTexture"], "NOISE_TEXTURE", { type: "texture", uniform: "uNoiseTexture", requires: "USE_SAO_NOISE_TEXTURE" }],
          [["postProcessing", "ssao", "_saoNoiseTexture", "width"], "", { uniform: "uNoiseTextureSize", requires: "USE_SAO_NOISE_TEXTURE" }],
        ],
        disabled: ({ cameraEntity }) => {
          const isEnabled = cameraEntity.postProcessing.ssao.type === "sao";

          if (
            isEnabled &&
            cameraEntity.postProcessing.ssao.noiseTexture &&
            !cameraEntity.postProcessing.ssao._saoNoiseTexture
          ) {
            const localPRNG = random.create("0");

            const size = 64;
            const sizeSquared = size ** 2;
            const channelSize = ctx.gl.RG ? 2 : 4;
            const ssaoNoiseData = new Float32Array(sizeSquared * channelSize);
            for (let i = 0; i < sizeSquared; i++) {
              ssaoNoiseData[i * channelSize + 0] = localPRNG.float(-1, 1);
              ssaoNoiseData[i * channelSize + 1] = localPRNG.float(-1, 1);
              if (!ctx.gl.RG) {
                ssaoNoiseData[i * channelSize + 2] = 0;
                ssaoNoiseData[i * channelSize + 3] = 1;
              }
            }
            cameraEntity.postProcessing.ssao._saoNoiseTexture = ctx.texture2D({
              width: size,
              height: size,
              data: ssaoNoiseData,
              pixelFormat: ctx.gl.RG
                ? ctx.PixelFormat.RG32F
                : ctx.PixelFormat.RGBA32F,
              encoding: ctx.Encoding.Linear,
              wrap: ctx.Wrap.Repeat,
              mag: ctx.Filter.Linear,
              min: ctx.Filter.Linear,
            });
          }

          return !isEnabled;
        },
        passDesc: () => ({
          clearColor: [0, 0, 0, 1],
        }),
        target: ({ viewport }) => {
          if (!saoMainTarget) {
            saoMainTarget = ctx.texture2D({
              ...descriptors.postProcessing.outputTextureDesc,
              // pixelFormat: ctx.PixelFormat.RGBA8,
              pixelFormat: ctx.gl.RG
                ? ctx.PixelFormat.R8
                : ctx.PixelFormat.RGBA8,
              width: viewport[2] * aoScale,
              height: viewport[3] * aoScale,
            });
          } else {
            ctx.update(saoMainTarget, {
              width: viewport[2] * aoScale,
              height: viewport[3] * aoScale,
            });
          }
          return saoMainTarget;
        },
        size: ({ viewport }) => [viewport[2] * aoScale, viewport[3] * aoScale],
      },
      {
        name: "blurHorizontal",
        frag: SHADERS.bilateralBlur.frag,
        // prettier-ignore
        flagDefinitions: [
          [["camera", "near"], "", { uniform: "uNear" }],
          [["camera", "far"], "", { uniform: "uFar" }],
          [["postProcessing", "ssao", "blurSharpness"], "", { uniform: "uSharpness" }],
        ],
        disabled: ({ cameraEntity }) =>
          cameraEntity.postProcessing.ssao.blurRadius === 0,
        uniforms: ({ cameraEntity: entity }) => ({
          uDirection: [entity.postProcessing.ssao.blurRadius, 0],
        }),
        passDesc: () => ({
          clearColor: [1, 1, 0, 1],
        }),
        source: () => "ssao.main",
        target: ({ viewport }) =>
          resourceCache.texture2D({
            ...descriptors.postProcessing.outputTextureDesc,
            pixelFormat: ctx.PixelFormat.RGBA8,
            width: viewport[2] * aoScale,
            height: viewport[3] * aoScale,
          }),
        size: ({ viewport }) => [viewport[2] * aoScale, viewport[3] * aoScale],
      },
      {
        name: "blurVertical",
        frag: SHADERS.bilateralBlur.frag,
        // prettier-ignore
        flagDefinitions: [
          [["camera", "near"], "", { uniform: "uNear" }],
          [["camera", "far"], "", { uniform: "uFar" }],
          [["postProcessing", "ssao", "blurSharpness"], "", { uniform: "uSharpness" }],
        ],
        disabled: ({ cameraEntity }) =>
          cameraEntity.postProcessing.ssao.blurRadius === 0,
        uniforms: ({ cameraEntity: entity }) => ({
          uDirection: [0, entity.postProcessing.ssao.blurRadius],
        }),
        passDesc: () => ({
          clearColor: [1, 1, 0, 1],
        }),
        source: () => "ssao.blurHorizontal",
        target: () => "ssao.main",
        size: ({ viewport }) => [viewport[2] * aoScale, viewport[3] * aoScale],
      },
    ],
  },
  {
    name: "dof",
    commands: [
      {
        name: "main",
        // prettier-ignore
        flagDefinitions: [
          [["camera", "near"], "", { uniform: "uNear" }],
          [["camera", "far"], "", { uniform: "uFar" }],
          [["camera", "actualSensorHeight"], "", { uniform: "uSensorHeight" }],
          [["camera", "focalLength"], "", { uniform: "uFocalLength" }],
          [["camera", "fStop"], "", { uniform: "uFStop" }],
          [["camera", "exposure"], "", { uniform: "uExposure" }],

          [["postProcessing", "dof"], "USE_DOF"],
          [["postProcessing", "dof", "type"], "USE_DOF_GUSTAFSSON", { compare: "gustafsson", requires: "USE_DOF" }],
          [["postProcessing", "dof", "type"], "USE_DOF_UPITIS", { compare: "upitis", requires: "USE_DOF" }],
          [["postProcessing", "dof", "focusDistance"], "", { uniform: "uFocusDistance", requires: "USE_DOF" }],
          [["postProcessing", "dof", "samples"], "NUM_SAMPLES", { type: "value", requires: "USE_DOF" }],
          [["postProcessing", "dof", "chromaticAberration"], "", { uniform: "uChromaticAberration", requires: "USE_DOF" }],
          [["postProcessing", "dof", "luminanceThreshold"], "", { uniform: "uLuminanceThreshold", requires: "USE_DOF" }],
          [["postProcessing", "dof", "luminanceGain"], "", { uniform: "uLuminanceGain", requires: "USE_DOF" }],
          [["postProcessing", "dof", "shape"], "USE_DOF_SHAPE_PENTAGON", { compare: "pentagon", requires: "USE_DOF_UPITIS" }],

          [["postProcessing", "dof", "focusOnScreenPoint"], "USE_DOF_FOCUS_ON_SCREEN_POINT"],
          [["postProcessing", "dof", "screenPoint"], "", { uniform: "uScreenPoint", requires: "USE_DOF_FOCUS_ON_SCREEN_POINT" }],
          [["postProcessing", "dof", "debug"], "USE_DOF_DEBUG", { requires: "USE_DOF" }],
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
        flagDefinitions: [
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
        flagDefinitions: [
          [["postProcessing", "bloom"], "USE_DOWN_SAMPLE"],
          [["postProcessing", "bloom", "quality"], "QUALITY", { type: "value" }],
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
        frag: SHADERS.upSample.frag,
        // prettier-ignore
        flagDefinitions: [
          [["postProcessing", "bloom"], "USE_UP_SAMPLE"],
          [["postProcessing", "bloom", "quality"], "QUALITY", { type: "value" }],
        ],
        blend: true,
        source: () => `bloom.downSample[${i + 1}]`,
        target: () => "bloom.threshold",
      })),
    ],
  },
  {
    name: "final",
    commands: [
      {
        name: "main",
        frag: SHADERS.postProcessing.frag,
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
          [["postProcessing", "ssao"], "USE_SSAO"],
          [["postProcessing", "ssao", "post"], "USE_SSAO_POST", { requires: "USE_SSAO" }],
          [["options", "targets", "ssao.main"], "AO_TEXTURE", { type: "texture", uniform: "uSSAOTexture", requires: "USE_SSAO_POST" }],
          [["postProcessing", "ssao", "mix"], "", { uniform: "uSSAOMix", requires: "USE_SSAO_POST" }],
          [["postProcessing", "ssao", "type"], "USE_SSAO_GTAO", { compare: "gtao", requires: "USE_SSAO_POST" }],
          // [["postProcessing", "ssao", "type"], "USE_SSAO_SAO", { compare: "sao", requires: "USE_SSAO_POST" }],
          [["postProcessing", "ssao", "colorBounce"], "USE_SSAO_COLORS", { requires: "USE_SSAO_GTAO" }],

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
    ],
  },
];

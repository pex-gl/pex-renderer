import { chunks as SHADERS, smaa as SMAA } from "pex-shaders";

import { loadImage } from "pex-io";
import { isFinalMainEnabled } from "./final.js";

// prettier-ignore
export const smaaPresetsFlagDefinitions = [
  [["postProcessing", "smaa", "quality"], "SMAA_PRESET_LOW", { compare: 0 }],
  [["postProcessing", "smaa", "quality"], "SMAA_PRESET_MEDIUM", { compare: 1 }],
  [["postProcessing", "smaa", "quality"], "SMAA_PRESET_HIGH", { compare: 2 }],
  [["postProcessing", "smaa", "quality"], "SMAA_PRESET_ULTRA", { compare: 3 }],
]

export const isSMAAEnabled = ({ cameraEntity }) =>
  cameraEntity.postProcessing.smaa;

const getVertexShader = (source) => `${SHADERS.output.vert}
${source}`;

const replaceAfter = (source, regex, replacement) => {
  const lastMatch = [...source.matchAll(regex)].at(-1);
  const i = lastMatch.index + lastMatch[0].length;
  return `${source.slice(0, i)}${replacement}${source.slice(i)}`;
};

const getFragmentShader = (source) =>
  replaceAfter(
    replaceAfter(
      source,
      /precision\s+(lowp|mediump|highp)\s+\w+\s*;/g,
      SHADERS.output.frag,
    ),
    /(gl_FragColor|gl_FragData\[0\])\s*=[^;]*;/g,
    SHADERS.output.assignment,
  );

const {
  SMAATextures,
  PRESETS,
  SMAA_EDGES_VERT,
  SMAA_EDGES_FRAG,
  SMAA_WEIGHTS_FRAG,
  SMAA_WEIGHTS_VERT,
  SMAA_BLEND_VERT,
  SMAA_BLEND_FRAG,
} = SMAA;

const smaa = ({ ctx, resourceCache, descriptors }) => {
  const edgesPass = {
    name: "edges",
    vert: getVertexShader(SMAA_EDGES_VERT),
    frag: getFragmentShader(`${PRESETS}\n${SMAA_EDGES_FRAG}`),
    // prettier-ignore
    flagDefinitions: [
      [["options", "targets", "combine.main"], "", { type: "texture", uniform: "uColorTexture" }],
      [["postProcessing", "smaa", "edges"], "SMAA_EDGES_DEPTH", { compare: "depth" }],
      [["postProcessing", "smaa", "edges"], "SMAA_EDGES_LUMA", { compare: "luma", }],
      [["postProcessing", "smaa", "edges"], "SMAA_EDGES_COLOR", { compare: "color" }],
      // [["postProcessing", "smaa", "predication"], "SMAA_PREDICATION 1"],
      ...smaaPresetsFlagDefinitions,
    ],
    enabled: isSMAAEnabled,
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    target: ({ viewport }) =>
      resourceCache.texture2D({
        ...descriptors.postProcessing.srgbTextureDesc,
        pixelFormat: ctx.gl.RG ? ctx.PixelFormat.RG8 : ctx.PixelFormat.RGBA8,
        width: viewport[2],
        height: viewport[3],
      }),
  };
  const weightPass = {
    name: "weights",
    vert: getVertexShader(`${PRESETS}\n${SMAA_WEIGHTS_VERT}`),
    frag: getFragmentShader(`${PRESETS}\n${SMAA_WEIGHTS_FRAG}`),
    // prettier-ignore
    flagDefinitions: [
      [["options", "targets", "smaa.edges"], "", { type: "texture", uniform: "uEdgesTexture" }],
      [["postProcessing", "smaa", "_smaaAreaTex"], "", { type: "texture", uniform: "uAreaTexture", }],
      [["postProcessing", "smaa", "_smaaSearchTex"], "", { type: "texture", uniform: "uSearchTexture", }],
      ...smaaPresetsFlagDefinitions,
    ],
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    enabled: (options) => {
      const isEnabled = isSMAAEnabled(options);
      const { cameraEntity } = options;

      if (isEnabled) {
        if (
          !cameraEntity.postProcessing.smaa._smaaAreaTex &&
          !cameraEntity.postProcessing.smaa._smaaAreaTexLoading
        ) {
          cameraEntity.postProcessing.smaa._smaaAreaTexLoading = true;
          (async () => {
            const image = await loadImage(SMAATextures.area);
            cameraEntity.postProcessing.smaa._smaaAreaTex = ctx.texture2D({
              data: image,
              pixelFormat: ctx.PixelFormat.RGBA8,
              mag: ctx.Filter.Linear,
              min: ctx.Filter.Linear,
            });
            cameraEntity.postProcessing.smaa._smaaAreaTex.name = `smaaAreaTexture`;
          })();
        }
        if (
          !cameraEntity.postProcessing.smaa._smaaSearchTex &&
          !cameraEntity.postProcessing.smaa._smaaSearchTexLoading
        ) {
          cameraEntity.postProcessing.smaa._smaaSearchTexLoading = true;
          (async () => {
            const image = await loadImage(SMAATextures.search);
            cameraEntity.postProcessing.smaa._smaaSearchTex = ctx.texture2D({
              data: image,
              pixelFormat: ctx.PixelFormat.RGBA8,
              mag: ctx.Filter.Nearest,
              min: ctx.Filter.Nearest,
              flipY: true,
            });
            cameraEntity.postProcessing.smaa._smaaSearchTex.name = `smaaSearchTexture`;
          })();
        }
      }

      return isEnabled;
    },
    // source: () => "smaa.edges",
    target: ({ viewport }) =>
      resourceCache.texture2D({
        ...descriptors.postProcessing.srgbTextureDesc,
        width: viewport[2],
        height: viewport[3],
      }),
  };
  const blendPass = {
    name: "blend",
    vert: getVertexShader(SMAA_BLEND_VERT),
    frag: getFragmentShader(SMAA_BLEND_FRAG),
    // prettier-ignore
    flagDefinitions: [
      [["options", "targets", "combine.main"], "", { type: "texture", uniform: "uColorTexture" }],
      [["options", "targets", "smaa.weights"], "", { type: "texture", uniform: "uBlendTexture" }],
    ],
    enabled: isSMAAEnabled,
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    target: ({ cameraEntity, viewport }) =>
      isFinalMainEnabled({ cameraEntity }) &&
      resourceCache.texture2D({
        ...descriptors.postProcessing.srgbTextureDesc,
        width: viewport[2],
        height: viewport[3],
      }),
  };

  return [edgesPass, weightPass, blendPass];
};

export default smaa;

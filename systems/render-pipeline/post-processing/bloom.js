import { postProcessing as postprocessingShaders } from "pex-shaders";

const bloom = ({
  ctx,
  resourceCache,
  descriptors,
  bloomLevels = 9, //TODO MARCIN: hardcoded
}) => {
  const thresholdPass = {
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
  };
  // TODO: custom downsample levels based on viewport size
  const downsamplePasses = Array.from({ length: bloomLevels }, (_, k) => k).map(
    (i) => ({
      name: `downsample[${i}]`,
      frag: postprocessingShaders.downsample.frag,
      // prettier-ignore
      flagDefinitions: [
        [["postProcessing", "bloom"], "USE_DOWN_SAMPLE"],
        [["postProcessing", "bloom", "quality"], "QUALITY", { type: "value" }],
        [["postProcessing", "bloom", "radius"], "", { uniform: "uIntensity" }],
      ],
      source: () =>
        i === 0 ? "bloom.threshold" : `bloom.downsample[${i - 1}]`,
      target: ({ viewport }) => {
        const tex = resourceCache.texture2D({
          ...descriptors.postProcessing.outputTextureDesc,
          width: Math.max(~~(viewport[2] / 2 ** (i + 1)), 1),
          height: Math.max(~~(viewport[3] / 2 ** (i + 1)), 1),
          min: ctx.capabilities.textureHalfFloatLinear
            ? ctx.Filter.Linear
            : ctx.Filter.Nearest,
          mag: ctx.capabilities.textureHalfFloatLinear
            ? ctx.Filter.Linear
            : ctx.Filter.Nearest,
        });
        return tex;
      },
      size: ({ viewport }) => [
        Math.max(~~(viewport[2] / 2 ** (i + 1)), 1),
        Math.max(~~(viewport[3] / 2 ** (i + 1)), 1),
      ],
    }),
  );

  const upsampleAndBlendPasses = Array.from(
    { length: bloomLevels - 1 },
    (_, k) => k,
  ).map((i) => ({
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
  }));

  return [thresholdPass, ...downsamplePasses, ...upsampleAndBlendPasses];
};

export default bloom;

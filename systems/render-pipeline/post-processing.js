import { postProcessing as SHADERS, parser as ShaderParser } from "pex-shaders";

export default ({ ctx, resourceCache, descriptors, cache }) => {
  // TODO: one global
  const dummyTexture2D = ctx.texture2D({
    name: "postProDummyTexture2D",
    width: 4,
    height: 4,
  });

  return [
    {
      name: "dof",
      commands: [
        {
          name: "main",
          frag: ShaderParser.build(ctx, SHADERS.dof.frag),
          uniforms: (entity, { viewport }) => ({
            uFar: entity.camera.far,
            uNear: entity.camera.near,
            uPixelSize: [1 / viewport[2], 1 / viewport[3]], // TODO: in shader
            uFocusDistance: entity.postProcessing.dof.focusDistance ?? 10,
            uSensorHeight: entity.camera.actualSensorHeight,
            uFocalLength: entity.camera.focalLength,
            uFStop: entity.camera.fStop,
            uDOFDebug: entity.postProcessing.dof.debug || false,
          }),
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
          frag: ShaderParser.build(ctx, SHADERS.threshold.frag),
          uniforms: (entity) => ({
            uExposure: entity.camera.exposure,
            uThreshold: entity.postProcessing.bloom.threshold ?? 1,
          }),
          // source = inputColor
          target: ({ viewport }) =>
            resourceCache.texture2D({
              ...descriptors.postProcessing.outputTextureDesc,
              width: viewport[2],
              height: viewport[3],
            }),
        },
        // TODO: custom downsample level (overkill sometimes?)
        ...Array.from({ length: 9 }, (_, k) => k).map((i) => ({
          name: `downSample[${i}]`,
          frag: ShaderParser.build(ctx, SHADERS.downSample.frag),
          uniforms: (entity) => ({
            uIntensity: entity.postProcessing.bloom.radius ?? 0.1,
          }),
          source: () =>
            i === 0 ? "bloom.threshold" : `bloom.downSample[${i - 1}]`,
          target: ({ viewport }) =>
            resourceCache.texture2D({
              ...descriptors.postProcessing.outputTextureDesc,
              width: Math.max(~~(viewport[2] / 2 ** (i + 1)), 1),
              height: Math.max(~~(viewport[3] / 2 ** (i + 1)), 1),
            }),
        })),
        // TODO: are we generating a useless downsample? 8 or 9?
        ...Array.from({ length: 8 }, (_, k) => k).map((i) => ({
          name: `main[${i}]`,
          frag: ShaderParser.build(ctx, SHADERS.bloom.frag),
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
          frag: ShaderParser.build(ctx, SHADERS.postProcessing.frag),
          blend: true,
          uniforms: (entity) => ({
            // TODO: better way of getting textures
            // uTexture: cache[`${entity.id}-colorTexture"],
            uTexture:
              (entity.postProcessing.dof && cache[`${entity.id}-dof.main`]) ||
              cache[`${entity.id}-colorTexture`],
            uTextureEncoding: cache[`${entity.id}-colorTexture`].encoding,
            uBloomTexture:
              (entity.postProcessing.bloom &&
                cache[`${entity.id}-bloom.threshold`]) ||
              dummyTexture2D,

            uViewMatrix: entity.camera.viewMatrix,
            uNear: entity.camera.near,
            uFar: entity.camera.far,
            uFov: entity.camera.fov,
            uExposure: entity.camera.exposure,

            // AA
            uFXAA: !!entity.postProcessing.aa,
            uFXAASpanMax: entity.postProcessing.aa?.spanMax ?? 8,

            // Fog
            uFog: !!entity.postProcessing.fog,
            uFogColor: entity.postProcessing.fog?.color || [0.5, 0.5, 0.5],
            uFogStart: entity.postProcessing.fog?.start || 5,
            uFogDensity: entity.postProcessing.fog?.density || 0.15,
            uSunPosition: entity.postProcessing.fog?.sunPosition || [1, 1, 1],
            uSunDispertion: entity.postProcessing.fog?.sunDispertion || 0.2,
            uSunIntensity: entity.postProcessing.fog?.sunIntensity || 0.1,
            uSunColor: entity.postProcessing.fog?.sunColor || [0.98, 0.98, 0.7],
            uInscatteringCoeffs: entity.postProcessing.fog
              ?.inscatteringCoeffs || [0.3, 0.3, 0.3],

            // Bloom
            uBloom: !!entity.postProcessing.bloom,
            uBloomIntensity: entity.postProcessing.bloom?.intensity || 1,

            // LUT
            uLUT: !!entity.postProcessing.lut,
            uLUTTexture: entity.postProcessing.lut?.texture || dummyTexture2D,
            uLUTTextureSize: (
              entity.postProcessing.lut?.texture || dummyTexture2D
            ).width,

            // Color correction
            uColorCorrection: !!entity.postProcessing.colorCorrection,
            uBrightness: entity.postProcessing.colorCorrection?.brightness ?? 0,
            uContrast: entity.postProcessing.colorCorrection?.contrast ?? 1,
            uSaturation: entity.postProcessing.colorCorrection?.saturation ?? 1,
            uHue: entity.postProcessing.colorCorrection?.hue ?? 0,

            // Vignette
            uVignette: !!entity.postProcessing.vignette,
            uVignetteRadius: entity.postProcessing.vignette?.radius ?? 0.8,
            uVignetteSmoothness:
              entity.postProcessing.vignette?.smoothness ?? 0.2,

            uOpacity: entity.postProcessing?.opacity ?? 1,
            uOutputEncoding: ctx.Encoding.Linear,
          }),
          // source = inputColor
          // target: ({ cameraEntity }) =>
          //   cache[`${cameraEntity.id}-colorTexture`],
        },
      ],
    },
  ];
};

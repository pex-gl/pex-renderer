import { createTexture } from "pex-gpu";
import random from "pex-random";

import {
  bilateralBlurShader,
  gtaoShader,
  saoShader,
  ssaoMixShader,
} from "../../../shaders/post-processing/ssao.js";
import { BlueNoiseGenerator } from "../../../utils/blue-noise.js";

import type { GpuContext, GpuTexture } from "../../../types.js";
import type {
  PostProcessingContext,
  PostProcessingEffect,
  PostProcessingSubPass,
} from "../post-processing.js";

// Noise textures are identical for every camera and never change, so they are
// memoized per context rather than cached per entity. Like the fullscreen
// geometry, they live for the context's lifetime.
const blueNoiseTextures = new WeakMap<GpuContext, GpuTexture>();
const noiseTextures = new WeakMap<GpuContext, GpuTexture>();
const dummyTextures = new WeakMap<GpuContext, GpuTexture>();

const BLUE_NOISE_SIZE = 32;
const NOISE_SIZE = 64;

/** Four channels of blue noise, one generated pattern each: GTAO reads .xy. */
function getBlueNoiseTexture(ctx: GpuContext): GpuTexture {
  return blueNoiseTextures.getOrInsertComputed(ctx, () => {
    const generator = new BlueNoiseGenerator();
    generator.size = BLUE_NOISE_SIZE;

    const data = new Uint8Array(BLUE_NOISE_SIZE ** 2 * 4);
    for (let channel = 0; channel < 4; channel++) {
      const { data: bin, maxValue } = generator.generate();
      for (let i = 0; i < bin.length; i++) {
        data[i * 4 + channel] = 255 * (bin[i]! / maxValue);
      }
    }

    return createTexture(ctx, {
      label: "ssaoBlueNoiseTexture",
      width: BLUE_NOISE_SIZE,
      height: BLUE_NOISE_SIZE,
      format: "rgba8unorm",
      data,
    });
  });
}

/**
 * White noise for SAO's rotation jitter. Values are [0, 1] rather than the
 * GLSL version's [-1, 1]: the analytic fallback the same shader uses is a
 * fract(), and 8 bit unorm is filterable where rg32float is not.
 */
function getNoiseTexture(ctx: GpuContext): GpuTexture {
  return noiseTextures.getOrInsertComputed(ctx, () => {
    const localPRNG = random.create("0");

    const data = new Uint8Array(NOISE_SIZE ** 2 * 4);
    for (let i = 0; i < NOISE_SIZE ** 2; i++) {
      data[i * 4] = 255 * localPRNG.float();
      data[i * 4 + 1] = 255 * localPRNG.float();
      data[i * 4 + 3] = 255;
    }

    return createTexture(ctx, {
      label: "ssaoNoiseTexture",
      width: NOISE_SIZE,
      height: NOISE_SIZE,
      format: "rgba8unorm",
      data,
    });
  });
}

/** The estimators sample a noise texture unconditionally, so the binding is
 * always declared; with the analytic hash selected it reads this instead. */
function getDummyTexture(ctx: GpuContext): GpuTexture {
  return dummyTextures.getOrInsertComputed(ctx, () =>
    createTexture(ctx, {
      label: "ssaoDummyNoiseTexture",
      width: 1,
      height: 1,
      format: "rgba8unorm",
      data: new Uint8Array([0, 0, 0, 255]),
    }),
  );
}

const isGTAO = ({ cameraEntity }: PostProcessingContext) =>
  cameraEntity.postProcessing!.ssao!.type === "gtao";

/**
 * Screen-space ambient occlusion.
 *
 * The estimators write a visibility buffer at `ssao.main`, which the separable
 * bilateral blur cleans up in place. Applying it to the color is left to
 * combine unless depth of field runs first, since DoF must blur an image that
 * already has its occlusion.
 */
const ssao: PostProcessingEffect = {
  name: "ssao",
  // Both estimators reconstruct view-space position from depth and read the
  // view-space normal target.
  enabled: ({ textures }) =>
    !!textures.get("depth") && !!textures.get("normal"),
  passes: (context) => {
    const { cameraEntity } = context;
    const camera = cameraEntity.camera!;
    const component = cameraEntity.postProcessing!.ssao!;
    const gtao = isGTAO(context);

    // Only GTAO gathers neighbouring color; SAO writes visibility alone, so it
    // degrades to the analytic fit rather than losing multi-bounce entirely.
    const screenSpaceBounce = gtao && component.multiBounce === "screen-space";

    // The gathered color needs the full HDR range; visibility alone does not.
    const format = (): GPUTextureFormat =>
      screenSpaceBounce ? "rgba16float" : "r8unorm";

    const noise = (ctx: GpuContext) =>
      component.noiseTexture
        ? gtao
          ? getBlueNoiseTexture(ctx)
          : getNoiseTexture(ctx)
        : getDummyTexture(ctx);

    const noiseSize = () =>
      component.noiseTexture ? (gtao ? BLUE_NOISE_SIZE : NOISE_SIZE) : 1;

    // Shared by both estimators: the AO buffer's own dimensions, which the
    // chunks use to walk the depth target in texel steps.
    const estimatorParams = ({ viewport }: PostProcessingContext) => ({
      near: camera.near!,
      far: camera.far!,
      fov: camera.fov!,
      viewportSize: [viewport[2]!, viewport[3]!],
      texelSize: [1 / viewport[2]!, 1 / viewport[3]!],
      intensity: component.intensity!,
      radius: component.radius!,
      bias: component.bias!,
      brightness: component.brightness!,
      contrast: component.contrast!,
      noiseTextureSize: noiseSize(),
    });

    const gtaoPass: PostProcessingSubPass = {
      name: "main",
      shader: gtaoShader,
      enabled: isGTAO,
      constants: () => ({
        GTAO_NUM_SLICES: component.slices!,
        GTAO_NUM_SAMPLES: component.samples!,
        USE_GTAO_NOISE_TEXTURE: !!component.noiseTexture,
        USE_GTAO_COLOR_BOUNCE: screenSpaceBounce,
      }),
      clearValue: [0, 0, 0, 1],
      format,
      uniforms: (context) => ({
        uGTAO: {
          ...estimatorParams(context),
          colorBounceIntensity: component.colorBounceIntensity!,
        },
        uDepthTexture: context.textures.get("depth")!,
        uDepthTextureSampler: context.samplers.nearest,
        uNormalTexture: context.textures.get("normal")!,
        uNormalTextureSampler: context.samplers.nearest,
        uNoiseTexture: noise(context.ctx),
        uNoiseTextureSampler: context.samplers.linearRepeat,
      }),
    };

    const saoPass: PostProcessingSubPass = {
      name: "main",
      shader: saoShader,
      enabled: (context) => !isGTAO(context),
      constants: () => ({
        SAO_NUM_SAMPLES: component.samples!,
        SAO_NUM_SPIRAL_TURNS: component.spiralTurns!,
        USE_SAO_NOISE_TEXTURE: !!component.noiseTexture,
      }),
      clearValue: [0, 0, 0, 1],
      format,
      uniforms: (context) => ({
        uSAO: estimatorParams(context),
        uDepthTexture: context.textures.get("depth")!,
        uDepthTextureSampler: context.samplers.nearest,
        uNormalTexture: context.textures.get("normal")!,
        uNormalTextureSampler: context.samplers.nearest,
        uNoiseTexture: noise(context.ctx),
        uNoiseTextureSampler: context.samplers.linearRepeat,
      }),
    };

    // A negative radius turns the blur off, leaving the raw estimate.
    const blurEnabled = () => component.blurRadius! >= 0;
    const blurUniforms = (direction: number[]) => (context: PostProcessingContext) => ({
      uBlur: {
        direction,
        near: camera.near!,
        far: camera.far!,
        sharpness: component.blurSharpness!,
      },
      uDepthTexture: context.textures.get("depth")!,
      uDepthTextureSampler: context.samplers.nearest,
    });

    const blurHorizontal: PostProcessingSubPass = {
      name: "blurHorizontal",
      shader: bilateralBlurShader,
      enabled: blurEnabled,
      clearValue: [0, 0, 0, 1],
      format,
      source: () => "ssao.main",
      uniforms: blurUniforms([component.blurRadius!, 0]),
    };

    const blurVertical: PostProcessingSubPass = {
      name: "blurVertical",
      shader: bilateralBlurShader,
      enabled: blurEnabled,
      source: () => "ssao.blurHorizontal",
      target: () => "ssao.main",
      uniforms: blurUniforms([0, component.blurRadius!]),
    };

    const mix: PostProcessingSubPass = {
      name: "mix",
      shader: ssaoMixShader,
      chain: true,
      // Without DoF, combine applies the same mix for free.
      enabled: ({ cameraEntity }) => !!cameraEntity.postProcessing!.dof,
      constants: () => ({
        USE_SSAO_COLORS: screenSpaceBounce,
        USE_SSAO_MULTI_BOUNCE: !!component.multiBounce,
      }),
      clearValue: [0, 0, 0, 1],
      uniforms: ({ textures, samplers }) => ({
        uSSAO: { mix: component.mix! },
        uSSAOTexture: textures.get("ssao.main")!,
        uSSAOTextureSampler: samplers.linear,
      }),
    };

    return [gtaoPass, saoPass, blurHorizontal, blurVertical, mix];
  },
};

export default ssao;

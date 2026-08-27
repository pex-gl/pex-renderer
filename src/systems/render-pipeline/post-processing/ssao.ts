import { createTexture } from "pex-gpu";
import random from "pex-random";

import {
  bilateralBlurShader,
  GTAO_DEPTH_MIP_LEVELS,
  gtaoDenoiseShader,
  gtaoPrefilterShader,
  gtaoShader,
  saoShader,
} from "../../../shaders/post-processing/ssao.js";

import type { ResourceHandle } from "../../../frame-graph/index.js";
import type { GpuContext, GpuTexture } from "../../../types.js";
import type {
  PostProcessingContext,
  PostProcessingEffect,
} from "../post-processing.js";

// Noise textures are identical for every camera and never change, so they are
// memoized per context rather than cached per entity. Like the fullscreen
// geometry, they live for the context's lifetime.
const noiseTextures = new WeakMap<GpuContext, GpuTexture>();
const dummyTextures = new WeakMap<GpuContext, GpuTexture>();

const NOISE_SIZE = 64;

/**
 * White noise for SAO's rotation jitter. Values are [0, 1] rather than the GLSL
 * version's [-1, 1]: the analytic fallback the same shader uses is a fract(),
 * and 8 bit unorm is filterable where rg32float is not.
 *
 * GTAO needs none: its noise is a Hilbert-driven R2 sequence evaluated per
 * pixel, which is better distributed than a tiled texture and costs no fetch.
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

/**
 * SAO samples a noise texture unconditionally, so the binding is always
 * declared; with the analytic hash selected it reads this instead.
 */
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

/** Pixels one workgroup covers: 8x8 threads, each handling a 2x2 block. */
const GTAO_PREFILTER_TILE = 16;
/** Disables the denoise more elegantly than zeroing every edge would. */
const GTAO_DENOISE_DISABLED_BETA = 1e4;

/** What both estimators need beyond the effect's own context. */
interface EstimatorScope extends PostProcessingContext {
  /** The scene's depth buffer, as the pre-pass left it. */
  depth: ResourceHandle;
  /** View-space normals, encoded to [0, 1]. */
  normal: ResourceHandle;
}

/** Everything both estimators derive from the camera and the viewport. */
function getEstimatorScope({ cameraEntity, viewport }: EstimatorScope) {
  const [width, height] = [viewport[2]!, viewport[3]!];
  return {
    camera: cameraEntity.camera!,
    component: cameraEntity.postProcessing!.ssao!,
    width,
    height,
    viewportSize: [width, height],
    viewportPixelSize: [1 / width, 1 / height],
  };
}

/**
 * Ground Truth Ambient Occlusion, after XeGTAO: prefilter the depth buffer into
 * a linear view-space pyramid, estimate against it, denoise.
 */
function declareGTAO(scope: EstimatorScope) {
  const {
    cameraEntity,
    frameIndex,
    textures,
    pass,
    compute,
    createTexture,
    depth,
    normal,
  } = scope;
  const { camera, component, width, height, viewportSize, viewportPixelSize } =
    getEstimatorScope(scope);

  const bentNormals = !!component.bentNormals;
  const denoisePasses = component.denoisePasses!;

  // The projection in the one form the estimator needs it: a view position is
  // (ndcToViewMul * uv + ndcToViewAdd) * viewspaceZ. The vertical terms are
  // negated because a screen coordinate's V points down where view space's Y
  // points up.
  const tanHalfFovY = Math.tan(camera.fov! * 0.5);
  const tanHalfFovX = tanHalfFovY * (width / height);
  const ndcToViewMul = [2 * tanHalfFovX, -2 * tanHalfFovY];

  const params = {
    ndcToViewMul,
    ndcToViewAdd: [-tanHalfFovX, tanHalfFovY],
    ndcToViewMulByPixelSize: [
      ndcToViewMul[0]! / width,
      ndcToViewMul[1]! / height,
    ],
    viewportSize,
    viewportPixelSize,
    near: camera.near!,
    far: camera.far!,
    effectRadius: component.radius!,
    radiusMultiplier: component.radiusMultiplier!,
    effectFalloffRange: component.falloffRange!,
    sampleDistributionPower: component.sampleDistributionPower!,
    thinOccluderCompensation: component.thinOccluderCompensation!,
    finalValuePower: component.finalValuePower!,
    mix: component.mix!,
    depthMipSamplingOffset: component.depthMipSamplingOffset!,
    denoiseBlurBeta: denoisePasses
      ? component.denoiseBlurBeta!
      : GTAO_DENOISE_DISABLED_BETA,
    brightness: component.brightness!,
    contrast: component.contrast!,
    // Rotates the slice azimuths per frame, which is what lets a temporal
    // filter average out the error between them — the reference's own
    // "frameIndex % 64 if using TAA or 0 otherwise". Held at 0 without one:
    // decorrelating the noise with nothing to accumulate it turns a static
    // pattern into a flickering one, which reads worse.
    noiseIndex: cameraEntity.postProcessing?.taa ? frameIndex % 64 : 0,
  };

  // r32uint holding bitcast floats — see the chunk's gtaoLoadViewspaceDepth for
  // why the pyramid is neither r16float nor r32float.
  const depthMips = createTexture({
    label: `ssao.depthMips.${cameraEntity.id}`,
    width,
    height,
    format: "r32uint",
    mipLevelCount: GTAO_DEPTH_MIP_LEVELS,
  });

  compute({
    name: "prefilterDepths",
    shader: gtaoPrefilterShader,
    dispatch: [
      Math.ceil(width / GTAO_PREFILTER_TILE),
      Math.ceil(height / GTAO_PREFILTER_TILE),
    ],
    writes: [depthMips],
    uniforms: { uGTAO: params, uDepthTexture: depth },
    // One binding per level: a storage texture view is a single mip, and the
    // dispatch writes all five.
    views: Object.fromEntries(
      Array.from({ length: GTAO_DEPTH_MIP_LEVELS }, (_, level) => [
        `uDepthMip${level}`,
        { handle: depthMips, level },
      ]),
    ),
  });

  // Visibility alone fits one channel. The bent normal takes the other three,
  // which is also what tells a reader they are there to be decoded.
  const format: GPUTextureFormat = bentNormals ? "rgba8unorm" : "r8unorm";

  const edges = denoisePasses
    ? createTexture({
        label: `ssao.edges.${cameraEntity.id}`,
        width,
        height,
        format: "rgba8unorm",
      })
    : undefined;

  let ao = pass({
    name: "main",
    shader: gtaoShader,
    // The estimator declares no uTexture: at the pre-pass stage the color chain
    // is a read edge on an image nothing has drawn into yet.
    source: null,
    ...(edges && {
      defines: new Set(["USE_GTAO_EDGES"]),
      targets: [{ name: "edges", texture: edges }],
    }),
    constants: {
      GTAO_NUM_SLICES: component.slices!,
      GTAO_NUM_SAMPLES: component.samples!,
      USE_GTAO_BENT_NORMALS: bentNormals,
      // Nothing follows to restore the packing scale, so the estimator applies
      // it itself.
      GTAO_FINAL_APPLY: !denoisePasses,
    },
    format,
    uniforms: {
      uGTAO: params,
      uDepthTexture: depthMips,
      uNormalTexture: normal,
    },
  });

  // The passes alternate between two textures rather than filtering one in
  // place: a pass may not read and write the same handle.
  let spare: ResourceHandle | undefined;
  for (let index = 0; index < denoisePasses; index++) {
    const source = ao;

    ao = pass({
      name: `denoise[${index}]`,
      shader: gtaoDenoiseShader,
      source: null,
      ...(spare && { target: spare }),
      constants: {
        USE_GTAO_BENT_NORMALS: bentNormals,
        GTAO_FINAL_APPLY: index === denoisePasses - 1,
      },
      format,
      uniforms: {
        uGTAO: params,
        uAOTexture: source,
        uEdgesTexture: edges!,
      },
    });
    spare = source;
  }

  // Each pass published under its own name; republish the last as the buffer
  // everything downstream asks for.
  textures.set("ssao.main", ao);
  // A second name for the same texture, published only when its remaining
  // channels carry a bent normal — the only thing that tells a reader they can
  // be decoded. See the standard renderer's inputs().
  if (bentNormals) textures.set("ssao.bentNormal", ao);
}

/** Scalable Ambient Obscurance: one estimator pass and a separable blur. */
function declareSAO(scope: EstimatorScope) {
  const { ctx, samplers, pass, depth, normal } = scope;
  const { camera, component, viewportSize, viewportPixelSize } =
    getEstimatorScope(scope);

  const noise = component.noiseTexture
    ? getNoiseTexture(ctx)
    : getDummyTexture(ctx);

  const params = {
    near: camera.near!,
    far: camera.far!,
    fov: camera.fov!,
    viewportSize,
    texelSize: viewportPixelSize,
    intensity: component.intensity!,
    radius: component.radius!,
    bias: component.bias!,
    brightness: component.brightness!,
    contrast: component.contrast!,
    noiseTextureSize: component.noiseTexture ? NOISE_SIZE : 1,
  };

  const format: GPUTextureFormat = "r8unorm";

  const ao = pass({
    name: "main",
    shader: saoShader,
    // SAO declares no uTexture at all, so binding the chain would be a read
    // edge on an image it never samples — and at the prePass stage, on one the
    // opaque pass has not written yet.
    source: null,
    constants: {
      SAO_NUM_SAMPLES: component.samples!,
      SAO_NUM_SPIRAL_TURNS: component.spiralTurns!,
      USE_SAO_NOISE_TEXTURE: !!component.noiseTexture,
    },
    clearValue: [0, 0, 0, 1],
    format,
    uniforms: {
      uSAO: params,
      uDepthTexture: depth,
      uDepthTextureSampler: samplers.nearest,
      uNormalTexture: normal,
      uNormalTextureSampler: samplers.nearest,
      uNoiseTexture: noise,
      uNoiseTextureSampler: samplers.linearRepeat,
    },
  });

  // A negative radius turns the blur off, leaving the raw estimate.
  if (component.blurRadius! >= 0) {
    const blur = (direction: number[]) => ({
      uBlur: {
        direction,
        near: camera.near!,
        far: camera.far!,
        sharpness: component.blurSharpness!,
      },
      uDepthTexture: depth,
      uDepthTextureSampler: samplers.nearest,
    });

    const horizontal = pass({
      name: "blurHorizontal",
      shader: bilateralBlurShader,
      source: ao,
      clearValue: [0, 0, 0, 1],
      format,
      uniforms: blur([component.blurRadius!, 0]),
    });

    // Back into the estimate: the write lands after the read that produced the
    // horizontal pass, so the graph orders them and nothing downstream sees the
    // unblurred image — including "ssao.main", which the estimator pass already
    // published as this texture.
    pass({
      name: "blurVertical",
      shader: bilateralBlurShader,
      source: horizontal,
      target: ao,
      uniforms: blur([0, component.blurRadius!]),
    });
  }
}

/**
 * Screen-space ambient occlusion.
 *
 * Declared at the pre-pass stage, so the visibility buffer exists before
 * anything is shaded and the standard shader folds it into the indirect term
 * rather than multiplying it over the result. That is the only way it is
 * applied: with occlusion a lighting input, there is nothing left for a
 * post-hoc mix to do.
 *
 * The result is published as `ssao.main` — visibility in `.x`, and under GTAO's
 * `bentNormals` the average unoccluded direction in `.yzw`, republished as
 * `ssao.bentNormal` because only the producer knows those channels are there.
 */
const ssao: PostProcessingEffect = {
  name: "ssao",
  outputs: ["normal"],
  stage: "prePass",
  declare(context) {
    // Both estimators reconstruct view-space position from depth and read the
    // view-space normal target.
    const depth = context.textures.get("depth");
    const normal = context.textures.get("normal");
    if (!depth || !normal) return;

    const scope: EstimatorScope = { ...context, depth, normal };

    if (context.cameraEntity.postProcessing!.ssao!.type === "gtao") {
      declareGTAO(scope);
    } else {
      declareSAO(scope);
    }
  },
};

export default ssao;

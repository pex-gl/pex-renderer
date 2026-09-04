import {
  bilateralBlurShader,
  DEPTH_MIP_LEVELS,
  depthPyramidShader,
  gtaoDenoiseShader,
  gtaoShader,
  saoShader,
} from "../../../shaders/post-processing/ssao.js";

import type { ResourceHandle } from "../../../frame-graph/index.js";
import type {
  PostProcessingContext,
  PostProcessingEffect,
} from "../post-processing.js";

/** Pixels one workgroup covers: 8x8 threads, each handling a 2x2 block. */
const DEPTH_PYRAMID_TILE = 16;
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

/** The four scalars the reduction needs, whichever filter it runs. */
interface DepthPyramidParams {
  // Indexable so it packs as a uniform block like the estimators' own params.
  [key: string]: number;
  near: number;
  far: number;
  effectRadius: number;
  falloffRange: number;
}

/**
 * The linear view-space depth pyramid both estimators sample, in one dispatch.
 *
 * SAO takes rotated grid subsampling — McGuire12 table 1 compares five filters
 * and finds it the only one whose levels hold values that were in the scene —
 * where GTAO takes the closest-biased mean its falloff parameters are tuned
 * against.
 */
function declareDepthPyramid(
  scope: EstimatorScope,
  params: DepthPyramidParams,
  rotatedGrid = false,
) {
  const { cameraEntity, compute, createTexture, depth } = scope;
  const { width, height } = getEstimatorScope(scope);

  // r32uint holding bitcast floats — see the chunk's depthPyramidLoad for why
  // the pyramid is neither r16float nor r32float.
  const depthMips = createTexture({
    label: `ssao.depthMips.${cameraEntity.id}`,
    width,
    height,
    format: "r32uint",
    mipLevelCount: DEPTH_MIP_LEVELS,
  });

  compute({
    name: "prefilterDepths",
    shader: depthPyramidShader,
    dispatch: [
      Math.ceil(width / DEPTH_PYRAMID_TILE),
      Math.ceil(height / DEPTH_PYRAMID_TILE),
    ],
    constants: { DEPTH_PYRAMID_ROTATED_GRID: rotatedGrid },
    writes: [depthMips],
    uniforms: { uDepthPyramid: params, uDepthTexture: depth },
    // One binding per level: a storage texture view is a single mip, and the
    // dispatch writes them all.
    views: Object.fromEntries(
      Array.from({ length: DEPTH_MIP_LEVELS }, (_, level) => [
        `uDepthMip${level}`,
        { handle: depthMips, level },
      ]),
    ),
  });

  return depthMips;
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

  const depthMips = declareDepthPyramid(scope, {
    near: camera.near!,
    far: camera.far!,
    // The filter's falloff is expressed against the radius the estimator
    // actually gathers over, which is the tuned one.
    effectRadius: component.radius! * component.radiusMultiplier!,
    falloffRange: component.falloffRange!,
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
      GTAO_NUM_STEPS_PER_SLICE: component.stepsPerSlice!,
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
  const { samplers, pass, depth, normal } = scope;
  const { camera, component, width, height } = getEstimatorScope(scope);

  const depthMips = declareDepthPyramid(
    scope,
    // Rotated grid subsampling picks a depth rather than combining four, so the
    // filter's falloff terms go unread.
    { near: camera.near!, far: camera.far!, effectRadius: 0, falloffRange: 0 },
    true,
  );

  // Taken from the projection matrix rather than the field of view, after the
  // reference: an offset frustum (`camera.view`) or a jittered projection is a
  // different matrix but the same fov, and reconstructing through the fov would
  // put every sample on a surface the scene does not have.
  const projection = camera.projectionMatrix!;
  const [p00, p11, p20, p21] = [
    projection[0]!,
    projection[5]!,
    projection[8]!,
    projection[9]!,
  ];

  const params = {
    projInfo: [
      2 / (width * p00),
      -2 / (height * p11),
      (p20 - 1) / p00,
      (1 + p21) / p11,
    ],
    far: camera.far!,
    projScale: 0.5 * height * p11,
    intensity: component.intensity!,
    radius: component.radius!,
    bias: component.bias!,
    brightness: component.brightness!,
    contrast: component.contrast!,
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
      SAO_NUM_SAMPLES: component.saoSamples!,
      SAO_NUM_SPIRAL_TURNS: component.spiralTurns!,
    },
    clearValue: [0, 0, 0, 1],
    format,
    uniforms: {
      uSAO: params,
      uDepthTexture: depthMips,
      uNormalTexture: normal,
    },
  });

  // A negative radius turns the blur off, leaving the raw estimate.
  if (component.blurRadius! >= 0) {
    const blur = (axis: number[]) => ({
      uBlur: {
        axis,
        radius: component.blurRadius!,
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
      uniforms: blur([1, 0]),
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
      uniforms: blur([0, 1]),
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

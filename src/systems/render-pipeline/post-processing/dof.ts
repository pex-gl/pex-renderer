import {
  dofCoCResolveShader,
  dofCompositeShader,
  dofDownsampleShader,
  dofFocusShader,
  dofGatherShader,
  dofPostFilterShader,
  dofPrefilterShader,
  dofTileDilateShader,
  dofTileMaxXShader,
  dofTileMaxYShader,
} from "../../../shaders/post-processing/dof.js";

import type { Entity } from "../../../types.js";
import type { PostProcessingEffect } from "../post-processing.js";

/** Colour and the signed circle of confusion; the two fields; all half resolution. */
const FIELD_FORMAT = "rgba16float" as GPUTextureFormat;

/** A tile is the near and far maximum it holds, and nothing else. */
const TILE_FORMAT = "rg16float" as GPUTextureFormat;

/**
 * Tile size in half-resolution pixels, unless a large radius forces it up.
 *
 * Sets how coarsely the near field's gather radius is quantised: a larger tile
 * spends samples on pixels that did not need them, a smaller one costs more
 * dilation taps to reach the same radius. Eight is what FidelityFX and HDRP
 * both settle on.
 */
const MIN_TILE_SIZE = 8;

/**
 * How many tiles the dilation is allowed to reach, which bounds it at
 * (2r + 1)^2 taps. Growing the tiles instead is what keeps that square from
 * following the radius: a 5% radius at 1080p reaches four tiles of eight, but
 * a 20% one at 4K would reach twenty-seven, and the dilation would cost more
 * than the gather it exists to make cheap.
 */
const MAX_DILATE_RADIUS = 4;

/** Below this there is no disc to speak of and the transition blur has it covered. */
const MIN_COC_RADIUS = 0.5;

/**
 * Weight given to this frame when accumulating the circle of confusion.
 *
 * Its own constant rather than temporal antialiasing's: this averages a
 * sub-pixel coverage over the whole jitter sequence. The reciprocal is roughly
 * the frames it averages, against a sequence of eight.
 */
const COC_BLEND_FACTOR = 0.1;

/**
 * What the last frame left behind, so this one can tell whether the circle of
 * confusion history holds anything worth blending. Weak, so a discarded camera
 * does not pin an entry.
 */
interface CoCHistoryState {
  width: number;
  height: number;
  frameIndex: number;
}
const cocStates = new WeakMap<Entity, CoCHistoryState>();

/**
 * Depth of field.
 *
 * First of the image-space effects after the temporal resolve, because it reads
 * a circle of confusion per pixel from the depth buffer: motion blur smears the
 * image out of correspondence with that depth, and defocusing a streak by the
 * depth of whatever it passes over is wrong at every pixel of it. Before bloom
 * for the same reason — out-of-focus highlights should glare as the bokeh shows
 * them, not as the sharp image would.
 *
 * The gather is the only pass that costs anything, and it runs at a quarter of
 * the pixels. See the `depthOfField` chunk for why the work is split this way.
 */
const dof: PostProcessingEffect = {
  name: "dof",
  declare({
    cameraEntity,
    frameIndex,
    viewport,
    textures,
    samplers,
    pass,
    createTexture,
  }) {
    const depth = textures.get("depth");
    if (!depth) return;

    const camera = cameraEntity.camera!;
    const postProcessing = cameraEntity.postProcessing!;
    const component = postProcessing.dof!;
    const viewId = cameraEntity.id;

    const width = viewport[2]!;
    const height = viewport[3]!;
    const halfWidth = Math.max(1, Math.ceil(width / 2));
    const halfHeight = Math.max(1, Math.ceil(height / 2));
    const halfSize = [halfWidth, halfHeight];

    // Everything below measures in half-resolution pixels of radius, so the cap
    // converts once here: a fraction of viewport height, which is what keeps a
    // given setting blurring over the same fraction of the image at every
    // resolution.
    const maxCoCRadius = (component.maxCoCRadius ?? 0.05) * height * 0.5;
    if (maxCoCRadius < MIN_COC_RADIUS) return;

    const tilePixels = Math.max(
      MIN_TILE_SIZE,
      Math.ceil(maxCoCRadius / MAX_DILATE_RADIUS),
    );
    const tilesX = Math.ceil(halfWidth / tilePixels);
    const tilesY = Math.ceil(halfHeight / tilePixels);
    const tileSize = [tilesX, tilesY];

    const rings = component.rings ?? 8;
    const samples = component.samples ?? 6;

    // The footprint one tap stands for, which sets how deep the chain has to
    // go. Rings are evenly spaced, so the level has to cover the larger of the
    // radial gap and the arc.
    //
    // At the cap, which is where the chain is deepest: the gather takes one
    // ring per pixel of radius until `rings` binds, so the widest spacing it
    // can ever ask for is the one this radius produces.
    const spacing = Math.max(
      maxCoCRadius / rings,
      (2 * Math.PI * maxCoCRadius) / (rings * samples),
    );
    // One level past that spacing, bounded by what the half-resolution image
    // actually has. Derived rather than a constant: a chain shorter than it
    // needs puts the sample pattern back into the image.
    const mipLevelCount = Math.max(
      1,
      Math.min(
        1 + Math.floor(Math.log2(Math.max(1, Math.min(halfWidth, halfHeight)))),
        1 + Math.ceil(Math.log2(Math.max(spacing, 1))),
      ),
    );

    const physical = component.physical ?? true;
    const focusOnScreenPoint = !!component.focusOnScreenPoint;
    const chromaticAberration = component.chromaticAberration ?? 0;

    const defines = new Set([
      ...(focusOnScreenPoint ? ["USE_FOCUS_ON_SCREEN_POINT"] : []),
    ]);

    // Packed by member name against DepthOfFieldParams, so a key that does not
    // exist there throws rather than shifting everything after it.
    const uDoFParams = {
      viewportSize: [width, height],
      texelSize: [1 / width, 1 / height],
      halfTexelSize: [1 / halfWidth, 1 / halfHeight],
      screenPoint: component.screenPoint ?? [0.5, 0.5],
      near: camera.near!,
      far: camera.far!,
      // m -> mm, the unit the thin lens model works in.
      focusDistance: (component.focusDistance ?? 7) * 1000,

      focalLength: camera.focalLength!,
      fStop: camera.fStop!,
      // Sensor millimetres to half-resolution pixels of radius: one halving for
      // diameter to radius, one for the grid. The sensor height is the one the
      // camera system fitted to the viewport, so this follows sensorFit rather
      // than assuming the frame is filled.
      cocScale:
        (height * 0.25) / (camera.actualSensorHeight ?? camera.sensorSize![1]!),
      focusScale: component.focusScale ?? 1,

      blurScale: (component.blurriness ?? 0.03) * height * 0.5,
      focusRange: (component.focusRange ?? 1) * 1000,
      // Zero would make the ramp a step at the edge of the in-focus zone, and
      // pow(0, 0) is 1 rather than 0.
      focusFalloff: Math.max(component.focusFalloff ?? 1, 1e-3),

      maxCoCRadius,
      chromaticAberration,
      exposure: postProcessing.exposure!,
      luminanceThreshold: component.luminanceThreshold ?? 0.7,
      luminanceGain: component.luminanceGain ?? 0,
      luminanceKnee: component.luminanceKnee ?? 0.5,
      // The diaphragm is the camera's, not this effect's: the lens flare images
      // the same opening as its starburst.
      blades: postProcessing.blades ?? 0,
      bladeRotation: postProcessing.bladeRotation ?? 0,
      bladeCurvature: postProcessing.bladeCurvature ?? 0,
    };

    const depthUniforms = {
      uDepthTexture: depth,
      // Point sampled: a depth interpolated across a silhouette describes
      // neither of the surfaces that meet there.
      uDepthTextureSampler: samplers.nearest,
    };

    const focus = focusOnScreenPoint
      ? pass({
          name: "focus",
          shader: dofFocusShader,
          // Nothing to read but depth, and an unread binding is a read edge the
          // graph would carry for a sample that never happens.
          source: null,
          size: [1, 1],
          uniforms: { uDoFParams, ...depthUniforms },
        })
      : undefined;

    const focusUniforms = focus && {
      uFocusTexture: focus,
      uFocusTextureSampler: samplers.nearest,
    };

    // Accumulated over the jitter sequence when there is one; see
    // `dofResolveCoC` for why it has to be. Nothing to resolve when the raster
    // is not jittered, and then this costs nothing at all.
    const jitter = camera._jitter;
    const resolveCoC =
      !!jitter &&
      (jitter[0] !== 0 || jitter[1] !== 0) &&
      !!camera._previousViewProjectionMatrix &&
      !!camera._inverseViewProjectionMatrix;

    let resolvedCoC;
    if (resolveCoC) {
      const cocDescriptor = {
        width,
        height,
        // One channel; half floats hold a radius in pixels far past the cap.
        format: "r16float" as GPUTextureFormat,
        persistent: true,
      };
      // Two, alternating by frame parity: a pass may not read and write one
      // handle, and both have to survive to the next frame.
      const parity = frameIndex % 2;
      const cocHistories = [
        createTexture({ label: `dof.cocHistory0.${viewId}`, ...cocDescriptor }),
        createTexture({ label: `dof.cocHistory1.${viewId}`, ...cocDescriptor }),
      ];

      const state = cocStates.get(cameraEntity);
      const historyValid =
        !camera._temporalReset &&
        state &&
        state.width === width &&
        state.height === height &&
        state.frameIndex === frameIndex - 1;
      cocStates.set(cameraEntity, { width, height, frameIndex });

      // Published only while something asked the scene pass for it; without it
      // the reprojection is the camera's alone.
      const velocity = textures.get("velocity");

      pass({
        name: "cocResolve",
        shader: dofCoCResolveShader,
        defines: new Set([
          ...defines,
          ...(velocity ? ["USE_DOF_COC_VELOCITY"] : []),
        ]),
        constants: { USE_DOF_PHYSICAL: physical },
        // Derived from depth and its own history; binding the colour chain
        // would carry a read edge for a sample that never happens.
        source: null,
        target: cocHistories[parity]!,
        uniforms: {
          uDoFParams,
          uTAA: {
            inverseViewProjectionMatrix: camera._inverseViewProjectionMatrix!,
            previousViewProjectionMatrix: camera._previousViewProjectionMatrix!,
            texelSize: [1 / width, 1 / height],
            // Undoes the raster's sub-pixel offset when reading what the scene
            // pass wrote. NDC to UV, hence the sign flip on Y.
            depthOffset: [jitter[0]! * 0.5, jitter[1]! * -0.5],
            blendFactor: COC_BLEND_FACTOR,
            varianceGamma: 0,
            historyValid: historyValid ? 1 : 0,
            disocclusionTolerance: 0,
          },
          ...depthUniforms,
          ...focusUniforms,
          uHistoryTexture: cocHistories[1 - parity]!,
          uHistoryTextureSampler: samplers.linear,
          ...(velocity && {
            uVelocityTexture: velocity,
            // Point sampled: interpolating motion vectors across a silhouette
            // averages two surfaces that went different ways.
            uVelocityTextureSampler: samplers.nearest,
          }),
        },
      });

      resolvedCoC = cocHistories[parity]!;
    }

    // Point sampled: already at full resolution, and interpolating it would
    // round the silhouettes the resolve just settled.
    const cocUniforms = resolvedCoC
      ? { uCoCTexture: resolvedCoC, uCoCTextureSampler: samplers.nearest }
      : { ...depthUniforms, ...focusUniforms };
    const cocDefines = resolvedCoC ? ["USE_DOF_RESOLVED_COC"] : [];

    const prefilter = pass({
      name: "prefilter",
      shader: dofPrefilterShader,
      defines: new Set([...defines, ...cocDefines]),
      constants: { USE_DOF_PHYSICAL: physical },
      size: halfSize,
      format: FIELD_FORMAT,
      mipLevelCount,
      uniforms: { uDoFParams, ...cocUniforms },
    });

    // Filled here rather than by a generic reduction: a box filter averages the
    // circle of confusion in alpha along with the colour, and a coarse texel
    // straddling a silhouette then claims a radius between the two surfaces' —
    // which spreads the sharp one as far as the blurry one and smears content
    // past the edge it belongs to.
    for (let level = 1; level < mipLevelCount; level++) {
      pass({
        name: `downsample[${level}]`,
        shader: dofDownsampleShader,
        // Neither is a read edge on a texture this pass writes: the source is
        // bound as a view of the level below, and ordering comes from the
        // write-after-write against the pass that filled it.
        source: null,
        target: prefilter,
        level,
        views: {
          uTexture: { handle: prefilter, level: level - 1, levelCount: 1 },
        },
        uniforms: { uTextureSampler: samplers.linear },
      });
    }

    const tileConstants = {
      DOF_TILE_SIZE: tilePixels,
      // How many tiles a maximum-radius disc spans, and so how far the dilation
      // has to look to find one. One more than that, because the gather reads
      // this interpolated: the four tiles it blends are centred up to a tile
      // away from the pixel asking. It widens the region a large radius applies
      // to by one tile, and cannot raise the radius itself.
      DOF_TILE_DILATE_RADIUS: Math.ceil(maxCoCRadius / tilePixels) + 1,
    };

    const rows = pass({
      name: "tileMaxX",
      shader: dofTileMaxXShader,
      constants: tileConstants,
      source: prefilter,
      size: [tilesX, halfHeight],
      format: TILE_FORMAT,
    });

    const tiles = pass({
      name: "tileMaxY",
      shader: dofTileMaxYShader,
      constants: tileConstants,
      source: rows,
      size: tileSize,
      format: TILE_FORMAT,
    });

    const dilated = pass({
      name: "tileDilate",
      shader: dofTileDilateShader,
      constants: tileConstants,
      source: tiles,
      size: tileSize,
      format: TILE_FORMAT,
    });

    const near = createTexture({
      label: `dof.near_${viewId}`,
      width: halfWidth,
      height: halfHeight,
      format: FIELD_FORMAT,
    });

    const far = pass({
      name: "far",
      shader: dofGatherShader,
      constants: {
        DOF_RINGS: rings,
        DOF_SAMPLES: samples,
        DOF_MAX_MIP: mipLevelCount - 1,
        USE_DOF_RING_OCCLUSION: component.ringOcclusion ?? true,
      },
      source: prefilter,
      size: halfSize,
      format: FIELD_FORMAT,
      targets: [{ name: "near", texture: near }],
      uniforms: {
        uDoFParams,
        uTileTexture: dilated,
        // Interpolated, so the near field's gather radius varies continuously
        // instead of stepping at tile borders.
        uTileTextureSampler: samplers.linear,
      },
    });

    let farField = far;
    let nearField = near;

    if (component.postFilter ?? true) {
      const nearBlur = createTexture({
        label: `dof.nearBlur_${viewId}`,
        width: halfWidth,
        height: halfHeight,
        format: FIELD_FORMAT,
      });

      farField = pass({
        name: "farBlur",
        shader: dofPostFilterShader,
        source: far,
        size: halfSize,
        format: FIELD_FORMAT,
        targets: [{ name: "nearBlur", texture: nearBlur }],
        uniforms: {
          uNearTexture: near,
          // Point sampled, unlike the far field's tent beside it: the near
          // filter's nine taps have to be nine texels, and interpolating would
          // average a speck back in before the median could reject it.
          uNearTextureSampler: samplers.nearest,
        },
      });
      nearField = nearBlur;
    }

    // Written alongside the image, not instead of it: the picker blits this one
    // directly, bypassing the tone map everything downstream applies.
    const debugTexture = component.debug
      ? createTexture({
          label: `dof.debug_${viewId}`,
          width,
          height,
          format: FIELD_FORMAT,
        })
      : undefined;

    pass({
      name: "main",
      shader: dofCompositeShader,
      chain: true,
      ...(debugTexture && {
        targets: [{ name: "debug", texture: debugTexture }],
      }),
      defines: new Set([
        ...defines,
        ...cocDefines,
        ...(component.debug ? ["USE_DOF_DEBUG"] : []),
      ]),
      constants: {
        USE_DOF_PHYSICAL: physical,
        USE_DOF_CHROMATIC_ABERRATION: chromaticAberration > 0,
        USE_DOF_TRANSITION_BLUR: component.transitionBlur ?? true,
      },
      uniforms: {
        uDoFParams,
        ...cocUniforms,
        // Bilinear: both fields are half resolution, and the near one is
        // premultiplied so interpolating it is still a valid image.
        uFarTexture: farField,
        uFarTextureSampler: samplers.linear,
        uNearTexture: nearField,
        uNearTextureSampler: samplers.linear,
        ...(component.debug && {
          uTileTexture: dilated,
          uTileTextureSampler: samplers.linear,
        }),
      },
    });
  },
};

export default dof;

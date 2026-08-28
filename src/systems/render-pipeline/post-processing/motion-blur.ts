import {
  motionBlurTileMaxXShader,
  motionBlurTileMaxYShader,
  motionBlurNeighborMaxShader,
  motionBlurShader,
} from "../../../shaders/post-processing/motion-blur.js";

import type { PostProcessingEffect } from "../post-processing.js";

/** Velocity, and the tiles reduced from it, are signed and want the range. */
const VELOCITY_FORMAT = "rg16float" as GPUTextureFormat;

/**
 * Motion blur.
 *
 * McGuire et al.'s tile framework with Guertin et al.'s 2014 reconstruction
 * filter: the velocity buffer is reduced to a grid of dominant motions, each
 * tile widened to include the motions that could reach it, and every pixel then
 * gathers colour along those motions.
 *
 * Runs after temporal antialiasing and before bloom, on the linear image. After
 * the resolve because blurring a jittered frame would smear the jitter along
 * with everything else, and the accumulated image is what should be smeared;
 * before bloom because a streak that ends bright should bloom.
 */
const motionBlur: PostProcessingEffect = {
  name: "motionBlur",
  // The same buffer temporal antialiasing reads, and the reason this could be
  // built at all: what moved, per pixel, from the geometry that moved it.
  outputs: ["velocity"],
  declare({ cameraEntity, renderView, samplers, textures, pass }) {
    const camera = cameraEntity.camera!;
    const component = cameraEntity.postProcessing!.motionBlur!;

    // Both are structural: without motion there is nothing to smear along, and
    // the filter weights every sample by how the depths compare.
    const velocity = textures.get("velocity");
    const depth = textures.get("depth");
    if (!velocity || !depth) return;

    const intensity = component.intensity ?? 1;
    if (intensity <= 0) return;

    const width = renderView.viewport[2]!;
    const height = renderView.viewport[3]!;
    const tileSize = Math.max(1, Math.trunc(component.tileSize ?? 40));
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);

    const constants = { MOTION_BLUR_TILE_SIZE: tileSize };
    const uMotionBlur = {
      viewportSize: [width, height],
      texelSize: [1 / width, 1 / height],
      tileSize,
      intensity,
      centerWeightBias: component.centerWeightBias ?? 40,
      directionBlend: component.directionBlend ?? 1.5,
      jitterScale: component.jitterScale ?? 27,
      tileBlend: component.tileBlend ?? 1,
      near: camera.near!,
      far: camera.far!,
    };

    // Separable, so each invocation reads a row of a tile rather than all of
    // it: one pass of tileSize² reads would leave most of the machine idle.
    const rows = pass({
      name: "tileMaxX",
      shader: motionBlurTileMaxXShader,
      constants,
      source: velocity,
      size: [tilesX, height],
      format: VELOCITY_FORMAT,
      uniforms: { uMotionBlur },
    });

    const tiles = pass({
      name: "tileMaxY",
      shader: motionBlurTileMaxYShader,
      constants,
      source: rows,
      size: [tilesX, tilesY],
      format: VELOCITY_FORMAT,
    });

    const neighborMax = pass({
      name: "neighborMax",
      shader: motionBlurNeighborMaxShader,
      source: tiles,
      size: [tilesX, tilesY],
      format: VELOCITY_FORMAT,
    });

    pass({
      name: "main",
      shader: motionBlurShader,
      constants: { MOTION_BLUR_SAMPLES: component.samples ?? 35 },
      chain: true,
      uniforms: {
        uMotionBlur,
        uVelocityTexture: velocity,
        // Point-sampled: a motion vector interpolated across a silhouette
        // describes neither of the surfaces that meet there.
        uVelocityTextureSampler: samplers.nearest,
        uNeighborMaxTexture: neighborMax,
        uNeighborMaxTextureSampler: samplers.nearest,
        uDepthTexture: depth,
        uDepthTextureSampler: samplers.nearest,
      },
    });
  },
};

export default motionBlur;

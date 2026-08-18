import { createBuffer } from "pex-gpu";

import { fullscreenTriangle, quad } from "./utils.js";

import type { GpuBuffer, GpuContext } from "./types.js";

export interface FullscreenGeometry {
  /** Single oversized triangle: one primitive, no seam down the diagonal. */
  triangle: { attributes: { position: GpuBuffer }; count: number };
  quad: {
    attributes: { position: GpuBuffer; texCoord0: GpuBuffer };
    indices: GpuBuffer;
  };
}

const perContext = new WeakMap<GpuContext, FullscreenGeometry>();

/**
 * Vertex data for fullscreen passes. Immutable and shared for the lifetime of
 * the context — the frame graph only owns resources whose lifetime is a frame,
 * so this deliberately sits outside it.
 */
export default (ctx: GpuContext): FullscreenGeometry =>
  perContext.getOrInsertComputed(ctx, () => ({
    triangle: {
      attributes: {
        position: createBuffer(ctx, {
          label: "fullscreenTrianglePosition",
          usage: "vertex",
          data: fullscreenTriangle.positions,
        }),
      },
      count: 3,
    },
    quad: {
      attributes: {
        position: createBuffer(ctx, {
          label: "fullscreenQuadPosition",
          usage: "vertex",
          data: quad.positions,
        }),
        texCoord0: createBuffer(ctx, {
          label: "fullscreenQuadTexCoord0",
          usage: "vertex",
          data: quad.uvs,
        }),
      },
      indices: createBuffer(ctx, {
        label: "fullscreenQuadIndices",
        usage: "index",
        data: quad.cells,
      }),
    },
  }));

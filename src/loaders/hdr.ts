import { loadArrayBuffer } from "pex-io";
import parseHdr from "parse-hdr";
import { createTexture } from "pex-gpu";

import { NAMESPACE } from "../utils.js";

import type { GpuContext, GpuTexture } from "../types.js";

export interface LoadHdrOptions {
  /**
   * Texture format. "rgba32float" keeps full precision but is only filterable
   * with the "float32-filterable" WebGPU feature; without it, falls back to
   * "rgba16float".
   */
  format?: "rgba16float" | "rgba32float";
}

/**
 * Load a Radiance HDR file (.hdr) as an equirectangular envMap texture.
 *
 * Uploads to rgba16float by default: parse-hdr decodes to a Float32Array, and
 * rgba16float preserves radiance beyond 1.0 while staying filterable for the
 * skybox renderer's linear sampler.
 */
async function loadHdr(
  ctx: GpuContext,
  url: string,
  options: LoadHdrOptions = {},
): Promise<GpuTexture> {
  let format = options.format ?? "rgba16float";

  if (
    format === "rgba32float" &&
    !ctx.device.features.has("float32-filterable")
  ) {
    console.warn(
      NAMESPACE,
      "loadHdr",
      `"rgba32float" requested but the "float32-filterable" feature is unavailable; falling back to "rgba16float"`,
    );
    format = "rgba16float";
  }

  const { shape, data } = parseHdr(await loadArrayBuffer(url));

  return createTexture(ctx, {
    label: url,
    width: shape[0],
    height: shape[1],
    format,
    // createTexture only auto-packs plain arrays to Float16Array for
    // half-float formats; a typed array is uploaded as trusted bytes as-is,
    // so parse-hdr's Float32Array needs packing down for rgba16float here.
    data: format === "rgba16float" ? new Float16Array(data) : data,
  });
}

export default loadHdr;

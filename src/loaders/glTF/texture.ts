import { loadImage, loadBlob, loadArrayBuffer } from "pex-io";
import { createTexture, createSampler } from "pex-gpu";
import { transcodeKtx2 } from "pex-loaders";

import { isBase64 } from "./io.js";

import type { GpuContext, MaterialTexture } from "../../types.js";

// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants#Textures
const GL_NEAREST = 9728;
const GL_NEAREST_MIPMAP_NEAREST = 9984;
const GL_LINEAR_MIPMAP_NEAREST = 9985;
const GL_NEAREST_MIPMAP_LINEAR = 9986;
const GL_CLAMP_TO_EDGE = 33_071;
const GL_MIRRORED_REPEAT = 33_648;

const loadImageBitmap = async (blob: Blob) =>
  await createImageBitmap(blob, {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });

// pex-io's generated ImageOptions type only declares `url` (its JSDoc "rest of
// HTMLImageElement properties" spread doesn't survive TS generation) — cast to
// pass crossOrigin, which loadImage does forward at runtime.
const loadCrossOriginImage = (url: string) =>
  loadImage({ url, crossOrigin: "anonymous" } as any);

// https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/sampler.schema.json
function magFilterToWebGPU(glFilter?: number): GPUFilterMode {
  return glFilter === GL_NEAREST ? "nearest" : "linear";
}

function minFilterToWebGPU(glFilter?: number): {
  minFilter: GPUFilterMode;
  mipmapFilter: GPUFilterMode;
  hasMipmap: boolean;
} {
  switch (glFilter) {
    case GL_NEAREST:
      return {
        minFilter: "nearest",
        mipmapFilter: "nearest",
        hasMipmap: false,
      };
    case GL_NEAREST_MIPMAP_NEAREST:
      return { minFilter: "nearest", mipmapFilter: "nearest", hasMipmap: true };
    case GL_LINEAR_MIPMAP_NEAREST:
      return { minFilter: "linear", mipmapFilter: "nearest", hasMipmap: true };
    case GL_NEAREST_MIPMAP_LINEAR:
      return { minFilter: "nearest", mipmapFilter: "linear", hasMipmap: true };
    default:
      // LINEAR, LINEAR_MIPMAP_LINEAR, and glTF's own default (unspecified).
      return { minFilter: "linear", mipmapFilter: "linear", hasMipmap: true };
  }
}

function wrapToWebGPU(glWrap?: number): GPUAddressMode {
  switch (glWrap) {
    case GL_CLAMP_TO_EDGE:
      return "clamp-to-edge";
    case GL_MIRRORED_REPEAT:
      return "mirror-repeat";
    default:
      return "repeat";
  }
}

const KTX2_MIME = "image/ktx2";

const isKtx2 = (image: any): boolean =>
  image.mimeType === KTX2_MIME ||
  (typeof image.uri === "string" && image.uri.split("?")[0]!.endsWith(".ktx2"));

export interface ResolveImagesOptions {
  basePath?: string | undefined;
  supportImageBitmap?: boolean;
  /**
   * Required to transcode KHR_texture_basisu images, which needs the device's
   * compressed-texture features.
   */
  ctx?: GpuContext;
}

/**
 * Decodes every glTF image (bufferView-embedded, data URI, or external file)
 * into `image._img`, ready for texture upload.
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/image.schema.json
 */
export async function resolveImages(
  json: any,
  options: ResolveImagesOptions,
): Promise<void> {
  if (!json.images) return;

  await Promise.all(
    json.images.map(async (image: any) => {
      // KHR_texture_basisu payloads are not decodable images: transcode them to
      // a compressed mip chain here, where async work is allowed, and let
      // resolveTexture upload it synchronously like every other image.
      if (isKtx2(image)) {
        if (!options.ctx) {
          console.warn(
            "glTF loader: KHR_texture_basisu image skipped (resolveImages needs a ctx to pick a transcode target).",
          );
          return;
        }
        const buffer =
          image.bufferView === undefined
            ? await loadArrayBuffer(
                decodeURIComponent([options.basePath, image.uri].join("/")),
              )
            : json.bufferViews[image.bufferView]._data;
        image._ktx2 = await transcodeKtx2(options.ctx, buffer);
        return;
      }

      if (image.bufferView !== undefined) {
        const bufferView = json.bufferViews[image.bufferView];
        bufferView.byteOffset = bufferView.byteOffset || 0;
        const buffer = json.buffers[bufferView.buffer];
        const data = buffer._data.slice(
          bufferView.byteOffset,
          bufferView.byteOffset + bufferView.byteLength,
        );
        const blob = new Blob([data], { type: image.mimeType });
        image._img = options.supportImageBitmap
          ? await loadImageBitmap(blob)
          : await loadCrossOriginImage(URL.createObjectURL(blob));
      } else if (isBase64(image.uri)) {
        image._img = await loadCrossOriginImage(image.uri);
      } else {
        const url = decodeURIComponent([options.basePath, image.uri].join("/"));
        image._img = options.supportImageBitmap
          ? await loadImageBitmap(await loadBlob(url, { mode: "cors" }))
          : await loadCrossOriginImage(url);
      }
    }),
  );
}

/**
 * Picks the image a texture should load from.
 *
 * Extensions each nominate their own image, replacing `texture.source` — which
 * a required extension may omit entirely, since there is then no fallback to
 * describe. KHR_texture_basisu wins over EXT_texture_webp when both are
 * present: it stays GPU-compressed, where webp decodes to RGBA like any other
 * image.
 */
function resolveTextureSource(texture: any): number | undefined {
  return (
    texture.extensions?.KHR_texture_basisu?.source ??
    texture.extensions?.EXT_texture_webp?.source ??
    texture.source
  );
}

/**
 * Resolves a glTF textureInfo (`{ index, texCoord, extensions }`) into a
 * MaterialTexture: the GPU texture is uploaded once per glTF texture index and
 * cached on the texture object (`texture._tex`) — reused across every material
 * field that references it. If two fields reference the same texture index
 * requesting different pixelFormats (e.g. one sRGB, one linear), the first
 * requested format wins; this mirrors the previous WebGL loader's behavior.
 *
 * Returns undefined when no image source is usable, so the material simply
 * renders without that map rather than failing the whole load.
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/textureInfo.schema.json
 */
export function resolveTexture(
  materialTexture: any,
  gltf: any,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
  pixelFormat?: GPUTextureFormat,
): MaterialTexture | undefined {
  const { textures, images, samplers } = gltf;
  const texture = textures[materialTexture.index];

  const source = resolveTextureSource(texture);
  if (source === undefined) {
    console.warn(
      `glTF loader: texture ${materialTexture.index} has no image source this loader supports (extensions: ${Object.keys(texture.extensions ?? {}).join(", ") || "none"}).`,
    );
    return undefined;
  }

  const image = images[source];
  const samplerDef = samplers?.[texture.sampler];

  if (!texture._tex) {
    const { minFilter, mipmapFilter, hasMipmap } = minFilterToWebGPU(
      samplerDef?.minFilter,
    );

    // A transcoded KTX2 carries its own format and mip chain: the container's
    // transfer function decides sRGB, so `pixelFormat` does not apply, and the
    // levels are uploaded rather than generated (compressed formats cannot be
    // rendered into).
    const ktx2: Awaited<ReturnType<typeof transcodeKtx2>> | undefined =
      image._ktx2;
    texture._tex = createTexture(
      ctx,
      ktx2
        ? {
            label: image.uri || image.name,
            width: ktx2.width,
            height: ktx2.height,
            format: ktx2.format,
            mipLevels: ktx2.levels.map((level) => level.data),
          }
        : {
            label: image.uri || image.name,
            data: image._img,
            format: pixelFormat ?? "rgba8unorm",
            mipmap: hasMipmap,
          },
    );

    if (texture.sampler !== undefined && !samplerCache.has(texture.sampler)) {
      const magFilter = magFilterToWebGPU(samplerDef?.magFilter);
      // WebGPU requires magFilter/minFilter/mipmapFilter to all be "linear"
      // when maxAnisotropy > 1 — a mixed nearest/linear sampler (common in
      // glTF test assets, e.g. BoxTextured) must skip it entirely.
      const allLinear =
        hasMipmap &&
        magFilter === "linear" &&
        minFilter === "linear" &&
        mipmapFilter === "linear";

      samplerCache.set(
        texture.sampler,
        createSampler(ctx, {
          magFilter,
          minFilter,
          mipmapFilter,
          addressModeU: wrapToWebGPU(samplerDef?.wrapS),
          addressModeV: wrapToWebGPU(samplerDef?.wrapT),
          ...(allLinear && { maxAnisotropy: 16 }),
        }),
      );
    }
  }

  const sampler =
    texture.sampler !== undefined
      ? samplerCache.get(texture.sampler)
      : undefined;

  // https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_texture_transform/schema/KHR_texture_transform.textureInfo.schema.json
  const textureTransform = materialTexture.extensions?.KHR_texture_transform;
  const texCoord = materialTexture.texCoord;

  if (!texCoord && !textureTransform && !sampler) {
    return texture._tex;
  }

  return {
    texture: texture._tex,
    texCoord: texCoord || 0,
    ...(sampler && { sampler }),
    // textureTransform.texCoord overrides the textureInfo texCoord above, per spec.
    ...textureTransform,
    // KHR_texture_transform's rotation is counter-clockwise looking at the UV
    // plane; base.ts's getTextureMatrix rotates the sampling coordinates the
    // other way round (its positive angle visually spins the sampled image
    // counter-clockwise, the opposite of rotating the UVs themselves
    // counter-clockwise) — negate here so a positive glTF rotation matches the
    // spec's visual result instead of spinning the texture backwards.
    ...(textureTransform?.rotation !== undefined && {
      rotation: -textureTransform.rotation,
    }),
  };
}

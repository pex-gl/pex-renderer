import {
  createBuffer,
  createTexture,
  isGpuBuffer,
  isGpuTexture,
} from "pex-gpu";

import { fullscreenTriangle, quad } from "./utils.js";

import type { GpuContext, ResourceCache } from "./types.js";

// Cache entry wrapping a GPU resource (or plain descriptor) with its allocation
// props and liveness bookkeeping.
interface CachedResource {
  type: string;
  value: any;
  props: any;
  used?: boolean;
  usage?: string | undefined;
  keepAlive?: number;
  delteCountDown?: number;
}

// TODO: should this be an option
const keepAliveCountdown = 30;

const Usage = {
  Transient: "Transient",
  Retained: "Retained",
};

function compareAttachments(a: any, b: any) {
  if (a?.texture && a?.texture === b?.texture) {
    // Check attachments with resolve targets (MSAA renderbuffer) or targets (cubemaps)
    if (a.resolveTarget) {
      return a.resolveTarget === b.resolveTarget;
    } else if (a.target === b.target) {
      return true;
    }
  }
  return false;
}

function arraysEqual(a: any, b: any) {
  // Check array equality or loose equality to null
  if (a === b) return true;
  if (a == null || b == null) return false;

  // Compare array length
  const { length } = a;
  if (length !== b.length) return false;

  // Note: sort arrays if order independent
  for (let i = 0; i < length; ++i) {
    // Check array item equality
    if (a[i] !== b[i] && !compareAttachments(a[i], b[i])) return false;
  }
  return true;
}

function getResourceFromCache(
  cache: CachedResource[],
  props: any,
): CachedResource | null {
  for (let i = 0; i < cache.length; i++) {
    const resource = cache[i]!;

    // Exclude used resources
    if (resource.used && resource.usage !== Usage.Retained) continue; // TODO: shouldn't this skip Retained resources?

    // Compare resource props
    let arePropsTheSame = true;
    for (const propName in props) {
      const a = props[propName];
      const b = resource.props[propName];

      if (Array.isArray(a) && Array.isArray(b)) {
        arePropsTheSame &&= arraysEqual(a, b);
      } else if (a != b) {
        arePropsTheSame = compareAttachments(a, b);
      }
      if (!arePropsTheSame) break;
    }

    if (arePropsTheSame) {
      resource.used = true;
      resource.delteCountDown = keepAliveCountdown;
      return resource;
    }
  }

  return null;
}

/**
 * Allocate a 2D texture (color or depth render target). `pixelFormat` accepts a
 * WGSL texture format string; filters live on samplers in WebGPU so min/mag are
 * ignored here.
 */
const createTexture2D = (ctx: GpuContext, props: any) =>
  createTexture(ctx, {
    label: props.name,
    width: props.width,
    height: props.height,
    format: props.pixelFormat || props.format || "rgba8unorm",
    ...(props.sampleCount ? { sampleCount: props.sampleCount } : {}),
    ...(props.mipmap ? { mipmap: true } : {}),
  });

// Type factories keyed by resource-cache type. Buffers/textures allocate real
// GPU resources; pipelines are plain descriptors kept identity-stable so
// pex-gpu's own pipeline cache hits across frames.
const factories: Record<string, (ctx: GpuContext, props: any) => any> = {
  texture2D: createTexture2D,
  // MSAA/cubemap targets are only reached by not-yet-ported branches; provide
  // working factories so descriptor construction and those paths don't throw.
  renderbuffer: createTexture2D,
  textureCube: (ctx, props) =>
    createTexture(ctx, {
      label: props.name,
      width: props.width,
      height: props.height,
      depth: 6,
      format: props.pixelFormat || props.format || "rgba8unorm",
      viewDimension: "cube",
    }),
  vertexBuffer: (ctx, props) =>
    createBuffer(ctx, { usage: "vertex", data: props.data || props }),
  indexBuffer: (ctx, props) =>
    createBuffer(ctx, { usage: "index", data: props.data || props }),
  pipeline: (_ctx, props) => ({ ...props }),
};

function getResource(
  ctx: GpuContext,
  cache: CachedResource[],
  type: string,
  props: any,
  usage?: string,
) {
  let resource = getResourceFromCache(cache, props);
  if (!resource) {
    resource = {
      type,
      value: factories[type]!(ctx, props),
      // TODO: this is problematic if we re-use descriptors
      props: { ...props },
      used: true,
      usage,
    };

    cache.push(resource);
  }
  return resource.value;
}

const isDisposable = (value: any) => isGpuTexture(value) || isGpuBuffer(value);

/**
 * Translate a pex-renderer pass description (color/depth textures, clear
 * values) into a pex-gpu RenderPassDescriptor. Passes are plain objects with no
 * GPU allocation, so they are built fresh rather than cached.
 */
function createPass(props: any) {
  const pass: any = { label: props.name };

  // A GpuTexture is passed straight through; an MSAA/cubemap wrapper carries
  // its GpuTexture under `.texture` (its raw handle lives on GpuTexture.texture,
  // so unwrapping unconditionally would drop the resolvable view). An explicit
  // empty array marks a depth-only pass (vs. undefined = default to canvas).
  if (props.color) {
    pass.colorAttachments = props.color.map((attachment: any, i: number) => {
      const texture = isGpuTexture(attachment)
        ? attachment
        : attachment.texture;
      return {
        texture,
        // Cubemap/array face: render into a single layer (eg. shadow cubemaps).
        ...(attachment.target != null
          ? {
              view: texture.texture.createView({
                dimension: "2d",
                baseArrayLayer: attachment.target,
                arrayLayerCount: 1,
              }),
            }
          : attachment.level != null
            ? // Explicit mip target (eg. building a grab-pass mip chain).
              {
                view: texture.texture.createView({
                  baseMipLevel: attachment.level,
                  mipLevelCount: 1,
                }),
              }
            : // Render attachments must target exactly one mip level; a mipmapped
              // texture's cached default view spans the full chain.
              texture.mipLevelCount > 1 && {
                view: texture.texture.createView({
                  baseMipLevel: 0,
                  mipLevelCount: 1,
                }),
              }),
        ...(attachment.resolveTarget
          ? { resolveTarget: attachment.resolveTarget }
          : {}),
        ...(props.clearColor && i === 0
          ? { clearValue: props.clearColor }
          : {}),
      };
    });
  }

  if (props.depth) {
    const depthTexture = isGpuTexture(props.depth)
      ? props.depth
      : props.depth.texture;
    pass.depthStencilAttachment = {
      texture: depthTexture,
      // Cubemap/array face depth attachment (eg. point-light shadow cube).
      ...(!isGpuTexture(props.depth) &&
        props.depth.target != null && {
          view: depthTexture.texture.createView({
            dimension: "2d",
            baseArrayLayer: props.depth.target,
            arrayLayerCount: 1,
          }),
        }),
      ...(props.clearDepth == null
        ? {}
        : { depthClearValue: props.clearDepth }),
    };
  }

  return pass;
}

export default (ctx: GpuContext): ResourceCache => {
  const cache: CachedResource[] = [];

  const fullscreenTriangleProps = {
    attributes: {
      // prettier-ignore
      position: getResource(ctx, cache, "vertexBuffer", fullscreenTriangle.positions, Usage.Retained),
    },
    count: 3,
  };

  cache.push({
    type: "fullscreenTriangle",
    props: fullscreenTriangleProps,
    value: fullscreenTriangleProps,
    usage: Usage.Retained,
  });

  // prettier-ignore
  const fullscreenQuadProps = {
    attributes: {
      position: getResource(ctx, cache, "vertexBuffer", quad.positions, Usage.Retained),
      texCoord0: getResource(ctx, cache, "vertexBuffer", quad.uvs, Usage.Retained),
    },
    indices: getResource(ctx, cache, "indexBuffer", quad.cells, Usage.Retained),
  };

  cache.push({
    type: "fullscreenQuad",
    props: fullscreenQuadProps,
    value: fullscreenQuadProps,
    usage: Usage.Retained,
  });

  return {
    _cache: cache,
    Usage,
    texture2D: (props: any, usage?: string) =>
      getResource(ctx, cache, "texture2D", props, usage),
    textureCube: (props: any, usage?: string) =>
      getResource(ctx, cache, "textureCube", props, usage),
    renderbuffer: (props: any, usage?: string) =>
      getResource(ctx, cache, "renderbuffer", props, usage),
    pass: (props: any) => createPass(props),
    pipeline: (props: any, usage?: string) =>
      getResource(ctx, cache, "pipeline", props, usage),
    vertexBuffer: (props: any, usage?: string) =>
      getResource(ctx, cache, "vertexBuffer", props, usage),
    indexBuffer: (props: any, usage?: string) =>
      getResource(ctx, cache, "indexBuffer", props, usage),
    fullscreenTriangle: () =>
      getResourceFromCache(cache, fullscreenTriangleProps)!.value,
    fullscreenQuad: () =>
      getResourceFromCache(cache, fullscreenQuadProps)!.value,
    //TODO: add release for Retained resources
    // release() {}
    beginFrame() {
      for (let i = 0; i < cache.length; i++) {
        cache[i]!.used = false;
      }
    },
    endFrame() {
      for (let i = 0; i < cache.length; i++) {
        const resource = cache[i]!;
        if (resource.used || resource.usage === Usage.Retained) {
          resource.keepAlive = keepAliveCountdown;
        } else {
          resource.keepAlive = (resource.keepAlive ?? keepAliveCountdown) - 1;
          if (resource.keepAlive < 0) {
            if (isDisposable(resource.value)) resource.value.dispose();
            cache.splice(i, 1);
          }
        }
      }
    },
    dispose() {
      for (let i = 0; i < cache.length; i++) {
        if (isDisposable(cache[i]!.value)) cache[i]!.value.dispose();
      }
      cache.length = 0;
    },
  };
};

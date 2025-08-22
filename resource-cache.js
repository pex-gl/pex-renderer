import { fullscreenTriangle, quad } from "./utils.js";

// TODO: should this be an option
const keepAliveCountdown = 30;

const Usage = {
  Transient: "Transient",
  Retained: "Retained",
};

function compareAttachments(a, b) {
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

function arraysEqual(a, b) {
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

function getResourceFromCache(cache, props) {
  for (let i = 0; i < cache.length; i++) {
    const resource = cache[i];

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

function getContextResource(ctx, cache, type, props, usage) {
  let resource = getResourceFromCache(cache, props);
  if (!resource) {
    resource = {
      type,
      value: ctx[type](props),
      // TODO: this is problematic if we re-use descriptors
      props: {
        ...props,
      },
      used: true,
      usage,
    };

    cache.push(resource);
  }
  return resource.value;
}

export default (ctx) => {
  const cache = [];

  const fullscreenTriangleProps = {
    attributes: {
      // prettier-ignore
      aPosition: getContextResource(ctx, cache, "vertexBuffer", fullscreenTriangle.positions, Usage.Retained),
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
      aPosition: getContextResource(ctx, cache, "vertexBuffer", quad.positions, Usage.Retained),
      aTexCoord0: getContextResource(ctx, cache, "vertexBuffer", quad.uvs, Usage.Retained),
    },
    indices: getContextResource(ctx, cache, "indexBuffer", quad.cells, Usage.Retained),
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
    texture2D: (props, usage) =>
      getContextResource(ctx, cache, "texture2D", props, usage),
    textureCube: (props, usage) =>
      getContextResource(ctx, cache, "textureCube", props, usage),
    renderbuffer: (props, usage) =>
      getContextResource(ctx, cache, "renderbuffer", props, usage),
    pass: (props, usage) =>
      getContextResource(ctx, cache, "pass", props, usage),
    pipeline: (props, usage) =>
      getContextResource(ctx, cache, "pipeline", props, usage),
    vertexBuffer: (props, usage) =>
      getContextResource(ctx, cache, "vertexBuffer", props, usage),
    indexBuffer: (props, usage) =>
      getContextResource(ctx, cache, "indexBuffer", props, usage),
    fullscreenTriangle: () =>
      getResourceFromCache(cache, fullscreenTriangleProps).value,
    fullscreenQuad: () =>
      getResourceFromCache(cache, fullscreenQuadProps).value,
    //TODO: add release for Retained resources
    // release() {}
    beginFrame() {
      for (let i = 0; i < cache.length; i++) {
        cache[i].used = false;
      }
    },
    endFrame() {
      for (let i = 0; i < cache.length; i++) {
        const resource = cache[i];
        if (resource.used || resource.usage === Usage.Retained) {
          cache[i].keepAlive = keepAliveCountdown;
        } else {
          if (--cache[i].keepAlive < 0) {
            if (cache[i].value._dispose) {
              ctx.dispose(cache[i].value);
            }
            cache.splice(i, 1);
          }
        }
      }
    },
    dispose() {
      for (let i = 0; i < cache.length; i++) {
        if (cache[i].value._dispose) ctx.dispose(cache[i].value);
      }
      cache.length = 0;
    },
  };
};

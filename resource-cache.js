import { fullscreenTriangle, quad } from "./utils.js";

// TODO: should this be an option
const keepAliveCoundown = 30;

const Usage = {
  Transient: "Transient",
  Retained: "Retained",
};

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.
  // Please note that calling sort on an array will modify that array.
  // you might want to clone your array first.

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) {
      //handle special case where array of color attachments is texture+target (rendering to cubemap)
      if (
        a[i].texture &&
        a[i].texture == b[i].texture &&
        a[i].target == b[i].target
      ) {
        return true;
      }
      return false;
    }
  }
  return true;
}

function getResourceFromCache(cache, props) {
  for (let i = 0; i < cache.length; i++) {
    const res = cache[i];
    if (res.used && res.usage !== Usage.Retained) continue;
    let areTheSame = true;
    for (const propName in props) {
      if (
        Array.isArray(props[propName]) &&
        Array.isArray(res.props[propName])
      ) {
        areTheSame &= arraysEqual(props[propName], res.props[propName]);
      } else if (props[propName] != res.props[propName]) {
        areTheSame = false;
      }
    }

    if (areTheSame) {
      res.used = true;
      res.delteCountDown = keepAliveCoundown;
      return res;
    }
  }
  return null;
}

function getContextResource(ctx, cache, type, props, usage) {
  let res = getResourceFromCache(cache, props);
  if (res) return res.value;
  res = {
    type: type,
    value: ctx[type](props),
    // TODO: this is problematic if we re-use descriptors
    props: {
      ...props,
    },
    used: true,
    usage: usage,
  };

  cache.push(res);
  return res.value;
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
        const res = cache[i];
        if (res.used || res.usage === Usage.Retained) {
          cache[i].keepAlive = keepAliveCoundown;
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

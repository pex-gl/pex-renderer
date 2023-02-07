export default function createResourceCache(ctx) {
  const cache = [];
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

    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) {
        //handle special case where array of color attachments is texture+target (rendering to cubemap)
        if (
          a[i].texture &&
          a[i].texture == b[i].texture &&
          a[i].target == b[i].target
        )
          return true;
        return false;
      }
    }
    return true;
  }

  function getResourceFromCache(props) {
    for (var i = 0; i < cache.length; i++) {
      var res = cache[i];
      if (res.used && res.usage !== Usage.Retained) continue;
      var areTheSame = true;
      for (var propName in props) {
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

  function getContextResource(type, props, usage) {
    let res = getResourceFromCache(props);
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

  //prettier-ignore
  const resourceCache = {
    _cache: cache,
    //TODO: make resourceCache a class
    Usage,
    texture2D: (props, usage) => getContextResource("texture2D", props, usage),
    textureCube: (props, usage) => getContextResource("textureCube", props, usage),
    pass: (props, usage) => getContextResource("pass", props, usage),
    pipeline: (props, usage) => getContextResource("pipeline", props, usage),
    vertexBuffer: (props, usage) => getContextResource("vertexBuffer", props, usage),
    indexBuffer: (props, usage) => getContextResource("indexBuffer", props, usage),
    fullscreenTriangle: () => getResourceFromCache(fullscreenTriangle).value,
    //TODO: add resourceCache.release for Retained resources
  };

  const triangle = {
    positions: [
      [-1, -1],
      [3, -1],
      [-1, 3],
    ],
  };

  const fullscreenTriangle = {
    attributes: {
      aPosition: resourceCache.vertexBuffer(triangle.positions, Usage.Retained),
    },
    count: 3,
  };

  cache.push({
    type: "fullscreenTriangle",
    props: fullscreenTriangle,
    value: fullscreenTriangle,
    usage: Usage.Retained,
  });

  function beginFrame() {
    for (let i = 0; i < cache.length; i++) {
      cache[i].used = false;
    }
  }
  resourceCache.beginFrame = beginFrame;

  function endFrame() {
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
  }
  resourceCache.endFrame = endFrame;

  function dispose() {
    for (let i = 0; i < cache.length; i++) {
      if (cache[i].value._dispose) {
        ctx.dispose(cache[i].value);
      }
    }
    cache.length = 0;
  }

  resourceCache.dispose = dispose;

  return resourceCache;
}

export default function createBasicRendererSystem(opts) {
  const { ctx } = opts;

  const cache = [];

  function getCommand(opts) {
    let { instanced, hasInstancedColor, blending } = opts;
    //convert to integers for cache indices
    instanced = instanced ? 1 : 0;
    hasInstancedColor = hasInstancedColor ? 1 : 0;
    blending = blending ? 1 : 0;

    if (!cache[instanced]) {
      cache[instanced] = [];
    }
    if (!cache[instanced][hasInstancedColor]) {
      cache[instanced][hasInstancedColor] = [];
    }
    if (!cache[instanced][hasInstancedColor][blending]) {
      cache[instanced][hasInstancedColor][blending] = {
        name: `basic${instanced ? "Instanced" : ""}${
          hasInstancedColor ? "Color" : ""
        }${blending ? "Transparent" : ""}Cmd`,
        pipeline: makePipeline(opts),
      };
    }
    return cache[instanced][hasInstancedColor][blending];
  }

  function makePipeline(opts) {
    const { instanced, hasInstancedColor, blending } = opts;

    const instancedAttribs = /*glsl*/ `
      attribute vec3 aOffset;
      attribute vec3 aScale;
    `;

    const instancedColorAttribs = /*glsl*/ `
      attribute vec4 aColor;
    `;

    const instancedPosition = /*glsl*/ `
      position = position * aScale + aOffset;
    `;

    const instancedColor = /*glsl*/ `
      vColor *= aColor;
    `;

    const pipelineDescriptor = {
      vert: /*glsl*/ `
      attribute vec3 aPosition;
      ${instanced ? instancedAttribs : ""}
      ${instanced && hasInstancedColor ? instancedColorAttribs : ""}
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      uniform mat4 uModelMatrix;
      varying vec4 vColor;
      void main() {
        vColor = vec4(1.0);
        vec3 position = aPosition;
        ${instanced && hasInstancedColor ? instancedColor : ""}
        ${instanced ? instancedPosition : ""}
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
      }
      `,
      frag: /*glsl*/ `
      precision highp float;
      uniform vec4 uBaseColor;
      varying vec4 vColor;
      void main() {
        gl_FragData[0] = vColor * uBaseColor;
      }
      `,
      depthWrite: !blending,
      depthTest: true,
    };

    if (blending) {
      Object.assign(pipelineDescriptor, {
        blend: true,
        blendSrcRGBFactor: ctx.BlendFactor.One,
        blendSrcAlphaFactor: ctx.BlendFactor.One,
        blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
        blendDstAlphaFactor: ctx.BlendFactor.OneMinusSrcAlpha,
      });
    }

    return ctx.pipeline(pipelineDescriptor);
  }
  const basicRendererSystem = {
    type: "basic-renderer",
    renderStages: {
      opaque: (renderView, entities) => {
        const { camera } = renderView;
        entities.forEach((e) => {
          if (
            e.geometry &&
            e.material &&
            !e.material?.blend &&
            !e.drawSegments
          ) {
            const cmd = getCommand({
              instanced: e.geometry.instances,
              hasInstancedColor: e.geometry.colors,
              blending: false,
            });
            ctx.submit(cmd, {
              attributes: e._geometry.attributes,
              indices: e._geometry.indices,
              instances: e._geometry.instances,
              uniforms: {
                uBaseColor: e.material.baseColor,
                uProjectionMatrix: camera.projectionMatrix,
                uViewMatrix: camera.viewMatrix,
                uModelMatrix: e._transform.modelMatrix,
              },
            });
          }
        });
      },
      transparent: (renderView, entities) => {
        const { camera } = renderView;
        entities.forEach((e) => {
          if (e.geometry && e.material && e.material?.blend) {
            const cmd = getCommand({
              instanced: e.geometry.instances,
              hasInstancedColor: e.geometry.colors,
              blending: true,
            });
            ctx.submit(cmd, {
              attributes: e._geometry.attributes,
              indices: e._geometry.indices,
              instances: e._geometry.instances,
              uniforms: {
                uBaseColor: e.material.baseColor,
                uProjectionMatrix: camera.projectionMatrix,
                uViewMatrix: camera.viewMatrix,
                uModelMatrix: e._transform.modelMatrix,
              },
            });
          }
        });
      },
    },
    update: () => {},
  };
  return basicRendererSystem;
}

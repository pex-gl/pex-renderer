// TODO: move to pex-shaders
const instancedAttribs = /* glsl */ `attribute vec3 aOffset;
attribute vec3 aScale;`;
const instancedColorAttribs = /* glsl */ `attribute vec4 aColor;`;
const instancedPosition = /* glsl */ `position = position * aScale + aOffset;`;
const instancedColor = /* glsl */ `vColor *= aColor;`;

function getPipeline(ctx, { instanced, hasInstancedColor, blending }) {
  const pipelineDescriptor = {
    vert: /* glsl */ `attribute vec3 aPosition;
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
}`,
    frag: /* glsl */ `precision highp float;

uniform vec4 uBaseColor;

varying vec4 vColor;

void main() {
  gl_FragData[0] = vColor * uBaseColor;
}`,
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

function getCommand(ctx, cache, opts) {
  let { instanced, hasInstancedColor, blending } = opts;
  //convert to integers for cache indices
  instanced = instanced ? 1 : 0;
  hasInstancedColor = hasInstancedColor ? 1 : 0;
  blending = blending ? 1 : 0;

  cache[instanced] ||= [];
  cache[instanced][hasInstancedColor] ||= [];
  cache[instanced][hasInstancedColor][blending] ||= {
    name: `basic${instanced ? "Instanced" : ""}${
      hasInstancedColor ? "Color" : ""
    }${blending ? "Transparent" : ""}Cmd`,
    pipeline: getPipeline(ctx, opts),
  };
  return cache[instanced][hasInstancedColor][blending];
}

export default ({ ctx }) => {
  const basicRendererSystem = {
    type: "basic-renderer",
    cache: [],
    renderStages: {
      opaque: (renderView, entities) => {
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          if (
            entity.geometry &&
            entity.material &&
            !entity.material.blend &&
            entity.material.type !== "segments"
          ) {
            ctx.submit(
              getCommand(ctx, basicRendererSystem.cache, {
                instanced: entity.geometry.instances,
                hasInstancedColor: entity.geometry.colors,
                blending: false,
              }),
              {
                attributes: entity._geometry.attributes,
                indices: entity._geometry.indices,
                instances: entity._geometry.instances,
                uniforms: {
                  uBaseColor: entity.material.baseColor,
                  uProjectionMatrix: renderView.camera.projectionMatrix,
                  uViewMatrix: renderView.camera.viewMatrix,
                  uModelMatrix: entity._transform.modelMatrix,
                },
              }
            );
          }
        }
      },
      transparent: (renderView, entities) => {
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          if (
            entity.geometry &&
            entity.material &&
            entity.material.blend &&
            entity.material.type !== "segments"
          ) {
            ctx.submit(
              getCommand(ctx, basicRendererSystem.cache, {
                instanced: entity.geometry.instances,
                hasInstancedColor: entity.geometry.colors,
                blending: true,
              }),
              {
                attributes: entity._geometry.attributes,
                indices: entity._geometry.indices,
                instances: entity._geometry.instances,
                uniforms: {
                  uBaseColor: entity.material.baseColor,
                  uProjectionMatrix: renderView.camera.projectionMatrix,
                  uViewMatrix: renderView.camera.viewMatrix,
                  uModelMatrix: entity._transform.modelMatrix,
                },
              }
            );
          }
        }
      },
    },
    update: () => {},
  };

  return basicRendererSystem;
};

import { pipeline as SHADERS } from "pex-shaders";

import createBaseSystem from "./base.js";

// Impacts program caching
// prettier-ignore
const flagDefinitions = [
  [["options", "attachmentsLocations", "color"], "LOCATION_COLOR", { type: "value" }],
  [["options", "attachmentsLocations", "normal"], "LOCATION_NORMAL", { type: "value" }],
  [["options", "attachmentsLocations", "emissive"], "LOCATION_EMISSIVE", { type: "value" }],
  [["options", "toneMap"], "TONE_MAP", { type: "value" }],
];

const frag = /* glsl */`precision highp float;


#ifndef LOCATION_NORMAL
  #define LOCATION_NORMAL -1
#endif
#ifndef LOCATION_EMISSIVE
  #define LOCATION_EMISSIVE -1
#endif

#if (__VERSION__ >= 300)
  #define varying in

  #define texture2D texture
  #define textureCube texture
  #define texture2DProj textureProj


  // EXT_frag_depth
  #define gl_FragDepthEXT gl_FragDepth

  // EXT_shader_texture_lod
  #define texture2DLodEXT textureLod
  #define texture2DProjLodEXT textureProjLod
  #define textureCubeLodEXT textureLod
  #define texture2DGradEXT textureGrad
  #define texture2DProjGradEXT textureProjGrad
  #define textureCubeGradEXT textureGrad

  vec4 FragData[3];
  #define gl_FragData FragData
  #define gl_FragColor gl_FragData[0]

  layout (location = 0) out vec4 outColor;
  #if LOCATION_NORMAL >= 0
    layout (location = LOCATION_NORMAL) out vec4 outNormal;
  #endif
  #if LOCATION_EMISSIVE >= 0
    layout (location = LOCATION_EMISSIVE) out vec4 outEmissive;
  #endif
#endif


varying vec2 vTexCoord0;
uniform sampler2D uTexture;

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  gl_FragColor = textureLod(uTexture, vTexCoord0, 6.0);


#if (__VERSION__ >= 300)
  outColor = FragData[0];

  #if LOCATION_NORMAL >= 0
    outNormal = FragData[LOCATION_NORMAL];
  #endif
  #if LOCATION_EMISSIVE >= 0
    outEmissive = FragData[LOCATION_EMISSIVE];
  #endif
#endif


  #define HOOK_FRAG_END
}`

/**
 * Overlay renderer
 * @param {import("../../types.js").SystemOptions} options
 * @returns {import("../../types.js").RendererSystem}
 * @alias module:renderer.overlay
 */
export default ({ ctx, resourceCache }) => ({
  ...createBaseSystem(),
  type: "overlay-renderer",
  debug: false,
  flagDefinitions,
  getVertexShader: () => SHADERS.overlay.vert,
  getFragmentShader: () => frag,
  render(renderView, entities, options) {
    const renderableEntities = entities.filter(
      (entity) => entity.overlay?.texture,
    );

    const fullscreenQuad = resourceCache.fullscreenQuad();

    for (let i = 0; i < renderableEntities.length; i++) {
      const entity = renderableEntities[i];

      // Also computes this.uniforms
      const pipeline = this.getPipeline(ctx, entity, options);

      const overlay = entity.overlay;
      const bounds = [
        overlay.x || 0,
        overlay.y || 0,
        overlay.width || 0.35,
        overlay.height || 0.35,
      ];
      if (
        overlay.x > 1 ||
        overlay.y > 1 ||
        overlay.width > 1 ||
        overlay.height > 1
      ) {
        bounds[0] /= ctx.gl.drawingBufferWidth;
        bounds[1] /= ctx.gl.drawingBufferHeight;
        bounds[2] /= ctx.gl.drawingBufferWidth;
        bounds[3] /= ctx.gl.drawingBufferHeight;
      }
      // overlay coordinates are from top left corner so we need to flip y
      bounds[1] = 1.0 - bounds[1] - bounds[3];

      ctx.submit({
        pipeline,
        attributes: fullscreenQuad.attributes,
        indices: fullscreenQuad.indices,
        uniforms: {
          uBounds: bounds,
          uTexture: overlay.texture,
        },
      });
    }
  },
  renderOverlay(renderView, entities, options) {
    this.render(renderView, entities, {
      ...options,
      toneMap: renderView.toneMap,
      transparent: false,
    });
  },
});

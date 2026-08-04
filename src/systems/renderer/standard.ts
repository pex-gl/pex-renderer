import { mat3, mat4 } from "pex-math";
import { submit, createTexture, createSampler } from "pex-gpu";
import { pipeline as SHADERS } from "pex-shaders";

import createBaseSystem from "./base.js";
import { NAMESPACE, TEMP_MAT4 } from "../../utils.js";

const ALPHA_BLEND = {
  color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
};

// Reused per draw; uniforms pack synchronously at submit().
const NORMAL_MATRIX = mat3.create();
const IDENTITY_MAT4 = mat4.create();

// [r, g, b] stays as authored sRGB; the shader decodes it. The 4th component
// carries intensity (light.color.w), matching the WGSL light chunks.
const lightColor = (light) => [
  light.color[0],
  light.color[1],
  light.color[2],
  light.intensity,
];

/**
 * Standard renderer
 *
 * PBR draw path built on pex-shaders' `standard` WGSL generator. Uniforms use
 * the shared bind group struct convention: @group(0) Frame, @group(1) Lights,
 * @group(2) Material, @group(3) Model. Shadow maps are not rendered yet;
 * shadow-map bindings are satisfied with dummy textures and lights are drawn
 * unshadowed.
 *
 * @param options
 * @returns
 * @alias module:renderer.standard
 */
export default ({ ctx, shadowQuality = 4 }) => ({
  ...createBaseSystem(),
  type: "standard-renderer",
  debug: false,
  shadowQuality,
  debugRender: "",

  // Depth-format dummies to satisfy texture_depth_2d/cube bindings when a light
  // casts no shadow.
  dummyTexture2D: createTexture(ctx, {
    label: "dummyShadowMap2D",
    width: 4,
    height: 4,
    format: "depth32float",
  }),
  dummyTextureCube: createTexture(ctx, {
    label: "dummyShadowMapCube",
    width: 4,
    height: 4,
    depth: 6,
    viewDimension: "cube",
    format: "depth32float",
  }),
  // Cube maps use a plain sampler (manual compare); 2D maps use a comparison
  // sampler for hardware PCF.
  shadowSampler: createSampler(ctx, { filter: "nearest" }),
  shadowCompareSampler: createSampler(ctx, {
    filter: "linear",
    compare: "less-equal",
  }),
  ltcTextures: { ltc_1: null, ltc_2: null },
  isLoadingAreaLightData: null,

  // Depth-pass pipeline variants (shadow maps) keyed by their defines signature.
  depthPipelineCache: new Map(),

  async loadAreaLightData() {
    try {
      const { g_ltc_1, g_ltc_2 } = await import("./area-light-data.js");
      const options = { width: 64, height: 64, format: "rgba16float" };
      this.ltcTextures.ltc_1 = createTexture(ctx, {
        label: "areaLightMatTexture",
        data: g_ltc_1,
        ...options,
      });
      this.ltcTextures.ltc_2 = createTexture(ctx, {
        label: "areaLightMagTexture",
        data: g_ltc_2,
        ...options,
      });
    } catch (error) {
      console.error(NAMESPACE, error);
    }
  },

  getShader: (defines, options) => SHADERS.standard(defines, options),
  getShaderOptions(entity) {
    const { _lights, _locations } = this;
    return {
      lights: _lights.counts,
      locationNormal: _locations.normal ?? -1,
      locationEmissive: _locations.emissive ?? -1,
      texCoords: {},
    };
  },
  getDefines(entity) {
    const { material, _geometry: geometry } = entity;
    const { attributes } = geometry;
    const defines = new Set();

    // Lighting needs normals; fall back to unlit when the geometry lacks them.
    if (material.unlit || !attributes.normal) {
      defines.add("USE_UNLIT_WORKFLOW");
    } else {
      defines.add("USE_METALLIC_ROUGHNESS_WORKFLOW");
      defines.add("USE_NORMALS");
    }

    if (attributes.tangent) defines.add("USE_TANGENTS");
    if (attributes.texCoord0) defines.add("USE_TEXCOORD_0");
    if (attributes.texCoord1) defines.add("USE_TEXCOORD_1");
    if (attributes.vertexColor) defines.add("USE_VERTEX_COLORS");
    if (attributes.offset) defines.add("USE_INSTANCED_OFFSET");
    if (attributes.scale) defines.add("USE_INSTANCED_SCALE");
    if (attributes.rotation) defines.add("USE_INSTANCED_ROTATION");
    if (attributes.instanceColor) defines.add("USE_INSTANCED_COLOR");

    if (material.blend) defines.add("USE_BLEND");
    if (material.emissiveColor) defines.add("USE_EMISSIVE_COLOR");

    if (this._locations.normal >= 0 || this._locations.emissive >= 0) {
      defines.add("USE_DRAW_BUFFERS");
    }
    if (this._msaa) defines.add("USE_MSAA");

    return defines;
  },
  getVariantKey(entity, defines) {
    const { counts } = this._lights;
    return [
      [...defines].sort().join("|"),
      counts.ambient,
      counts.directional,
      counts.point,
      counts.spot,
      counts.area,
      this._locations.normal ?? -1,
      this._locations.emissive ?? -1,
    ].join("_");
  },
  isUnlit(entity) {
    return entity.material.unlit || !entity._geometry.attributes.normal;
  },
  getPipelineOptions(entity) {
    const { material } = entity;
    return {
      depthWriteEnabled: material.depthWrite !== false && !material.blend,
      cullMode: (material.cullFace ?? true) ? "back" : "none",
      ...(material.blend ? { blend: ALPHA_BLEND } : {}),
      // SHADOW_QUALITY only exists in the lit (non-unlit) shader.
      ...(this.isUnlit(entity)
        ? {}
        : {
            constants: {
              SHADOW_QUALITY: material.receiveShadows ? this.shadowQuality : 0,
            },
          }),
    };
  },

  // Builds the @group(1) uniform values: fixed-size struct arrays per light
  // type plus the individually-bound shadow maps (dummies for now).
  gatherLights(entities) {
    const ambient = entities.filter((e) => e.ambientLight);
    const directional = entities.filter((e) => e.directionalLight);
    const point = entities.filter((e) => e.pointLight);
    const spot = entities.filter((e) => e.spotLight);
    const area = entities.filter((e) => e.areaLight);

    // TODO(stage-2): area lights need LTC textures; rgba32float is
    // unfilterable-float and won't bind under the reflected "float" sample type
    // without the float32-filterable feature. Deferred with shadows.
    const ltcReady = this.ltcTextures.ltc_1 && this.ltcTextures.ltc_2;
    const areaActive = ltcReady ? area : [];

    const uniforms = {};

    if (ambient.length) {
      uniforms.uAmbientLights = ambient.map((e) => ({
        color: lightColor(e.ambientLight),
      }));
    }

    // 2D shadow fields shared by directional/spot/area, plus the bound map.
    const shadow2D = (light) => {
      const map = light.castShadows ? light._shadowMap : null;
      return {
        map: map || this.dummyTexture2D,
        castShadows: map ? 1 : 0,
        near: light._near ?? 0,
        far: light._far ?? 0,
        radiusUV: light._radiusUV ?? [0, 0],
        shadowMapSize: map ? [map.width, map.height] : [0, 0],
      };
    };

    if (directional.length) {
      uniforms.uDirectionalLights = directional.map((e) => {
        const light = e.directionalLight;
        const s = shadow2D(light);
        return {
          direction: light._direction,
          color: lightColor(light),
          projectionMatrix: light._projectionMatrix,
          viewMatrix: light._viewMatrix,
          castShadows: s.castShadows,
          near: s.near,
          far: s.far,
          radiusUV: s.radiusUV,
          shadowMapSize: s.shadowMapSize,
        };
      });
      directional.forEach((e, i) => {
        uniforms[`uDirectionalShadowMap${i}`] = shadow2D(
          e.directionalLight,
        ).map;
        uniforms[`uDirectionalShadowMap${i}Sampler`] =
          this.shadowCompareSampler;
      });
    }

    if (point.length) {
      uniforms.uPointLights = point.map((e) => {
        const light = e.pointLight;
        const map = light.castShadows ? light._shadowCubemap : null;
        return {
          position: e._transform.worldPosition,
          color: lightColor(light),
          range: light.range,
          castShadows: map ? 1 : 0,
          bias: light.bias ?? 0,
          radius: light.bulbRadius ?? 0,
          shadowMapSize: map ? [map.width, map.height] : [0, 0],
          // Normalizes the stored/compared radial distance (shadow-mapping.ts
          // writes length(view)/far into the cube).
          far: light._far ?? 0,
        };
      });
      point.forEach((e, i) => {
        const light = e.pointLight;
        uniforms[`uPointShadowMap${i}`] =
          (light.castShadows && light._shadowCubemap) || this.dummyTextureCube;
        uniforms[`uPointShadowMap${i}Sampler`] = this.shadowSampler;
      });
    }

    if (spot.length) {
      uniforms.uSpotLights = spot.map((e) => {
        const light = e.spotLight;
        const s = shadow2D(light);
        return {
          position: e._transform.worldPosition,
          direction: light._direction,
          color: lightColor(light),
          innerAngle: light.innerAngle,
          angle: light.angle,
          range: light.range,
          projectionMatrix: light._projectionMatrix,
          viewMatrix: light._viewMatrix,
          castShadows: s.castShadows,
          near: s.near,
          far: s.far,
          radiusUV: s.radiusUV,
          shadowMapSize: s.shadowMapSize,
        };
      });
      spot.forEach((e, i) => {
        uniforms[`uSpotShadowMap${i}`] = shadow2D(e.spotLight).map;
        uniforms[`uSpotShadowMap${i}Sampler`] = this.shadowCompareSampler;
      });
    }

    if (areaActive.length) {
      uniforms.uLtc1 = this.ltcTextures.ltc_1;
      uniforms.uLtc1Sampler = this.shadowSampler;
      uniforms.uLtc2 = this.ltcTextures.ltc_2;
      uniforms.uLtc2Sampler = this.shadowSampler;
      uniforms.uAreaLights = areaActive.map((e) => {
        const light = e.areaLight;
        return {
          position: e.transform.position,
          color: lightColor(light),
          rotation: e.transform.rotation,
          size: [e.transform.scale[0] / 2, e.transform.scale[1] / 2],
          disk: light.disk ? 1 : 0,
          doubleSided: light.doubleSided ? 1 : 0,
          projectionMatrix: light._projectionMatrix,
          viewMatrix: light._viewMatrix,
          castShadows: 0,
          near: 0,
          far: 0,
          radiusUV: [0, 0],
          shadowMapSize: [0, 0],
        };
      });
      areaActive.forEach((_, i) => {
        uniforms[`uAreaShadowMap${i}`] = this.dummyTexture2D;
        uniforms[`uAreaShadowMap${i}Sampler`] = this.shadowCompareSampler;
      });
    }

    return {
      uniforms,
      counts: {
        ambient: ambient.length,
        directional: directional.length,
        point: point.length,
        spot: spot.length,
        area: areaActive.length,
      },
    };
  },

  getMaterialUniforms(entity) {
    const { material } = entity;
    if (this.isUnlit(entity)) return { baseColor: material.baseColor };

    const uniforms = {
      baseColor: material.baseColor,
      metallic: material.metallic ?? 1,
      roughness: material.roughness ?? 1,
      ior: material.ior ?? 1.5,
    };
    if (material.emissiveColor) {
      uniforms.emissiveColor = material.emissiveColor;
      uniforms.emissiveIntensity = material.emissiveIntensity ?? 1;
    }
    return uniforms;
  },

  render(renderView, entities, options) {
    const { camera, cameraEntity, viewport } = renderView;
    const { attachmentsLocations = {}, msaa, transparent } = options;

    this._msaa = msaa;
    this._locations = {
      normal: attachmentsLocations.normal ?? -1,
      emissive: attachmentsLocations.emissive ?? -1,
    };

    const lights = this.gatherLights(entities);
    this._lights = lights;

    const uFrame = {
      projectionMatrix: camera.projectionMatrix,
      viewMatrix: camera.viewMatrix,
      inverseViewMatrix: camera.invViewMatrix || camera.inverseViewMatrix,
      cameraPosition: cameraEntity._transform.worldPosition,
      viewportSize: [viewport[2], viewport[3]],
    };

    const renderableEntities = entities.filter(
      (e) =>
        e.geometry &&
        e.material &&
        e.material.type === undefined &&
        !e.material.transmission &&
        (transparent ? e.material.blend : !e.material.blend),
    );

    for (let i = 0; i < renderableEntities.length; i++) {
      const entity = renderableEntities[i];
      const pipeline = this.getPipeline(ctx, entity, options);

      // View-space normal matrix: mat3(transpose(inverse(view * model))).
      mat4.set(TEMP_MAT4, uFrame.viewMatrix);
      mat4.mult(TEMP_MAT4, entity._transform.modelMatrix);
      mat4.invert(TEMP_MAT4);
      mat4.transpose(TEMP_MAT4);

      submit(ctx, {
        name: transparent
          ? "drawTransparentGeometryCmd"
          : "drawOpaqueGeometryCmd",
        pipeline,
        attributes: entity._geometry.attributes,
        indices: entity._geometry.indices,
        count: entity._geometry.count,
        instanceCount: entity._geometry.instances,
        uniforms: {
          uFrame,
          uModel: {
            modelMatrix: entity._transform.modelMatrix,
            normalMatrix: mat3.fromMat4(NORMAL_MATRIX, TEMP_MAT4),
          },
          uMaterial: this.getMaterialUniforms(entity),
          ...lights.uniforms,
        },
      });
    }
  },
  renderOpaque(renderView, entities, options) {
    this.render(renderView, entities, { ...options, transparent: false });
  },
  renderTransparent(renderView, entities, options) {
    this.render(renderView, entities, { ...options, transparent: true });
  },
  // `linear` selects the omni (point) variant: a fragment stage stores
  // normalized radial distance instead of clip depth (see depthPass). `bias`
  // is the light's slope-scaled shadow bias, unused by the linear variant.
  getDepthPipeline(entity, linear, bias) {
    const { attributes } = entity._geometry;
    // Depth pass only cares about position-affecting features.
    const defines = new Set();
    if (attributes.offset) defines.add("USE_INSTANCED_OFFSET");
    if (attributes.scale) defines.add("USE_INSTANCED_SCALE");
    if (attributes.rotation) defines.add("USE_INSTANCED_ROTATION");
    if (linear) defines.add("USE_LINEAR_DEPTH");

    const key = [...defines].sort().join("|");
    let pipeline = this.depthPipelineCache.get(key);
    if (!pipeline) {
      const shader = SHADERS.depthPass(defines, {});
      // 2D maps are vertex-only; the linear variant needs a fragment stage to
      // write frag_depth.
      pipeline = linear
        ? { vertex: shader, fragment: shader }
        : { vertex: shader };
      this.depthPipelineCache.set(key, pipeline);
    }
    pipeline.depthWriteEnabled = true;
    pipeline.cullMode = (entity.material.cullFace ?? true) ? "back" : "none";
    if (linear) {
      // The cube-face projection is Y-flipped to match the depth-cube sampler
      // (see shadow-mapping.ts), which reverses winding; skip culling so the flip
      // can't drop caster faces.
      pipeline.cullMode = "none";
      // Writing frag_depth bypasses rasterizer depth bias; the point shader
      // biases its compare instead.
      pipeline.depthBias = 0;
      pipeline.depthBiasSlopeScale = 0;
    } else {
      // Rasterizer depth bias replaces shader-side shadow bias: a flat constant
      // term plus the light's slope-scaled term (handles grazing angles). Too
      // much detaches the shadow from the contact point (peter-panning).
      pipeline.depthBias = 1;
      pipeline.depthBiasSlopeScale = bias;
    }
    return pipeline;
  },

  // Depth-only pass into a light's shadow map. renderView.camera carries the
  // light's projection/view matrices; point lights (cubemap) store normalized
  // radial distance and need the light's far plane in uFrame.
  renderShadow(renderView, entities, options = {}) {
    const { camera, viewport } = renderView;
    const light = options.shadowMappingLight;
    const linear = !!light?._shadowCubemap;

    const uFrame = {
      projectionMatrix: camera.projectionMatrix,
      viewMatrix: camera.viewMatrix,
      inverseViewMatrix: camera.invViewMatrix || IDENTITY_MAT4,
      cameraPosition: [0, 0, 0],
      viewportSize: [viewport[2], viewport[3]],
      ...(linear ? { far: light._far } : {}),
    };

    const casters = entities.filter(
      (e) =>
        e.geometry &&
        e.material?.castShadows &&
        e.material.type === undefined &&
        e._geometry &&
        e._transform,
    );

    for (let i = 0; i < casters.length; i++) {
      const entity = casters[i];
      submit(ctx, {
        name: "drawShadowGeometryCmd",
        pipeline: this.getDepthPipeline(entity, linear, light?.bias ?? 1),
        attributes: entity._geometry.attributes,
        indices: entity._geometry.indices,
        count: entity._geometry.count,
        instanceCount: entity._geometry.instances,
        uniforms: {
          uFrame,
          uModel: {
            modelMatrix: entity._transform.modelMatrix,
            normalMatrix: mat3.fromMat4(
              NORMAL_MATRIX,
              entity._transform.modelMatrix,
            ),
          },
        },
      });
    }
  },
  dispose() {
    this.dummyTexture2D.dispose();
    this.dummyTextureCube.dispose();
    this.ltcTextures.ltc_1?.dispose();
    this.ltcTextures.ltc_2?.dispose();
    this.pipelineCache.clear();
    this.depthPipelineCache.clear();
  },
});

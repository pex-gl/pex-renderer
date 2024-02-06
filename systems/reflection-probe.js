import { mat4 } from "pex-math";
import {
  pipeline,
  reflectionProbe as SHADERS,
  parser as ShaderParser,
} from "pex-shaders";

import hammersley from "hammersley";
import { CUBEMAP_SIDES } from "../utils.js";

const IRRADIANCE_OCT_MAP_SIZE = 64;

const NUM_SAMPLES = 128;
const hammersleyPointSet = new Float32Array(4 * NUM_SAMPLES);
for (let i = 0; i < NUM_SAMPLES; i++) {
  const p = hammersley(i, NUM_SAMPLES);
  hammersleyPointSet[i * 4] = p[0];
  hammersleyPointSet[i * 4 + 1] = p[1];
}

class ReflectionProbe {
  constructor(opts) {
    this.enabled = true;
    this.rgbm = false;
    this.size = 1024;

    this.set(opts);

    const ctx = opts.ctx;
    this._ctx = ctx;
    this.dirty = true;

    this.initCubemap();
    this.initOctMap();
    this.initCommands();
  }

  init(entity) {
    this.entity = entity;
  }

  set(opts) {
    Object.assign(this, opts);
  }

  initCubemap() {
    const ctx = this._ctx;

    this._dynamicCubemap = ctx.textureCube({
      name: "reflectionProbeDynamicCubeMap",
      width: this.size,
      height: this.size,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    });

    this._dynamicCubemapSides = structuredClone(CUBEMAP_SIDES).map(
      (side, i) => {
        side.viewMatrix = mat4.lookAt(
          mat4.create(),
          side.eye,
          side.target,
          side.up,
        );
        side.drawPassCmd = {
          name: `reflectionProbeCubemapSideCmd${i}`,
          pass: ctx.pass({
            name: `reflectionProbeCubemapSidePass${i}`,
            color: [
              {
                texture: this._dynamicCubemap,
                target: ctx.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
              },
            ],
            clearColor: [0, 0, 0, 1],
            clearDepth: 1,
          }),
        };
        return side;
      },
    );
  }

  initOctMap() {
    const ctx = this._ctx;

    this._octMap = ctx.texture2D({
      name: "reflectionProbeOctMap",
      width: this.size,
      height: this.size,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    });

    this._reflectionMap = ctx.texture2D({
      name: "reflectionProbeReflectionMap",
      width: 2 * this.size,
      height: 2 * this.size,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    });

    this._hammersleyPointSetMap = ctx.texture2D({
      name: "reflectionProbeHammersleyPointSetMap",
      data: hammersleyPointSet,
      width: 1,
      height: NUM_SAMPLES,
      pixelFormat: ctx.PixelFormat.RGBA32F,
      encoding: ctx.Encoding.Linear,
    });
  }

  initCommands() {
    const ctx = this._ctx;

    const fullscreenTriangle = this.resourceCache.fullscreenTriangle();
    const attributes = fullscreenTriangle.attributes;
    const count = fullscreenTriangle.count;
    const vert = ShaderParser.build(ctx, pipeline.blit.vert);

    this.clearOctMapAtlasCmd = {
      name: "reflectionProbeClearOctMapAtlasCmd",
      pass: ctx.pass({
        name: "reflectionProbeClearOctMapAtlasPass",
        color: [this._reflectionMap],
        clearColor: [0, 0, 0, 0],
      }),
    };

    this.cubemapToOctMapCmd = {
      name: "reflectionProbeCubemapToOctMapCmd",
      pass: ctx.pass({
        name: "reflectionProbeCubemapToOctMapPass",
        color: [this._octMap],
      }),
      pipeline: ctx.pipeline({
        vert,
        frag: ShaderParser.build(ctx, SHADERS.cubemapToOctMap.frag),
      }),
      attributes,
      count,
      uniforms: {
        uCubemap: this._dynamicCubemap,
      },
    };

    this.convolveOctmapAtlasToOctMapCmd = {
      name: "reflectionProbeConvolveOctmapAtlasToOctMapCmd",
      pass: ctx.pass({
        name: "reflectionProbeConvolveOctmapAtlasToOctMapPass",
        color: [this._octMap],
      }),
      pipeline: ctx.pipeline({
        vert,
        frag: ShaderParser.build(ctx, SHADERS.convolveOctMapAtlasToOctMap.frag),
      }),
      attributes,
      count,
      uniforms: {
        uIrradianceOctMapSize: IRRADIANCE_OCT_MAP_SIZE,
        uOctMapAtlas: this._reflectionMap,
      },
    };

    this.blitToOctMapAtlasCmd = {
      name: "reflectionProbeBlitToOctMapAtlasCmd",
      pass: ctx.pass({
        name: "reflectionProbeBlitToOctMapAtlasPass",
        color: [this._reflectionMap],
      }),
      pipeline: ctx.pipeline({
        vert,
        frag: ShaderParser.build(ctx, SHADERS.blitToOctMapAtlas.frag),
      }),
      uniforms: {
        uOctMap: this._octMap,
      },
      attributes,
      count,
    };

    this.downsampleFromOctMapAtlasCmd = {
      name: "reflectionProbeDownsampleFromOctMapAtlasCmd",
      pass: ctx.pass({
        name: "reflectionProbeDownsampleFromOctMapAtlasPass",
        color: [this._octMap],
        clearColor: [0, 0, 0, 1],
      }),
      pipeline: ctx.pipeline({
        vert,
        frag: ShaderParser.build(ctx, SHADERS.downsampleFromOctMapAtlas.frag),
      }),
      uniforms: {
        uOctMapAtlas: this._reflectionMap,
      },
      attributes,
      count,
    };

    this.prefilterFromOctMapAtlasCmd = {
      name: "reflectionProbePrefilterFromOctMapAtlasCmd",
      pass: ctx.pass({
        name: "reflectionProbePrefilterFromOctMapAtlasPass",
        color: [this._octMap],
        clearColor: [0, 0, 0, 1],
      }),
      pipeline: ctx.pipeline({
        vert,
        frag: ShaderParser.build(ctx, SHADERS.prefilterFromOctMapAtlas.frag),
      }),
      uniforms: {
        uOctMapAtlas: this._reflectionMap,
      },
      attributes,
      count,
    };
  }

  // sourceRegionSize - as we downsample the octmap we recycle the fully size octMap
  // but use only 1/2, 1/4, 1/8 of it, so when we blit it back to atlas we need to know
  // which part is downsampled data (and the rest is garbage from previous iterations)
  blitToOctMapAtlasLevel(mipmapLevel, roughnessLevel, sourceRegionSize) {
    const width = this._reflectionMap.width;
    // TODO: consider removing as it should match sourceRegionSize
    const levelSize = Math.max(
      64,
      width / 2 ** (1 + mipmapLevel + roughnessLevel),
    );
    const roughnessLevelWidth = width / 2 ** (1 + roughnessLevel);
    const vOffset = width - 2 ** (Math.log2(width) - roughnessLevel);
    const hOffset =
      2 * roughnessLevelWidth -
      2 ** (Math.log2(2 * roughnessLevelWidth) - mipmapLevel);

    this._ctx.submit(this.blitToOctMapAtlasCmd, {
      viewport: [hOffset, vOffset, levelSize, levelSize],
      uniforms: {
        uOctMapSize: this._octMap.width,
        uSourceRegionSize: sourceRegionSize,
      },
    });
  }

  downsampleFromOctMapAtlasLevel(
    mipmapLevel,
    roughnessLevel,
    targetRegionSize,
  ) {
    this._ctx.submit(this.downsampleFromOctMapAtlasCmd, {
      viewport: [0, 0, targetRegionSize, targetRegionSize],
      uniforms: {
        uOctMapAtlasSize: this._reflectionMap.width,
        uMipmapLevel: mipmapLevel,
        uRoughnessLevel: roughnessLevel,
      },
    });
  }

  prefilterFromOctMapAtlasLevel(
    sourceMipmapLevel,
    sourceRoughnessLevel,
    roughnessLevel,
    targetRegionSize,
  ) {
    this._ctx.submit(this.prefilterFromOctMapAtlasCmd, {
      viewport: [0, 0, targetRegionSize, targetRegionSize],
      uniforms: {
        uOctMapAtlasSize: this._reflectionMap.width,
        uOctMapAtlasEncoding: this._reflectionMap.encoding,
        uOutputEncoding: this._octMap.encoding,
        uNumSamples: NUM_SAMPLES, // TODO: either make constant in shader or make it configurable
        uHammersleyPointSetMap: this._hammersleyPointSetMap,
        uSourceMipmapLevel: sourceMipmapLevel,
        uSourceRoughnessLevel: sourceRoughnessLevel,
        uRoughnessLevel: roughnessLevel,
      },
    });
  }

  update(drawScene) {
    this.dirty = false;

    const ctx = this._ctx;

    for (let i = 0; i < this._dynamicCubemapSides.length; i++) {
      const side = this._dynamicCubemapSides[i];
      ctx.submit(side.drawPassCmd, () =>
        drawScene(side, this._dynamicCubemap.encoding),
      );
    }

    ctx.submit(this.cubemapToOctMapCmd, {
      uniforms: { uTextureSize: this.size },
    });

    ctx.submit(this.clearOctMapAtlasCmd);

    const maxLevel = Math.log2(this.size) - Math.log2(32);
    this.blitToOctMapAtlasLevel(0, 0, this.size);

    // Mipmap (horizontally)
    for (let i = 0; i < maxLevel - 1; i++) {
      const size = this.size / 2 ** (i + 1);
      this.downsampleFromOctMapAtlasLevel(i, 0, size);
      this.blitToOctMapAtlasLevel(i + 1, 0, size);
    }
    // we copy last level without downsampling it as it
    // doesn't makes sense to have octahedral maps smaller than 64x64
    this.blitToOctMapAtlasLevel(maxLevel, 0, 64);

    // Roughness (vertically)
    for (let i = 1; i <= maxLevel; i++) {
      const size = Math.max(64, this.size / 2 ** i);
      this.prefilterFromOctMapAtlasLevel(0, Math.max(0, i - 1), i, size);
      this.blitToOctMapAtlasLevel(0, i, size);
    }

    ctx.submit(this.convolveOctmapAtlasToOctMapCmd, {
      uniforms: {
        uOctMapAtlasSize: this._reflectionMap.width,
        uOctMapAtlasEncoding: this._reflectionMap.encoding,
        uOutputEncoding: this._octMap.encoding,
      },
      viewport: [0, 0, IRRADIANCE_OCT_MAP_SIZE, IRRADIANCE_OCT_MAP_SIZE],
    });

    ctx.submit(this.blitToOctMapAtlasCmd, {
      viewport: [
        this._reflectionMap.width - IRRADIANCE_OCT_MAP_SIZE,
        this._reflectionMap.height - IRRADIANCE_OCT_MAP_SIZE,
        IRRADIANCE_OCT_MAP_SIZE,
        IRRADIANCE_OCT_MAP_SIZE,
      ],
      uniforms: {
        uOctMapSize: this._octMap.width,
        uSourceRegionSize: IRRADIANCE_OCT_MAP_SIZE,
      },
    });
  }

  resize(size) {
    if (!size) return;
    const ctx = this._ctx;
    this.size = size;
    ctx.update(this._dynamicCubemap, { width: size, height: size });
    ctx.update(this._octMap, { width: size, height: size });
    ctx.update(this._reflectionMap, { width: size * 2, height: size * 2 });
  }
}

/**
 * Reflection Probe system
 *
 * Adds:
 * - "_reflectionProbe" to reflectionProbe components
 * @param {import("../types.js").SystemOptions} options
 * @returns {import("../types.js").System}
 * @alias module:systems.reflectionProbe
 */
export default ({ ctx, resourceCache }) => ({
  type: "reflection-probe-system",
  cache: {},
  debug: false,
  updateReflectionProbeEntity(entity, skyboxEntities, options) {
    // Initialise
    if (!this.cache[entity.id] || !entity._reflectionProbe) {
      this.cache[entity.id] = {};
      entity._reflectionProbe = new ReflectionProbe({
        ...entity.reflectionProbe,
        ctx,
        resourceCache,
      });
    }

    // Compare
    // TODO: also check for rgbm change?
    if (entity._reflectionProbe.size !== entity.reflectionProbe.size) {
      entity._reflectionProbe.resize(entity.reflectionProbe.size);
      entity.reflectionProbe.dirty = true;
    }

    const skyboxEntity = skyboxEntities[0];

    if (!skyboxEntity) return;

    if (this.cache[entity.id].skyboxEnvMap !== skyboxEntity.skybox.envMap) {
      this.cache[entity.id].skyboxEnvMap = skyboxEntity.skybox.envMap;
      entity.reflectionProbe.dirty = true;
    }

    if (this.cache[entity.id].skyboxExposure !== skyboxEntity.skybox.exposure) {
      this.cache[entity.id].skyboxExposure = skyboxEntity.skybox.exposure;
      entity.reflectionProbe.dirty = true;
    }

    // Update and render
    if (
      // TODO: data ownership reflectionProbe vs _reflectionProbe
      entity._reflectionProbe.dirty || // From ReflectionProbe instance
      entity.reflectionProbe.dirty || // From user
      skyboxEntity.skybox.dirty || // From user
      skyboxEntity.skybox._skyTextureChanged // From skybox system
    ) {
      entity.reflectionProbe.dirty = false;
      entity._reflectionProbe.dirty = false;

      let { renderers = [] } = options;
      entity._reflectionProbe.update((camera, encoding) => {
        const renderView = {
          camera: camera,
          outputEncoding: encoding,
        };
        // should be only skybox renderers
        for (let i = 0; i < renderers.length; i++) {
          renderers[i].renderBackground?.(renderView, skyboxEntities, {
            attachmentsLocations: { color: 0 },
            renderingToReflectionProbe: true,
          });
        }
        if (skyboxEntities.length > 0) {
          // TODO: drawing skybox inside reflection probe
          // skyboxEntities[0]._skybox.draw(camera, {
          //   outputEncoding: encoding,
          //   backgroundMode: false,
          // });
        }
      });
    }
  },
  update(entities, options = {}) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.reflectionProbe) {
        const skyboxEntities = entities.filter(
          (skyboxEntity) =>
            skyboxEntity.skybox &&
            (!entity.layer || entity.layer == skyboxEntity.layer),
        );

        this.updateReflectionProbeEntity(entity, skyboxEntities, options);
      }
    }
  },
});

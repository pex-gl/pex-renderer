import { vec3, mat4 } from "pex-math";
// import { reflectionProbe as SHADERS } from "pex-shaders";
import {
  pipeline,
  reflectionProbe as SHADERS,
} from "./renderer/pex-shaders/index.js";

import hammersley from "hammersley";
import { CUBEMAP_SIDES, quad } from "../utils.js";

const IRRADIANCE_OCT_MAP_SIZE = 64;

const NUM_SAMPLES = 1024; //TODO: it was 128, check on mobile if it doesn't hang at 1024
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
          side.up
        );
        side.drawPassCmd = {
          name: `ReflectionProbe.cubemapSide_${i}`,
          pass: ctx.pass({
            name: `ReflectionProbe.cubemapSide_${i}`,
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
      }
    );
  }

  initOctMap() {
    const ctx = this._ctx;

    this._octMap = ctx.texture2D({
      width: this.size,
      height: this.size,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    });

    this._reflectionMap = ctx.texture2D({
      width: 2 * this.size,
      height: 2 * this.size,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    });

    this._hammersleyPointSetMap = ctx.texture2D({
      data: hammersleyPointSet,
      width: 1,
      height: NUM_SAMPLES,
      pixelFormat: ctx.PixelFormat.RGBA32F,
      encoding: ctx.Encoding.Linear,
    });
  }

  initCommands() {
    const ctx = this._ctx;

    const attributes = {
      aPosition: ctx.vertexBuffer(quad.positions),
      aTexCoord0: ctx.vertexBuffer(quad.uvs),
    };

    const indices = ctx.indexBuffer(quad.cells);

    this.clearOctMapAtlasCmd = {
      name: "ReflectionProbe.clearOctMapAtlas",
      pass: ctx.pass({
        name: "ReflectionProbe.clearOctMapAtlas",
        color: [this._reflectionMap],
        clearColor: [0, 0, 0, 0],
      }),
    };

    this.cubemapToOctMapCmd = {
      name: "ReflectionProbe.cubemapToOctMap",
      pass: ctx.pass({
        name: "ReflectionProbe.cubemapToOctMap",
        color: [this._octMap],
      }),
      pipeline: ctx.pipeline({
        vert: pipeline.fullscreen.vert,
        frag: SHADERS.cubemapToOctMap.frag,
      }),
      attributes,
      indices,
      uniforms: {
        uCubemap: this._dynamicCubemap,
      },
    };

    this.convolveOctmapAtlasToOctMapCmd = {
      name: "ReflectionProbe.convolveOctmapAtlasToOctMap",
      pass: ctx.pass({
        name: "ReflectionProbe.convolveOctmapAtlasToOctMap",
        color: [this._octMap],
      }),
      pipeline: ctx.pipeline({
        vert: pipeline.fullscreen.vert,
        frag: SHADERS.convolveOctMapAtlasToOctMap.frag,
      }),
      attributes,
      indices,
      uniforms: {
        uIrradianceOctMapSize: IRRADIANCE_OCT_MAP_SIZE,
        uOctMapAtlas: this._reflectionMap,
      },
    };

    this.blitToOctMapAtlasCmd = {
      name: "ReflectionProbe.blitToOctMapAtlasCmd",
      pass: ctx.pass({
        name: "ReflectionProbe.blitToOctMapAtlasCmd",
        color: [this._reflectionMap],
      }),
      pipeline: ctx.pipeline({
        vert: pipeline.fullscreen.vert,
        frag: SHADERS.blitToOctMapAtlas.frag,
      }),
      uniforms: {
        uOctMap: this._octMap,
      },
      attributes,
      indices,
    };

    this.downsampleFromOctMapAtlasCmd = {
      name: "ReflectionProbe.downsampleFromOctMapAtlasCmd",
      pass: ctx.pass({
        name: "ReflectionProbe.downsampleFromOctMapAtlasCmd",
        color: [this._octMap],
        clearColor: [0, 0, 0, 1],
      }),
      pipeline: ctx.pipeline({
        vert: pipeline.fullscreen.vert,
        frag: SHADERS.downsampleFromOctMapAtlas.frag,
      }),
      uniforms: {
        uOctMapAtlas: this._reflectionMap,
      },
      attributes,
      indices,
    };

    this.prefilterFromOctMapAtlasCmd = {
      name: "ReflectionProbe.prefilterFromOctMapAtlasCmd",
      pass: ctx.pass({
        name: "ReflectionProbe.prefilterFromOctMapAtlasCmd",
        color: [this._octMap],
        clearColor: [0, 0, 0, 1],
      }),
      pipeline: ctx.pipeline({
        vert: pipeline.fullscreen.vert,
        frag: SHADERS.prefilterFromOctMapAtlas.frag,
      }),
      uniforms: {
        uOctMapAtlas: this._reflectionMap,
      },
      attributes,
      indices,
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
      width / 2 ** (1 + mipmapLevel + roughnessLevel)
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
    targetRegionSize
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
    targetRegionSize
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
        drawScene(side, this._dynamicCubemap.encoding)
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

export default ({ ctx }) => ({
  type: "reflection-probe-system",
  cache: {},
  debug: false,
  update(entities, opts = {}) {
    let { renderers = [] } = opts;

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity.reflectionProbe) continue;

      const skyboxEntities = entities
        .filter((e) => e.skybox)
        .filter(
          (skyboxEntity) => !entity.layer || entity.layer == skyboxEntity.layer
        );
      const skyboxEntity = skyboxEntities[0];

      let cachedProps = this.cache[entity.id];
      if (!cachedProps || !entity._reflectionProbe) {
        cachedProps = this.cache[entity.id] = {
          skyboxSunPosition: [0, 0, 0],
        };
        const reflectionProbe = new ReflectionProbe({
          ...entity.reflectionProbe,
          ctx,
        });
        entity._reflectionProbe = reflectionProbe;
      }

      // TODO: also check for rgbm change?
      if (entity._reflectionProbe.size !== entity.reflectionProbe.size) {
        entity._reflectionProbe.resize(entity.reflectionProbe.size);
        entity.reflectionProbe.dirty = true;
      }

      if (!skyboxEntity) continue;

      // TODO: this should be just node.reflectionProbe
      // TODO: data ownership reflectionProbe vs _reflectionProbe
      let needsUpdate =
        entity.reflectionProbe.dirty || entity._reflectionProbe.dirty;

      if (
        vec3.distance(
          cachedProps.skyboxSunPosition,
          skyboxEntity.skybox.sunPosition
        ) > 0
      ) {
        vec3.set(
          cachedProps.skyboxSunPosition,
          skyboxEntity.skybox.sunPosition
        );
        needsUpdate = true;
      }

      if (cachedProps.skyboxEnvMap != skyboxEntity.skybox.envMap) {
        cachedProps.skyboxEnvMap = skyboxEntity.skybox.envMap;
        needsUpdate = true;
      }

      if (needsUpdate) {
        entity.reflectionProbe.dirty = false;
        entity._reflectionProbe.dirty = false;
        entity._reflectionProbe.update((camera, encoding) => {
          const renderView = {
            camera: camera,
            outputEncoding: encoding,
          };
          // should be only skybox renderers
          for (let i = 0; i < renderers.length; i++) {
            const renderer = renderers[i];
            if (renderer.renderStages.background) {
              renderer.renderStages.background(renderView, skyboxEntities, {
                renderingToReflectionProbe: true,
              });
            }
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
    }
  },
});

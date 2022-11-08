import { vec3, mat4 } from "pex-math";
// import { reflectionProbe as SHADERS } from "pex-shaders";
import { reflectionProbe as SHADERS } from "./renderer/pex-shaders/index.js";

import hammersley from "hammersley";

// TODO: primitive-geometry
const quadPositions = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
const quadTexCoords = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
// TODO: is that correct CCW?
const quadFaces = [
  [0, 1, 2],
  [0, 2, 3],
];

const IRRADIANCE_OCT_MAP_SIZE = 64;

class ReflectionProbe {
  constructor(opts) {
    this.type = "ReflectionProbe";
    this.enabled = true;
    this.rgbm = false;
    this.size = 1024 * 2;

    this.set(opts);

    const ctx = opts.ctx;
    this._ctx = ctx;
    this.dirty = true;

    const dynamicCubemap = (this._dynamicCubemap = ctx.textureCube({
      width: this.size,
      height: this.size,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    }));

    const sides = [
      { eye: [0, 0, 0], target: [1, 0, 0], up: [0, -1, 0] },
      { eye: [0, 0, 0], target: [-1, 0, 0], up: [0, -1, 0] },
      { eye: [0, 0, 0], target: [0, 1, 0], up: [0, 0, 1] },
      { eye: [0, 0, 0], target: [0, -1, 0], up: [0, 0, -1] },
      { eye: [0, 0, 0], target: [0, 0, 1], up: [0, -1, 0] },
      { eye: [0, 0, 0], target: [0, 0, -1], up: [0, -1, 0] },
    ].map((side, i) => {
      side.projectionMatrix = mat4.perspective(
        mat4.create(),
        Math.PI / 2,
        1,
        0.1,
        100
      );
      side.viewMatrix = mat4.lookAt(
        mat4.create(),
        side.eye,
        side.target,
        side.up
      );
      side.drawPassCmd = {
        name: "ReflectionProbe.sidePass",
        pass: ctx.pass({
          name: "ReflectionProbe.sidePass",
          color: [
            {
              texture: dynamicCubemap,
              target: ctx.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
            },
          ],
          clearColor: [0, 0, 0, 1],
          clearDepth: 1,
        }),
      };
      return side;
    });

    const attributes = {
      aPosition: ctx.vertexBuffer(quadPositions),
      aTexCoord: ctx.vertexBuffer(quadTexCoords),
    };

    const indices = ctx.indexBuffer(quadFaces);

    const octMap = (this._octMap = ctx.texture2D({
      width: this.size,
      height: this.size,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    }));

    const octMapAtlas = (this._reflectionMap = ctx.texture2D({
      width: 2 * this.size,
      height: 2 * this.size,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
      pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
      encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    }));

    const cubemapToOctMap = {
      name: "ReflectionProbe.cubemapToOctMap",
      pass: ctx.pass({
        name: "ReflectionProbe.cubemapToOctMap",
        color: [octMap],
      }),
      pipeline: ctx.pipeline({
        vert: SHADERS.fullscreenQuad.vert,
        frag: SHADERS.cubemapToOctMap.frag,
      }),
      attributes,
      indices,
      uniforms: {
        uTextureSize: this.size,
        uCubemap: dynamicCubemap,
      },
    };

    const convolveOctmapAtlasToOctMap = {
      name: "ReflectionProbe.convolveOctmapAtlasToOctMap",
      pass: ctx.pass({
        name: "ReflectionProbe.convolveOctmapAtlasToOctMap",
        color: [octMap],
      }),
      pipeline: ctx.pipeline({
        vert: SHADERS.fullscreenQuad.vert,
        frag: SHADERS.convolveOctMapAtlasToOctMap.frag,
      }),
      attributes,
      indices,
      uniforms: {
        uIrradianceOctMapSize: IRRADIANCE_OCT_MAP_SIZE,
        uOctMapAtlas: octMapAtlas,
        uOctMapAtlasSize: octMapAtlas.width,
        uOctMapAtlasEncoding: octMapAtlas.encoding,
        uOutputEncoding: octMap.encoding,
      },
    };

    const clearOctMapAtlasCmd = {
      name: "ReflectionProbe.clearOctMapAtlas",
      pass: ctx.pass({
        name: "ReflectionProbe.clearOctMapAtlas",
        color: [octMapAtlas],
        clearColor: [0, 0, 0, 0],
      }),
    };

    const blitToOctMapAtlasCmd = {
      name: "ReflectionProbe.blitToOctMapAtlasCmd",
      pass: ctx.pass({
        name: "ReflectionProbe.blitToOctMapAtlasCmd",
        color: [octMapAtlas],
      }),
      pipeline: ctx.pipeline({
        vert: SHADERS.fullscreenQuad.vert,
        frag: SHADERS.blitToOctMapAtlas.frag,
      }),
      uniforms: {
        uOctMap: octMap,
        uOctMapSize: this.size,
      },
      attributes,
      indices,
    };

    const downsampleFromOctMapAtlasCmd = {
      name: "ReflectionProbe.downsampleFromOctMapAtlasCmd",
      pass: ctx.pass({
        name: "ReflectionProbe.downsampleFromOctMapAtlasCmd",
        color: [octMap],
        clearColor: [0, 0, 0, 1],
      }),
      pipeline: ctx.pipeline({
        vert: SHADERS.fullscreenQuad.vert,
        frag: SHADERS.downsampleFromOctMapAtlas.frag,
      }),
      uniforms: {
        uOctMapAtlas: octMapAtlas,
        uOctMapAtlasSize: octMapAtlas.width,
      },
      attributes,
      indices,
    };

    const prefilterFromOctMapAtlasCmd = {
      name: "ReflectionProbe.prefilterFromOctMapAtlasCmd",
      pass: ctx.pass({
        name: "ReflectionProbe.prefilterFromOctMapAtlasCmd",
        color: [octMap],
        clearColor: [0, 0, 0, 1],
      }),
      pipeline: ctx.pipeline({
        vert: SHADERS.fullscreenQuad.vert,
        frag: SHADERS.prefilterFromOctMapAtlas.frag,
      }),
      uniforms: {
        uOctMapAtlas: octMapAtlas,
        uOctMapAtlasSize: octMapAtlas.width,
        uOctMapAtlasEncoding: octMapAtlas.encoding,
        uOutputEncoding: octMap.encoding,
      },
      attributes,
      indices,
    };

    const numSamples = 128;
    const hammersleyPointSet = new Float32Array(4 * numSamples);
    for (let i = 0; i < numSamples; i++) {
      const p = hammersley(i, numSamples);
      hammersleyPointSet[i * 4] = p[0];
      hammersleyPointSet[i * 4 + 1] = p[1];
      // hammersleyPointSet[i * 4 + 2] = 0;
      // hammersleyPointSet[i * 4 + 3] = 0;
    }

    const hammersleyPointSetMap = ctx.texture2D({
      data: hammersleyPointSet,
      width: 1,
      height: numSamples,
      pixelFormat: ctx.PixelFormat.RGBA32F,
      encoding: ctx.Encoding.Linear,
    });

    //sourceRegionSize - as we downsample the octmap we recycle the fully size octMap
    //but use only 1/2, 1/4, 1/8 of it, so when we blit it back to atlas we need to know
    //which part is downsampled data (and the rest is garbage from previous iterations)
    function blitToOctMapAtlasLevel(
      mipmapLevel,
      roughnessLevel,
      sourceRegionSize,
      debug
    ) {
      const width = octMapAtlas.width;
      //TODO: consider removing as it should match sourceRegionSize
      const levelSize = Math.max(
        64,
        width / 2 ** (1 + mipmapLevel + roughnessLevel)
      );
      const roughnessLevelWidth = width / 2 ** (1 + roughnessLevel);
      const vOffset = width - 2 ** (Math.log2(width) - roughnessLevel);
      const hOffset =
        2 * roughnessLevelWidth -
        2 ** (Math.log2(2 * roughnessLevelWidth) - mipmapLevel);

      if (debug)
        console.log(
          "hdr",
          "blitToOctMapAtlasLevel",
          octMap.width,
          sourceRegionSize,
          "->",
          mipmapLevel,
          roughnessLevel,
          levelSize
        );
      ctx.submit(blitToOctMapAtlasCmd, {
        viewport: [hOffset, vOffset, levelSize, levelSize],
        uniforms: {
          uSourceRegionSize: sourceRegionSize,
        },
      });
    }

    function downsampleFromOctMapAtlasLevel(
      mipmapLevel,
      roughnessLevel,
      targetRegionSize
    ) {
      console.log(
        "hdr",
        "downsampleFromOctMapAtlasLevel",
        mipmapLevel,
        roughnessLevel,
        targetRegionSize
      );
      ctx.submit(downsampleFromOctMapAtlasCmd, {
        viewport: [0, 0, targetRegionSize, targetRegionSize],
        uniforms: {
          uMipmapLevel: mipmapLevel,
          uRoughnessLevel: roughnessLevel,
        },
      });
    }

    function prefilterFromOctMapAtlasLevel(
      sourceMipmapLevel,
      sourceRoughnessLevel,
      roughnessLevel,
      targetRegionSize
    ) {
      ctx.submit(prefilterFromOctMapAtlasCmd, {
        viewport: [0, 0, targetRegionSize, targetRegionSize],
        uniforms: {
          uSourceMipmapLevel: sourceMipmapLevel,
          uSourceRoughnessLevel: sourceRoughnessLevel,
          uRoughnessLevel: roughnessLevel,
          uNumSamples: numSamples,
          uHammersleyPointSetMap: hammersleyPointSetMap,
        },
      });
    }

    this.update = function (drawScene) {
      if (!drawScene) return;
      this.dirty = false;

      sides.forEach((side) => {
        ctx.submit(side.drawPassCmd, () =>
          drawScene(side, dynamicCubemap.encoding)
        );
      });

      ctx.submit(cubemapToOctMap);

      ctx.submit(clearOctMapAtlasCmd);

      console.log("hdr", "---");

      // TODO: should level  be relative to size?
      const maxLevel = Math.log2(this.size) - Math.log2(32); // MAX_MIPMAP_LEVEL
      blitToOctMapAtlasLevel(0, 0, this.size, true);

      // Mipmap (horizontally)
      // 0: 4096 -> 2048
      // 1: 2048 -> 1024
      // 2: 1024 -> 512
      for (let i = 0; i < maxLevel - 1; i++) {
        const size = this.size / 2 ** (i + 1);
        downsampleFromOctMapAtlasLevel(i, 0, size);
        blitToOctMapAtlasLevel(i + 1, 0, size, true);
      }
      //we copy last level without downsampling it as it
      //doesn't makes sense to have octahedral maps smaller than 64x64
      blitToOctMapAtlasLevel(maxLevel, 0, 64);

      // Roughness (vertically)
      // TODO: creates lone render at bottom right
      for (let i = 1; i <= maxLevel; i++) {
        const size = Math.max(64, this.size / 2 ** i);
        prefilterFromOctMapAtlasLevel(0, Math.max(0, i - 1), i, size);
        blitToOctMapAtlasLevel(0, i, size, true);
      }

      ctx.submit(convolveOctmapAtlasToOctMap, {
        viewport: [0, 0, IRRADIANCE_OCT_MAP_SIZE, IRRADIANCE_OCT_MAP_SIZE],
      });

      ctx.submit(blitToOctMapAtlasCmd, {
        viewport: [
          octMapAtlas.width - IRRADIANCE_OCT_MAP_SIZE,
          octMapAtlas.height - IRRADIANCE_OCT_MAP_SIZE,
          IRRADIANCE_OCT_MAP_SIZE,
          IRRADIANCE_OCT_MAP_SIZE,
        ],
        uniforms: {
          uSourceRegionSize: IRRADIANCE_OCT_MAP_SIZE,
        },
      });
    };
  }

  init(entity) {
    this.entity = entity;
  }

  set(opts) {
    Object.assign(this, opts);
  }
}

export default function createReflectionProbeSystem(opts) {
  const { ctx } = opts;
  const reflectionProbeSystem = {
    type: "reflection-probe-system",
    cache: {},
    debug: false,
  };

  reflectionProbeSystem.update = (entities, opts = {}) => {
    let { renderers = [] } = opts;

    const skyboxEntities = entities.filter((e) => e.skybox);
    const skyboxEntity = skyboxEntities[0];

    const reflectionProbeEntities = entities.filter((e) => e.reflectionProbe);
    for (let reflectionProbeEntity of reflectionProbeEntities) {
      let cachedProps = reflectionProbeSystem.cache[reflectionProbeEntity.id];
      if (!cachedProps || !reflectionProbeEntity._reflectionProbe) {
        cachedProps = reflectionProbeSystem.cache[reflectionProbeEntity.id] = {
          skyboxSunPosition: [0, 0, 0],
        };
        const reflectionProbe = new ReflectionProbe({
          ...reflectionProbeEntity.reflectionProbe,
          ctx: ctx,
        });
        reflectionProbeEntity._reflectionProbe = reflectionProbe;
      }

      if (!skyboxEntity) {
        continue;
      }

      // TODO: this should be just node.reflectionProbe
      // TODO: data ownership reflectionProbe vs _reflectionProbe
      let needsUpdate =
        reflectionProbeEntity.reflectionProbe.dirty ||
        reflectionProbeEntity._reflectionProbe.dirty;

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
        reflectionProbeEntity.reflectionProbe.dirty = false;
        reflectionProbeEntity._reflectionProbe.dirty = false;
        reflectionProbeEntity._reflectionProbe.update((camera, encoding) => {
          const renderView = {
            camera: camera,
            outputEncoding: encoding,
          };
          // should be only skybox renderers
          renderers.forEach((renderer) => {
            if (renderer.renderStages.background) {
              renderer.renderStages.background(renderView, skyboxEntities, {
                renderingToReflectionProbe: true,
              });
            }
          });
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
  };

  return reflectionProbeSystem;
}

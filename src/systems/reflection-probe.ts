import { mat3 } from "pex-math";
import type { Mat4 } from "pex-math";
import {
  submit,
  createTexture,
  createBuffer,
  createSampler,
  copyExternalImage,
} from "pex-gpu";

import type {
  Entity,
  GpuTexture,
  ReflectionProbePrebakedData,
  SystemOptions,
} from "../types.js";
import { getEnvironmentRotation, getSkyboxEnvMap } from "../utils.js";
import {
  ROUGHNESS_LEVELS,
  SH_COEFFICIENT_COUNT,
  PREFILTER_SAMPLE_COUNT_DEFAULT,
  reflectionProbeSHShader,
  reflectionProbeEquirectToCubeShader,
  reflectionProbeDownsampleShader,
  reflectionProbePrefilterShader,
} from "../shaders/reflection-probe.js";

// Base cube face size; the prefiltered roughness levels are its mip chain.
const CUBEMAP_SIZE = 256;
// Full mip chain of the radiance cube — the pre-blurred source the prefilter
// samples from for filtered importance sampling.
const RADIANCE_MIP_COUNT = 1 + Math.floor(Math.log2(CUBEMAP_SIZE));
// Matches @workgroup_size(8, 8) in the compute shaders.
const WORKGROUP_SIZE = 8;

type ComputePipeline = { compute: string; entryPoint: string };

interface ProbeCacheEntry {
  resources: ProbeResources;
  envMap: GpuTexture | null;
  /** Calibration the probe was last baked with; a change forces a rebake. */
  luminanceScale?: number;
  /** Identity of the pre-baked payload this cache entry was built from. */
  data?: ReflectionProbePrebakedData | undefined;
  /** A bake the graph has not run yet. Only the bake itself clears it. */
  needsBake?: boolean;
}

interface ProbeResources {
  specularTexture: ReturnType<typeof createTexture>;
  irradianceCoefficients: ReturnType<typeof createBuffer>;
  sampler: GPUSampler;
  /** Mip levels in specularTexture; forwarded to entity._reflectionProbe. */
  roughnessLevels: number;
}

/**
 * Reflection probe system
 *
 * Filters the scene's environment (a skybox's user envMap or its analytic
 * `_skyTexture`, both equirectangular HDR) into image-based lighting, entirely
 * in compute:
 *
 * - Diffuse irradiance projected into L2 spherical harmonics (9 coefficients)
 * - Specular radiance prefiltered into a native cubemap mip chain (split-sum)
 *
 * Adds to reflectionProbe components:
 *
 * - "_reflectionProbe": `{ specularTexture, irradianceCoefficients, sampler }`
 *   consumed by the standard renderer's `USE_REFLECTION_PROBES` bindings.
 *
 * `update` is CPU only. `declareReflectionProbes` records the probe's outputs
 * and its bake into the frame's graph, once per frame rather than per camera.
 */
export default ({ ctx, frameGraph }: SystemOptions) => ({
  type: "reflection-probe-system",
  cache: {} as Record<number, ProbeCacheEntry>,
  debug: false,
  shPipeline: null as ComputePipeline | null,
  equirectToCubePipeline: null as ComputePipeline | null,
  downsamplePipeline: null as ComputePipeline | null,
  prefilterPipeline: null as ComputePipeline | null,
  envSampler: null as GPUSampler | null,

  createResources(): ProbeResources {
    const specularTexture = createTexture(ctx, {
      label: "reflectionProbeSpecularCubemap",
      width: CUBEMAP_SIZE,
      height: CUBEMAP_SIZE,
      depth: 6,
      viewDimension: "cube",
      mipLevelCount: ROUGHNESS_LEVELS,
      format: "rgba16float",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST,
    });

    // 9 vec4f: array<vec3f> has a 16-byte std430 stride, so coefficients are
    // stored (and declared in WGSL) as vec4f with an unused w.
    const irradianceCoefficients = createBuffer(ctx, {
      label: "reflectionProbeIrradianceCoefficients",
      usage: "storage",
      size: SH_COEFFICIENT_COUNT * 4 * Float32Array.BYTES_PER_ELEMENT,
    });

    // Trilinear so roughness interpolates smoothly across prefiltered mips.
    const sampler = createSampler(ctx, {
      filter: "linear",
      addressMode: "clamp-to-edge",
    });

    return {
      specularTexture,
      irradianceCoefficients,
      sampler,
      roughnessLevels: ROUGHNESS_LEVELS,
    };
  },

  /**
   * Builds probe resources from pre-baked IBL data (e.g. a glTF
   * `EXT_lights_image_based` light): uploads the file's specular mips and SH
   * coefficients as-is, with no compute-shader bake pass. The mip count comes
   * from the data itself rather than the fixed ROUGHNESS_LEVELS constant, so
   * the specular cubemap's own size is what the shader is told to sample
   * against (see systems/renderer/standard.ts's ROUGHNESS_LEVELS override).
   */
  createPrebakedResources(data: ReflectionProbePrebakedData): ProbeResources {
    const roughnessLevels = data.specularImages.length;

    const specularTexture = createTexture(ctx, {
      label: "reflectionProbeSpecularCubemapPrebaked",
      width: data.specularImageSize,
      height: data.specularImageSize,
      depth: 6,
      viewDimension: "cube",
      mipLevelCount: roughnessLevels,
      // Assumes LDR (non-float) source images, matching the glTF-IBL-Sampler
      // tool's default PNG output for EXT_lights_image_based.
      format: "rgba8unorm",
      // copyExternalImageToTexture (see copyExternalImage below) requires
      // RENDER_ATTACHMENT on the destination in addition to COPY_DST.
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    for (let level = 0; level < roughnessLevels; level++) {
      const faces = data.specularImages[level]!;
      // Each level's images are already sized for that level — copyExternalImage
      // defaults to shrinking the source by 2^mipLevel (for the common case of
      // reusing one full-res source across levels), which would double-shrink
      // these; pass the level's actual size to override that.
      const faceSize = Math.max(1, data.specularImageSize >> level);
      for (let face = 0; face < faces.length; face++) {
        copyExternalImage(ctx, specularTexture, faces[face]!, {
          origin: [0, 0, face],
          mipLevel: level,
          width: faceSize,
          height: faceSize,
          // glTF-IBL-Sampler bakes EXT_lights_image_based faces for the WebGL
          // reference viewer's bottom-left texture origin; WebGPU's is top-left.
          flipY: true,
        });
      }
    }

    // 9 vec4f: array<vec3f> has a 16-byte std430 stride (see createResources).
    const irradianceData = new Float32Array(SH_COEFFICIENT_COUNT * 4);
    for (let i = 0; i < SH_COEFFICIENT_COUNT; i++) {
      const [r = 0, g = 0, b = 0] = data.irradianceCoefficients[i] ?? [];
      irradianceData[i * 4] = r;
      irradianceData[i * 4 + 1] = g;
      irradianceData[i * 4 + 2] = b;
    }
    const irradianceCoefficients = createBuffer(ctx, {
      label: "reflectionProbeIrradianceCoefficientsPrebaked",
      usage: "storage",
      data: irradianceData,
    });

    const sampler = createSampler(ctx, {
      filter: "linear",
      addressMode: "clamp-to-edge",
    });

    return {
      specularTexture,
      irradianceCoefficients,
      sampler,
      roughnessLevels,
    };
  },

  disposeResources(resources: ProbeResources) {
    resources.specularTexture.dispose();
    resources.irradianceCoefficients.dispose();
  },

  /**
   * Records one probe's bake into this frame's graph: SH projection, the
   * radiance pyramid, and the GGX prefilter of every roughness level.
   */
  declareBake(entity: Entity, cached: ProbeCacheEntry) {
    const { resources, envMap } = cached;
    const luminanceScale = cached.luminanceScale ?? 1;

    const shPipeline = (this.shPipeline ||= {
      compute: reflectionProbeSHShader(),
      entryPoint: "computeMain",
    });
    const equirectToCubePipeline = (this.equirectToCubePipeline ||= {
      compute: reflectionProbeEquirectToCubeShader(),
      entryPoint: "computeMain",
    });
    const downsamplePipeline = (this.downsamplePipeline ||= {
      compute: reflectionProbeDownsampleShader(),
      entryPoint: "computeMain",
    });
    const prefilterPipeline = (this.prefilterPipeline ||= {
      compute: reflectionProbePrefilterShader(),
      entryPoint: "computeMain",
    });
    const envSampler = (this.envSampler ||= createSampler(ctx, {
      filter: "linear",
      addressModeU: "repeat",
      addressModeV: "clamp-to-edge",
    }));

    const scope = entity.id;
    // Imported, not graph-owned: these outlive the bake that fills them, and
    // the renderers bind them straight off the component. Importing is interned
    // per frame, so the render pipeline reaches the same nodes when it declares
    // the scene passes' reads.
    const specular = frameGraph.importTexture(
      resources.specularTexture,
      `reflectionProbeSpecular.${scope}`,
    );
    const irradiance = frameGraph.importBuffer(
      resources.irradianceCoefficients,
      `reflectionProbeIrradiance.${scope}`,
    );
    const environment = frameGraph.importTexture(
      envMap!,
      `reflectionProbeEnvMap.${scope}`,
    );

    // Box-filtered mip pyramid of the environment, sampled per GGX sample at the
    // mip matching its solid angle (filtered importance sampling). Graph-owned
    // rather than imported: it lives only for the length of a bake, so the pool
    // reclaims it once the probe settles.
    const radiance = frameGraph.createTexture({
      label: `reflectionProbeRadiance.${scope}`,
      width: CUBEMAP_SIZE,
      height: CUBEMAP_SIZE,
      depth: 6,
      viewDimension: "cube",
      mipLevelCount: RADIANCE_MIP_COUNT,
      format: "rgba16float",
    });

    const dispatch2d = (faceSize: number): [number, number, number] => {
      const groups = Math.ceil(faceSize / WORKGROUP_SIZE);
      return [groups, groups, 6];
    };

    // All six faces of one mip, write-only: what a single dispatch covers.
    const storageView = (level: number) =>
      ({ dimension: "2d-array", level, layer: 0, layerCount: 6 }) as const;

    // Diffuse: project the environment into L2 SH (single workgroup reduction).
    frameGraph.addPass({
      name: `reflectionProbeSH.${scope}`,
      type: "compute",
      // A handle-valued uniform is a read edge, and a pass may not read and
      // write one resource — so this is declared as a write and resolved in
      // execute instead.
      writes: [irradiance],
      uniforms: {
        uEnvMap: environment,
        uEnvMapSampler: envSampler,
        uParams: { luminanceScale },
      },
      execute: ({ uniforms, resolveBuffer, timestampWrites }) => {
        submit(ctx, {
          label: "reflectionProbeSHCmd",
          pipeline: shPipeline,
          uniforms: {
            ...uniforms,
            uIrradianceCoefficients: resolveBuffer(irradiance),
          },
          dispatch: 1,
          ...(timestampWrites && {
            pass: { label: `reflectionProbeSH.${scope}`, timestampWrites },
          }),
        });
      },
    });

    // Radiance cube mip 0 from the equirect environment.
    frameGraph.addPass({
      name: `reflectionProbeEquirectToCube.${scope}`,
      type: "compute",
      writes: [radiance],
      uniforms: {
        uEnvMap: environment,
        uEnvMapSampler: envSampler,
        uParams: { faceSize: CUBEMAP_SIZE, luminanceScale },
      },
      execute: ({ uniforms, resolveView, timestampWrites }) => {
        submit(ctx, {
          label: "reflectionProbeEquirectToCubeCmd",
          pipeline: equirectToCubePipeline,
          uniforms: {
            ...uniforms,
            uOutput: resolveView(radiance, storageView(0)),
          },
          dispatch: dispatch2d(CUBEMAP_SIZE),
          ...(timestampWrites && {
            pass: {
              label: `reflectionProbeEquirectToCube.${scope}`,
              timestampWrites,
            },
          }),
        });
      },
    });

    for (let level = 1; level < RADIANCE_MIP_COUNT; level++) {
      const faceSize = CUBEMAP_SIZE >> level;
      frameGraph.addPass({
        name: `reflectionProbeDownsample${level}.${scope}`,
        type: "compute",
        // Samples level-1 while writing level, which a read edge cannot
        // express — so the sampled usage is declared here instead. Ordering
        // is the write-after-write edge to the level before, and the implicit
        // barrier between two compute passes.
        writes: [
          {
            handle: radiance,
            usage:
              GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
          },
        ],
        uniforms: { uParams: { faceSize } },
        execute: ({ uniforms, resolveView, timestampWrites }) => {
          submit(ctx, {
            label: `reflectionProbeDownsampleCmd${level}`,
            pipeline: downsamplePipeline,
            uniforms: {
              ...uniforms,
              uSource: resolveView(radiance, {
                dimension: "cube",
                level: level - 1,
                layer: 0,
                layerCount: 6,
              }),
              uSourceSampler: resources.sampler,
              uOutput: resolveView(radiance, storageView(level)),
            },
            dispatch: dispatch2d(faceSize),
            ...(timestampWrites && {
              pass: {
                label: `reflectionProbeDownsample${level}.${scope}`,
                timestampWrites,
              },
            }),
          });
        },
      });
    }

    // Specular: GGX-prefilter one roughness level per pass from the radiance cube.
    for (let level = 0; level < ROUGHNESS_LEVELS; level++) {
      const faceSize = CUBEMAP_SIZE >> level;
      const isLastLevel = level === ROUGHNESS_LEVELS - 1;

      frameGraph.addPass({
        name: `reflectionProbePrefilter${level}.${scope}`,
        type: "compute",
        writes: [specular],
        uniforms: {
          uRadianceCube: radiance,
          uRadianceCubeSampler: resources.sampler,
          uParams: {
            faceSize,
            roughness: level / (ROUGHNESS_LEVELS - 1),
            sampleCount: PREFILTER_SAMPLE_COUNT_DEFAULT,
            cubeResolution: CUBEMAP_SIZE,
          },
        },
        execute: ({ uniforms, resolveView, timestampWrites }) => {
          submit(ctx, {
            label: `reflectionProbePrefilterCmd${level}`,
            pipeline: prefilterPipeline,
            uniforms: {
              ...uniforms,
              uOutput: resolveView(specular, storageView(level)),
            },
            dispatch: dispatch2d(faceSize),
            ...(timestampWrites && {
              pass: {
                label: `reflectionProbePrefilter${level}.${scope}`,
                timestampWrites,
              },
            }),
          });

          // Cleared on the last level, not at declaration: a bake that never
          // runs stays pending rather than being lost.
          if (isLastLevel) cached.needsBake = false;
        },
      });
    }
  },

  updateReflectionProbeEntity(
    entity: Entity,
    envMap: GpuTexture,
    luminanceScale: number,
    dirty: boolean,
  ) {
    let cached = this.cache[entity.id];
    // A cache entry with `data` set came from createPrebakedResources(): its
    // specular cubemap carries the file's mip count and format, so rebuild
    // rather than bake into it.
    if (!cached || cached.data !== undefined) {
      if (cached) this.disposeResources(cached.resources);
      const resources = this.createResources();
      cached = this.cache[entity.id] = { resources, envMap: null };
      entity._reflectionProbe = {
        specularTexture: resources.specularTexture,
        irradianceCoefficients: resources.irradianceCoefficients,
        sampler: resources.sampler,
        roughnessLevels: resources.roughnessLevels,
      };
      dirty = true;
    }

    if (cached.envMap !== envMap) {
      cached.envMap = envMap;
      dirty = true;
    }

    // The calibration is baked into the SH + radiance cube (v6 filters the raw
    // env map rather than re-rendering the exposed skybox, as v5 did), so a
    // change has to rebake for lit materials to track it.
    if (cached.luminanceScale !== luminanceScale) {
      cached.luminanceScale = luminanceScale;
      dirty = true;
    }

    // `dirty` is the input; `needsBake` is the pending work only the bake
    // clears.
    if (dirty) {
      entity.reflectionProbe!.dirty = false;
      cached.needsBake = true;
    }
  },

  /**
   * Pre-baked path (e.g. glTF `EXT_lights_image_based`): uploads once per
   * distinct `data` payload and otherwise leaves entity._reflectionProbe
   * untouched — never matched against a skybox, so it can't be overwritten by
   * the bake path even if an unrelated skybox+reflectionProbe pair exists
   * elsewhere in the scene.
   */
  updatePrebakedReflectionProbeEntity(entity: Entity) {
    const { data } = entity.reflectionProbe!;
    let cached = this.cache[entity.id];

    if (!cached || cached.data !== data) {
      if (cached) this.disposeResources(cached.resources);
      const resources = this.createPrebakedResources(data!);
      cached = this.cache[entity.id] = { resources, envMap: null, data };

      entity._reflectionProbe = {
        specularTexture: resources.specularTexture,
        irradianceCoefficients: resources.irradianceCoefficients,
        sampler: resources.sampler,
        roughnessLevels: resources.roughnessLevels,
        intensity: data!.intensity,
      };
    }

    entity.reflectionProbe!.dirty = false;
  },

  update(entities: Entity[]) {
    const skyboxEntities = entities.filter((e) => e.skybox);

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      if (!entity.reflectionProbe) continue;

      if (entity.reflectionProbe.data) {
        this.updatePrebakedReflectionProbeEntity(entity);
      } else {
        const skyboxEntity = skyboxEntities.find(
          (s) => !entity.layer || entity.layer == s.layer,
        );
        if (!skyboxEntity) continue;

        const skybox = skyboxEntity.skybox!;
        const envMap = getSkyboxEnvMap(skybox);
        if (!envMap) continue;

        // Rebake when the user marks the probe dirty or the sky is about to.
        this.updateReflectionProbeEntity(
          entity,
          envMap,
          skybox._luminanceScale ?? 1,
          !!entity.reflectionProbe.dirty || !!skybox._skyTextureChanged,
        );
      }

      this.updateRotation(entity, entity._transform?.modelMatrix);
    }
  },

  /**
   * Records every probe's outputs into this frame's graph, and the bake for
   * those whose environment changed under them.
   */
  declareReflectionProbes(entities: Entity[]) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      const cached = this.cache[entity.id];

      // A pre-baked probe never bakes: `update` uploaded its data and there is
      // nothing to filter.
      if (!entity.reflectionProbe || !cached?.needsBake || !cached.envMap) {
        continue;
      }
      this.declareBake(entity, cached);
    }
  },

  updateRotation(entity: Entity, modelMatrix: Mat4 | undefined) {
    const probe = entity._reflectionProbe;
    if (!probe) return;
    probe.rotation = getEnvironmentRotation(
      probe.rotation ?? mat3.create(),
      modelMatrix,
    );
  },

  dispose(entities?: Entity[]) {
    if (entities) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]!;
        const cached = this.cache[entity.id];
        if (cached) {
          this.disposeResources(cached.resources);
          delete this.cache[entity.id];
        }
      }
    } else {
      this.cache = {};
    }
  },
});

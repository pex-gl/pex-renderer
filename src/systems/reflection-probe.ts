import { submit, createTexture, createBuffer, createSampler } from "pex-gpu";

import type { Entity, GpuTexture, SystemOptions } from "../types.js";
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

interface ProbeResources {
  specularTexture: ReturnType<typeof createTexture>;
  mipViews: GPUTextureView[];
  radianceCube: ReturnType<typeof createTexture>;
  // Per-mip 2d-array storage views (write targets) and single-level cube views
  // (downsample sources) of the radiance cube.
  radianceStorageViews: GPUTextureView[];
  radianceLevelViews: GPUTextureView[];
  irradianceCoefficients: ReturnType<typeof createBuffer>;
  sampler: GPUSampler;
}

/**
 * Reflection probe system
 *
 * Filters the scene's environment (a skybox's user envMap or its analytic
 * `_skyTexture`, both equirectangular HDR) into image-based lighting, entirely
 * in compute:
 *
 * - diffuse irradiance projected into L2 spherical harmonics (9 coefficients)
 * - specular radiance prefiltered into a native cubemap mip chain (split-sum)
 *
 * Adds to reflectionProbe components:
 *
 * - "_reflectionProbe": `{ specularTexture, irradianceCoefficients, sampler }`
 *   consumed by the standard renderer's `USE_REFLECTION_PROBES` bindings.
 */
export default ({ ctx }: SystemOptions) => ({
  type: "reflection-probe-system",
  cache: {} as Record<
    number,
    { resources: ProbeResources; envMap: GpuTexture | null }
  >,
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

    // One write-only 2d-array view per mip: the prefilter writes all six faces
    // of a single roughness level per dispatch.
    const mipViews = Array.from({ length: ROUGHNESS_LEVELS }, (_, level) =>
      specularTexture.texture.createView({
        label: `reflectionProbeSpecularMip${level}`,
        dimension: "2d-array",
        baseMipLevel: level,
        mipLevelCount: 1,
        baseArrayLayer: 0,
        arrayLayerCount: 6,
      }),
    );

    // Box-filtered mip pyramid of the environment, sampled per GGX sample at the
    // mip matching its solid angle (filtered importance sampling).
    const radianceCube = createTexture(ctx, {
      label: "reflectionProbeRadianceCubemap",
      width: CUBEMAP_SIZE,
      height: CUBEMAP_SIZE,
      depth: 6,
      viewDimension: "cube",
      mipLevelCount: RADIANCE_MIP_COUNT,
      format: "rgba16float",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    });
    const radianceStorageViews = Array.from(
      { length: RADIANCE_MIP_COUNT },
      (_, level) =>
        radianceCube.texture.createView({
          label: `reflectionProbeRadianceStore${level}`,
          dimension: "2d-array",
          baseMipLevel: level,
          mipLevelCount: 1,
          baseArrayLayer: 0,
          arrayLayerCount: 6,
        }),
    );
    const radianceLevelViews = Array.from(
      { length: RADIANCE_MIP_COUNT },
      (_, level) =>
        radianceCube.texture.createView({
          label: `reflectionProbeRadianceLevel${level}`,
          dimension: "cube",
          baseMipLevel: level,
          mipLevelCount: 1,
        }),
    );

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
      mipViews,
      radianceCube,
      radianceStorageViews,
      radianceLevelViews,
      irradianceCoefficients,
      sampler,
    };
  },

  bake(resources: ProbeResources, envMap: GpuTexture) {
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
      addressMode: "repeat",
    }));

    const dispatch2d = (faceSize: number): [number, number, number] => {
      const groups = Math.ceil(faceSize / WORKGROUP_SIZE);
      return [groups, groups, 6];
    };

    // Diffuse: project the environment into L2 SH (single workgroup reduction).
    submit(ctx, {
      label: "reflectionProbeSHCmd",
      pipeline: shPipeline,
      uniforms: {
        uEnvMap: envMap,
        uEnvMapSampler: envSampler,
        uIrradianceCoefficients: resources.irradianceCoefficients,
      },
      dispatch: 1,
    });

    // Radiance cube mip 0 from the equirect environment.
    submit(ctx, {
      label: "reflectionProbeEquirectToCubeCmd",
      pipeline: equirectToCubePipeline,
      uniforms: {
        uEnvMap: envMap,
        uEnvMapSampler: envSampler,
        uOutput: resources.radianceStorageViews[0]!,
        uParams: { faceSize: CUBEMAP_SIZE },
      },
      dispatch: dispatch2d(CUBEMAP_SIZE),
    });

    // Build the radiance mip chain. Each level is its own compute pass, so the
    // implicit inter-pass barrier orders the write of level-1 before its read.
    for (let level = 1; level < RADIANCE_MIP_COUNT; level++) {
      const faceSize = CUBEMAP_SIZE >> level;
      submit(ctx, {
        label: `reflectionProbeDownsampleCmd${level}`,
        pipeline: downsamplePipeline,
        uniforms: {
          uSource: resources.radianceLevelViews[level - 1]!,
          uSourceSampler: resources.sampler,
          uOutput: resources.radianceStorageViews[level]!,
          uParams: { faceSize },
        },
        dispatch: dispatch2d(faceSize),
      });
    }

    // Specular: GGX-prefilter one roughness level per pass from the radiance cube.
    for (let level = 0; level < ROUGHNESS_LEVELS; level++) {
      const faceSize = CUBEMAP_SIZE >> level;
      submit(ctx, {
        label: `reflectionProbePrefilterCmd${level}`,
        pipeline: prefilterPipeline,
        uniforms: {
          uRadianceCube: resources.radianceCube,
          uRadianceCubeSampler: resources.sampler,
          uOutput: resources.mipViews[level]!,
          uParams: {
            faceSize,
            roughness: level / (ROUGHNESS_LEVELS - 1),
            sampleCount: PREFILTER_SAMPLE_COUNT_DEFAULT,
            cubeResolution: CUBEMAP_SIZE,
          },
        },
        dispatch: dispatch2d(faceSize),
      });
    }
  },

  updateReflectionProbeEntity(entity: Entity, envMap: GpuTexture, dirty: boolean) {
    let cached = this.cache[entity.id];
    if (!cached) {
      const resources = this.createResources();
      cached = this.cache[entity.id] = { resources, envMap: null };
      entity._reflectionProbe = {
        specularTexture: resources.specularTexture,
        irradianceCoefficients: resources.irradianceCoefficients,
        sampler: resources.sampler,
      };
      dirty = true;
    }

    if (cached.envMap !== envMap) {
      cached.envMap = envMap;
      dirty = true;
    }

    if (dirty) {
      entity.reflectionProbe!.dirty = false;
      this.bake(cached.resources, envMap);
    }
  },

  update(entities: Entity[]) {
    const skyboxEntities = entities.filter((e) => e.skybox);

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      if (!entity.reflectionProbe) continue;

      const skyboxEntity = skyboxEntities.find(
        (s) => !entity.layer || entity.layer == s.layer,
      );
      if (!skyboxEntity) continue;

      const skybox = skyboxEntity.skybox!;
      const envMap = skybox.envMap || skybox._skyTexture;
      if (!envMap) continue;

      // Rebake when the user marks the probe dirty or the analytic sky rebaked.
      this.updateReflectionProbeEntity(
        entity,
        envMap,
        !!entity.reflectionProbe.dirty || !!skybox._skyTextureChanged,
      );
    }
  },

  dispose(entities?: Entity[]) {
    if (entities) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]!;
        const cached = this.cache[entity.id];
        if (cached) {
          cached.resources.specularTexture.dispose();
          cached.resources.radianceCube.dispose();
          cached.resources.irradianceCoefficients.dispose();
          delete this.cache[entity.id];
        }
      }
    } else {
      this.cache = {};
    }
  },
});

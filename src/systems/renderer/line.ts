import { avec3, mat3 } from "pex-math";
import { submit, createBuffer } from "pex-gpu";

import createBaseSystem, { attributeBuffer, outputsKey } from "./base.js";
import { definesKey, hooksKey } from "../../utils.js";
import {
  lineShader,
  LINE_VERTEX_FIELDS,
  LINE_MATERIAL_FIELDS,
} from "../../shaders/line.js";

import type { Attributes, GpuBuffer } from "pex-gpu";
import type {
  PipelineShaderOptions,
  Entity,
  RendererPassOptions,
  RendererSystem,
  RenderView,
  SystemOptions,
} from "../../types.js";

// Reused per draw; the Model struct carries a normalMatrix the line shader
// never reads, but WGSL struct packing still requires the member.
const NORMAL_MATRIX = mat3.create();

const FLOAT = Float32Array.BYTES_PER_ELEMENT;

// Base round-cap quad (6 verts): xy is the signed width offset, z selects the
// endpoint (0 = A, 1 = B). getLinePositionsBuffer appends `resolution` cap
// segments on each end.
// prettier-ignore
const instanceRoundRound = Float32Array.of(
  0, -0.5, 0,
  0, -0.5, 1,
  0, 0.5, 1,
  0, -0.5, 0,
  0, 0.5, 1,
  0, 0.5, 0,
);

// `RendererSystem` reaches a renderer's own state through an index signature,
// which loses what this one keeps there: round-cap quads keyed by resolution.
const lineBuffers = (renderer: RendererSystem) =>
  renderer.cache as Record<number, GpuBuffer>;

/**
 * Line renderer
 *
 * Screen-space expanded line segments built on the `line` WGSL generator. Each
 * segment is drawn as an instanced quad (plus round caps); per-instance
 * endpoints alias the geometry position buffer via strided attributes. Uniforms
 * follow the shared bind group convention: `@group(0)` Frame, `@group(2)`
 * Material, `@group(3)` Model.
 */
export default ({ ctx }: SystemOptions): RendererSystem => ({
  ...createBaseSystem(),
  type: "line-renderer",
  // Round-cap quad buffers keyed by material.lineResolution.
  cache: {} as Record<number, GpuBuffer>,
  debug: false,

  getShader: (defines: Set<string>, options: PipelineShaderOptions) =>
    lineShader(defines, options),
  getShaderOptions(entity: Entity, options: RendererPassOptions) {
    return { outputs: options.outputs, hooks: entity.material!.hooks };
  },
  getDefines(entity: Entity, options: RendererPassOptions) {
    const defines = new Set<string>();
    this.getFeatureFlags(
      entity._geometry!.attributes,
      LINE_VERTEX_FIELDS,
      defines,
    );
    this.getFeatureFlags(entity.material!, LINE_MATERIAL_FIELDS, defines);
    if (options.msaa) defines.add("USE_MSAA");
    return defines;
  },
  getVariantKey(
    entity: Entity,
    defines: Set<string>,
    options: RendererPassOptions,
  ) {
    return [
      definesKey(defines),
      outputsKey(options.outputs),
      hooksKey(entity.material!.hooks),
    ].join("_");
  },
  getPipelineOptions(entity: Entity) {
    const material = entity.material!;
    // Camera-facing quads have no meaningful winding, so culling stays off.
    return {
      depthWriteEnabled: material.depthWriteEnabled !== false,
      depthCompare: material.depthCompare ?? "less",
      cullMode: "none",
      // Always written, undefined included: the pipeline object is cached per
      // shader variant and mutated per draw, so an omitted key would leave the
      // previous entity's bias in place.
      depthBias: material.depthBias,
      depthBiasSlopeScale: material.depthBiasSlopeScale,
      depthBiasClamp: material.depthBiasClamp,
    };
  },
  getLinePositionsBuffer(resolution: number) {
    const cache = lineBuffers(this);
    if (!cache[resolution]) {
      const positions = new Float32Array(
        instanceRoundRound.length + resolution * 18,
      );
      positions.set(instanceRoundRound);

      for (let step = 0; step < resolution; step++) {
        // Left cap
        let index = instanceRoundRound.length / 3 + step * 3;
        let theta0 = Math.PI / 2 + ((step + 0) * Math.PI) / resolution;
        let theta1 = Math.PI / 2 + ((step + 1) * Math.PI) / resolution;

        avec3.set3(
          positions,
          index + 1,
          0.5 * Math.cos(theta0),
          0.5 * Math.sin(theta0),
          0,
        );
        avec3.set3(
          positions,
          index + 2,
          0.5 * Math.cos(theta1),
          0.5 * Math.sin(theta1),
          0,
        );

        // Right cap
        index += resolution * 3;
        theta0 = (3 * Math.PI) / 2 + ((step + 0) * Math.PI) / resolution;
        theta1 = (3 * Math.PI) / 2 + ((step + 1) * Math.PI) / resolution;

        avec3.set3(positions, index, 0, 0, 1);
        avec3.set3(
          positions,
          index + 1,
          0.5 * Math.cos(theta0),
          0.5 * Math.sin(theta0),
          1,
        );
        avec3.set3(
          positions,
          index + 2,
          0.5 * Math.cos(theta1),
          0.5 * Math.sin(theta1),
          1,
        );
      }

      cache[resolution] = createBuffer(ctx, {
        usage: "vertex",
        data: positions,
      });
    }

    return cache[resolution];
  },
  render(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions,
  ) {
    const shadowMapping = !!options.shadowMappingLight;
    const uFrame = this.getFrameUniforms(renderView);

    const renderableEntities = entities.filter(
      (entity) =>
        entity.geometry &&
        entity.material &&
        entity.material.type === "line" &&
        (!shadowMapping || entity.material.castShadows),
    );

    for (let i = 0; i < renderableEntities.length; i++) {
      const entity = renderableEntities[i]!;
      const material = entity.material!;
      const geometry = entity.geometry!;
      const { attributes } = entity._geometry!;
      const positionBuffer = attributeBuffer(attributes.position!);

      // One segment per endpoint pair. `count` is authoritative where it is
      // set: a geometry builder's array is sized to its capacity, not to what
      // it holds. Otherwise the array length tells, flat or as vectors —
      // `[0].length` says which.
      const positions = geometry.positions as unknown as number[][];
      const positionCount =
        geometry.count ??
        (positions[0]!.length ? positions.length : positions.length / 3);

      // A helper builder holds nothing until something asks for a helper.
      if (positionCount < 2) continue;

      const pipeline = this.getPipeline(entity, options);

      const resolution = material.lineResolution!;

      // Per-instance endpoints alias the position buffer: stride 6 floats (one
      // segment = 2 points), pointB offset by one point (3 floats).
      const drawAttributes: Attributes = {
        position: { buffer: this.getLinePositionsBuffer(resolution) },
        pointA: {
          buffer: positionBuffer,
          stepMode: "instance",
          arrayStride: FLOAT * 6,
        },
        pointB: {
          buffer: positionBuffer,
          stepMode: "instance",
          arrayStride: FLOAT * 6,
          offset: FLOAT * 3,
        },
      };

      if (attributes.vertexColor) {
        const colorBuffer = attributeBuffer(attributes.vertexColor);
        drawAttributes.colorA = {
          buffer: colorBuffer,
          stepMode: "instance",
          arrayStride: FLOAT * 8,
        };
        drawAttributes.colorB = {
          buffer: colorBuffer,
          stepMode: "instance",
          arrayStride: FLOAT * 8,
          offset: FLOAT * 4,
        };
      }

      if (attributes.lineWidth) {
        drawAttributes.lineWidth = {
          buffer: attributeBuffer(attributes.lineWidth),
          stepMode: "instance",
        };
      }

      submit(ctx, {
        label: "drawLineGeometryCmd",
        pipeline,
        attributes: drawAttributes,
        count: (instanceRoundRound.length + resolution * 18) / 3,
        instanceCount: positionCount / 2,
        uniforms: {
          uFrame,
          ...this.getModelUniforms(
            entity,
            mat3.fromMat4(NORMAL_MATRIX, entity._transform!.modelMatrix),
            // The shader declares no skin bindings, so the block carries none.
            { previousModelMatrix: !!options.outputs?.velocity },
          ),
          uMaterial: {
            baseColor: material.baseColor,
            lineWidth: material.lineWidth,
          },
          ...this.getHookUniforms(entity, options.frameIndex ?? NaN),
        },
      });
    }
  },
  renderShadow(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions = {},
  ) {
    this.render(renderView, entities, options);
  },
  renderOpaque(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions = {},
  ) {
    this.render(renderView, entities, options);
  },
  dispose() {
    for (const buffer of Object.values(lineBuffers(this))) {
      buffer.dispose();
    }
    this.cache = {};
    this.pipelineCache.clear();
  },
});

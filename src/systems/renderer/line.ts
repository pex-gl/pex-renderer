import { avec3, mat3 } from "pex-math";
import { submit, createBuffer } from "pex-gpu";

import createBaseSystem, { outputsKey } from "./base.js";
import { definesKey } from "../../utils.js";
import {
  lineShader,
  LINE_VERTEX_FIELDS,
  LINE_MATERIAL_FIELDS,
} from "../../shaders/line.js";

import type {
  Entity,
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

/**
 * Line renderer
 *
 * Screen-space expanded line segments built on the `line` WGSL generator. Each
 * segment is drawn as an instanced quad (plus round caps); per-instance
 * endpoints alias the geometry position buffer via strided attributes. Uniforms
 * follow the shared bind group convention: @group(0) Frame, @group(2) Material,
 * @group(3) Model.
 */
export default ({ ctx }: SystemOptions): RendererSystem => ({
  ...createBaseSystem(),
  type: "line-renderer",
  // Round-cap quad buffers keyed by material.lineResolution.
  cache: {},
  debug: false,

  getShader: (defines: Set<string>, options: any) => lineShader(defines, options),
  getShaderOptions() {
    return { outputs: this._outputs };
  },
  getDefines(entity: any) {
    const defines = new Set<string>();
    this.getFeatureFlags(entity._geometry.attributes, LINE_VERTEX_FIELDS, defines);
    this.getFeatureFlags(entity.material, LINE_MATERIAL_FIELDS, defines);
    if (this._msaa) defines.add("USE_MSAA");
    return defines;
  },
  getVariantKey(entity: any, defines: Set<string>) {
    return `${definesKey(defines)}_${outputsKey(this._outputs)}`;
  },
  getPipelineOptions(entity: any) {
    const { material } = entity;
    // Camera-facing quads have no meaningful winding, so culling stays off.
    return {
      depthWriteEnabled: material.depthWrite !== false,
      depthCompare: material.depthTest === false ? "always" : "less",
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
    const cache = this.cache!;
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
  render(renderView: RenderView, entities: Entity[], options: any) {
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
      const material: any = entity.material;
      const geometry: any = entity.geometry;
      const { attributes } = entity._geometry!;

      const pipeline = this.getPipeline(entity, options);

      const resolution = material.lineResolution;
      const positionBuffer = this.getLinePositionsBuffer(resolution);

      // Per-instance endpoints alias the position buffer: stride 6 floats (one
      // segment = 2 points), pointB offset by one point (3 floats).
      const drawAttributes: Record<string, any> = {
        position: { buffer: positionBuffer },
        pointA: {
          buffer: attributes.position.buffer,
          stepMode: "instance",
          stride: FLOAT * 6,
        },
        pointB: {
          buffer: attributes.position.buffer,
          stepMode: "instance",
          stride: FLOAT * 6,
          offset: FLOAT * 3,
        },
      };

      if (attributes.vertexColor) {
        drawAttributes.colorA = {
          buffer: attributes.vertexColor.buffer,
          stepMode: "instance",
          stride: FLOAT * 8,
        };
        drawAttributes.colorB = {
          buffer: attributes.vertexColor.buffer,
          stepMode: "instance",
          stride: FLOAT * 8,
          offset: FLOAT * 4,
        };
      }

      if (attributes.lineWidth) {
        drawAttributes.lineWidth = {
          buffer: attributes.lineWidth.buffer,
          stepMode: "instance",
        };
      }

      const positions = geometry.positions;

      submit(ctx, {
        label: "drawLineGeometryCmd",
        pipeline,
        attributes: drawAttributes,
        count: (instanceRoundRound.length + resolution * 18) / 3,
        instanceCount: positions[0].length
          ? positions.length / 2
          : positions.length / 6,
        uniforms: {
          uFrame,
          uModel: {
            modelMatrix: entity._transform!.modelMatrix,
            normalMatrix: mat3.fromMat4(
              NORMAL_MATRIX,
              entity._transform!.modelMatrix,
            ),
            // Only where the shader declared it: pex-gpu throws on an unknown
            // struct member, and modelStruct gates this on the velocity output.
            ...(this._outputs?.velocity && {
              previousModelMatrix: entity._transform!.previousModelMatrix,
            }),
          },
          uMaterial: {
            baseColor: material.baseColor,
            lineWidth: material.lineWidth,
          },
        },
      });
    }
  },
  renderShadow(renderView: RenderView, entities: Entity[], options: any = {}) {
    this.setStageState(options);
    this.render(renderView, entities, options);
  },
  renderOpaque(renderView: RenderView, entities: Entity[], options: any = {}) {
    this.setStageState(options);
    this.render(renderView, entities, options);
  },
  setStageState(options: any) {
    const { outputs = {}, msaa } = options;
    this._msaa = msaa;
    this._outputs = outputs;
  },
  dispose() {
    for (const buffer of Object.values(this.cache!)) {
      (buffer as any).dispose?.();
    }
    this.cache = {};
    this.pipelineCache.clear();
  },
});

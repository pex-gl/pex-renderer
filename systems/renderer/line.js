import { avec3 } from "pex-math";
import { pipeline as SHADERS } from "pex-shaders";

import createBaseSystem from "./base.js";
import { ProgramCache } from "../../utils.js";

// Impacts program caching
// prettier-ignore
const flagDefinitions = [
  [["options", "attachmentsLocations", "color"], "LOCATION_COLOR", { type: "value" }],
  [["options", "attachmentsLocations", "normal"], "LOCATION_NORMAL", { type: "value" }],
  [["options", "attachmentsLocations", "emissive"], "LOCATION_EMISSIVE", { type: "value" }],
  [["options", "toneMap"], "TONE_MAP", { type: "value" }],

  [["material", "baseColor"], "", { uniform: "uBaseColor" }],
  [["material", "lineWidth"], "", { uniform: "uLineWidth" }],
  [["geometry", "attributes", "aVertexColor"], "USE_VERTEX_COLORS"],
  [["geometry", "attributes", "aLineWidth"], "USE_INSTANCED_LINE_WIDTH"],
];

// Impacts pipeline caching
const pipelineMaterialProps = ["id"];

// prettier-ignore
const instanceRoundRound = Float32Array.of(
  0, -0.5, 0,
  0, -0.5, 1,
  0, 0.5, 1,
  0, -0.5, 0,
  0, 0.5, 1,
  0, 0.5, 0,
);

export default ({ ctx } = {}) => {
  const lineRendererSystem = Object.assign(createBaseSystem(), {
    type: "line-renderer",
    cache: {
      programs: new ProgramCache(),
      pipelines: {},
      positionBuffers: {},
    },
    debug: false,
    flagDefinitions,
    getVertexShader: () => SHADERS.line.vert,
    getFragmentShader: () => SHADERS.line.frag,
    getPipelineHash(entity) {
      return this.getHashFromProps(
        entity.material,
        pipelineMaterialProps,
        this.debug,
      );
    },
    getPipelineOptions() {
      return { depthWrite: true, depthTest: true };
    },
    getLinePositionsBuffer(resolution) {
      if (!this.cache.positionBuffers[resolution]) {
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

        this.cache.positionBuffers[resolution] = ctx.vertexBuffer(positions);
      }

      return this.cache.positionBuffers[resolution];
    },
    render(renderView, entities, options) {
      const sharedUniforms = {
        uExposure: renderView.exposure,
        uOutputEncoding: renderView.outputEncoding,

        uProjectionMatrix: renderView.camera.projectionMatrix,
        uViewMatrix: renderView.camera.viewMatrix,
      };

      const renderableEntities = entities.filter(
        (entity) =>
          entity.geometry && entity.material && entity.material.type === "line",
      );

      for (let i = 0; i < renderableEntities.length; i++) {
        const entity = renderableEntities[i];

        // Also computes this.uniforms
        const pipeline = this.getPipeline(ctx, entity, options);

        const uniforms = {
          uModelMatrix: entity._transform.modelMatrix,
          uResolution: [ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight],
        };
        Object.assign(uniforms, sharedUniforms, this.uniforms);

        const resolution = entity.material.lineResolution;
        const positionBuffer = this.getLinePositionsBuffer(resolution);

        const attributes = {
          aPosition: positionBuffer,
          aPointA: {
            buffer: entity._geometry.attributes.aPosition.buffer,
            divisor: 1,
            stride: Float32Array.BYTES_PER_ELEMENT * 6,
          },
          aPointB: {
            buffer: entity._geometry.attributes.aPosition.buffer,
            divisor: 1,
            stride: Float32Array.BYTES_PER_ELEMENT * 6,
            offset: Float32Array.BYTES_PER_ELEMENT * 3,
          },
        };

        if (entity._geometry.attributes.aVertexColor) {
          attributes.aColorA = {
            buffer: entity._geometry.attributes.aVertexColor.buffer,
            divisor: 1,
            stride: Float32Array.BYTES_PER_ELEMENT * 8,
          };
          attributes.aColorB = {
            buffer: entity._geometry.attributes.aVertexColor.buffer,
            divisor: 1,
            stride: Float32Array.BYTES_PER_ELEMENT * 8,
            offset: Float32Array.BYTES_PER_ELEMENT * 4,
          };
        }

        ctx.submit({
          name: "drawLineGeometryCmd",
          pipeline,
          attributes,
          count: (instanceRoundRound.length + resolution * 18) / 3,
          instances: entity.geometry.positions[0].length
            ? entity.geometry.positions.length / 2
            : entity.geometry.positions.length / 6,
          uniforms,
        });
      }
    },
    renderStages: {
      shadow: (renderView, entities, options) => {
        lineRendererSystem.render(renderView, entities, options);
      },
      opaque: (renderView, entities, options) => {
        lineRendererSystem.render(renderView, entities, {
          ...options,
          toneMap: renderView.toneMap,
        });
      },
    },
  });

  return lineRendererSystem;
};

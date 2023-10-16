import { avec3 } from "pex-math";
import { pipeline as SHADERS, parser as ShaderParser } from "pex-shaders";

// prettier-ignore
const instanceRoundRound = Float32Array.of(
  0, -0.5, 0,
  0, -0.5, 1,
  0, 0.5, 1,
  0, -0.5, 0,
  0, 0.5, 1,
  0, 0.5, 0,
);

// TODO: resolution should be per geometry component
export default ({ ctx, resolution = 16 } = {}) => {
  const positions = new Float32Array(
    instanceRoundRound.length + resolution * 18
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
      0
    );
    avec3.set3(
      positions,
      index + 2,
      0.5 * Math.cos(theta1),
      0.5 * Math.sin(theta1),
      0
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
      1
    );
    avec3.set3(
      positions,
      index + 2,
      0.5 * Math.cos(theta1),
      0.5 * Math.sin(theta1),
      1
    );
  }

  const positionBuffer = ctx.vertexBuffer(positions);

  const drawSegmentsCmd = {
    name: "drawSegmentsCmd",
    pipeline: ctx.pipeline({
      vert: ShaderParser.build(ctx, SHADERS.line.vert),
      frag: ShaderParser.build(ctx, SHADERS.line.frag, [
        ctx.capabilities.maxColorAttachments > 1 && "USE_DRAW_BUFFERS",
      ]),
      depthWrite: true,
      depthTest: true,
    }),
    count: positions.length / 3,
  };

  const lineRendererSystem = {
    type: "line-renderer",
    cache: {},
    debug: false,
    render(renderView, entity) {
      ctx.submit(drawSegmentsCmd, {
        attributes: {
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
          aColorA: {
            buffer: entity._geometry.attributes.aVertexColor.buffer,
            divisor: 1,
            stride: Float32Array.BYTES_PER_ELEMENT * 8,
          },
          aColorB: {
            buffer: entity._geometry.attributes.aVertexColor.buffer,
            divisor: 1,
            stride: Float32Array.BYTES_PER_ELEMENT * 8,
            offset: Float32Array.BYTES_PER_ELEMENT * 4,
          },
        },
        instances: entity.geometry.positions[0].length
          ? entity.geometry.positions.length / 2
          : entity.geometry.positions.length / 6,
        uniforms: {
          uExposure: renderView.exposure,
          uOutputEncoding: renderView.outputEncoding,

          uProjectionMatrix: renderView.camera.projectionMatrix,
          uViewMatrix: renderView.camera.viewMatrix,
          uModelMatrix: entity._transform.modelMatrix,

          uBaseColor: entity.material.baseColor,
          uLineWidth: entity.material.lineWidth || 1,
          uResolution: [ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight],
          uLineZOffset: 0,
        },
      });
    },
    renderStages: {
      shadow: (renderView, entities) => {
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          if (
            entity.geometry &&
            entity.material &&
            entity.material.type === "line" &&
            entity.material.castShadows
          ) {
            lineRendererSystem.render(renderView, entity);
          }
        }
      },
      opaque: (renderView, entities) => {
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          if (
            entity.geometry &&
            entity.material &&
            entity.material.type === "line"
          ) {
            lineRendererSystem.render(renderView, entity);
          }
        }
      },
    },
    update: () => {},
  };

  return lineRendererSystem;
};

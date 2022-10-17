import { patchVS, patchFS } from "../../utils.js";

export default function createLineRendererSystem(opts) {
  const { ctx } = opts;

  const resolution = 16;
  const instanceRoundRound = [
    [0, -0.5, 0],
    [0, -0.5, 1],
    [0, 0.5, 1],
    [0, -0.5, 0],
    [0, 0.5, 1],
    [0, 0.5, 0],
  ];
  // Add the left cap.
  for (let step = 0; step < resolution; step++) {
    const theta0 = Math.PI / 2 + ((step + 0) * Math.PI) / resolution;
    const theta1 = Math.PI / 2 + ((step + 1) * Math.PI) / resolution;
    instanceRoundRound.push([0, 0, 0]);
    instanceRoundRound.push([
      0.5 * Math.cos(theta0),
      0.5 * Math.sin(theta0),
      0,
    ]);
    instanceRoundRound.push([
      0.5 * Math.cos(theta1),
      0.5 * Math.sin(theta1),
      0,
    ]);
  }

  // Add the right cap.
  for (let step = 0; step < resolution; step++) {
    const theta0 = (3 * Math.PI) / 2 + ((step + 0) * Math.PI) / resolution;
    const theta1 = (3 * Math.PI) / 2 + ((step + 1) * Math.PI) / resolution;
    instanceRoundRound.push([0, 0, 1]);
    instanceRoundRound.push([
      0.5 * Math.cos(theta0),
      0.5 * Math.sin(theta0),
      1,
    ]);
    instanceRoundRound.push([
      0.5 * Math.cos(theta1),
      0.5 * Math.sin(theta1),
      1,
    ]);
  }

  const positionBuffer = ctx.vertexBuffer(instanceRoundRound);

  const DRAW_BUFFERS_EXT =
    ctx.capabilities.maxColorAttachments > 1 ? "#define USE_DRAW_BUFFERS" : "";

  const lineVert = /*glsl*/ `
    attribute vec3 aPosition;
    attribute vec3 aPointA;
    attribute vec3 aPointB;
    attribute vec4 aColorA;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    uniform float uLineWidth;
    uniform vec2 uResolution;
    uniform float uLineZOffset;

    varying vec4 vColor;

    void main () {
      vColor = aColorA;
      vec4 clip0 = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPointA, 1.0);
      vec4 clip1 = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPointB, 1.0);
      vec2 screen0 = uResolution * (0.5 * clip0.xy/clip0.w + 0.5);
      vec2 screen1 = uResolution * (0.5 * clip1.xy/clip1.w + 0.5);

      vec2 xBasis = normalize(screen1 - screen0);
      vec2 yBasis = vec2(-xBasis.y, xBasis.x);
      vec2 pt0 = screen0 + aColorA.a * uLineWidth * (aPosition.x * xBasis + aPosition.y * yBasis);
      vec2 pt1 = screen1 + aColorA.a * uLineWidth * (aPosition.x * xBasis + aPosition.y * yBasis);
      vec2 pt = mix(pt0, pt1, aPosition.z);
      vec4 clip = mix(clip0, clip1, aPosition.z);

      gl_Position = vec4(clip.w * ((2.0 * pt) / uResolution - 1.0), clip.z + uLineZOffset, clip.w);

      if (length(aPointA) == 0.0 || length(aPointB) == 0.0) {
        gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
      }
    }
  `;

  const lineFrag = /*glsl*/ `
    ${DRAW_BUFFERS_EXT}
    #ifdef USE_DRAW_BUFFERS
      #extension GL_EXT_draw_buffers : enable
    #endif

    precision highp float;
    uniform vec4 uBaseColor;
    varying vec4 vColor;
    void main() {
      gl_FragData[0] = uBaseColor * vColor;
      #ifdef USE_DRAW_BUFFERS
      gl_FragData[1] = vec4(0.0);
      gl_FragData[2] = vec4(0.0);
      #endif
    }
    `;

  const drawSegmentsCmd = {
    name: "drawSegmentsCmd",
    pipeline: ctx.pipeline({
      vert: ctx.capabilities.isWebGL2 ? patchVS(lineVert) : lineVert,
      frag: ctx.capabilities.isWebGL2 ? patchFS(lineFrag) : lineFrag,
      depthWrite: true,
      depthTest: true,
    }),
    count: instanceRoundRound.length,
  };

  function drawSegmentMesh(camera, e) {
    ctx.submit(drawSegmentsCmd, {
      attributes: {
        aPosition: positionBuffer,
        aPointA: {
          buffer: e._geometry.attributes.aPosition.buffer,
          divisor: 1,
          stride: Float32Array.BYTES_PER_ELEMENT * 6,
        },
        aPointB: {
          buffer: e._geometry.attributes.aPosition.buffer,
          divisor: 1,
          stride: Float32Array.BYTES_PER_ELEMENT * 6,
          offset: Float32Array.BYTES_PER_ELEMENT * 3,
        },
        aColorA: {
          buffer: e._geometry.attributes.aVertexColor.buffer,
          divisor: 1,
          stride: Float32Array.BYTES_PER_ELEMENT * 8,
        },
        aColorB: {
          buffer: e._geometry.attributes.aVertexColor.buffer,
          divisor: 1,
          stride: Float32Array.BYTES_PER_ELEMENT * 8,
          offset: Float32Array.BYTES_PER_ELEMENT * 4,
        },
      },
      instances: e.geometry.positions.length / 2,
      uniforms: {
        uBaseColor: e.material.baseColor,
        uProjectionMatrix: camera.projectionMatrix,
        uViewMatrix: camera.viewMatrix,
        uModelMatrix: e._transform.modelMatrix,
        uLineWidth: 10,
        uResolution: [ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight],
        uLineZOffset: 0,
      },
    });
  }

  const lineRendererSystem = {
    renderStages: {
      shadow: (renderView, entities) => {
        const { camera } = renderView;
        entities.forEach((e) => {
          if (e.drawSegments && e.material.castShadows) {
            drawSegmentMesh(camera, e);
          }
        });
      },
      opaque: (renderView, entities) => {
        const { camera } = renderView;
        entities.forEach((e) => {
          if (e.drawSegments) {
            drawSegmentMesh(camera, e);
          }
        });
      },
    },
    update: () => {},
  };
  return lineRendererSystem;
}

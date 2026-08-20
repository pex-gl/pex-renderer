import { vertexOutputStruct } from "../wgsl.js";

// The vertex stage every post-processing pass shares, and the uniform block the
// registry supplies to all of them.
//
// Attribute @location convention specific to post-processing: 0 position
// (vec2, clip-space fullscreen triangle corners).

/**
 * Uniforms the registry writes for every sub-pass. Bound at `@group(0)
 * @binding(0)` in every post-processing shader, whether or not the fragment
 * stage reads it: the vertex stage needs `texelSize` for its neighbour taps.
 */
export const postProcessingStruct = /* wgsl */ `
struct PostProcessing {
  viewportSize: vec2f,
  texelSize: vec2f,
  time: f32,
}
@group(0) @binding(0) var<uniform> uPostProcessing: PostProcessing;
`;

/** Neighbour taps carried through the vertex stage. */
export interface FullscreenVertexOptions {
  /** The four diagonal taps (down/upsample box filters, FXAA corners). */
  corners?: boolean;
  /** The four axis-aligned taps (upsample tent filter, FXAA edge search). */
  axis?: boolean;
  /** Diagonal tap distance in texels. The 4-tap upsampler samples half a texel out. */
  offset?: number;
}

const CORNER_MEMBERS = [
  "texCoord0LeftUp",
  "texCoord0RightUp",
  "texCoord0LeftDown",
  "texCoord0RightDown",
];
const AXIS_MEMBERS = [
  "texCoord0Down",
  "texCoord0Up",
  "texCoord0Left",
  "texCoord0Right",
];

/**
 * `VertexOutput` for a post-processing pass. Neighbour taps are interpolated
 * rather than recomputed per fragment — the down/upsample and FXAA chunks take
 * them as parameters for exactly that reason.
 */
const fullscreenVertexOutput = ({
  corners = false,
  axis = false,
}: FullscreenVertexOptions = {}): string =>
  vertexOutputStruct([
    { name: "texCoord0", type: "vec2f" },
    ...(corners ? CORNER_MEMBERS : []).map((name) => ({ name, type: "vec2f" })),
    ...(axis ? AXIS_MEMBERS : []).map((name) => ({ name, type: "vec2f" })),
  ]);

/**
 * The shared vertex stage: a fullscreen triangle plus its neighbour taps.
 *
 * WebGPU's texture origin is top-left while clip space points y up, so the
 * flipped y makes a fullscreen pass an identity copy — target texel to source
 * texel. Tap names stay in screen terms (`Up` is visually up, one texel back in
 * v), which is what the chunks' symmetric filters expect.
 */
export const fullscreenVertex = ({
  corners = false,
  axis = false,
  offset = 1,
}: FullscreenVertexOptions = {}): string => /* wgsl */ `
struct VertexInput {
  @location(0) position: vec2f,
}

${fullscreenVertexOutput({ corners, axis })}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  output.position = vec4f(input.position, 0.0, 1.0);
  output.texCoord0 = vec2f(input.position.x * 0.5 + 0.5, 0.5 - input.position.y * 0.5);

  ${
    corners
      ? `let cornerOffset = uPostProcessing.texelSize * ${offset.toFixed(2)};
  output.texCoord0LeftUp = output.texCoord0 + cornerOffset * vec2f(-1.0, -1.0);
  output.texCoord0RightUp = output.texCoord0 + cornerOffset * vec2f(1.0, -1.0);
  output.texCoord0LeftDown = output.texCoord0 + cornerOffset * vec2f(-1.0, 1.0);
  output.texCoord0RightDown = output.texCoord0 + cornerOffset * vec2f(1.0, 1.0);`
      : ""
  }
  ${
    axis
      ? `output.texCoord0Down = output.texCoord0 + uPostProcessing.texelSize * vec2f(0.0, 1.0);
  output.texCoord0Up = output.texCoord0 + uPostProcessing.texelSize * vec2f(0.0, -1.0);
  output.texCoord0Left = output.texCoord0 + uPostProcessing.texelSize * vec2f(-1.0, 0.0);
  output.texCoord0Right = output.texCoord0 + uPostProcessing.texelSize * vec2f(1.0, 0.0);`
      : ""
  }

  return output;
}
`;

/**
 * `gl_FragCoord` counterpart: the chunks ported from GLSL take a pixel-centre
 * coordinate, and WebGPU's `@builtin(position)` already shares the depth and
 * normal targets' top-left origin, so it maps texel-for-texel with no flip.
 */
export const FRAGMENT_COORD = "input.position.xy";

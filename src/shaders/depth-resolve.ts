/**
 * Resolves the multisampled depth buffer into a single-sample one.
 *
 * WebGPU has no depth resolve — `GPURenderPassDepthStencilAttachment` has no
 * `resolveTarget` — so under MSAA the depth buffer stays multisampled, and a
 * multisampled texture cannot be sampled. Everything that reads depth after the
 * scene (ambient occlusion, depth of field, fog, SMAA's depth edges) needs this
 * pass to exist at all.
 *
 * Nearest rather than an average: depth is not averageable. A mean across a
 * silhouette names a depth belonging to neither surface, which puts occlusion
 * samples and circles of confusion in mid-air. Taking the closest sample keeps
 * thin foreground geometry at the cost of dilating silhouettes by a sample.
 *
 * The sample count is baked in rather than read back with `textureNumSamples`,
 * so the loop has a literal bound the compiler can unroll. A loop whose trip
 * count the driver supplies is one a bad answer turns into a GPU hang, and a
 * hang here costs the device, not the frame. One variant per MSAA level, which
 * in practice means one.
 */
export const depthResolveShader = (sampleCount: number): string => /* wgsl */ `
@group(0) @binding(0) var uDepthTexture: texture_depth_multisampled_2d;

struct VertexInput {
  @location(0) position: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @builtin(frag_depth) f32 {
  // Both textures share the top-left origin, so the fragment position is the
  // source texel coordinate directly — no sampler, no UV remap.
  let coord = vec2i(input.position.xy);

  var nearest = 1.0;
  for (var i = 0; i < ${Math.max(1, Math.trunc(sampleCount))}; i++) {
    nearest = min(nearest, textureLoad(uDepthTexture, coord, i));
  }

  return nearest;
}
`;

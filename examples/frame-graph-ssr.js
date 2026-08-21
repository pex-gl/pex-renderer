// Shaders for the screen-space reflections injected by the "frame-graph"
// example. They live here so that example stays about the frame graph API;
// the WGSL is deliberately plain (no pex-shaders chunks, no generator) so a
// pass declared from outside the engine reads as something anyone could write.
//
// Attribute convention matches the engine's fullscreen passes: @location(0) is
// a clip-space vec2 corner of the fullscreen triangle.

const FULLSCREEN_VERTEX = /* wgsl */ `
struct VertexInput {
  @location(0) position: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texCoord0: vec2f,
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  // Textures are y-down in WebGPU while clip space is y-up, so the flip makes
  // a fullscreen pass an identity copy.
  output.texCoord0 = vec2f(input.position.x * 0.5 + 0.5, 0.5 - input.position.y * 0.5);
  return output;
}
`;

/**
 * Screen-space ray march against the depth buffer.
 *
 * Reads the scene color, depth and view normals of the main pass and writes the
 * reflected radiance in `rgb` with a confidence weight in `a`, so the composite
 * is a single multiply-add. Half resolution: the frame graph sizes the target,
 * this only ever works in normalized coordinates.
 */
export const ssrTraceShader = /* wgsl */ `
struct SSR {
  viewportSize: vec2f,
  near: f32,
  far: f32,
  fov: f32,
  aspect: f32,
  intensity: f32,
  maxDistance: f32,
  thickness: f32,
  steps: f32,
  jitter: f32,
}
@group(0) @binding(0) var<uniform> uSSR: SSR;

@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uTextureSampler: sampler;
@group(0) @binding(3) var uDepthTexture: texture_depth_2d;
@group(0) @binding(4) var uDepthTextureSampler: sampler;
@group(0) @binding(5) var uNormalTexture: texture_2d<f32>;
@group(0) @binding(6) var uNormalTextureSampler: sampler;
@group(0) @binding(7) var uNoiseTexture: texture_2d<f32>;
@group(0) @binding(8) var uNoiseTextureSampler: sampler;

// Per-step offsets along the ray, indexed rather than recomputed. A graph-owned
// buffer: uploaded once, content-addressed by the pool.
@group(0) @binding(9) var<storage, read> uMarchOffsets: array<f32>;

${FULLSCREEN_VERTEX}

fn saturateF32(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }

/** Eye-space distance along -z, from the [0, 1] clip depth WebGPU writes. */
fn eyeDistance(uv: vec2f) -> f32 {
  let d = textureSampleLevel(uDepthTexture, uDepthTextureSampler, uv, 0);
  return uSSR.near * uSSR.far / (uSSR.far - d * (uSSR.far - uSSR.near));
}

// The texture coordinate is y-down and view space is y-up, so both directions
// flip y. Keeping that consistent is what lets the march compare against the
// view normals the standard renderer writes.
fn viewPosition(uv: vec2f, distance: f32) -> vec3f {
  let tanHalfFov = tan(uSSR.fov * 0.5);
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  return vec3f(ndc.x * tanHalfFov * uSSR.aspect, ndc.y * tanHalfFov, -1.0) * distance;
}

fn viewToTexCoord(position: vec3f) -> vec2f {
  let tanHalfFov = tan(uSSR.fov * 0.5);
  let distance = max(-position.z, 1.0e-4);
  let ndc = vec2f(
    position.x / (tanHalfFov * uSSR.aspect * distance),
    position.y / (tanHalfFov * distance)
  );
  return vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let uv = input.texCoord0;
  let distance = eyeDistance(uv);

  // Nothing behind the far plane reflects: the sky is drawn by the skybox.
  if (distance >= uSSR.far * 0.99) { return vec4f(0.0); }

  let position = viewPosition(uv, distance);
  let normal = normalize(textureSampleLevel(uNormalTexture, uNormalTextureSampler, uv, 0.0).rgb * 2.0 - 1.0);
  let viewDirection = normalize(position);
  let rayDirection = reflect(viewDirection, normal);

  // Clipped to the near plane before it is projected: past it the perspective
  // divide flips the ray and the march walks backwards across the screen.
  var rayLength = uSSR.maxDistance;
  if (position.z + rayDirection.z * rayLength > -uSSR.near) {
    rayLength = (-uSSR.near - position.z) / rayDirection.z;
  }
  let endPosition = position + rayDirection * rayLength;
  let endTexCoord = viewToTexCoord(endPosition);

  // The march is uniform in screen space, not in view-space distance. Equal
  // world-space steps project to wildly unequal pixel distances, so hits snap
  // to a handful of iso-distance shells and the reflection comes out in flat
  // staggered bands. Along the projected segment 1/z is linear, so the ray's
  // depth at each sample is an interpolation rather than a second projection.
  let invStartZ = 1.0 / -position.z;
  let invEndZ = 1.0 / -endPosition.z;

  // Tiled noise decorrelates the per-pixel step offset, trading banding for
  // grain the half-resolution upsample then softens.
  let noise = textureSampleLevel(
    uNoiseTexture,
    uNoiseTextureSampler,
    uv * uSSR.viewportSize / 64.0,
    0.0
  ).r;

  let steps = i32(uSSR.steps);
  let offsetCount = arrayLength(&uMarchOffsets);
  // A ray leaves the surface it reflects off, so the first samples sit within a
  // texel of it. Anything nearer than this is that surface, not a reflection.
  let bias = max(0.01, distance * 0.005);

  var previousT = 0.0;
  var previousDelta = 0.0;
  var hitT = -1.0;

  for (var i = 1; i <= steps; i++) {
    let offset = fract(uMarchOffsets[u32(i) % offsetCount] + noise) * uSSR.jitter;
    let t = (f32(i) - offset) / f32(steps);
    let sampleTexCoord = mix(uv, endTexCoord, t);

    // Off screen: there is no color to reflect, and clamping would smear the
    // border pixel along the ray.
    if (any(sampleTexCoord < vec2f(0.0)) || any(sampleTexCoord > vec2f(1.0))) { break; }

    let delta = 1.0 / mix(invStartZ, invEndZ, t) - eyeDistance(sampleTexCoord);

    // In front of the surface at the previous sample and behind it at this one,
    // but not so far behind that the ray passed under an unrelated object: a
    // depth buffer has no thickness of its own.
    if (previousDelta <= bias && delta > bias && delta < uSSR.thickness) {
      // Bisect the step that crossed. Without it the hit — and the color it
      // samples — quantizes to the march, which is the staggering itself.
      var low = previousT;
      var high = t;
      for (var j = 0; j < 5; j++) {
        let mid = 0.5 * (low + high);
        let midDelta = 1.0 / mix(invStartZ, invEndZ, mid) - eyeDistance(mix(uv, endTexCoord, mid));
        if (midDelta > bias) { high = mid; } else { low = mid; }
      }
      hitT = high;
      break;
    }

    previousT = t;
    previousDelta = delta;
  }

  if (hitT < 0.0) { return vec4f(0.0); }

  let hitTexCoord = mix(uv, endTexCoord, hitT);
  let border = min(
    min(hitTexCoord.x, 1.0 - hitTexCoord.x),
    min(hitTexCoord.y, 1.0 - hitTexCoord.y)
  );
  let edgeFade = smoothstep(0.0, 0.15, border);
  // Back to view space for the fade: the march parameter is linear across the
  // screen, not along the ray, so it is not a distance.
  let hitPosition = viewPosition(hitTexCoord, 1.0 / mix(invStartZ, invEndZ, hitT));
  let distanceFade = 1.0 - saturateF32(length(hitPosition - position) / uSSR.maxDistance);
  // Schlick, with a floor so surfaces facing the camera still reflect a little.
  let fresnel = mix(0.1, 1.0, pow(1.0 - saturateF32(dot(-viewDirection, normal)), 5.0));

  return vec4f(
    textureSampleLevel(uTexture, uTextureSampler, hitTexCoord, 0.0).rgb,
    edgeFade * distanceFade * fresnel * uSSR.intensity
  );
}
`;

/** Scene color plus the traced reflection, weighted by its confidence. */
export const ssrCompositeShader = /* wgsl */ `
@group(0) @binding(0) var uTexture: texture_2d<f32>;
@group(0) @binding(1) var uTextureSampler: sampler;
@group(0) @binding(2) var uReflectionTexture: texture_2d<f32>;
@group(0) @binding(3) var uReflectionTextureSampler: sampler;

${FULLSCREEN_VERTEX}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(uTexture, uTextureSampler, input.texCoord0);
  let reflection = textureSample(uReflectionTexture, uReflectionTextureSampler, input.texCoord0);
  return vec4f(color.rgb + reflection.rgb * reflection.a, color.a);
}
`;

/** Straight copy, for the debug capture the GUI holds between frames. */
export const copyShader = /* wgsl */ `
@group(0) @binding(0) var uTexture: texture_2d<f32>;
@group(0) @binding(1) var uTextureSampler: sampler;

${FULLSCREEN_VERTEX}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(uTexture, uTextureSampler, input.texCoord0);
}
`;

/**
 * Replacement for the engine's grab pass copy: same texel-for-texel copy
 * (`@builtin(position)` indexes the source directly, no sampler needed), tinted
 * so what refraction sampled is obvious on screen.
 */
export const tintedGrabShader = /* wgsl */ `
struct Tint {
  color: vec3f,
  saturation: f32,
}
@group(0) @binding(0) var<uniform> uTint: Tint;
@group(0) @binding(1) var uTexture: texture_2d<f32>;

struct Varyings {
  @builtin(position) position: vec4f,
}

@vertex
fn vertexMain(@location(0) position: vec2f) -> Varyings {
  var output: Varyings;
  output.position = vec4f(position, 0.0, 1.0);
  return output;
}

@fragment
fn fragmentMain(input: Varyings) -> @location(0) vec4f {
  let color = textureLoad(uTexture, vec2i(input.position.xy), 0);
  let luminance = dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722));
  return vec4f(mix(vec3f(luminance), color.rgb, uTint.saturation) * uTint.color, color.a);
}
`;

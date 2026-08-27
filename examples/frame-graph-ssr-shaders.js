import { shaders } from "pex-renderer";

const { fullscreenVertex, postProcessingStruct } = shaders.postProcessing;

// WGSL for the screen-space reflections the frame-graph example injects. See
// frame-graph-ssr.js for what each pass is and where it joins the frame.
//
// Written the way the built-in effects are — the shared post-processing uniform
// block at binding 0 and the shared fullscreen vertex stage, both public — so
// an effect declared from outside the engine differs from one inside it only in
// who declares it.

// ─── Shared WGSL ─────────────────────────────────────────────────────────────

/**
 * Everything the passes need about the view and the settings.
 *
 * The matrices rather than a field of view: reconstruction and projection then
 * hold for any projection the camera has — off-centre, orthographic, jittered —
 * where the trigonometric shortcut only holds for a centred perspective one.
 */
const ssrStruct = /* wgsl */ `
struct SSR {
  projectionMatrix: mat4x4f,
  inverseProjectionMatrix: mat4x4f,
  /** View space of this frame to clip space of the previous one. */
  reprojectionMatrix: mat4x4f,
  viewportSize: vec2f,
  halfSize: vec2f,
  frame: f32,
  near: f32,
  intensity: f32,
  maxDistance: f32,
  thickness: f32,
  steps: f32,
  maxLevel: f32,
  roughnessCutoff: f32,
  /** At or below this roughness a ray is the mirror direction, not a sample. */
  mirrorRoughness: f32,
  historyWeight: f32,
}
@group(0) @binding(1) var<uniform> uSSR: SSR;
`;

const ssrCommon = /* wgsl */ `
const PI = 3.141592653589793;

fn saturateF32(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }

/**
 * View-space position of a pixel, from its texture coordinate and the depth
 * WebGPU wrote for it.
 */
fn viewPositionFromDepth(texCoord: vec2f, depth: f32) -> vec3f {
  let ndc = vec4f(texCoord.x * 2.0 - 1.0, 1.0 - texCoord.y * 2.0, depth, 1.0);
  let view = uSSR.inverseProjectionMatrix * ndc;
  return view.xyz / view.w;
}

/** Eye-space distance from an NDC depth. */
fn linearDepth(depth: f32) -> f32 {
  let view = uSSR.inverseProjectionMatrix * vec4f(0.0, 0.0, depth, 1.0);
  return -view.z / view.w;
}

/** View space to texture coordinate, keeping the NDC depth in z. */
fn projectToScreen(position: vec3f) -> vec3f {
  let clip = uSSR.projectionMatrix * vec4f(position, 1.0);
  let ndc = clip.xyz / clip.w;
  return vec3f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5, ndc.z);
}

/** Branchless orthonormal basis around a unit vector (Duff et al. 2017). */
fn orthonormalBasis(n: vec3f) -> mat3x3f {
  let s = select(-1.0, 1.0, n.z >= 0.0);
  let a = -1.0 / (s + n.z);
  let b = n.x * n.y * a;
  return mat3x3f(
    vec3f(1.0 + s * n.x * n.x * a, s * b, -s * n.x),
    vec3f(b, s + n.y * n.y * a, -n.y),
    n
  );
}

fn ggxD(NdotH: f32, alpha: f32) -> f32 {
  let a2 = alpha * alpha;
  let d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / max(PI * d * d, 1.0e-9);
}

fn smithG1(NdotV: f32, alpha: f32) -> f32 {
  let a2 = alpha * alpha;
  return 2.0 * NdotV / max(NdotV + sqrt(a2 + (1.0 - a2) * NdotV * NdotV), 1.0e-9);
}

/** Height-correlated Smith masking-shadowing. */
fn smithG2(NdotV: f32, NdotL: f32, alpha: f32) -> f32 {
  let a2 = alpha * alpha;
  let lambdaV = NdotL * sqrt(a2 + (1.0 - a2) * NdotV * NdotV);
  let lambdaL = NdotV * sqrt(a2 + (1.0 - a2) * NdotL * NdotL);
  return 2.0 * NdotL * NdotV / max(lambdaV + lambdaL, 1.0e-9);
}

/**
 * Sample the distribution of visible normals (Heitz 2018), in the tangent
 * frame. Importance sampling what the surface can actually reflect rather than
 * the lobe as a whole: at high roughness a mirror ray would spend most of its
 * samples on microfacets the eye cannot see, which is noise with no image in it.
 */
fn sampleGGXVNDF(ve: vec3f, alpha: f32, u: vec2f) -> vec3f {
  let vh = normalize(vec3f(alpha * ve.x, alpha * ve.y, ve.z));
  let lensq = vh.x * vh.x + vh.y * vh.y;
  let t1 = select(
    vec3f(1.0, 0.0, 0.0),
    vec3f(-vh.y, vh.x, 0.0) * inverseSqrt(max(lensq, 1.0e-9)),
    lensq > 0.0
  );
  let t2 = cross(vh, t1);

  let r = sqrt(u.x);
  let phi = 2.0 * PI * u.y;
  let px = r * cos(phi);
  var py = r * sin(phi);
  let s = 0.5 * (1.0 + vh.z);
  py = (1.0 - s) * sqrt(max(1.0 - px * px, 0.0)) + s * py;

  let nh = px * t1 + py * t2 + sqrt(max(1.0 - px * px - py * py, 0.0)) * vh;
  return normalize(vec3f(alpha * nh.x, alpha * nh.y, max(nh.z, 0.0)));
}

/**
 * Split-sum BRDF integral, analytic fit (Karis/Lazarov). The same weight the
 * probe applied to its prefiltered radiance, so a reflection substituted for it
 * carries the same energy.
 */
fn envBRDF(f0: vec3f, roughness: f32, NdotV: f32) -> vec3f {
  let c0 = vec4f(-1.0, -0.0275, -0.572, 0.022);
  let c1 = vec4f(1.0, 0.0425, 1.04, -0.04);
  let r = roughness * c0 + c1;
  let a004 = min(r.x * r.x, exp2(-9.28 * NdotV)) * r.x + r.y;
  let ab = vec2f(-1.04, 1.04) * a004 + r.zw;
  return f0 * ab.x + ab.y;
}

/**
 * The full-res pixel a half-res one stands for. Fixed, not rotated through the
 * 2x2 block per frame: a half-resolution buffer has one slot per block, so
 * tracing a different quarter of it each frame does not accumulate a better
 * estimate of the block — it just changes which surface point the slot holds,
 * every frame, forever. Measured at roughness 0.1, where the ray is otherwise
 * deterministic, the rotation was the whole of the residual flicker.
 */
fn sourceCoord(halfCoord: vec2i) -> vec2i {
  return min(halfCoord * 2, vec2i(uSSR.viewportSize) - vec2i(1));
}

fn texelCenter(coord: vec2i) -> vec2f {
  return (vec2f(coord) + 0.5) / uSSR.viewportSize;
}

/**
 * What a trace wrote in its w channel, and therefore how the resolve weights it.
 *
 * A sampled ray carries its own density in z, so a neighbour's can be
 * reweighted into this pixel's lobe. A mirror ray is a delta: no density to
 * divide by, the whole integral on its own, and nothing another pixel's ray
 * can stand in for.
 */
const HIT_SAMPLED = 1.0;
const HIT_MIRROR = 2.0;

/**
 * Whether this surface's lobe is stood in for by a cone through the colour
 * pyramid rather than sampled.
 *
 * Sampling a narrow lobe is the worst case for a half-resolution frame: a few
 * pixels of angular spread need more rays than there are to spend, and what
 * comes back is the variance rather than the blur. One mirror ray read at the
 * mip its footprint covers has the same expected value and no variance, and it
 * holds as long as what the cone covers is smooth — which is the same
 * condition that makes a prefiltered probe usable.
 */
fn isMirror(roughness: f32) -> bool {
  return roughness <= uSSR.mirrorRoughness;
}

/** Fades a reflection out as its hit approaches the edge of the screen. */
fn edgeFade(texCoord: vec2f) -> f32 {
  let border = min(
    min(texCoord.x, 1.0 - texCoord.x),
    min(texCoord.y, 1.0 - texCoord.y)
  );
  return smoothstep(0.0, 0.1, border);
}
`;

// ─── Hierarchical depth ──────────────────────────────────────────────────────
// Declared with addPass rather than the pipeline's fullscreen helper: each pass
// draws into one mip level of the texture the previous one wrote, which is a
// sub-resource write the helper has no vocabulary for. No uniform block either,
// so bindings start at 0 rather than after uPostProcessing.

/**
 * Depth into mip 0 of the pyramid.
 *
 * The pyramid is an integer format holding the bits of a float: it is only ever
 * read with textureLoad, but a `texture_2d<f32>` binding asks for a filterable
 * sample type, which no 32 bit float format has without an optional feature. A
 * `texture_2d<u32>` asks for nothing, and depth stays exact.
 */
export const hiZCopyShader = () => /* wgsl */ `
@group(0) @binding(0) var uDepthTexture: texture_depth_2d;

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) u32 {
  return bitcast<u32>(textureLoad(uDepthTexture, vec2i(input.position.xy), 0));
}
`;

/**
 * One mip level from the one above it, keeping the nearest surface.
 *
 * A minimum, and conservatively so: the traversal skips a cell when the ray
 * passes in front of everything in it, so a level that lost a texel would let
 * it skip geometry that is really there.
 */
export const hiZReduceShader = () => /* wgsl */ `
@group(0) @binding(0) var uPreviousLevelTexture: texture_2d<u32>;

${fullscreenVertex()}

fn load(coord: vec2i, size: vec2i) -> f32 {
  return bitcast<f32>(textureLoad(uPreviousLevelTexture, min(coord, size - 1), 0).r);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) u32 {
  let size = vec2i(textureDimensions(uPreviousLevelTexture));
  let base = vec2i(input.position.xy) * 2;

  var nearest = load(base, size);
  nearest = min(nearest, load(base + vec2i(1, 0), size));
  nearest = min(nearest, load(base + vec2i(0, 1), size));
  nearest = min(nearest, load(base + vec2i(1, 1), size));

  // An odd level leaves a column, a row or a corner texel out of every 2x2
  // block, and dropping one is exactly the conservative failure above.
  let odd = vec2<bool>((size.x & 1) == 1, (size.y & 1) == 1);
  if (odd.x) {
    nearest = min(nearest, load(base + vec2i(2, 0), size));
    nearest = min(nearest, load(base + vec2i(2, 1), size));
  }
  if (odd.y) {
    nearest = min(nearest, load(base + vec2i(0, 2), size));
    nearest = min(nearest, load(base + vec2i(1, 2), size));
  }
  if (odd.x && odd.y) {
    nearest = min(nearest, load(base + vec2i(2, 2), size));
  }

  return bitcast<u32>(nearest);
}
`;

// ─── Trace ───────────────────────────────────────────────────────────────────

/**
 * One ray per half-res pixel, marched through the depth pyramid.
 *
 * Writes where it landed rather than what it found: the hit as an offset from
 * the pixel's own coordinate — small numbers, so half floats keep it
 * sub-pixel — and the density it was sampled with, which is what lets the
 * resolve pass treat a neighbour's ray as one of its own.
 */
export const ssrTraceShader = () => /* wgsl */ `
${postProcessingStruct}
${ssrStruct}

@group(0) @binding(2) var uHiZTexture: texture_2d<u32>;
@group(0) @binding(3) var uDepthTexture: texture_depth_2d;
@group(0) @binding(4) var uNormalTexture: texture_2d<f32>;
@group(0) @binding(5) var uMaterialTexture: texture_2d<f32>;
@group(0) @binding(6) var uNoiseTexture: texture_2d<f32>;

${fullscreenVertex()}
${ssrCommon}

/**
 * Ray parameter at which the segment leaves the cell it is in, on the grid of
 * mip \`level\`.
 */
fn cellBoundary(texCoord: vec2f, delta: vec2f, cellCount: vec2f, t: f32) -> f32 {
  let cell = floor(texCoord * cellCount);
  let boundary = (cell + select(vec2f(0.0), vec2f(1.0), delta > vec2f(0.0))) / cellCount;
  let toBoundary = (boundary - texCoord) / delta;

  var nearest = 1.0e30;
  if (abs(delta.x) > 1.0e-9) { nearest = min(nearest, toBoundary.x); }
  if (abs(delta.y) > 1.0e-9) { nearest = min(nearest, toBoundary.y); }
  return t + max(nearest, 0.0);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let halfCoord = vec2i(input.position.xy);
  let coord = sourceCoord(halfCoord);

  let depth = textureLoad(uDepthTexture, coord, 0);
  if (depth >= 1.0) { return vec4f(0.0); }

  let material = textureLoad(uMaterialTexture, coord, 0);
  let f0 = material.rgb;
  let roughness = material.a;
  // Nothing worth tracing: no specular at all (the sky, a line, an unlit
  // material), or a lobe wide enough that the probe is already the answer.
  if (max(f0.r, max(f0.g, f0.b)) <= 0.0 || roughness > uSSR.roughnessCutoff) {
    return vec4f(0.0);
  }

  let texCoord = texelCenter(coord);
  let position = viewPositionFromDepth(texCoord, depth);
  let normal = normalize(textureLoad(uNormalTexture, coord, 0).rgb * 2.0 - 1.0);
  let view = normalize(-position);

  // R2, an additive low-discrepancy sequence: the per-pixel noise decorrelates
  // neighbours, and shifting it by the frame keeps successive frames spread out
  // however many of them the temporal pass has accumulated.
  let noiseSize = vec2i(textureDimensions(uNoiseTexture));
  let noise = textureLoad(uNoiseTexture, halfCoord % noiseSize, 0).rg;
  let u = fract(noise + uSSR.frame * vec2f(0.7548776662, 0.5698402909));

  let alpha = max(roughness * roughness, 1.0e-3);
  let basis = orthonormalBasis(normal);
  let ve = vec3f(dot(view, basis[0]), dot(view, basis[1]), dot(view, basis[2]));
  let NdotV = max(ve.z, 1.0e-4);

  let mirror = isMirror(roughness);
  var direction = reflect(-view, normal);
  var pdf = 0.0;
  if (!mirror) {
    let nh = sampleGGXVNDF(ve, alpha, u);
    direction = reflect(-view, basis * nh);
    // Visible-normal sampling collapses the density to this — no D_v, no
    // half-vector Jacobian left over.
    pdf = smithG1(NdotV, alpha) * ggxD(max(nh.z, 1.0e-4), alpha) / (4.0 * NdotV);
  }
  if (dot(normal, direction) <= 0.0) { return vec4f(0.0); }

  // Along the normal before projecting: a ray leaving a surface is behind it in
  // depth from its very first step, and would otherwise hit the pixel it
  // started from.
  let eyeDistance = -position.z;
  let origin = position + normal * (0.02 + 0.01 * eyeDistance);

  var rayLength = uSSR.maxDistance;
  // Clipped to the near plane: past it the perspective divide flips the ray and
  // the march walks backwards across the screen.
  if (origin.z + direction.z * rayLength > -uSSR.near) {
    rayLength = (-uSSR.near - origin.z) / direction.z;
  }

  let start = projectToScreen(origin);
  let end = projectToScreen(origin + direction * rayLength);
  let texCoord0 = start.xy;
  let delta = end.xy - texCoord0;
  let z0 = start.z;
  let dz = end.z - z0;

  // Clipped to the screen and to the far plane, so no step is spent where there
  // is nothing to sample.
  var tMax = 1.0;
  if (abs(delta.x) > 1.0e-9) {
    tMax = min(tMax, (select(1.0, 0.0, delta.x < 0.0) - texCoord0.x) / delta.x);
  }
  if (abs(delta.y) > 1.0e-9) {
    tMax = min(tMax, (select(1.0, 0.0, delta.y < 0.0) - texCoord0.y) / delta.y);
  }
  if (dz > 1.0e-9) { tMax = min(tMax, (1.0 - z0) / dz); }
  if (tMax <= 0.0) { return vec4f(0.0); }

  // Half a mip-0 texel, in ray parameter: enough to land inside the next cell
  // at any level, small enough never to step over one.
  let nudge = 0.5 / max(length(delta * uSSR.viewportSize), 1.0e-6);

  let maxLevel = i32(uSSR.maxLevel);
  let steps = i32(uSSR.steps);
  var level = 0;
  // Skips the texel the ray starts in, whose recorded surface is the one it is
  // reflecting off.
  var t = min(cellBoundary(texCoord0, delta, uSSR.viewportSize, 0.0) + nudge, tMax);
  var hitT = -1.0;

  for (var i = 0; i < steps; i++) {
    if (t >= tMax) { break; }

    let cellCount = vec2f(textureDimensions(uHiZTexture, level));
    let at = texCoord0 + delta * t;
    let cell = clamp(vec2i(floor(at * cellCount)), vec2i(0), vec2i(cellCount) - 1);
    // Nearest surface anywhere in this cell.
    let nearest = bitcast<f32>(textureLoad(uHiZTexture, cell, level).r);

    let tCell = cellBoundary(at, delta, cellCount, t) + nudge;
    let zEnter = z0 + dz * t;
    let zExit = z0 + dz * min(tCell, tMax);

    // Nowhere in this cell is the ray behind that surface, so nothing in the
    // cell can be what it hits — whichever way its depth is going. Skip it, and
    // take the next one twice as wide.
    if (max(zEnter, zExit) <= nearest) {
      t = tCell;
      level = min(level + 1, maxLevel);
      continue;
    }

    // Something in this cell is in front of the ray. Refine, without advancing:
    // the minimum says where the cell's nearest surface is, not which of its
    // texels holds it.
    if (level > 0) {
      level -= 1;
      continue;
    }

    // A depth buffer records surfaces, not volumes. A ray already this far
    // behind one when it enters the texel went under it rather than into it,
    // and this surface is not what it reflects.
    if (linearDepth(zEnter) - linearDepth(nearest) <= uSSR.thickness) {
      // Where it crosses, when it crosses inside the texel rather than having
      // arrived behind the surface already.
      hitT = select(t, clamp((nearest - z0) / dz, t, min(tCell, tMax)), abs(dz) > 1.0e-9);
      break;
    }
    t = tCell;
  }

  if (hitT < 0.0) { return vec4f(0.0); }

  // Logarithmic: a near-mirror lobe puts the density in the hundreds of
  // thousands, which a half float target stores as infinity.
  return vec4f(
    texCoord0 + delta * hitT - texCoord,
    log2(max(pdf, 1.0e-20)),
    select(HIT_SAMPLED, HIT_MIRROR, mirror),
  );
}
`;

// ─── Resolve ─────────────────────────────────────────────────────────────────

/**
 * One ray per pixel is noise; the same rays read as a small sample set are an
 * image. Each pixel reuses its neighbours' hits, weighting every one by the
 * BRDF it would have had *here* over the density it was actually drawn from —
 * so a ray traced for a neighbour with a different normal contributes what it
 * is worth to this pixel rather than an equal share.
 */
export const ssrResolveShader = () => /* wgsl */ `
${postProcessingStruct}
${ssrStruct}

@group(0) @binding(2) var uTraceTexture: texture_2d<f32>;
@group(0) @binding(3) var uColorTexture: texture_2d<f32>;
@group(0) @binding(4) var uColorTextureSampler: sampler;
@group(0) @binding(5) var uDepthTexture: texture_depth_2d;
@group(0) @binding(6) var uNormalTexture: texture_2d<f32>;
@group(0) @binding(7) var uMaterialTexture: texture_2d<f32>;

override USE_NEIGHBOUR_REUSE: bool = true;

${fullscreenVertex()}
${ssrCommon}

const TAPS = array<vec2i, 5>(
  vec2i(0, 0),
  vec2i(1, 0),
  vec2i(-1, 0),
  vec2i(0, 1),
  vec2i(0, -1)
);

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let halfCoord = vec2i(input.position.xy);
  let coord = sourceCoord(halfCoord);

  let depth = textureLoad(uDepthTexture, coord, 0);
  if (depth >= 1.0) { return vec4f(0.0); }

  let material = textureLoad(uMaterialTexture, coord, 0);
  let roughness = material.a;
  let position = viewPositionFromDepth(texelCenter(coord), depth);
  let normal = normalize(textureLoad(uNormalTexture, coord, 0).rgb * 2.0 - 1.0);
  let view = normalize(-position);
  let NdotV = max(dot(normal, view), 1.0e-4);
  let alpha = max(roughness * roughness, 1.0e-3);

  // World units to pixels at a given eye distance, for the cone footprint below.
  let pixelsPerUnit = uSSR.projectionMatrix[1][1] * uSSR.viewportSize.y * 0.5;

  var radiance = vec3f(0.0);
  var weightSum = 0.0;
  var confidence = 0.0;
  var taps = 0.0;

  // A mirror pixel reuses nothing. Its neighbours' rays left their own surfaces
  // in their own directions, and with no lobe to weight them into there is
  // nothing that makes one of them a sample of this pixel's reflection — it
  // would be a blur, and the blur this surface wants already comes from the mip
  // the cone footprint selects below.
  let mirror = isMirror(roughness);
  let tapCount = select(select(1, 5, USE_NEIGHBOUR_REUSE), 1, mirror);
  for (var i = 0; i < tapCount; i++) {
    let tapCoord = clamp(
      halfCoord + TAPS[i],
      vec2i(0),
      vec2i(uSSR.halfSize) - vec2i(1)
    );
    taps += 1.0;

    let trace = textureLoad(uTraceTexture, tapCoord, 0);
    if (trace.w <= 0.0) { continue; }

    // The hit was stored relative to the pixel that traced it.
    let hitTexCoord = texelCenter(sourceCoord(tapCoord)) + trace.xy;
    // A ray whose origin was pushed off screen by the normal offset can land
    // outside it; sampling that reads the clamped edge, which is not what the
    // ray found.
    if (any(hitTexCoord < vec2f(0.0)) || any(hitTexCoord > vec2f(1.0))) { continue; }
    let hitDepth = textureLoad(
      uDepthTexture,
      vec2i(hitTexCoord * uSSR.viewportSize),
      0
    );
    let hitPosition = viewPositionFromDepth(hitTexCoord, hitDepth);

    let toHit = hitPosition - position;
    let hitDistance = length(toHit);
    if (hitDistance <= 0.0) { continue; }
    let light = toHit / hitDistance;

    let NdotL = dot(normal, light);
    if (NdotL <= 0.0) { continue; }

    // f * cos / pdf, with the Fresnel term left out: it belongs to the split-sum
    // weight the composite applies, and counting it here would apply it twice.
    // A delta lobe has no density to divide by — the one ray is the integral.
    var weight = 1.0;
    if (trace.w < HIT_MIRROR) {
      let halfVector = normalize(light + view);
      let pdf = exp2(trace.z);
      weight =
        ggxD(max(dot(normal, halfVector), 0.0), alpha) *
        smithG2(NdotV, NdotL, alpha) /
        max(4.0 * NdotV * pdf, 1.0e-6);
    }

    // How wide the lobe has spread by the time it reaches the hit, in pixels.
    // Sampling the matching mip is what keeps a rough reflection smooth instead
    // of leaving it to the sample count.
    let footprint = hitDistance * alpha * pixelsPerUnit / max(-hitPosition.z, 1.0e-3);
    let level = clamp(log2(max(footprint, 1.0)), 0.0, uSSR.maxLevel);

    radiance += weight * textureSampleLevel(
      uColorTexture,
      uColorTextureSampler,
      hitTexCoord,
      level
    ).rgb;
    weightSum += weight;
    confidence += edgeFade(hitTexCoord);
  }

  if (weightSum <= 0.0) { return vec4f(0.0); }

  // Radiance is the weighted mean of what the rays found; confidence is how
  // many of them found anything, which is what the composite fades back to the
  // probe with.
  return vec4f(radiance / weightSum, confidence / taps);
}
`;

// ─── Temporal ────────────────────────────────────────────────────────────────

/**
 * The previous frame's reflections, reprojected and blended in.
 *
 * Camera motion only — there are no motion vectors, so a moving object's
 * reflection is rejected by the neighbourhood clamp rather than followed. The
 * clamp is what keeps that a little extra noise instead of a smear.
 */
export const ssrTemporalShader = () => /* wgsl */ `
${postProcessingStruct}
${ssrStruct}

@group(0) @binding(2) var uResolveTexture: texture_2d<f32>;
@group(0) @binding(3) var uHistoryTexture: texture_2d<f32>;
@group(0) @binding(4) var uHistoryTextureSampler: sampler;
@group(0) @binding(5) var uDepthTexture: texture_depth_2d;

/**
 * How many standard deviations of the neighbourhood the history may sit at
 * before it is treated as belonging to something else. The usual TAA range is
 * 1 to 1.5: below it a converging estimate keeps getting clipped back toward
 * the noise, above it a ghost survives long enough to be seen.
 */
const CLAMP_GAMMA = 1.25;

${fullscreenVertex()}
${ssrCommon}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let halfCoord = vec2i(input.position.xy);
  let current = textureLoad(uResolveTexture, halfCoord, 0);
  if (uSSR.historyWeight <= 0.0) { return current; }

  // Moments of the neighbourhood, not its extremes. min/max is not a rejection
  // test on a one-ray-per-pixel signal: the neighbourhood holds the same noise
  // the clamp exists to catch, so the window is wide enough to admit any ghost
  // — and where every ray in it missed, the window collapses to a point and
  // throws away everything accumulated so far. mean ± gamma * sigma is the
  // window the samples actually support.
  let limit = vec2i(uSSR.halfSize) - vec2i(1);
  var sum = vec4f(0.0);
  var sumSquares = vec4f(0.0);
  var hits = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let neighbour = textureLoad(
        uResolveTexture,
        clamp(halfCoord + vec2i(x, y), vec2i(0), limit),
        0
      );
      sum += neighbour;
      sumSquares += neighbour * neighbour;
      hits += select(0.0, 1.0, neighbour.w > 0.0);
    }
  }

  let coord = sourceCoord(halfCoord);
  let depth = textureLoad(uDepthTexture, coord, 0);
  let position = viewPositionFromDepth(texelCenter(coord), depth);
  let previous = uSSR.reprojectionMatrix * vec4f(position, 1.0);
  if (previous.w <= 0.0) { return current; }

  let previousTexCoord = vec2f(
    previous.x / previous.w * 0.5 + 0.5,
    0.5 - previous.y / previous.w * 0.5
  );
  // Off screen last frame: there is nothing to accumulate onto.
  if (any(previousTexCoord < vec2f(0.0)) || any(previousTexCoord > vec2f(1.0))) {
    return current;
  }

  let history = textureSampleLevel(
    uHistoryTexture,
    uHistoryTextureSampler,
    previousTexCoord,
    0.0
  );

  // Nothing within reach found a reflection this frame, so there is no
  // neighbourhood to clamp against. Letting the history decay at the blend's
  // own rate is what tells the two cases apart without having to know which
  // this is: a frame whose rays happened to miss is one step of noise the
  // accumulation absorbs, and a reflection that has genuinely gone fades over
  // the same handful of frames.
  if (hits == 0.0) { return mix(current, history, uSSR.historyWeight); }

  let mean = sum / 9.0;
  // The epsilon keeps a neighbourhood that agrees exactly — a flat region, or
  // one quantised to the same half float — from collapsing the window onto a
  // single value and rejecting a history that differs in the last bit.
  let deviation =
    sqrt(max(sumSquares / 9.0 - mean * mean, vec4f(0.0))) * CLAMP_GAMMA +
    vec4f(1.0e-3);

  return mix(
    current,
    clamp(history, mean - deviation, mean + deviation),
    uSSR.historyWeight,
  );
}
`;

/**
 * Straight copy: into the texture the next frame reads as its history, into mip
 * 0 of the radiance pyramid, into a thumbnail. Sampled rather than loaded, so
 * the same shader serves a copy at size and one that scales.
 */
export const copyShader = () => /* wgsl */ `
${postProcessingStruct}

@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uTextureSampler: sampler;

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSampleLevel(uTexture, uTextureSampler, input.texCoord0, 0.0);
}
`;

// ─── Composite ───────────────────────────────────────────────────────────────

/**
 * The traced reflection in place of the probe's.
 *
 * `indirectSpecular` is what the main pass already applied for this pixel, so
 * subtracting it and adding the traced radiance under the same split-sum weight
 * *replaces* that term rather than piling onto it — an SSR that only ever adds
 * makes every reflective surface brighter as it turns on. Where the ray found
 * nothing the confidence is zero, the two terms cancel, and the probe is left
 * exactly as it was.
 */
export const ssrCompositeShader = () => /* wgsl */ `
${postProcessingStruct}
${ssrStruct}

@group(0) @binding(2) var uTexture: texture_2d<f32>;
@group(0) @binding(3) var uReflectionTexture: texture_2d<f32>;
@group(0) @binding(4) var uDepthTexture: texture_depth_2d;
@group(0) @binding(5) var uNormalTexture: texture_2d<f32>;
@group(0) @binding(6) var uMaterialTexture: texture_2d<f32>;
@group(0) @binding(7) var uIndirectSpecularTexture: texture_2d<f32>;

${fullscreenVertex()}
${ssrCommon}

const BILINEAR = array<vec2i, 4>(
  vec2i(0, 0),
  vec2i(1, 0),
  vec2i(0, 1),
  vec2i(1, 1)
);

/**
 * Half-res reflections back to full res, weighted by how well each tap's own
 * pixel agrees in depth with this one. A plain bilinear upsample bleeds a
 * reflection across every silhouette in the frame.
 */
fn upsample(coord: vec2i, eyeDistance: f32) -> vec4f {
  let position = (vec2f(coord) + 0.5) * 0.5 - 0.5;
  let base = vec2i(floor(position));
  let fraction = position - vec2f(base);
  let limit = vec2i(uSSR.halfSize) - vec2i(1);

  var sum = vec4f(0.0);
  var weightSum = 0.0;
  for (var i = 0; i < 4; i++) {
    let offset = BILINEAR[i];
    let tapCoord = clamp(base + offset, vec2i(0), limit);
    let bilinear =
      mix(1.0 - fraction.x, fraction.x, f32(offset.x)) *
      mix(1.0 - fraction.y, fraction.y, f32(offset.y));

    let tapDepth = textureLoad(uDepthTexture, sourceCoord(tapCoord), 0);
    let weight = bilinear / (1.0e-3 + abs(linearDepth(tapDepth) - eyeDistance));

    sum += weight * textureLoad(uReflectionTexture, tapCoord, 0);
    weightSum += weight;
  }
  return sum / max(weightSum, 1.0e-6);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let coord = vec2i(input.position.xy);
  let color = textureLoad(uTexture, coord, 0);

  let depth = textureLoad(uDepthTexture, coord, 0);
  let material = textureLoad(uMaterialTexture, coord, 0);
  let f0 = material.rgb;
  if (depth >= 1.0 || max(f0.r, max(f0.g, f0.b)) <= 0.0) { return color; }

  let position = viewPositionFromDepth(texelCenter(coord), depth);
  let normal = normalize(textureLoad(uNormalTexture, coord, 0).rgb * 2.0 - 1.0);
  let NdotV = max(dot(normal, normalize(-position)), 1.0e-4);

  let reflection = upsample(coord, linearDepth(depth));
  let weight = saturateF32(reflection.a * uSSR.intensity);
  let indirectSpecular = textureLoad(uIndirectSpecularTexture, coord, 0).rgb;
  let specular = reflection.rgb * envBRDF(f0, material.a, NdotV);

  return vec4f(
    max(color.rgb + (specular - indirectSpecular) * weight, vec3f(0.0)),
    color.a
  );
}
`;

/**
 * A copy with a tint, for the override demo: same texel-for-texel copy as the
 * pipeline's own grab pass, only obviously different on screen. No uniform
 * block at binding 0 — the pass this replaces has none, and an override keeps
 * everything about a declaration except what it draws.
 */
export const tintedCopyShader = () => /* wgsl */ `
struct Tint {
  color: vec3f,
  saturation: f32,
}
@group(0) @binding(0) var<uniform> uTint: Tint;
@group(0) @binding(1) var uTexture: texture_2d<f32>;

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let color = textureLoad(uTexture, vec2i(input.position.xy), 0);
  let luminance = dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722));
  return vec4f(mix(vec3f(luminance), color.rgb, uTint.saturation) * uTint.color, color.a);
}
`;

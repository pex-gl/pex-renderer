import { mapValues } from "../utils.js";

// Binding primitives

/** A material texture's `@group(2)` uniform binding slot (texture + sampler). */
export interface MaterialTextureBinding {
  texture: number;
  sampler: number;
}

/** Sequential `@binding` counter for a single bind group. */
export interface BindingAllocator {
  next: () => number;
  nextTextureSampler: () => MaterialTextureBinding;
}

/**
 * Curries a pipeline shader's `options.texCoords` (per-texture-slot texCoord
 * set) into a `tc(key)` lookup, defaulting to set 0 when a slot isn't assigned
 * — shared so every generator's texCoord-set expressions read the same options
 * shape the same way.
 */
export function getTexCoordGetter(
  texCoords: Record<string, number>,
): (key: string) => number {
  return (key) => texCoords[key] ?? 0;
}

/**
 * Turns a whole `DEFINE`-style map (e.g. `shaders/standard.ts`'s
 * `MATERIAL_DEFINE`/`VERTEX_DEFINE`) into a flags object of the same shape, one
 * `defines.has(...)` check per key — the read-side counterpart to
 * `getFeatureFlags`'s write-side walk, replacing one hand-written `const useX =
 * defines.has(DEFINE.x)` per define with a single call.
 */
export function getDefineFlags<T extends Record<string, string>>(
  defineMap: T,
  defines: Set<string>,
): { [K in keyof T]: boolean } {
  return mapValues(defineMap, (value) => defines.has(value)) as {
    [K in keyof T]: boolean;
  };
}

/**
 * Curries a bind group's binding counter into a closure (not a class — matches
 * the getTexCoordGetter/getDefineFlags factory idiom and keeps the module
 * tree-shakeable). Material groups reserve binding 0 for the uMaterial struct,
 * so start at 1; the light group has no reserved slot, so start at 0.
 */
export function createBindingAllocator(start = 0): BindingAllocator {
  let next = start;
  return {
    next: () => next++,
    nextTextureSampler: () => ({ texture: next++, sampler: next++ }),
  };
}

/**
 * A single `@group @binding var` declaration line — the primitive every other
 * binding declaration here is built from. `addressSpace` (e.g. `"uniform"`) is
 * omitted for handle types (textures/samplers), which take none in WGSL.
 */
export function bindingDeclaration(
  group: number,
  binding: number,
  name: string,
  type: string,
  addressSpace = "",
): string {
  const qualifier = addressSpace ? `<${addressSpace}>` : "";
  return `@group(${group}) @binding(${binding}) var${qualifier} ${name}: ${type};`;
}

// Uniform naming conventions. These are the single source shared by both the
// decl side (textureSamplerDeclaration / textureMatrixField here) and the
// runtime uniform-write side (getFeatureFlags in systems/renderer/base.ts, and
// the light writes in systems/renderer/standard.ts), so a shader can never
// declare a name the renderer writes under a different one.

/**
 * Property/feature key → its `u`-prefixed uniform var name:
 * `"baseColorTexture"` → `"uBaseColorTexture"`, `"directionalShadowMap0"` →
 * `"uDirectionalShadowMap0"`. The `u`+capitalize convention for every uniform
 * (textures, light arrays, shadow maps) lives here.
 */
export function uniformName(key: string): string {
  return `u${key[0]!.toUpperCase()}${key.slice(1)}`;
}

/**
 * Texture/shadow-map var name → its paired sampler var name:
 * `"uBaseColorTexture"` → `"uBaseColorTextureSampler"`.
 */
export function samplerName(varName: string): string {
  return `${varName}Sampler`;
}

/**
 * Material-feature key → its KHR_texture_transform matrix name:
 * `"baseColorTexture"` → `"baseColorTextureMatrix"`.
 */
export function textureMatrixName(key: string): string {
  return `${key}Matrix`;
}

// Declaration builders

/**
 * One texture+sampler binding-pair declaration, or "" when the pair is unused.
 * Shared by material textures (non-comparison sampler) and shadow maps (depth
 * texture + comparison sampler) — they differ only by group, texture kind and
 * sampler kind.
 */
export function textureSamplerDeclaration(
  group: number,
  binding: MaterialTextureBinding | null,
  varName: string,
  kind = "texture_2d<f32>",
  samplerKind = "sampler",
): string {
  return binding
    ? `${bindingDeclaration(group, binding.texture, varName, kind)}\n${bindingDeclaration(group, binding.sampler, samplerName(varName), samplerKind)}`
    : "";
}

/**
 * KHR_texture_transform struct field for a texture, or "" when absent. `key` is
 * the full material-feature key (e.g. `"baseColorTexture"`), emitting
 * `baseColorTextureMatrix: mat3x3f,`.
 */
export function textureMatrixField(
  key: string,
  binding: MaterialTextureBinding | null,
): string {
  return binding ? `${textureMatrixName(key)}: mat3x3f,` : "";
}

/**
 * A runtime-sized light-array storage declaration, or "" when the scene has
 * none of that type (consuming no binding in that case, so the counter only
 * advances for arrays that are actually declared).
 *
 * Runtime-sized rather than fixed: the shader is then independent of how many
 * lights there are, so adding one is a buffer write rather than a recompile.
 * The count comes from `arrayLength()`, which is exact because the binding is
 * only declared when there is at least one light to put in it.
 */
export function lightArrayDeclaration(
  group: number,
  alloc: BindingAllocator,
  name: string,
  structName: string,
  present: boolean,
): string {
  return present
    ? bindingDeclaration(
        group,
        alloc.next(),
        name,
        `array<${structName}>`,
        "storage, read",
      )
    : "";
}

// Uniform struct builders

/** Options for {@link frameStruct}. */
export interface FrameStructOptions {
  /**
   * Extra trailing struct members, appended verbatim (e.g. depth-pass's `"far:
   * f32,"` for omni shadows).
   */
  extraFields?: string;
}

/** The `@group(0)` per-frame uniform block, shared by every pass. */
export function frameStruct({
  extraFields = "",
}: FrameStructOptions = {}): string {
  return `struct Frame {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  inverseViewMatrix: mat4x4f,
  cameraPosition: vec3f,
  viewportSize: vec2f,
  // Sub-pixel NDC offset for temporal antialiasing, zero without it. Applied
  // after projection rather than baked into projectionMatrix, so everything
  // reconstructing view position from that matrix — ambient occlusion,
  // transmission, depth of field — keeps reading an unjittered one.
  jitter: vec2f,
  // Last frame's projectionMatrix * viewMatrix, unjittered. Only a pass writing
  // motion vectors reads it; it costs one matrix in a block that already
  // carries three, which is cheaper than a second variant of every shader.
  previousViewProjectionMatrix: mat4x4f,
  ${extraFields}
}
${bindingDeclaration(0, 0, "uFrame", "Frame", "uniform")}`;
}

/**
 * The jitter offset, applied to a clip-space position after projection.
 *
 * Multiplied by `w` because the perspective divide has not happened yet: the
 * offset has to survive it as a constant NDC displacement. Emitted at the end of
 * every rasterizing vertex stage — and nowhere in a shadow pass, whose camera is
 * the light and whose result is sampled, not resolved.
 */
export const vertexJitter = (position = "output.position"): string =>
  `${position} += vec4f(uFrame.jitter * ${position}.w, 0.0, 0.0);`;

/**
 * Varyings a pass writing motion vectors carries.
 *
 * Both clip positions rather than the screen-space offset itself: the offset is
 * not linear under perspective, so interpolating it would bend every motion
 * vector towards the triangle's interior. The divide belongs per fragment.
 *
 * Both are unjittered. The jitter says where geometry was rasterized, not where
 * a surface went, and leaving it in would report the sampling pattern as motion.
 */
export const VELOCITY_MEMBERS: readonly ShaderStructMember[] = [
  { name: "positionClip", type: "vec4f" },
  { name: "previousPositionClip", type: "vec4f" },
];

/** Options for {@link vertexVelocity}. */
export interface VertexVelocityOptions {
  /** Expression for this frame's unjittered clip position. */
  clip?: string;
  /**
   * Expression for the previous frame's world position. Defaults to the current
   * local position through `previousModelMatrix`, which covers rigid motion —
   * a skinned or morphed surface has no previous local position to offer yet,
   * and passes its current world position to report camera motion alone.
   */
  previousWorld?: string;
}

/** Vertex-stage half of the motion vector: both clip positions, unjittered. */
export const vertexVelocity = ({
  clip = "positionOut",
  previousWorld = "uModel.previousModelMatrix * position",
}: VertexVelocityOptions = {}): string =>
  `output.positionClip = ${clip};
  output.previousPositionClip = uFrame.previousViewProjectionMatrix * (${previousWorld});`;

/**
 * Where this vertex was last frame, in world space — the other half of what a
 * motion vector is made of.
 *
 * Emitted after `vertexTransform`, which is what makes the two branches differ:
 * the plain path finds `position` already carrying this frame's instancing,
 * which is last frame's too while instance attributes are static, so the
 * previous model matrix is all it needs. The skin path finds `position`
 * untouched — `vertexTransform` instances the skinned world position, not the
 * local one — so it composes the same chain itself from last frame's joints.
 */
export function vertexPreviousWorld({
  useSkin = false,
  instancedScale = false,
  instancedRotation = false,
  instancedOffset = false,
  previousPosition = false,
  previousInstancedScale = false,
  previousInstancedRotation = false,
  previousInstancedOffset = false,
}: VertexTransformFlags & VertexInputFlags): string {
  // Last frame's values where the geometry system kept them, this frame's
  // where it did not — an attribute it never saw change holds the same data for
  // both frames, so reading the current one is not an approximation.
  const previousInstancing = {
    instancedScale,
    instancedRotation,
    instancedOffset,
  };
  const attribute = {
    scale: previousInstancedScale ? "input.previousScale" : "input.scale",
    rotation: previousInstancedRotation
      ? "input.previousRotation"
      : "input.rotation",
    offset: previousInstancedOffset ? "input.previousOffset" : "input.offset",
  };
  const local = previousPosition
    ? "vec4f(input.previousPosition, 1.0)"
    : "position";

  if (!useSkin) {
    // The plain path instances the local position before the model matrix, so
    // it has to redo that chain whenever either half has a previous value.
    const deforming =
      previousPosition ||
      previousInstancedScale ||
      previousInstancedRotation ||
      previousInstancedOffset;
    if (!deforming) {
      return "var previousPositionWorld = uModel.previousModelMatrix * position;";
    }

    return [
      `var previousLocalPosition = ${local};`,
      ...instancedOps("previousLocalPosition", previousInstancing, {
        rotationMat: "previousRotationMat",
        attribute,
      }),
      "var previousPositionWorld = uModel.previousModelMatrix * previousLocalPosition;",
    ].join("\n  ");
  }

  return [
    skinMatrix("previousSkinMat", "uPreviousJointMatrices"),
    `var previousPositionWorld = previousSkinMat * ${local};`,
    ...instancedOps("previousPositionWorld", previousInstancing, {
      rotationMat: "previousRotationMat",
      attribute,
    }),
  ].join("\n  ");
}

/**
 * Fragment-stage half: where this surface was last frame, minus where it is now,
 * in texture coordinates.
 *
 * `previous - current` so a reader adds it to its own coordinate to find the
 * history, and scaled by (0.5, -0.5) because NDC spans [-1, 1] with Y up where
 * texture coordinates span [0, 1] with V down.
 */
export const FRAGMENT_VELOCITY = `output.velocity =
    (input.previousPositionClip.xy / input.previousPositionClip.w -
      input.positionClip.xy / input.positionClip.w) * vec2f(0.5, -0.5);`;

/** Options for {@link modelStruct}. */
export interface ModelStructOptions {
  /**
   * Declare `previousModelMatrix`, for a pass writing motion vectors. Gated
   * rather than always present because this block is written per entity.
   */
  previousModelMatrix?: boolean;
  /**
   * Declare the displacement texture (bindings 2/3) and its `displacement`
   * struct field.
   */
  displacementTexture?: boolean;
  /** Declare the skin joint-matrix array (binding 1). */
  skin?: boolean;
  /**
   * Declare last frame's joint-matrix array (binding 4), for a skinned pass
   * writing motion vectors. Doubles what a skinned entity uploads, so it is
   * gated separately from `skin`.
   */
  previousSkin?: boolean;
  /** Skin joint-matrix array length. */
  maxJoints?: number;
}

/**
 * The `@group(3)` per-model uniform block plus its optional skin joint-matrix
 * (binding 1) and displacement texture (bindings 2/3) decls — the same layout
 * in every pass.
 */
export function modelStruct({
  previousModelMatrix = false,
  displacementTexture = false,
  skin = false,
  previousSkin = false,
  maxJoints = 256,
}: ModelStructOptions = {}): string {
  return `struct Model {
  modelMatrix: mat4x4f,
  normalMatrix: mat3x3f,
  ${previousModelMatrix ? "previousModelMatrix: mat4x4f," : ""}
  ${displacementTexture ? "displacement: f32," : ""}
}
${bindingDeclaration(3, 0, "uModel", "Model", "uniform")}
${skin ? bindingDeclaration(3, 1, "uJointMatrices", `array<mat4x4f, ${maxJoints}>`, "uniform") : ""}
${skin && previousSkin ? bindingDeclaration(3, 4, "uPreviousJointMatrices", `array<mat4x4f, ${maxJoints}>`, "uniform") : ""}
${displacementTexture ? textureSamplerDeclaration(3, { texture: 2, sampler: 3 }, "uDisplacementTexture") : ""}`;
}

// Vertex stage: input struct and the transform body it feeds.

/** Geometry/instancing attributes gated into a pass's `VertexInput`. */
export interface VertexInputFlags {
  normal?: boolean;
  tangent?: boolean;
  texCoord0?: boolean;
  texCoord1?: boolean;
  vertexColor?: boolean;
  instancedOffset?: boolean;
  instancedScale?: boolean;
  instancedRotation?: boolean;
  instancedColor?: boolean;
  skin?: boolean;
  // Last frame's values, present only once the geometry system has seen the
  // attribute change — a surface that never deforms has none.
  previousPosition?: boolean;
  previousInstancedOffset?: boolean;
  previousInstancedScale?: boolean;
  previousInstancedRotation?: boolean;
}

/** A WGSL IO struct member: field name and type. */
export interface ShaderStructMember {
  name: string;
  type: string;
}

/**
 * Emits struct members with sequential `@location` indices, skipping falsy
 * entries so optional members gate inline with `cond && { … }`. Locations are
 * assigned in list order with no gaps, so members are added or removed without
 * hand-numbering. `start` offsets the first index (past a fixed leading member).
 * The numbers are only ever matched back by name — vertex inputs via reflection
 * (pex-gpu `vertex-layout.ts`), varyings by the shared vertex/fragment struct —
 * so their order and uniqueness matter, not their values.
 */
function locationMembers(
  members: readonly (ShaderStructMember | false | null | undefined)[],
  start = 0,
): string {
  return members
    .filter((member): member is ShaderStructMember => Boolean(member))
    .map(
      ({ name, type }, index) => `@location(${start + index}) ${name}: ${type},`,
    )
    .join("\n  ");
}

// VertexInput attributes gated by their flag, in @location order. Position is
// always present and leads (see vertexInputStruct); every other attribute is
// omitted when its flag is unset.
const VERTEX_ATTRIBUTES: readonly (ShaderStructMember & {
  flag: keyof VertexInputFlags;
})[] = [
  { flag: "normal", name: "normal", type: "vec3f" },
  { flag: "tangent", name: "tangent", type: "vec4f" },
  { flag: "texCoord0", name: "texCoord0", type: "vec2f" },
  { flag: "texCoord1", name: "texCoord1", type: "vec2f" },
  { flag: "vertexColor", name: "vertexColor", type: "vec4f" },
  { flag: "instancedOffset", name: "offset", type: "vec3f" },
  { flag: "instancedScale", name: "scale", type: "vec3f" },
  { flag: "instancedRotation", name: "rotation", type: "vec4f" },
  { flag: "instancedColor", name: "instanceColor", type: "vec4f" },
  { flag: "skin", name: "joint", type: "vec4f" },
  { flag: "skin", name: "weight", type: "vec4f" },
  { flag: "previousPosition", name: "previousPosition", type: "vec3f" },
  { flag: "previousInstancedOffset", name: "previousOffset", type: "vec3f" },
  { flag: "previousInstancedScale", name: "previousScale", type: "vec3f" },
  { flag: "previousInstancedRotation", name: "previousRotation", type: "vec4f" },
];

export function vertexInputStruct(flags: VertexInputFlags): string {
  return `struct VertexInput {
  ${locationMembers([
    { name: "position", type: "vec3f" },
    ...VERTEX_ATTRIBUTES.map((attribute) => flags[attribute.flag] && attribute),
  ])}
}`;
}

/**
 * A vertex stage's output struct: the `@builtin(position)` clip position
 * followed by sequentially-located user members (falsy entries skipped). Every
 * pass shares this `VertexOutput` shape; the `@location`s are private to the
 * vertex/fragment pair, so they are assigned in order, not hand-numbered.
 *
 * `@invariant` is what makes a depth pre-pass safe. Two shaders computing the
 * same clip position from the same inputs are only guaranteed the same result
 * bit-for-bit if both declare it — a driver is otherwise free to contract
 * multiply-adds differently in each, and the depth-only and shading passes
 * differ in everything around the transform. Without it the second pass'
 * `less-equal` test fails on the fragments that landed a few ULPs further away,
 * which reads as hatching and dropouts across every surface.
 */
export function vertexOutputStruct(
  members: readonly (ShaderStructMember | false | null | undefined)[],
): string {
  return `struct VertexOutput {
  @invariant @builtin(position) position: vec4f,
  ${locationMembers(members)}
}`;
}

/**
 * Vertex-stage transform flags: which instancing attributes are active and
 * whether the pass needs the normal/tangent carried through the transform.
 */
export interface VertexTransformFlags {
  useSkin?: boolean;
  instancedScale?: boolean;
  instancedRotation?: boolean;
  instancedOffset?: boolean;
  /**
   * Transform the normal into view space and write `output.normalView`. The
   * depth-only pass, which needs position alone, leaves this off.
   */
  transformNormal?: boolean;
  /**
   * Pre-transform the tangent by the skin matrix (standard's normal-mapping
   * path only; unused by both depth passes).
   */
  transformTangent?: boolean;
}

/** Weighted blend of the four influencing joints, from `array` into `name`. */
const skinMatrix = (name: string, array: string) => `let ${name} =
    input.weight.x * ${array}[u32(input.joint.x)] +
    input.weight.y * ${array}[u32(input.joint.y)] +
    input.weight.z * ${array}[u32(input.joint.z)] +
    input.weight.w * ${array}[u32(input.joint.w)];`;

const SKIN_MATRIX = skinMatrix("skinMat", "uJointMatrices");

/**
 * Per-instance scale, rotation and offset applied to `target`, in that order.
 *
 * Shared by the current and previous transforms so the two cannot drift: they
 * have to compose identically, or the difference between them reads as motion
 * that never happened.
 */
function instancedOps(
  target: string,
  {
    instancedScale = false,
    instancedRotation = false,
    instancedOffset = false,
  }: VertexTransformFlags,
  {
    rotationMat = "rotationMat",
    transformNormal = false,
    attribute = {
      scale: "input.scale",
      rotation: "input.rotation",
      offset: "input.offset",
    },
  }: {
    rotationMat?: string;
    transformNormal?: boolean;
    attribute?: { scale: string; rotation: string; offset: string };
  } = {},
): string[] {
  return [
    instancedScale &&
      `${target} = vec4f(${target}.xyz * ${attribute.scale}, ${target}.w);`,
    instancedRotation &&
      `let ${rotationMat} = quatToMat4(${attribute.rotation});\n  ${target} = ${rotationMat} * ${target};${transformNormal ? `\n  normal = (${rotationMat} * vec4f(normal, 0.0)).xyz;` : ""}`,
    instancedOffset &&
      `${target} = vec4f(${target}.xyz + ${attribute.offset}, ${target}.w);`,
  ].filter(Boolean) as string[];
}

/**
 * The shared vertex-stage transform: declares `positionWorld` and applies skin
 * (or model-matrix) plus instanced scale/rotation/offset, optionally carrying
 * the normal (and skinned tangent) through. Emits `output.normalView` when
 * `transformNormal` is set. Assumes `position`/`normal`/`tangent`/`output` are
 * already in scope (matching each pass's vertexMain).
 */
export function vertexTransform({
  useSkin = false,
  instancedScale = false,
  instancedRotation = false,
  instancedOffset = false,
  transformNormal = false,
  transformTangent = false,
}: VertexTransformFlags): string {
  const instancing = { instancedScale, instancedRotation, instancedOffset };

  const branch = useSkin
    ? [
        SKIN_MATRIX,
        transformNormal && "normal = (skinMat * vec4f(normal, 0.0)).xyz;",
        "positionWorld = skinMat * position;",
        ...instancedOps("positionWorld", instancing, { transformNormal }),
        transformTangent && "tangent = skinMat * vec4f(tangent.xyz, 0.0);",
        transformNormal &&
          "output.normalView = (uFrame.viewMatrix * vec4f(normal, 0.0)).xyz;",
      ]
    : [
        ...instancedOps("position", instancing, { transformNormal }),
        "positionWorld = uModel.modelMatrix * position;",
        transformNormal && "output.normalView = uModel.normalMatrix * normal;",
      ];

  return `var positionWorld: vec4f;
  ${branch.filter(Boolean).join("\n\n  ")}`;
}

// Fragment stage

/**
 * The fragment stage's `FragmentOutput` struct: the always-present color
 * target (`@location(0)`) plus whatever extra MRT members the caller passes,
 * assigned sequential locations in that order via `locationMembers` — the same
 * scheme `vertexOutputStruct` uses, and for the same reason: a shader picks its
 * own member types (a motion-vector target might be `vec2f`, not `vec4f`) so
 * this only owns the location numbering, not the shape. Called with no args
 * it's the color-only form the depth pre-pass and post-processing blits use.
 * The render pipeline builds its `color: [...]` pass attachments in this same
 * fixed order, so the emitted `@location`s line up with attachment index
 * without either side passing numbers to the other.
 */
export function fragmentOutputStruct(
  members: readonly (ShaderStructMember | false | null | undefined)[] = [],
): string {
  return `struct FragmentOutput {
  ${locationMembers([{ name: "color", type: "vec4f" }, ...members])}
}`;
}

/** Format shaders */
export function formatShader(source: string) {
  return source.replaceAll(/\n\s*\n/g, "\n\n");
}

import type {
  ComputePipeline,
  GpuContext,
  GpuTexture,
  GpuBuffer,
  ExternalImageSource,
  RenderCommand,
  RenderPipeline,
} from "pex-gpu";
import type { Vec2, Vec3, Quat, Mat3, Mat4 } from "pex-math";
import type { FrameGraph, ResourceHandle } from "./frame-graph/index.js";
import type { LightKind } from "./systems/render-pipeline/shadow-mapping.js";

/** Axis-aligned bounding box as [min, max]. */
export type AABB = number[][];
/** RGB or RGBA color, components in [0, 1]. */
export type Color = number[];

/** UV transform applied to a material texture. */
export interface TextureTransform {
  /** [x, y] */
  offset?: Vec2;
  /** Angle in radians. */
  rotation?: number;
  /** [x, y] */
  scale?: Vec2;
  /** Vertex texCoord set to sample: 0 (texCoord0) or 1 (texCoord1). */
  texCoord?: 0 | 1;
  /**
   * Per-texture sampler override (e.g. from a glTF sampler's wrap/filter
   * settings). Falls back to the renderer's shared default sampler when unset.
   */
  sampler?: GPUSampler;
}

/**
 * A material texture: a GPU texture, its properties optionally decorated
 * directly onto the texture object with a UV transform, texCoord set and/or
 * sampler override. The nested `{ texture, ... }` form is used whenever any of
 * these are set; a bare GpuTexture is used otherwise.
 */
export type MaterialTexture =
  | GpuTexture
  | ({ texture: GpuTexture } & Partial<TextureTransform>);

/**
 * A single vertex/index attribute value on a geometry component: a plain typed
 * array/number array, or a GPU-backed descriptor (e.g. built by the glTF
 * loader to share one buffer across attributes/primitives from the same
 * bufferView).
 */
export type GeometryAttribute =
  | Float32Array
  | Uint16Array
  | Uint32Array
  | number[]
  | {
      buffer: GpuBuffer;
      /** Raw data backing the buffer, e.g. for bounds computation. */
      data?: Float32Array | Uint16Array | Uint32Array | number[];
      /** Byte offset into the buffer. */
      offset?: number;
      /** Byte stride override. */
      stride?: number;
      /** "instance" to step this attribute per instance instead of per vertex. */
      stepMode?: GPUVertexStepMode;
      /** Re-uploads the buffer's data on the next geometry-system update. */
      dirty?: boolean;
    };

// Entity
export interface Entity {
  id: number;
  /** Debug/display label, e.g. set by loaders and helper tools. */
  name?: string;
  ambientLight?: AmbientLightComponentOptions;
  animation?: AnimationComponentOptions;
  /** Multiple named animations (e.g. from a glTF file); systems/animation.ts plays these instead of `animation` when set. */
  animations?: AnimationComponentOptions[];
  areaLight?: AreaLightComponentOptions;
  axesHelper?: AxesHelperComponentOptions;
  boundingBoxHelper?: BoundingBoxHelperComponentOptions;
  skeletonHelper?: SkeletonHelperComponentOptions;
  cameraHelper?: CameraHelperComponentOptions;
  camera?: CameraComponentOptions;
  directionalLight?: DirectionalLightComponentOptions;
  geometry?: GeometryComponentOptions;
  gridHelper?: GridHelperComponentOptions;
  lightHelper?: LightHelperComponentOptions;
  material?: MaterialComponentOptions;
  morph?: MorphComponentOptions;
  orbiter?: OrbiterComponentOptions;
  pointLight?: PointLightComponentOptions;
  postProcessing?: PostProcessingComponentOptions;
  reflectionProbe?: ReflectionProbeComponentOptions;
  skin?: SkinComponentOptions;
  skybox?: SkyboxComponentOptions;
  spotLight?: SpotLightComponentOptions;
  transform?: TransformComponentOptions;
  vertexHelper?: VertexHelperComponentOptions;
  /** Layer name used to filter entities per render view. */
  layer?: string | undefined;
  /** Cached transform state, added by the transform system. */
  _transform?: TransformCache;
  /** Cached geometry GPU resources, added by the geometry system. */
  _geometry?: GeometryCache;
  /** Baked IBL GPU resources, added by the reflection-probe system. */
  _reflectionProbe?: ReflectionProbeCache;
}

/**
 * Baked image-based lighting resources for a reflection probe entity. Field
 * naming follows the glTF `EXT_lights_image_based` vocabulary (specular cubemap
 * + irradiance coefficients) so a future loader maps onto it directly.
 */
export interface ReflectionProbeCache {
  /** Prefiltered specular radiance cubemap (roughness mapped to mip level). */
  specularTexture: GpuTexture;
  /** L2 spherical harmonics diffuse irradiance coefficients (9 × vec4f). */
  irradianceCoefficients: GpuBuffer;
  /** Trilinear sampler for the specular cubemap. */
  sampler: GPUSampler;
  /** Mip levels in specularTexture; drives the shader's roughness-to-lod mapping. */
  roughnessLevels: number;
  /** Rotation applied to the sampled reflection/normal directions. */
  rotation?: Mat3 | undefined;
  /** Multiplier applied to the probe's indirect diffuse + specular output. */
  intensity?: number | undefined;
}

// Components
export interface AmbientLightComponentOptions {
  color?: Color;
  intensity?: number;
}
export interface AnimationComponentOptions {
  name?: string;
  playing?: boolean;
  loop?: boolean;
  time?: number;
  /** Total animation length in seconds; falls back to the last channel's input when unset. */
  duration?: number;
  channels?: unknown[];
}
/** Shadow-mapping internals shared by shadow-casting lights. */
export interface LightShadowInternals {
  _projectionMatrix?: Mat4;
  _viewMatrix?: Mat4;
  _direction?: Vec3;
  _near?: number;
  _far?: number;
  _radiusUV?: Vec2;
  /**
   * The size-bucketed array this light's shadow map is a layer of, shared with
   * every other caster that asked for the same size.
   */
  _shadowMap?: GpuTexture;
  _shadowCubemap?: GpuTexture;
  /** Which bucket binding the shader samples, and the light's slot in it. */
  _shadowBucket?: number;
  _shadowLayer?: number;
  _sceneBboxInLightSpace?: AABB;
  _sceneBbox?: AABB;
}
export interface AreaLightComponentOptions extends LightShadowInternals {
  color?: Color;
  intensity?: number;
  disk?: boolean;
  doubleSided?: boolean;
  /** Shadow-map rasterizer constant depth bias. */
  depthBias?: number;
  /**
   * Shadow-map rasterizer slope-scaled depth bias, the effective term on a
   * float depth map (raise to remove acne).
   */
  depthBiasSlopeScale?: number;
  /**
   * Upper bound on the applied depth bias to limit peter-panning (0 disables
   * the clamp).
   */
  depthBiasClamp?: number;
  /**
   * Soft-shadow (PCSS) light radius in world units (scaled by the light's
   * transform): larger widens the penumbra.
   */
  bulbRadius?: number;
  castShadows?: boolean;
  shadowMapSize?: number;
}
export interface AxesHelperComponentOptions {}
export interface BoundingBoxHelperComponentOptions {
  color?: Color;
}
export interface SkeletonHelperComponentOptions {
  color?: Color | Color[];
}
export interface CameraHelperComponentOptions {
  color?: Color;
}
export interface CameraView {
  totalSize?: Vec2;
  size?: Vec2;
  offset?: Vec2;
}
export interface CameraComponentOptions {
  projection?: "perspective" | "orthographic";
  near?: number;
  far?: number;
  aspect?: number;
  clearColor?: Color;
  viewMatrix?: Mat4;
  inverseViewMatrix?: Mat4;
  culling?: boolean;
  /** Focal length of the camera lens [10mm - 200mm] in mm. */
  focalLength?: number;
  /** Ratio of camera lens opening, f-number, f/N, aperture [1.2 - 32] in mm. */
  fStop?: number;
  /** Physical camera sensor or film size [sensorWidth, sensorHeight] in mm. */
  sensorSize?: Vec2;
  /** Matching of camera frame to sensor frame. */
  sensorFit?: "vertical" | "horizontal" | "fit" | "overscan" | "fill";
  view?: CameraView;
  fov?: number;
  left?: number;
  right?: number;
  bottom?: number;
  top?: number;
  zoom?: number;
  /** [x, y, width, height] region of the target this camera renders into. */
  viewport?: number[];
  // Runtime, added/derived by the camera system.
  projectionMatrix?: Mat4;
  frustum?: Float32Array;
  actualSensorHeight?: number;
  dirty?: boolean;
  // Runtime, maintained every frame by the camera system.
  /**
   * Sub-pixel NDC offset for this frame while temporal antialiasing is on, zero
   * otherwise. Applied after projection, so `projectionMatrix` stays unjittered
   * for everything reconstructing view position from it.
   */
  _jitter?: Vec2;
  /** `projectionMatrix * viewMatrix`, this frame and last. Never jittered. */
  _viewProjectionMatrix?: Mat4;
  _previousViewProjectionMatrix?: Mat4;
  /** Cleared once a real view-projection has been seeded into the previous. */
  _hasPreviousViewProjectionMatrix?: boolean;
  /** Inverse of `_viewProjectionMatrix`, for reconstructing world position. */
  _inverseViewProjectionMatrix?: Mat4;
  /**
   * Set for the one frame following `cameraSystem.resetTemporal(entity)`, and
   * read by anything accumulating across frames: this frame does not continue
   * from the last, so its history describes somewhere else.
   */
  _temporalReset?: boolean;
}
export interface DirectionalLightComponentOptions extends LightShadowInternals {
  color?: Color;
  intensity?: number;
  /** Shadow-map rasterizer constant depth bias. */
  depthBias?: number;
  /**
   * Shadow-map rasterizer slope-scaled depth bias, the effective term on a
   * float depth map (raise to remove acne).
   */
  depthBiasSlopeScale?: number;
  /**
   * Upper bound on the applied depth bias to limit peter-panning (0 disables
   * the clamp).
   */
  depthBiasClamp?: number;
  /**
   * Soft-shadow (PCSS) light size. A directional light is at infinity, so this
   * reads as an angular size relative to the shadow frustum: larger widens the
   * penumbra.
   */
  bulbRadius?: number;
  castShadows?: boolean;
  shadowMapSize?: number;
}
export interface GeometryComponentOptions {
  positions?: GeometryAttribute;
  normals?: GeometryAttribute;
  tangents?: GeometryAttribute;
  /** Alias: texCoords/texCoords0 */
  uvs?: GeometryAttribute;
  /** Alias: texCoords1 */
  uvs1?: GeometryAttribute;
  vertexColors?: GeometryAttribute;
  cells?: GeometryAttribute;
  weights?: GeometryAttribute;
  joints?: GeometryAttribute;
  /** Instanced */
  offsets?: GeometryAttribute;
  /** Instanced */
  rotations?: GeometryAttribute;
  /** Instanced */
  scales?: GeometryAttribute;
  /** Instanced */
  colors?: GeometryAttribute;
  count?: number;
  instances?: number;
  multiDraw?: object;
  culled?: boolean;
  primitive?: string;
  /** Runtime, computed by the geometry system. */
  bounds?: AABB;
  attributes?: Record<string, unknown>;
}
export interface GridHelperComponentOptions {
  color?: Color;
  size?: number;
}
export interface LightHelperComponentOptions {}
/**
 * Blend equation preset for `material.blend`, named after their common
 * compositing-software equivalents (Photoshop/Three.js/Unity):
 * "normal" (standard non-premultiplied "over"), "premultiplied" ("over" with
 * color already scaled by opacity), "additive", "multiply", "screen".
 */
export type BlendMode =
  | "normal"
  | "premultiplied"
  | "additive"
  | "multiply"
  | "screen";
export interface MaterialComponentOptions {
  unlit?: boolean;
  type?: undefined | "line";
  baseColor?: Color;
  emissiveColor?: Color;
  emissiveIntensity?: number;
  metallic?: number;
  roughness?: number;
  ior?: number;
  specular?: number;
  specularTexture?: MaterialTexture;
  specularColor?: Color;
  specularColorTexture?: MaterialTexture;
  baseColorTexture?: MaterialTexture;
  emissiveColorTexture?: MaterialTexture;
  normalTexture?: MaterialTexture;
  normalTextureScale?: number;
  roughnessTexture?: MaterialTexture;
  metallicTexture?: MaterialTexture;
  metallicRoughnessTexture?: MaterialTexture;
  occlusionTexture?: MaterialTexture;
  clearCoat?: number;
  clearCoatRoughness?: number;
  clearCoatTexture?: MaterialTexture;
  clearCoatRoughnessTexture?: MaterialTexture;
  clearCoatNormalTexture?: MaterialTexture;
  clearCoatNormalTextureScale?: number;
  sheenColor?: Color;
  sheenRoughness?: number;
  transmission?: number;
  transmissionTexture?: MaterialTexture;
  dispersion?: number;
  diffuseTransmission?: number;
  diffuseTransmissionTexture?: MaterialTexture;
  diffuseTransmissionColor?: Color;
  diffuseTransmissionColorTexture?: MaterialTexture;
  thickness?: number;
  thicknessTexture?: MaterialTexture;
  attenuationDistance?: number;
  attenuationColor?: Color;
  alphaTest?: number;
  alphaTexture?: MaterialTexture;
  depthTest?: boolean;
  depthWrite?: boolean;
  depthFunc?: string;
  blend?: boolean;
  /** Blend equation when `blend` is set. Default: "normal". */
  blendMode?: BlendMode;
  cullFace?: boolean;
  cullFaceMode?: string;
  pointSize?: number;
  castShadows?: boolean;
  receiveShadows?: boolean;
  // Line material fields (type: "line"), stored on the same slot.
  lineWidth?: number;
  lineResolution?: number;
  perspectiveScaling?: boolean;
  /** Runtime flag set by renderers when the pipeline variant is rebuilt. */
  needsPipelineUpdate?: boolean;
}
export interface LineMaterialComponentOptions {
  type?: "line";
  baseColor?: Color;
  lineWidth?: number;
  lineResolution?: number;
  perspectiveScaling?: boolean;
  depthTest?: boolean;
  depthWrite?: boolean;
  castShadows?: boolean;
}
export interface MorphComponentOptions {
  sources: Record<string, any>;
  targets: Record<string, any>;
  current?: Record<string, any>;
  weights?: number[];
}
export interface OrbiterComponentOptions {
  element?: HTMLElement;
  target?: Vec3;
  lat?: number;
  lon?: number;
  distance?: number;
  /** Runtime pex-cam orbiter instance. */
  _orbiter?: any;
}
export interface PointLightComponentOptions extends LightShadowInternals {
  color?: Color;
  intensity?: number;
  range?: number;
  /** Normalized shadow-map bias (fraction of the light's far plane). */
  bias?: number;
  bulbRadius?: number;
  castShadows?: boolean;
  shadowMapSize?: number;
}
export interface SSAOComponentOptions {
  type?: "sao" | "gtao";
  /**
   * How far to take the term towards full occlusion: 0 leaves surfaces
   * unoccluded, 1 applies the estimate as computed.
   */
  mix?: number;
  /** World (view space) size of the occlusion sphere, in meters. */
  radius?: number;
  brightness?: number;
  contrast?: number;

  /** SAO: sample a noise texture for the rotation jitter rather than hashing. */
  noiseTexture?: boolean;
  /** Samples per pixel (SAO), or steps per slice (GTAO). */
  samples?: number;
  /** SAO: darkening exponent. GTAO uses `finalValuePower`. */
  intensity?: number;
  /** SAO: bias against occlusion in smooth corners, in centimeters. */
  bias?: number;
  /** SAO: turns of the sampling spiral. Prime, so taps don't line up. */
  spiralTurns?: number;
  /** SAO: bilateral blur width, or negative to leave the estimate raw. */
  blurRadius?: number;
  /** SAO: how sharply the bilateral blur rejects a depth difference. */
  blurSharpness?: number;

  /**
   * GTAO: azimuthal slices of the horizon search, and the only control over the
   * low-frequency blotching a spatial denoiser cannot remove. Three is enough
   * alongside `taa`, which rotates the azimuths per frame and averages the
   * error between them; without it, raise this rather than `denoisePasses` when
   * the occlusion reads as a pattern instead of grain.
   */
  slices?: number;
  /**
   * GTAO: also estimate the average unoccluded direction, which then drives the
   * irradiance lookup and the specular occlusion cone instead of the surface
   * normal and the flat visibility term. Costs the buffer's other three
   * channels and a handful of transcendentals per slice.
   */
  bentNormals?: boolean;
  /**
   * GTAO: lets the tuned radius differ from the ground-truth one, countering
   * biases screen-space gathering has no way to avoid. Expected range
   * [0.3, 3.0].
   */
  radiusMultiplier?: number;
  /** GTAO: fraction of the radius over which a sample fades out. [0, 1] */
  falloffRange?: number;
  /**
   * GTAO: 1 spreads samples evenly along a slice, higher pulls them towards the
   * center, where the small crevices are. Expected range [1, 3].
   */
  sampleDistributionPower?: number;
  /**
   * GTAO: discards samples behind the center sooner, countering a depth buffer
   * that holds no thickness information. Expected range [0, 0.7].
   */
  thinOccluderCompensation?: number;
  /** GTAO: `occlusion = pow(occlusion, finalValuePower)`. [0.5, 5.0] */
  finalValuePower?: number;
  /**
   * GTAO: trades memory bandwidth against temporal stability and thin-object
   * accuracy — higher reads a coarser depth mip at the same offset. [0, 30]
   */
  depthMipSamplingOffset?: number;
  /** GTAO: edge-aware denoise passes. 0 leaves the estimate raw. */
  denoisePasses?: number;
  /** GTAO: the denoiser's center tap weight. Higher blurs less. */
  denoiseBlurBeta?: number;
}
export interface DoFComponentOptions {
  /** Gustafsson uses a spiral pattern while Upitis uses a circular one. */
  type?: "gustafsson" | "upitis";
  /** Use camera f-stop and focal length. */
  physical?: boolean;
  /** The point to focus on in meters. */
  focusDistance?: number;
  /**
   * Non physically based value for artistic control when physical is false,
   * otherwise acts as an fStop divider.
   */
  focusScale?: number;
  /**
   * Read the depth buffer to find the first intersecting object to focus on
   * instead of a fixed focus distance.
   */
  focusOnScreenPoint?: boolean;
  /** The normalized screen point to focus on when "focusOnScreenPoint" is true. */
  screenPoint?: Vec2;
  /** Amount of RGB separation. */
  chromaticAberration?: number;
  /** Threshold for out of focus highlights. */
  luminanceThreshold?: number;
  /** Gain for out of focus highlights. */
  luminanceGain?: number;
  /**
   * Iteration steps. More steps means better blur but also degraded
   * performances.
   */
  samples?: number;
  /** The bokeh shape for type "upitis". */
  shape?: "disk" | "pentagon";
  debug?: boolean;
}
export interface MSAAComponentOptions {
  /** Multisample anti-aliasing samples: 1 or 4. */
  sampleCount?: number;
}
export interface FXAAComponentOptions {
  /** For edge luma threshold: 0 to 4. */
  quality?: number;
  /** Higher = softer. Helps mitigate fireflies but will blur small details. */
  subPixelQuality?: number;
}
export interface SMAAComponentOptions {
  /** 0 to 3 (60/80/95/99% of the quality). */
  quality?: number;
  edges?: "luma" | "color" | "depth";
}
export interface TAAComponentOptions {
  /**
   * Weight given to the current frame, so roughly one over the number of frames
   * accumulated. Lower converges further and ghosts more; the jitter sequence
   * is eight frames long, so below ~0.05 the window outruns it.
   */
  blendFactor?: number;
  /**
   * Half-width of the history clipping box, in standard deviations of the 3x3
   * neighbourhood. Below ~1 the history is clipped hard enough to stop
   * accumulating; above ~1.5 ghosting starts to survive.
   */
  varianceGamma?: number;
}
export interface FogComponentOptions {
  color?: Color;
  start?: number;
  density?: number;
  sunPosition?: Vec3;
  sunDispertion?: number;
  sunIntensity?: number;
  sunColor?: Color;
  inscatteringCoeffs?: Vec3;
}
export interface BloomComponentOptions {
  /** The bloom quality: 0 or 1 (0 is faster but flickers). */
  quality?: number;
  /** The function used to determine the brightness of a pixel for the threshold. */
  colorFunction?: "luma" | "luminance" | "average";
  /** The brightness value at which pixels are filtered out for the threshold. */
  threshold?: number;
  /** The source texture for the threshold. */
  source?: "color" | "emissive";
  /** The strength of the bloom effect. */
  intensity?: number;
  /**
   * Per-level gain applied as the pyramid is built: how much glare gets blended
   * in, not how far it spreads. {@link BloomComponentOptions.levels} is what
   * sets the extent.
   */
  radius?: number;
  /**
   * Levels in the downsample pyramid, each doubling how far the glare spreads.
   *
   * Omitted means as many as the viewport has texels for — the widest, haziest
   * bloom, and the only choice that is resolution-independent. A lower count is
   * the tighter, more contained look, and nothing else exposes it.
   */
  levels?: number;
}
export interface LutComponentOptions {
  texture: GpuTexture;
}
export interface ColorCorrectionComponentOptions {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
}
export interface VignetteComponentOptions {
  radius?: number;
  intensity?: number;
}
export interface FilmGrainComponentOptions {
  quality?: number;
  size?: number;
  intensity?: number;
  colorIntensity?: number;
  luminanceIntensity?: number;
  speed?: number;
}
export interface PostProcessingComponentOptions {
  ssao?: SSAOComponentOptions;
  dof?: DoFComponentOptions;
  bloom?: BloomComponentOptions;
  fog?: FogComponentOptions;
  vignette?: VignetteComponentOptions;
  lut?: LutComponentOptions;
  colorCorrection?: ColorCorrectionComponentOptions;
  fxaa?: FXAAComponentOptions;
  smaa?: SMAAComponentOptions;
  taa?: TAAComponentOptions;
  msaa?: MSAAComponentOptions;
  filmGrain?: FilmGrainComponentOptions;
  exposure?: number;
  /** Tone map operator, or null to leave the image scene-referred. */
  toneMap?:
    | "aces"
    | "acesHill"
    | "agx"
    | "agxGolden"
    | "agxNeedle"
    | "agxPunchy"
    | "filmic"
    | "hejl"
    | "lottes"
    | "neutral"
    | "reinhard"
    | "reinhard2"
    | "reinhardJodie"
    | "uchimura"
    | "uncharted2"
    | "unreal"
    | null;
  opacity?: number;
}
/**
 * Pre-baked image-based lighting data (e.g. from a glTF `EXT_lights_image_based`
 * light) that bypasses the reflection-probe system's compute-shader bake
 * pipeline entirely: the specular mips and SH coefficients are uploaded as-is.
 */
export interface ReflectionProbePrebakedData {
  /**
   * `[mip][face]` image sources for the specular cubemap, mip 0 first. Face
   * order matches WebGPU cube array layers (+X, -X, +Y, -Y, +Z, -Z). The mip
   * count becomes the probe's `roughnessLevels` — no resampling to a fixed
   * chain is needed.
   */
  specularImages: ExternalImageSource[][];
  /** Mip 0 face size in pixels. */
  specularImageSize: number;
  /** 9 L2 spherical harmonics coefficients, each `[r, g, b]`. */
  irradianceCoefficients: number[][];
  /** Seeds the probe entity's transform rotation on load. */
  rotation?: Quat;
  /** Multiplier applied to the probe's indirect diffuse + specular output. */
  intensity?: number;
}
export interface ReflectionProbeComponentOptions {
  /** Set to force a rebake of the probe on the next update. */
  dirty?: boolean;
  /** Pre-baked IBL data; when set, bypasses the compute-shader bake pipeline. */
  data?: ReflectionProbePrebakedData;
}
export interface SkinComponentOptions {}
export interface SkyboxComponentOptions {
  sunPosition?: Vec3;
  envMap?: GpuTexture;
  /**
   * Background blur amount, 0 (sharp) to 1 (fully blurred). Sampled from a
   * paired reflectionProbe entity's prefiltered specular cubemap; ignored
   * with a warning if no reflectionProbe is present.
   */
  backgroundBlur?: number;
  exposure?: number;
  turbidity?: number;
  rayleigh?: number;
  mieCoefficient?: number;
  mieDirectionalG?: number;
  // Runtime, added by the skybox system.
  dirty?: boolean;
  _skyTexture?: GpuTexture;
  _skyTextureChanged?: boolean;
}
export interface SpotLightComponentOptions extends LightShadowInternals {
  color?: Color;
  intensity?: number;
  angle?: number;
  innerAngle?: number;
  range?: number;
  /** Shadow-map rasterizer constant depth bias. */
  depthBias?: number;
  /**
   * Shadow-map rasterizer slope-scaled depth bias, the effective term on a
   * float depth map (raise to remove acne).
   */
  depthBiasSlopeScale?: number;
  /**
   * Upper bound on the applied depth bias to limit peter-panning (0 disables
   * the clamp).
   */
  depthBiasClamp?: number;
  /** Soft-shadow (PCSS) light radius in world units: larger widens the penumbra. */
  bulbRadius?: number;
  castShadows?: boolean;
  shadowMapSize?: number;
}
export interface TransformComponentOptions {
  position?: Vec3;
  rotation?: Quat;
  scale?: Vec3;
  // Runtime, added by the transform system.
  parent?: TransformComponentOptions | undefined;
  entity?: Entity;
  depth?: number;
  worldBounds?: AABB;
  worldPosition?: Vec3;
  modelMatrix?: Mat4;
  dirty?: boolean;
  aabbDirty?: boolean;
}
export interface VertexHelperComponentOptions {
  color?: Color;
  size?: number;
  attribute?: string;
}

// Cached, system-owned resources referenced back from entities.
/** Transform state cached per entity by the transform system. */
export interface TransformCache {
  transform: TransformComponentOptions;
  modelMatrix: Mat4;
  /** Last frame's `modelMatrix`, for reprojecting between frames. */
  previousModelMatrix: Mat4;
  /** Cleared once the first `modelMatrix` has been copied into the previous. */
  hasPreviousModelMatrix: boolean;
  localModelMatrix: Mat4;
  worldPosition: Vec3;
}
// Draw-relevant fields (count/instances/indices) are typed permissively:
// they feed pex-gpu draw commands directly and may legitimately be undefined
// at runtime (inferred by pex-gpu), which exactOptionalPropertyTypes would
// otherwise reject when spread into a RenderCommand.
/** Geometry GPU resources cached per entity by the geometry system. */
export interface GeometryCache {
  geometry: GeometryComponentOptions | null;
  attributes: Record<string, any>;
  indices: any;
  count: number;
  instances: number;
  primitive?: string;
  customAttributes?: string[];
}

// Shaders (pipeline WGSL generators)
/** Raw WGSL text injected at fixed points of a pipeline shader. */
export interface ShaderHooks {
  vertDeclarationsEnd?: string;
  vertBeforeTransform?: string;
  vertEnd?: string;
  fragDeclarationsEnd?: string;
  fragBeforeTextures?: string;
  fragBeforeLighting?: string;
  fragAfterLighting?: string;
  fragEnd?: string;
}
/**
 * Active light counts per type. The standard shader generator only reads them
 * as presence — the arrays are runtime-sized — except for the shadow bucket
 * counts, which decide how many texture bindings exist.
 */
export interface ShaderLightCounts {
  ambient?: number;
  directional?: number;
  point?: number;
  spot?: number;
  area?: number;
  /** Distinct shadow map sizes in use, each one array binding. */
  shadow2DBuckets?: number;
  shadowCubeBuckets?: number;
}
/** Which optional MRT fragment outputs a pipeline shader should emit, beyond color. */
export interface FragmentOutputs {
  normal?: boolean;
  emissive?: boolean;
  /** Screen-space motion vectors, for temporal reprojection and motion blur. */
  velocity?: boolean;
}
/** Options accepted by the pipeline WGSL generators in src/shaders. */
export interface PipelineShaderOptions {
  hooks?: ShaderHooks;
  /** Optional MRT fragment outputs (normal, emissive, velocity) to emit. */
  outputs?: FragmentOutputs;
  /** Size of the skinning joint matrix array. */
  maxJoints?: number;
  /** Per-texture texture coordinate set index (0 or 1), e.g. { baseColor: 1 }. */
  texCoords?: Record<string, number>;
  /** Active light counts per type, e.g. { directional: 2, point: 1 }. */
  lights?: ShaderLightCounts;
}
/** Signature of a pipeline WGSL generator. */
export type PipelineShaderBuilder = (
  defines?: Set<string>,
  options?: PipelineShaderOptions,
) => string;

// System
export interface SystemOptions {
  ctx: GpuContext;
  frameGraph: FrameGraph;
}
export type SystemUpdate = (entities: Entity[], deltaTime?: number) => void;
export type SystemDispose = (entities?: Entity[]) => void;
export interface System {
  type: string;
  cache?: Record<number, any>;
  debug?: boolean;
  update: SystemUpdate;
  dispose?: SystemDispose;
}
export interface RenderEngineOptions {
  width?: number;
  height?: number;
  renderers?: RendererSystem[];
  drawToScreen?: boolean;
  /** Overrides the engine's accumulated time for this render call. */
  time?: number;
}
/** Resolves to each camera's output textures, keyed by name. */
export type RenderEngineRender = (
  entities: Entity[],
  cameraEntities: Entity | Entity[],
  options?: RenderEngineOptions,
) => Promise<Record<string, GpuTexture>[]>;
export type RenderEngineDebug = (enable: boolean) => void;
export interface RenderEngine extends System {
  render: RenderEngineRender;
  debug: any;
  systems: System[];
  renderers: RendererSystem[];
}
export type RendererSystemRender = (
  renderView: RenderView,
  entities: Entity | Entity[],
  options?: any,
) => void;
export interface RendererSystemStageOptions {
  outputs?: FragmentOutputs;
  shadowMappingLight?: any;
  /**
   * Resolved frame images, keyed by the register names the renderer asked for
   * through `inputs`. Missing entries mean nothing published that name.
   */
  textures?: Record<string, GpuTexture>;
  renderingToReflectionProbe?: boolean;
  msaa?: boolean;
  transparent?: boolean;
  transmitted?: boolean;
  cullFaceMode?: string;
}
export type RendererSystemStage = (
  renderView: RenderView,
  entities: Entity[],
  options?: RendererSystemStageOptions,
) => void;
// Renderer systems accrete per-frame internal state (locations, light data,
// pipeline caches) and expose a set of optional draw stages (render,
// renderShadow, renderOpaque, ...) with per-renderer signatures. The index
// signature keeps that dynamic draw path usable; RendererSystemRender and
// RendererSystemStage document the stage shape callers rely on.
export interface RendererSystem {
  type: string;
  cache?: Record<number, any>;
  debug?: boolean;
  [key: string]: any;
}

// render-pipeline.ts's own state and top-level orchestration methods.
export interface RenderPipelineCore {
  type: string;
  time: number;
  /** Frames rendered, from the engine. Indexes every per-frame sequence. */
  frameIndex: number;
  debug: boolean;
  debugRender: string;
  reversibleToneMap: boolean;
  /** Draw depth (+ normal) before shading. See render-pipeline.ts. */
  depthPrePass: boolean;
  /** Set when the canvas is configured `alphaMode: "premultiplied"`. */
  premultipliedAlpha: boolean;
  fullscreen: any;
  samplers: Samplers;
  blitPipeline: RenderPipeline;
  blitPremultipliedPipeline: RenderPipeline;
  grabPipeline: RenderPipeline;
  /** Resolve the depth buffer under MSAA so effects can sample it. */
  depthResolve: boolean;
  depthResolvePipelines: Map<number, RenderPipeline>;
  getDepthResolvePipeline(sampleCount: number): RenderPipeline;
  outputs: Set<string>;
  colorFormat: GPUTextureFormat;
  depthFormat: GPUTextureFormat;
  /** Per-output format overrides, for outputs that do not hold colour. */
  outputFormats: Record<string, GPUTextureFormat>;

  drawMeshes(options: any): void;
  drawFullscreen(command: RenderCommand): void;
  update(
    entities: Entity[],
    options?: any,
  ): Promise<Record<string, ResourceHandle>>;
  dispose(entities: Entity[]): void;
}
// Members shadow-mapping.ts mixes into render-pipeline-system.
export interface ShadowMappingMethods {
  checkLight(light: any, lightEntity: Entity): true | undefined;
  getLightVolumeTest(
    lightEntity: Entity,
    light: any,
  ): (worldBounds: any) => boolean;
  computeLightProperties(
    lightEntity: Entity,
    light: any,
    participants: Entity[],
  ): void;
  computePointLightProperties(
    lightEntity: Entity,
    light: any,
    participants: Entity[],
  ): void;
  createShadowMapBucket(
    size: number,
    count: number,
    cubemap: boolean,
    scope: string,
  ): ResourceHandle;
  declareShadowMaps(
    entities: Entity[],
    renderers: RendererSystem[],
    layer: string | undefined,
  ): { shadowMaps: ResourceHandle[]; shadowCastingLights: any[] };
  renderShadowMap(
    kind: LightKind,
    lightEntity: Entity,
    entities: Entity[],
    renderers: RendererSystem[],
    scope: string,
    shadowMap: ResourceHandle,
  ): void;
}
/**
 * The pipeline's samplers, bound by its own passes and handed to every
 * post-processing sub-pass.
 */
export interface Samplers {
  /** Filtered, clamped: color reads, the blit, and the SMAA area lookup. */
  linear: GPUSampler;
  /** Unfiltered, clamped: depth reads, and the SMAA search lookup. */
  nearest: GPUSampler;
  /** Filtered, repeating: the tiled SSAO noise textures. */
  linearRepeat: GPUSampler;
}
// Members post-processing.ts mixes into render-pipeline-system.
export interface PostProcessingMethods {
  postProcessingEffects: Map<string, any>;
  postProcessingLoading: Map<string, Promise<void>>;
  postProcessingPipelines: Map<string, RenderPipeline | ComputePipeline>;
  loadPostProcessingEffect(registration: any): Promise<void> | undefined;
  getPostProcessingPipeline(
    key: string,
    shader: (defines: Set<string>) => string,
    defines: Set<string>,
    constants: Record<string, number | boolean>,
    blend?: GPUBlendState,
    compute?: boolean,
  ): RenderPipeline | ComputePipeline;
  /**
   * Declare one fullscreen pass and publish it under `"<prefix>.<name>"`. The
   * helper built-in effects get as `context.pass`, on the pipeline so anything
   * injecting a pass from outside reaches it too.
   */
  declareFullscreenPass(scope: any, options: any): ResourceHandle;
  /** The same, for one compute dispatch — `context.compute`. */
  declareComputePass(scope: any, options: any): void;
  enabledPostProcessingEffects(cameraEntity: Entity): Generator<any>;
  postProcessingOutputs(cameraEntity: Entity): string[];
  postProcessingEffectsByStage(cameraEntity: Entity): Map<string, any[]>;
  renderPostProcessing(args: {
    renderView: RenderView;
    textures: any;
    effects: any[] | undefined;
  }): void;
}
/**
 * Payload of the `"outputs"` stage: what the main pass should produce for one
 * view, before any of it has been allocated.
 *
 * A module joins the frame at an injection point, but the attachments it wants
 * to read have to exist before the pass that writes them is declared — earlier
 * than any hook that hands over {@link RenderTextures}. Adding a name here is
 * how anything outside the pipeline asks for one.
 *
 * Union only: there is no way to withdraw a name another module asked for.
 * Outputs are attachments on the main pass, so the set changing relayouts it
 * and recompiles every material pipeline — a requirement that flickers frame to
 * frame is far more expensive than one that is simply always on.
 */
export interface OutputRequest {
  /** Add a name to request it. `"color"` and `"depth"` are always present. */
  outputs: Set<string>;
  renderView: RenderView;
}
// Members culling.ts mixes into render-pipeline-system.
export interface CullingMethods {
  cullEntities(entities: Entity[], camera: any): Entity[];
}
/**
 * The render-pipeline-system object built in
 * systems/render-pipeline/render-pipeline.ts by spreading
 * ShadowMappingMethods, PostProcessingMethods and CullingMethods into one
 * literal alongside RenderPipelineCore. Declared once here rather than in any
 * single one of those files because each calls back into members another one
 * contributes (a shadow pass calls `drawMeshes`, post-processing reads
 * `time`): a contributor types its return as its own slice (e.g.
 * `ShadowMappingMethods`) intersected with `ThisType<RenderPipelineSystem>`,
 * so `this` resolves across all of them instead of being typed from that
 * one file's own object literal alone.
 */
export type RenderPipelineSystem = RenderPipelineCore &
  ShadowMappingMethods &
  PostProcessingMethods &
  CullingMethods;

// World
export type WorldAdd = (entity: Entity) => void;
export type WorldAddSystem = (system: System) => void;
export type WorldUpdate = (deltaTime?: number) => void;
export interface World {
  entities: Entity[];
  systems: System[];
  add: WorldAdd;
  addSystem: WorldAddSystem;
  update: WorldUpdate;
}

/** A camera and the region of a target it renders into. */
export interface RenderView {
  camera: CameraComponentOptions;
  cameraEntity?: Entity;
  /** [x, y, width, height] */
  viewport: number[];
}

export type { GpuContext, GpuTexture, GpuBuffer };

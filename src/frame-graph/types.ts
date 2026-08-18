import type {
  ColorAttachment,
  CreateBufferOptions,
  CreateTextureOptions,
  RenderCommand,
  UniformValue,
  Uniforms,
} from "pex-gpu";

import type { GpuBuffer, GpuContext, GpuTexture, RenderView } from "../types.js";

// ─── Handles ─────────────────────────────────────────────────────────────────

/**
 * Reference to a virtual resource, resolved to a GPU object only inside a pass's
 * `execute`.
 *
 * Interned, one instance per resource: identity comparison works, and a handle
 * in a `uniforms` bag stays distinguishable from a numeric uniform.
 */
export interface ResourceHandle {
  readonly __frameGraphResource: true;
  /** Index into the graph's resource table. */
  readonly index: number;
  readonly name: string;
}

export const isResourceHandle = (value: unknown): value is ResourceHandle =>
  typeof value === "object" &&
  value !== null &&
  (value as ResourceHandle).__frameGraphResource === true;

/** What a handle stands for once allocated or imported. */
export type PhysicalResource = GpuTexture | GpuBuffer;

// ─── Resource descriptors ────────────────────────────────────────────────────

/**
 * Texture creation options minus what the graph derives (usage) or forbids
 * (initial data). `depth` is the array layer count, 6 with `viewDimension:
 * "cube"`; `mipmap` allocates the chain rather than generating it.
 */
export interface TextureDescriptor
  extends Required<Pick<CreateTextureOptions, "width" | "height">>,
    Pick<
      CreateTextureOptions,
      | "label"
      | "depth"
      | "format"
      | "sampleCount"
      | "mipLevelCount"
      | "mipmap"
      | "viewDimension"
    > {
  /**
   * Keep one dedicated texture across frames instead of drawing from the pool,
   * looked up by `label`. Implies `exportTexture`.
   *
   * Pooling churns texture identity frame to frame, which breaks anything
   * holding one between frames: a debug view cannot tell which frame it has,
   * and pex-gpu's bind group cache, keyed by texture, rebuilds every bind group
   * sampling it. Costs one texture that is never reclaimed.
   */
  persistent?: boolean;
}

/**
 * Buffer creation options as they are: a graph buffer declares its own usage
 * and may carry data. `label` is identity as well as debug string.
 */
export type BufferDescriptor = CreateBufferOptions;

// ─── Pass declaration ────────────────────────────────────────────────────────

/** Color attachment with handles for textures; load/store ops are derived. */
export interface ColorAttachmentDeclaration
  extends Pick<ColorAttachment, "clearValue"> {
  texture: ResourceHandle;
  /** Cube face or array layer to render into. */
  layer?: number;
  /** Mip level to render into. Defaults to 0. */
  level?: number;
  resolveTarget?: ResourceHandle;
}

export interface DepthStencilAttachmentDeclaration
  extends Pick<
    GPURenderPassDepthStencilAttachment,
    "depthClearValue" | "stencilClearValue"
  > {
  texture: ResourceHandle;
  layer?: number;
}

/** `GPUTextureViewDescriptor` in the graph's `layer`/`level` vocabulary. */
export interface SubResourceView
  extends Pick<GPUTextureViewDescriptor, "dimension"> {
  level?: number;
  levelCount?: number;
  layer?: number;
  layerCount?: number;
}

/** Pass parameters, accepting a handle wherever a texture is expected. */
export type PassUniforms = Record<string, UniformValue | ResourceHandle>;

/** What a pass hands to its `execute` callback. */
export interface PassContext {
  ctx: GpuContext;
  /** Physical resource for a handle. Throws outside a pass's `execute`. */
  resolveTexture: (handle: ResourceHandle) => GpuTexture;
  resolveBuffer: (handle: ResourceHandle) => GpuBuffer;
  /**
   * View of one mip or layer, for sampling a texture the pass writes at another
   * level. Use instead of `createView()`: views are cached per physical
   * texture, and an uncached one leaks a bind group per frame.
   */
  resolveView: (
    handle: ResourceHandle,
    options?: SubResourceView,
  ) => GPUTextureView;
  /** `uniforms` with every handle replaced by its physical resource. */
  uniforms: Uniforms;
  renderView?: RenderView;
  /** Viewport of the pass's attachments, `[0, 0, width, height]`. */
  viewport: NonNullable<RenderCommand["viewport"]>;
}

export type PassExecute = (context: PassContext) => void;

export interface PassDeclaration {
  /** Unique within a frame. Identifies the pass for overrides and inspection. */
  name: string;
  type?: "render" | "compute";
  color?: ColorAttachmentDeclaration[];
  depth?: DepthStencilAttachmentDeclaration;
  /**
   * Resources read beyond those derived from handle-valued `uniforms`. Mesh
   * passes need this: their bindings are per-draw.
   */
  reads?: ResourceHandle[];
  /**
   * Resources written outside the attachment path (storage textures, buffers).
   * Attachments are writes already and must not be repeated here.
   */
  writes?: ResourceHandle[];
  /** Handle-valued entries become read edges and resolve before `execute`. */
  uniforms?: PassUniforms;
  /** Keep the pass even when nothing reads its outputs, eg. presenting. */
  neverCull?: boolean;
  renderView?: RenderView;
  execute: PassExecute;
}

/**
 * Intercepts a pass before it enters the graph. Returns a replacement, the
 * original, or null to drop it.
 */
export type PassOverride = (
  declaration: PassDeclaration,
) => PassDeclaration | null;

/** Work registered at a named stage. */
export type StageCallback = () => void | Promise<void>;

// ─── Compiled plan ───────────────────────────────────────────────────────────

export interface CompiledColorAttachment
  extends Pick<ColorAttachment, "clearValue">,
    Required<Pick<ColorAttachment, "loadOp" | "storeOp">> {
  handle: ResourceHandle;
  layer?: number;
  level?: number;
  resolveTarget?: ResourceHandle;
}

export interface CompiledDepthStencilAttachment
  extends Omit<CompiledColorAttachment, "clearValue" | "resolveTarget">,
    Pick<
      GPURenderPassDepthStencilAttachment,
      "depthClearValue" | "stencilClearValue"
    > {}

export interface CompiledPass {
  /** The head declaration's name. */
  name: string;
  /** Every merged sub-pass name joined, as handed to pex-gpu. */
  label: string;
  type: "render" | "compute";
  color: CompiledColorAttachment[];
  depth?: CompiledDepthStencilAttachment;
  /** Declarations folded in by merging, including its own, in order. */
  subPasses: { name: string; execute: PassExecute; declarationIndex: number }[];
  reads: number[];
  writes: number[];
  renderView?: RenderView;
  viewport: NonNullable<RenderCommand["viewport"]>;
}

export interface CompiledResource {
  index: number;
  name: string;
  kind: "texture" | "buffer";
  imported: boolean;
  descriptor: TextureDescriptor | BufferDescriptor;
  /** Derived from how passes use the resource, never requested. */
  usage: GPUTextureUsageFlags | GPUBufferUsageFlags;
  /** Never sampled and never outlives its pass, so it can stay memoryless. */
  transient: boolean;
  /** Holds a dedicated texture across frames rather than coming from the pool. */
  persistent: boolean;
  culled: boolean;
  /** Compiled pass indices. -1 when never used. */
  firstUse: number;
  lastUse: number;
  bytes: number;
  /** Resources sharing one are recycling the same texture. */
  physicalId?: number;
}

export interface CompiledPlan {
  passes: CompiledPass[];
  resources: CompiledResource[];
  /**
   * Physical resource per resource index, undefined where culled. The only live
   * GPU objects in the plan, so a handle is resolvable only through a compiled
   * frame.
   */
  physical: (PhysicalResource | undefined)[];
  culledPasses: string[];
  stats: {
    declaredPasses: number;
    culledPasses: number;
    mergedPasses: number;
    peakBytes: number;
    /** What the frame would cost with a distinct texture per resource. */
    naiveBytes: number;
  };
}

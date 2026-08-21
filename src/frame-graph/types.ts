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
  /**
   * The frame's live command encoder. Only set for a `"raw"` pass: it runs
   * outside pex-gpu's declarative `submit()`, so nothing opens a render or
   * compute pass around it — the callback records into this encoder directly
   * (or hands it to a pex-gpu helper that does, eg. `generateMipmaps`).
   */
  encoder?: GPUCommandEncoder;
}

export type PassExecute = (context: PassContext) => void;

/** A write with an explicit usage flag, for a resource a `"raw"` pass touches
 * outside the attachment path (eg. `RENDER_ATTACHMENT` for a helper that opens
 * its own render passes on the raw encoder). A bare handle defaults to
 * `STORAGE_BINDING`/`STORAGE`, the compute-write case. */
export interface WriteDeclaration {
  handle: ResourceHandle;
  usage: GPUTextureUsageFlags | GPUBufferUsageFlags;
}

export interface PassDeclaration {
  /** Unique within a frame. Identifies the pass for overrides and inspection. */
  name: string;
  /**
   * `"raw"` skips pex-gpu's declarative `submit()` entirely — no render or
   * compute pass is opened, and `execute` gets the frame's live encoder
   * instead. For work that manages its own passes on the shared encoder (eg.
   * `generateMipmaps`), which can't run nested inside a pass the graph already
   * opened.
   */
  type?: "render" | "compute" | "raw";
  color?: ColorAttachmentDeclaration[];
  depth?: DepthStencilAttachmentDeclaration;
  /**
   * Resources read beyond those derived from handle-valued `uniforms`. Mesh
   * passes need this: their bindings are per-draw.
   */
  reads?: ResourceHandle[];
  /**
   * Resources written outside the attachment path (storage textures, buffers,
   * or — as a `{ handle, usage }` pair — whatever a `"raw"` pass's own
   * commands need). Attachments are writes already and must not be repeated
   * here.
   */
  writes?: (ResourceHandle | WriteDeclaration)[];
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

/**
 * Work run right after a named pass enters the graph, to declare passes at that
 * point in the frame. Synchronous: `addPass` is, and everything at declaration
 * time is.
 */
export type PassHook = (declaration: PassDeclaration) => void;

/**
 * Work registered at a named stage, run with whatever that stage publishes and
 * the name of the stage running, for a callback registered on several.
 *
 * The graph never looks inside the payload: what it holds, and whether mutating
 * it means anything, is the contract of whoever calls `stage()`.
 */
// `any` rather than `unknown`: one stage name holds every callback registered on
// it, and a parameter type is contravariant, so `unknown` would reject typed ones.
export type StageCallback<T = any> = (
  context: T,
  name: string,
) => void | Promise<void>;

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
  type: "render" | "compute" | "raw";
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
  /**
   * Derived from how passes use the resource — plus a sampled read for
   * anything exported, which is read where no pass can declare it. Never
   * requested.
   */
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

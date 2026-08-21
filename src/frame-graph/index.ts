import { beginFrame, endFrame } from "pex-gpu";
import { commandsState } from "pex-gpu/internals";

import { NAMESPACE } from "../utils.js";
import { createGraphState, requirePhase, resetGraphState } from "./state.js";
import { isResourceHandle } from "./types.js";
import {
  addResource,
  collectUniformReads,
  readResource,
  writeResource,
} from "./setup.js";
import { ResourcePool } from "./pool.js";
import compilePlan from "./compile.js";
import executePlan from "./execute.js";
import inspectGraph from "./inspect.js";

import type { GpuBuffer, GpuContext, GpuTexture } from "../types.js";
import type { GraphState, PassEntry } from "./state.js";
import type { PoolStats } from "./pool.js";
import type { GraphInspection } from "./inspect.js";
import type {
  BufferDescriptor,
  CompiledPlan,
  PassDeclaration,
  PassHook,
  PassOverride,
  PhysicalResource,
  ResourceHandle,
  StageCallback,
  TextureDescriptor,
} from "./types.js";

const DECLARE_HINT = "Declare resources and passes inside frameGraph.setup().";

/**
 * Retained-mode frame graph: passes and virtual resources are declared every
 * frame, compiled into an execution plan, then executed.
 *
 * Culls passes nobody reads, merges adjacent passes sharing attachments,
 * derives load/store ops and usage flags from lifetimes, and recycles textures
 * whose lifetimes don't overlap.
 *
 * Nothing is private: the phase guards, not visibility, protect the invariants.
 */
export class FrameGraph {
  ctx: GpuContext;
  /** Everything declared this frame, plus the phase the graph is in. */
  state: GraphState;
  pool: ResourcePool;
  overrides = new Map<string, PassOverride>();
  stages = new Map<string, Set<StageCallback>>();
  passHooks = new Map<string, Set<PassHook>>();
  /** Type-loose channel for passing handles between decoupled modules. */
  blackboard = new Map<string, unknown>();
  /** Messages already logged, so a pass that throws every frame logs once. */
  reportedErrors = new Set<string>();
  /** Last compiled plan; cleared when a new frame's setup starts. */
  plan: CompiledPlan | undefined;
  debug = false;

  constructor(ctx: GpuContext) {
    this.ctx = ctx;
    this.state = createGraphState();
    this.pool = new ResourcePool(ctx);
  }

  // ─── Declaration ───────────────────────────────────────────────────────────

  /** Declare a texture the graph owns, allocates and recycles. */
  createTexture(descriptor: TextureDescriptor): ResourceHandle {
    const { state } = this;
    requirePhase(state, "declaring", "createTexture", DECLARE_HINT);

    const name = descriptor.label ?? `texture${state.resources.length}`;
    const handle = addResource(state, name, "texture", descriptor);

    if (descriptor.persistent) {
      if (state.persistentNames.has(name)) {
        throw new Error(
          `${NAMESPACE}: duplicate persistent resource "${name}". Persistent resources are looked up by label across frames, so two sharing one would hand back the same texture.`,
        );
      }
      state.persistentNames.add(name);

      const entry = state.resources[handle.index]!;
      entry.persistent = true;
      // A resource that outlives the frame is observable outside it, so the
      // export rules — survives culling, last write stored — all apply.
      entry.exported = true;
      entry.refCount++;
    }
    return handle;
  }

  createBuffer(descriptor: BufferDescriptor): ResourceHandle {
    const { state } = this;
    requirePhase(state, "declaring", "createBuffer", DECLARE_HINT);

    return addResource(
      state,
      descriptor.label ?? `buffer${state.resources.length}`,
      "buffer",
      descriptor,
    );
  }

  /** Reference a resource the graph does not own (shadow maps, IBL, canvas). */
  importTexture(texture: GpuTexture, label?: string): ResourceHandle {
    requirePhase(this.state, "declaring", "importTexture", DECLARE_HINT);

    return addResource(
      this.state,
      label ?? `importedTexture${texture.id}`,
      "texture",
      {
        width: texture.width,
        height: texture.height,
        depth: texture.depthOrArrayLayers,
        format: texture.format,
        sampleCount: texture.sampleCount,
        mipLevelCount: texture.mipLevelCount,
        viewDimension: texture.viewDimension,
      },
      texture,
    );
  }

  importBuffer(buffer: GpuBuffer, label?: string): ResourceHandle {
    const { state } = this;
    requirePhase(state, "declaring", "importBuffer", DECLARE_HINT);

    return addResource(
      state,
      label ?? `importedBuffer${state.resources.length}`,
      "buffer",
      { usage: "storage" },
      buffer,
    );
  }

  /**
   * Mark a resource as read outside the graph: it survives culling, its last
   * write is stored, and it is not recycled until the frame ends.
   */
  exportTexture(handle: ResourceHandle): ResourceHandle {
    requirePhase(this.state, "declaring", "exportTexture", DECLARE_HINT);

    const resource = this.state.resources[handle.index];
    if (resource) {
      resource.exported = true;
      // Stands in for the reader the graph cannot see, so culling spares it.
      resource.refCount++;
    }
    return handle;
  }

  addPass(declaration: PassDeclaration): void {
    const { state } = this;
    requirePhase(
      state,
      "declaring",
      `addPass("${declaration.name}")`,
      DECLARE_HINT,
    );

    const override = this.overrides.get(declaration.name);
    if (override) {
      const replaced = override(declaration);
      if (!replaced) return;
      declaration = replaced;
    }

    if (state.passNames.has(declaration.name)) {
      throw new Error(
        `${NAMESPACE}: duplicate pass name "${declaration.name}". Names identify passes for overrides and inspection, so they must be unique within a frame.`,
      );
    }
    state.passNames.add(declaration.name);

    const pass: PassEntry = {
      index: state.passes.length,
      name: declaration.name,
      type: declaration.type ?? "render",
      color: declaration.color ?? [],
      ...(declaration.depth && { depth: declaration.depth }),
      reads: [],
      writes: [],
      ...(declaration.uniforms && { uniforms: declaration.uniforms }),
      neverCull: declaration.neverCull ?? false,
      ...(declaration.renderView && { renderView: declaration.renderView }),
      execute: declaration.execute,
      dependencies: new Set<number>(),
      refCount: 0,
      culled: false,
    };
    state.passes.push(pass);

    // Reads first: detecting a pass that both reads and writes a resource
    // needs them recorded.
    const reads: ResourceHandle[] = [...(declaration.reads ?? [])];
    collectUniformReads(declaration.uniforms, reads);
    for (const handle of reads) {
      readResource(
        state,
        pass,
        handle,
        state.resources[handle.index]?.kind === "buffer"
          ? GPUBufferUsage.STORAGE
          : GPUTextureUsage.TEXTURE_BINDING,
      );
    }

    for (const attachment of pass.color) {
      writeResource(
        state,
        pass,
        attachment.texture,
        GPUTextureUsage.RENDER_ATTACHMENT,
        attachment,
      );
      // A resolve writes its target too; without this its lifetime would not
      // cover the pass.
      if (attachment.resolveTarget) {
        writeResource(
          state,
          pass,
          attachment.resolveTarget,
          GPUTextureUsage.RENDER_ATTACHMENT,
          {},
        );
      }
    }
    if (pass.depth) {
      writeResource(
        state,
        pass,
        pass.depth.texture,
        GPUTextureUsage.RENDER_ATTACHMENT,
        pass.depth,
      );
    }
    for (const write of declaration.writes ?? []) {
      const handle = isResourceHandle(write) ? write : write.handle;
      const usage = isResourceHandle(write)
        ? state.resources[handle.index]?.kind === "buffer"
          ? GPUBufferUsage.STORAGE
          : GPUTextureUsage.STORAGE_BINDING
        : write.usage;
      writeResource(state, pass, handle, usage, {});
    }

    // Last, so a hook sees the pass complete and its own passes land after it.
    const hooks = this.passHooks.get(pass.name);
    if (hooks) for (const hook of hooks) hook(declaration);
  }

  // ─── Extensibility ─────────────────────────────────────────────────────────

  /**
   * Run everything registered at this injection point, in registration order,
   * handing each callback the payload the caller publishes for this stage.
   *
   * The payload is how a callback learns what exists at this point in the frame
   * and how it hands something back — the graph passes it through untouched, so
   * the vocabulary stays with the caller rather than becoming graph API. See
   * `RenderTextures`, the payload the render pipeline publishes: a callback
   * reads the frame's images by name from it and publishes its own the same
   * way, which is what splices its passes into the frame.
   *
   * Callbacks may be async, but only for CPU work: declaration runs inside the
   * caller's frame segment, and yielding past a browser present destroys the
   * swapchain texture it acquired, which fails the submit for the whole frame.
   * Fetch outside the frame and use what has arrived, as post-processing does
   * with its effect modules.
   */
  async stage<T>(name: string, context?: T): Promise<void> {
    requirePhase(this.state, "declaring", `stage("${name}")`, DECLARE_HINT);

    const callbacks = this.stages.get(name);
    if (!callbacks) return;
    for (const callback of callbacks) await callback(context, name);
  }

  /** Register work at a named stage. Persists across frames. */
  on<T>(name: string, callback: StageCallback<T>): () => void {
    const callbacks = this.stages.getOrInsertComputed(name, () => new Set());
    callbacks.add(callback);
    return () => callbacks.delete(callback);
  }

  /**
   * Declare passes immediately after `name` enters the graph, at that point in
   * the frame.
   *
   * Every pass is an injection point this way, so positioning work relative to
   * one costs the caller nothing: no `stage()` to add, and no set of stage
   * names shadowing the pass list. Named stages remain for the boundaries no
   * single pass marks — a phase that exists whether or not the pass before it
   * was declared — and for the payload and the awaiting that come with them.
   *
   * The hook runs after the pass and its edges are recorded, and after any
   * override, so a dropped pass fires nothing and a renamed one fires under its
   * new name. Reading the frame's images from here is the register's job, keyed
   * by the view on the declaration.
   */
  afterPass(name: string, hook: PassHook): () => void {
    const hooks = this.passHooks.getOrInsertComputed(name, () => new Set());
    hooks.add(hook);
    return () => hooks.delete(hook);
  }

  /** Register a {@link PassOverride} for a pass name; null clears it. */
  overridePass(name: string, transform: PassOverride | null): void {
    if (transform) this.overrides.set(name, transform);
    else this.overrides.delete(name);
  }

  disablePass(name: string): void {
    this.overrides.set(name, () => null);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /** Declare the frame. May await: nothing is recorded until execute. */
  async setup(declare: () => void | Promise<void>): Promise<void> {
    resetGraphState(this.state);
    this.blackboard.clear();
    this.plan = undefined;
    this.state.phase = "declaring";
    try {
      await declare();
    } finally {
      this.state.phase = "declared";
    }
  }

  compile(): CompiledPlan {
    requirePhase(this.state, "declared", "compile()", "Call setup() first.");

    this.plan = compilePlan(this.state, this.pool, { debug: this.debug });
    this.state.phase = "compiled";
    return this.plan;
  }

  /** Record and submit. Opens its own pex-gpu segment unless one is open. */
  execute(): void {
    requirePhase(this.state, "compiled", "execute()", "Call compile() first.");

    executePlan(this.ctx, this.state, this.plan!, this.reportedErrors);
    this.state.phase = "idle";
  }

  /** setup + compile + execute, bracketing execution in one command buffer. */
  async render(declare: () => void | Promise<void>): Promise<CompiledPlan> {
    await this.setup(declare);
    const compiled = this.compile();

    // A caller already inside a segment keeps ownership of it, so anything it
    // draws afterwards shares this command buffer.
    const ownsSegment = !commandsState(this.ctx).frame;
    if (ownsSegment) beginFrame(this.ctx);
    try {
      this.execute();
    } finally {
      if (ownsSegment) endFrame(this.ctx);
      this.pool.endFrame();
    }
    return compiled;
  }

  // ─── Introspection ─────────────────────────────────────────────────────────

  /**
   * Descriptor a handle was declared or imported with: format, size, sample
   * count, mip levels.
   *
   * Readable from declaration onwards, so a pass sizes and formats its own
   * textures from what it is about to read instead of being handed those values
   * separately — the graph already holds them, and a copy is one more thing to
   * keep in sync.
   */
  describe(
    handle: ResourceHandle,
  ): Readonly<TextureDescriptor | BufferDescriptor> | undefined {
    return this.state.resources[handle.index]?.descriptor;
  }

  /**
   * Physical resource behind a handle. Undefined before compile, after the next
   * `setup` clears the plan, or when the resource was culled.
   */
  resolve(handle: ResourceHandle): PhysicalResource | undefined {
    return this.plan?.physical[handle.index];
  }

  inspect(): GraphInspection {
    return inspectGraph(this.state, this.plan, this.pool);
  }

  poolStats(): PoolStats {
    return this.pool.stats();
  }

  dispose(): void {
    this.pool.dispose();
    resetGraphState(this.state);
    this.overrides.clear();
    this.stages.clear();
    this.passHooks.clear();
    this.blackboard.clear();
    this.reportedErrors.clear();
    this.plan = undefined;
  }
}

export default FrameGraph;

export * from "./types.js";
export { memoryTimeline } from "./inspect.js";
export { isTextureDescriptor } from "./state.js";
export type { GraphPhase, GraphState } from "./state.js";
export { ResourcePool } from "./pool.js";
export type { PoolStats } from "./pool.js";
export type {
  GraphInspection,
  InspectedAttachment,
  InspectedPass,
  InspectedResource,
} from "./inspect.js";

import type { ComputePipeline, RenderPipeline } from "pex-gpu";
import { submit } from "pex-gpu";

import { NAMESPACE, definesKey, mapValues } from "../../utils.js";
import { isTextureDescriptor } from "../../frame-graph/state.js";

import type {
  Entity,
  GpuContext,
  PostProcessingMethods,
  RenderPipelineSystem,
  RenderView,
  Samplers,
} from "../../types.js";
import type { RenderTextures } from "./render-textures.js";
import type {
  FrameGraph,
  PassUniforms,
  ResourceHandle,
  SubResourceView,
  TextureDescriptor,
} from "../../frame-graph/index.js";

/** One entry in the built-in chain: what turns it on, and how to fetch it. */
interface EffectRegistration {
  /** Component key that switches the effect on, and its register prefix. */
  name: string;
  /**
   * Separate from the effect itself so a scene without bloom never downloads or
   * parses the bloom shaders. Written as a literal specifier rather than a
   * template, so a bundler can follow each one to exactly one chunk.
   */
  load: () => Promise<{ default: PostProcessingEffect }>;
  /**
   * Declared with no component key of its own. Exposure, the tonemap and the
   * output opacity are not optional effects, they are what makes an image.
   */
  unconditional?: boolean;
}

/**
 * The built-in chain, in the order effects run _within a stage_ — which stage
 * an effect runs at is its own (see `PostProcessingEffect.stage`).
 *
 * Closed, and deliberately so. The order is fixed because the image chain
 * genuinely is sequential — bloom feeds combine, combine feeds smaa, smaa feeds
 * final — and an effect from outside does not need a slot here: the frame graph
 * already positions passes, and the pipeline's `declareFullscreenPass` gives an
 * injected pass the same ergonomics a built-in gets. See that method for where
 * to hook.
 */
const EFFECT_ORDER: readonly EffectRegistration[] = [
  { name: "ssao", load: () => import("./post-processing/ssao.js") },
  { name: "dof", load: () => import("./post-processing/dof.js") },
  { name: "bloom", load: () => import("./post-processing/bloom.js") },
  {
    name: "combine",
    load: () => import("./post-processing/combine.js"),
    unconditional: true,
  },
  { name: "smaa", load: () => import("./post-processing/smaa.js") },
  {
    name: "final",
    load: () => import("./post-processing/final.js"),
    unconditional: true,
  },
];

/** Where an effect runs unless it names another stage: after the whole scene. */
const DEFAULT_STAGE = "postProcessing";

/** An effect's stage, resolved for one camera. */
const resolveStage = (
  effect: PostProcessingEffect,
  cameraEntity: Entity,
): string =>
  (typeof effect.stage === "function"
    ? effect.stage(cameraEntity)
    : effect.stage) ?? DEFAULT_STAGE;

/** One fullscreen pass, in the terms `PassDeclaration` already uses. */
export interface PostProcessingPassOptions {
  /** Unique within the effect. Published as `"<effect>.<name>"`. */
  name: string;
  /** WGSL generator, same contract as the renderer shaders. */
  shader: (defines: Set<string>) => string;
  defines?: Set<string>;
  /**
   * WGSL `override` values. Part of the pipeline variant key, so a pass that
   * flips one gets its own pipeline rather than mutating a shared object whose
   * passes have not executed yet.
   */
  constants?: Record<string, number | boolean>;
  blend?: GPUBlendState;
  /**
   * Texture bound as `uTexture`. Defaults to the current `"color"`; `null`
   * binds nothing, for a shader that declares no `uTexture` — which is a read
   * edge the graph would otherwise carry for a sample that never happens.
   */
  source?: ResourceHandle | null;
  /** Where to draw. A texture is allocated when omitted. */
  target?: ResourceHandle;
  /**
   * Further colour attachments, at `@location(1)` onwards. Each is published
   * under `"<effect>.<name>"` from its own entry, so a reader asks for the
   * buffer it wants rather than for the pass that happened to write it.
   */
  targets?: { name: string; texture: ResourceHandle; clearValue?: GPUColor }[];
  /** Size of the allocated target. Defaults to the full viewport. */
  size?: number[];
  /** Format of the allocated target. Defaults to the effect's working format. */
  format?: GPUTextureFormat;
  uniforms?: PassUniforms;
  clearValue?: GPUColor;
  /**
   * Publish this output as `"color"`, making it the image every later pass
   * reads by default. Off unless set: most passes write data only their own
   * effect consumes — a visibility buffer, a bloom pyramid level, an edge mask
   * — and leave the image alone. The output is published under
   * `"<effect>.<name>"` either way.
   */
  chain?: boolean;
}

/** One dispatch, in the terms `PassDeclaration` already uses. */
export interface PostProcessingComputePassOptions {
  /** Unique within the effect. Names the pass as `"<effect>.<name>"`. */
  name: string;
  /** WGSL generator, same contract as the fullscreen shaders. */
  shader: (defines: Set<string>) => string;
  defines?: Set<string>;
  constants?: Record<string, number | boolean>;
  /** Workgroup counts. */
  dispatch: [number, number?, number?];
  /**
   * Resources the dispatch writes through a storage binding. Attachments are
   * writes already; these are not, so the graph only learns of them here — and
   * without them the target is culled and its usage flags lack
   * STORAGE_BINDING.
   */
  writes?: ResourceHandle[];
  uniforms?: PassUniforms;
  /**
   * Bindings that need a view of one mip or layer rather than the whole
   * texture, which is every storage-texture binding: a storage view is a single
   * level, so writing a mip chain means one binding per level. Resolved through
   * the pass context, never `createView()` — see `resolveView`.
   */
  views?: Record<string, { handle: ResourceHandle } & SubResourceView>;
}

export interface PostProcessingContext {
  ctx: GpuContext;
  cameraEntity: Entity;
  renderView: RenderView;
  viewport: number[];
  time: number;
  samplers: Samplers;
  /**
   * The frame's images. `get("color")` is the current end of the chain — what a
   * pass reads unless it names a source — alongside the main pass outputs under
   * `"depth"`, `"normal"` and `"emissive"` and every pass output so far under
   * `"<effect>.<name>"`. Anything it does not hand back was not asked for or
   * cannot be bound, so an effect needing it returns without declaring.
   */
  textures: RenderTextures;
  /**
   * Declare one fullscreen pass and return what it wrote, for the next pass to
   * read. A handle rather than a name: intra-effect wiring is a variable, and
   * only what other effects consume needs to go through the register.
   */
  pass: (options: PostProcessingPassOptions) => ResourceHandle;
  /**
   * Declare one compute dispatch. Separate from `pass` rather than a flag on
   * it: a dispatch has no attachments, no target to allocate and no image to
   * chain, so all it shares is the pipeline cache and the uniform block.
   */
  compute: (options: PostProcessingComputePassOptions) => void;
  /**
   * A texture for the effect to own for the frame, for what `pass` cannot
   * allocate on its own — a mip chain, or a storage target a dispatch writes.
   */
  createTexture: (descriptor: TextureDescriptor) => ResourceHandle;
}

export interface PostProcessingEffect {
  /**
   * Must match the registration's name: it is both the component key that
   * switches the effect on and the prefix its outputs are published under.
   */
  name: string;
  /**
   * Frame graph stage this effect declares its passes at. Defaults to
   * `"postProcessing"`, after the scene is fully drawn.
   *
   * An effect that has to run earlier names an earlier stage instead — ambient
   * occlusion consumed as a lighting input rather than a post-hoc multiply is
   * the case this exists for. Nothing else changes: it still reads and
   * publishes through the same register, so anything downstream picks up its
   * output by name without knowing when it ran.
   */
  stage?: string | ((cameraEntity: Entity) => string);
  /**
   * Main pass outputs this effect samples, beyond the color chain — `"normal"`,
   * `"emissive"`, and whatever later ones exist.
   *
   * Declared here rather than in the pipeline so the requirement sits with the
   * code that reads it; the pipeline unions whatever the loaded effects ask
   * for. An output is an attachment on the main pass, so adding one relayouts
   * it and recompiles the material pipelines — which is why this is a static
   * list rather than something recomputed from the component each frame.
   */
  outputs?: string[];
  /** Outputs are display-referred from this effect onwards. */
  srgb?: boolean;
  /**
   * Declare the effect's passes, in order, through `context.pass`. Returning
   * without declaring any is how an effect sits the frame out — its inputs are
   * missing, or its settings amount to a no-op.
   */
  declare: (context: PostProcessingContext) => void;
}

const constantsKey = (constants: Record<string, number | boolean>) =>
  Object.keys(constants)
    .sort()
    .map((key) => `${key}=${constants[key]}`)
    .join(",");

/**
 * Stable identity for a shader generator, so two sub-passes sharing a name but
 * not a shader don't share a pipeline. Weak: a generator belongs to an effect
 * module, and a module that is never loaded again should not be held alive.
 */
const shaderIds = new WeakMap<object, number>();
let nextShaderId = 0;
const shaderId = (shader: object) =>
  shaderIds.getOrInsertComputed(shader, () => nextShaderId++);

/**
 * Pipeline variants kept before the least recently used is dropped. Generous:
 * the working set is one per sub-pass of every enabled effect, and the point is
 * to bound a slider dragged through its range, not to ration normal use.
 */
const POST_PROCESSING_PIPELINE_LIMIT = 128;

/** Where a pass draws and what it is called. */
export interface FullscreenPassScope {
  renderView: RenderView;
  textures: RenderTextures;
  /** Prefixes the pass name and the register key. An effect uses its own name. */
  prefix: string;
  /** Allocate display-referred targets rather than HDR ones. */
  srgb?: boolean;
}

/**
 * Post-processing as frame graph passes.
 *
 * An effect is a function that declares passes, the same way the pipeline's own
 * modules do. `context.pass` carries what is genuinely shared — the pipeline
 * variant cache, the uniform block every shader binds, target allocation, and
 * publishing the result — and hands back the handle, so wiring one pass into
 * the next is a variable rather than a name looked up in the register.
 */
export default ({
  ctx,
  frameGraph,
}: {
  ctx: GpuContext;
  frameGraph: FrameGraph;
}): PostProcessingMethods & ThisType<RenderPipelineSystem> => ({
  postProcessingEffects: new Map<string, PostProcessingEffect | null>(),
  postProcessingLoading: new Map<string, Promise<void>>(),
  postProcessingPipelines: new Map<string, RenderPipeline | ComputePipeline>(),

  /**
   * Fetch an effect module once. A failed import is remembered as null so a
   * missing or broken effect doesn't retry every frame.
   */
  loadPostProcessingEffect({
    name,
    load,
  }: EffectRegistration): Promise<void> | undefined {
    if (this.postProcessingEffects.has(name)) return;

    let loading = this.postProcessingLoading.get(name);
    if (!loading) {
      loading = load()
        .then((module: { default: PostProcessingEffect }) => {
          if (typeof module.default?.declare !== "function") {
            throw new Error(
              `"${name}" does not export a PostProcessingEffect.`,
            );
          }
          this.postProcessingEffects.set(name, module.default);
        })
        .catch((error: unknown) => {
          this.postProcessingEffects.set(name, null);
          console.error(
            NAMESPACE,
            "post-processing",
            `failed to load effect "${name}"`,
            error,
          );
        })
        .finally(() => {
          this.postProcessingLoading.delete(name);
        });
      this.postProcessingLoading.set(name, loading);
    }
    return loading;
  },

  /**
   * Pex-gpu keys compiled pipelines by descriptor identity, so each shader
   * variant needs one stable object for the lifetime of the system.
   *
   * Bounded, because `constants` carries slider-driven counts — sample counts,
   * spiral turns — and not just feature flags, so dragging one mints a variant
   * per value. pex-gpu holds its compiled pipelines in a WeakMap keyed by the
   * descriptor, so dropping the oldest here is what makes them collectable.
   */
  getPostProcessingPipeline(
    key: string,
    shader: (defines: Set<string>) => string,
    defines: Set<string>,
    constants: Record<string, number | boolean>,
    blend?: GPUBlendState,
    compute?: boolean,
  ) {
    // Two sub-passes can share a key and differ only in their shader — ssao's
    // "main" is the SAO or the GTAO generator depending on `type` — so the
    // function is part of the identity, not just the name it was declared under.
    const variantKey = `${key}|${shaderId(shader)}|${definesKey(defines)}|${constantsKey(constants)}|${blend ? JSON.stringify(blend) : ""}`;

    const existing = this.postProcessingPipelines.get(variantKey);
    if (existing) {
      // Re-inserting moves it to the end: a Map iterates in insertion order, so
      // the first key is the least recently used.
      this.postProcessingPipelines.delete(variantKey);
      this.postProcessingPipelines.set(variantKey, existing);
      return existing;
    }

    const source = shader(defines);
    // WGSL `override ...: bool` constants are authored as JS booleans; pex-gpu's
    // `constants` is Record<string, number> (GPUPipelineConstantValue is a
    // `double`), so coerce here rather than lean on the browser's WebIDL
    // ToNumber() conversion to do it for us.
    const specialization = Object.keys(constants).length
      ? { constants: mapValues(constants, Number) }
      : {};

    const variant: RenderPipeline | ComputePipeline = compute
      ? { compute: source, ...specialization }
      : {
          vertex: source,
          fragment: source,
          depthWriteEnabled: false,
          ...specialization,
          ...(blend && { blend }),
        };

    this.postProcessingPipelines.set(variantKey, variant);
    if (this.postProcessingPipelines.size > POST_PROCESSING_PIPELINE_LIMIT) {
      const oldest = this.postProcessingPipelines.keys().next().value!;
      this.postProcessingPipelines.delete(oldest);
    }
    return variant;
  },

  /**
   * Declare one fullscreen pass, returning what it wrote.
   *
   * The helper the built-in effects get through `context.pass`, and a method on
   * the pipeline rather than a private function so anything joining the frame
   * from outside reaches it the same way — an injected pass then costs no more
   * to write than a built-in one, and the graph, not a registry, decides where
   * it goes:
   *
   * ```js
   * const pipeline = renderEngine.systems.find(
   *   (system) => system.type === "render-pipeline-system",
   * );
   * // Before every built-in post effect, or after all of them:
   * frameGraph.on("postProcessing", (textures) => {
   *   pipeline.declareFullscreenPass({ renderView: textures.renderView, textures, prefix: "myEffect" }, { ... });
   * });
   * // Or against one pass, wherever it lands:
   * frameGraph.afterPass(`combine.main.${cameraId}`, ...);
   * ```
   *
   * `overridePass` and `disablePass` take it from there for replacing or
   * dropping one. Publishing the result as `"color"` (via `chain`) is what
   * splices it into the image; nothing downstream has to be told it exists.
   */
  declareFullscreenPass(
    { renderView, textures, prefix, srgb }: FullscreenPassScope,
    {
      name,
      shader,
      defines = new Set<string>(),
      constants = {},
      blend,
      source,
      target,
      targets,
      size = [renderView.viewport[2]!, renderView.viewport[3]!],
      format,
      uniforms,
      clearValue,
      chain,
    }: PostProcessingPassOptions,
  ): ResourceHandle {
    const viewId = renderView.cameraEntity!.id;
    const key = `${prefix}.${name}`;

    const output =
      target ??
      frameGraph.createTexture({
        label: `${key}_${viewId}`,
        width: Math.max(1, Math.trunc(size[0]!)),
        height: Math.max(1, Math.trunc(size[1]!)),
        format: format ?? (srgb ? "rgba8unorm-srgb" : "rgba16float"),
      });

    const input = source === undefined ? textures.get("color") : source;

    const textureSize = (handle: ResourceHandle): number[] | undefined => {
      const descriptor = frameGraph.describe(handle);
      return descriptor && isTextureDescriptor(descriptor)
        ? [descriptor.width, descriptor.height]
        : undefined;
    };

    // Both grids come from the graph, not from `size`: `size` is only consulted
    // when this pass allocates, so it describes neither a target that was handed
    // in nor the source being sampled.
    const targetSize = textureSize(output) ?? size;
    const sourceSize = (input && textureSize(input)) ?? targetSize;

    // Handle-valued uniforms become read edges and are swapped for physical
    // textures before execute runs, so nothing here declares dependencies twice.
    // Only the chain input is bound for every pass; a pass binds the
    // depth/normal/emissive textures it actually reads itself, so it doesn't hold
    // alive what it never samples.
    const passUniforms: PassUniforms = {
      ...(input && {
        uTexture: input,
        uTextureSampler: this.samplers.linear,
      }),
      uPostProcessing: {
        viewportSize: targetSize,
        texelSize: [1 / targetSize[0]!, 1 / targetSize[1]!],
        sourceTexelSize: [1 / sourceSize[0]!, 1 / sourceSize[1]!],
        time: this.time,
      },
      ...uniforms,
    };

    const variant = this.getPostProcessingPipeline(
      key,
      shader,
      defines,
      constants,
      blend,
    );

    frameGraph.addPass({
      name: `${key}.${viewId}`,
      color: [
        { texture: output, ...(clearValue && { clearValue }) },
        ...(targets ?? []).map(({ texture, clearValue: value }) => ({
          texture,
          ...(value && { clearValue: value }),
        })),
      ],
      uniforms: passUniforms,
      renderView,
      execute: ({ uniforms: resolved }) => {
        this.drawFullscreen({
          label: key,
          pipeline: variant as RenderPipeline,
          uniforms: resolved,
        });
      },
    });

    textures.set(key, output);
    for (const target of targets ?? []) {
      textures.set(`${prefix}.${target.name}`, target.texture);
    }
    if (chain) textures.set("color", output);

    return output;
  },

  /**
   * Declare one compute dispatch, on the same terms a fullscreen pass gets: the
   * same pipeline cache, the same uniform block, the same naming.
   *
   * Nothing is returned — a dispatch writes through storage bindings the caller
   * already holds handles to, so there is no output to hand back. Those handles
   * must be listed in `writes`: they are not attachments, so the graph has no
   * other way to learn the pass produces them, and without it the pass is
   * culled and its targets never gain STORAGE_BINDING.
   */
  declareComputePass(
    { renderView, prefix }: Pick<FullscreenPassScope, "renderView" | "prefix">,
    {
      name,
      shader,
      defines = new Set<string>(),
      constants = {},
      dispatch,
      writes,
      uniforms,
      views,
    }: PostProcessingComputePassOptions,
  ): void {
    const viewId = renderView.cameraEntity!.id;
    const key = `${prefix}.${name}`;
    const viewport = renderView.viewport;

    const variant = this.getPostProcessingPipeline(
      key,
      shader,
      defines,
      constants,
      undefined,
      true,
    );

    frameGraph.addPass({
      name: `${key}.${viewId}`,
      type: "compute",
      ...(writes && { writes }),
      uniforms: {
        uPostProcessing: {
          viewportSize: [viewport[2]!, viewport[3]!],
          texelSize: [1 / viewport[2]!, 1 / viewport[3]!],
          sourceTexelSize: [1 / viewport[2]!, 1 / viewport[3]!],
          time: this.time,
        },
        ...uniforms,
      },
      renderView,
      execute: ({ uniforms: resolved, resolveView, timestampWrites }) => {
        submit(ctx, {
          label: key,
          pipeline: variant as ComputePipeline,
          uniforms: {
            ...resolved,
            ...mapValues(views ?? {}, ({ handle, ...view }) =>
              resolveView(handle, view),
            ),
          },
          dispatch,
          ...(timestampWrites && { pass: { label: key, timestampWrites } }),
        });
      },
    });
  },

  /**
   * The effects this camera has switched on, in chain order, skipping any whose
   * module has not arrived.
   *
   * Loading starts here, so whichever question is asked first is also what
   * fetches. An effect switched on this frame therefore contributes from the
   * next one, which costs nothing: its passes are a frame behind for the same
   * reason, and an effect whose inputs are missing sits the frame out anyway.
   */
  *enabledPostProcessingEffects(
    cameraEntity: Entity,
  ): Generator<PostProcessingEffect> {
    const component = cameraEntity.postProcessing as
      Record<string, unknown> | undefined;
    if (!component) return;

    for (const registration of EFFECT_ORDER) {
      const { name, unconditional } = registration;
      if (!unconditional && !component[name]) continue;

      // Never awaited. The caller's frame segment acquired the swapchain
      // texture when it opened, and a module fetch is long enough for the
      // browser to present in the meantime — which destroys that texture and
      // takes the whole command buffer with it, bakes included. That failure is
      // invisible and permanent: the sky and reflection probe bake once, into
      // the frame this would have straddled, and clear their dirty flags either
      // way.
      this.loadPostProcessingEffect(registration);

      const effect = this.postProcessingEffects.get(name);
      if (effect) yield effect;
    }
  },

  /** Main pass outputs the enabled effects need. */
  postProcessingOutputs(cameraEntity: Entity): string[] {
    const outputs: string[] = [];
    for (const effect of this.enabledPostProcessingEffects(cameraEntity)) {
      if (effect.outputs) outputs.push(...effect.outputs);
    }
    return outputs;
  },

  /**
   * The enabled effects grouped by the stage they declare at, so the pipeline
   * looks up rather than rescanning the chain at every boundary — and can see,
   * before opening any of them, that something is anchored at a stage which is
   * conditional. An effect at `"prePass"` is asking for a pre-pass, not just
   * for a place in the frame.
   */
  postProcessingEffectsByStage(
    cameraEntity: Entity,
  ): Map<string, PostProcessingEffect[]> {
    const byStage = new Map<string, PostProcessingEffect[]>();
    for (const effect of this.enabledPostProcessingEffects(cameraEntity)) {
      const stage = resolveStage(effect, cameraEntity);
      byStage.getOrInsertComputed(stage, () => []).push(effect);
    }
    return byStage;
  },

  /** Declare `effects`, in order, at the point in the frame reached now. */
  renderPostProcessing({
    renderView,
    textures,
    effects,
  }: {
    renderView: RenderView;
    textures: RenderTextures;
    effects: PostProcessingEffect[] | undefined;
  }): void {
    if (!effects?.length) return;

    const cameraEntity = renderView.cameraEntity!;

    for (const effect of effects) {
      const scope: FullscreenPassScope = {
        renderView,
        textures,
        prefix: effect.name,
        ...(effect.srgb !== undefined && { srgb: effect.srgb }),
      };

      effect.declare({
        ctx,
        cameraEntity,
        renderView,
        viewport: renderView.viewport,
        time: this.time,
        samplers: this.samplers,
        textures,
        pass: (options) => this.declareFullscreenPass(scope, options),
        compute: (options) => this.declareComputePass(scope, options),
        createTexture: (descriptor) => frameGraph.createTexture(descriptor),
      });
    }
  },
});

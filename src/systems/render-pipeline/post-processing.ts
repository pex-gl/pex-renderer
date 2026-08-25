import type { RenderPipeline } from "pex-gpu";

import { NAMESPACE, definesKey, mapValues } from "../../utils.js";
import { isResourceHandle } from "../../frame-graph/types.js";

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
} from "../../frame-graph/index.js";

/**
 * Order effects run in _within a stage_. An effect is declared when the
 * postProcessing component has a truthy key of the same name. Its module is
 * only fetched once it is first needed, so a scene without bloom never
 * downloads or parses the bloom shaders.
 *
 * Which stage an effect runs at is its own (see `PostProcessingEffect.stage`);
 * this list only settles the order of those sharing one. That remains a fixed
 * list because the image chain genuinely is sequential — bloom feeds combine,
 * combine feeds smaa, smaa feeds final — and nothing is gained by making a
 * total order over them negotiable.
 */
const EFFECT_ORDER = [
  "ssao",
  "dof",
  "bloom",
  "combine",
  "smaa",
  "final",
] as const;

/**
 * Declared with no component key of their own: exposure, the tonemap and the
 * output opacity are not optional effects, they are what makes an image. Kept
 * here rather than as a flag on the effect, since whether a module is fetched
 * has to be decided before it is fetched.
 */
const UNCONDITIONAL = new Set(["combine", "final"]);

/** Where an effect runs unless it names another stage: after the whole scene. */
const DEFAULT_STAGE = "postProcessing";

/**
 * Whether ambient occlusion is consumed as a lighting input rather than applied
 * over the shaded image.
 *
 * The technique decides, not a setting: the screen-space bounce gathers light
 * from neighbouring pixels, which do not exist before shading, so asking for it
 * is asking for AO to run afterwards. Everything else — plain visibility, the
 * analytic multi-bounce — needs only depth and normals, so it can run against
 * the pre-pass and modulate indirect light properly.
 *
 * Lives here rather than in the ssao module because combine has to agree, and a
 * static import between two lazily-fetched effects would defeat the fetching.
 */
export const isAOPreLighting = (cameraEntity: Entity): boolean =>
  cameraEntity.postProcessing?.ssao?.multiBounce !== "screen-space";

/** An effect's stage, resolved for one camera. */
const resolveStage = (
  effect: PostProcessingEffect,
  cameraEntity: Entity,
): string =>
  (typeof effect.stage === "function"
    ? effect.stage(cameraEntity)
    : effect.stage) ?? DEFAULT_STAGE;

export interface PostProcessingContext {
  ctx: GpuContext;
  cameraEntity: Entity;
  renderView: RenderView;
  viewport: number[];
  time: number;
  samplers: Samplers;
  /**
   * The frame's images. `get("color")` is the current end of the chain — what a
   * sub-pass reads unless it names a source — alongside the main pass outputs
   * under `"depth"`, `"normal"` and `"emissive"` and every sub-pass output so
   * far under `"<effect>.<subPass>"`. Anything it does not hand back was not
   * asked for or cannot be bound, so an effect needing it sits the frame out.
   */
  textures: RenderTextures;
}

export interface PostProcessingSubPass {
  name: string;
  /** WGSL generator, same contract as the renderer shaders. */
  shader: (defines: Set<string>, options?: unknown) => string;
  getDefines?: (context: PostProcessingContext) => Set<string>;
  /**
   * WGSL `override` values. Part of the pipeline variant key, so a sub-pass
   * that flips one gets its own pipeline rather than mutating a shared object
   * whose passes have not executed yet.
   */
  constants?: (
    context: PostProcessingContext,
  ) => Record<string, number | boolean>;
  blend?: GPUBlendState;
  enabled?: (context: PostProcessingContext) => boolean;
  /** Handle, or a register name. Defaults to the current image, `"color"`. */
  source?: (
    context: PostProcessingContext,
  ) => ResourceHandle | string | undefined;
  /**
   * Publish this sub-pass's output as `"color"`, making it the image every
   * later sub-pass reads by default. Off unless set: most sub-passes write data
   * only their own effect consumes — a visibility buffer, a bloom pyramid
   * level, an edge mask — and leave the image alone. Its output is published
   * under `"<effect>.<subPass>"` either way.
   */
  chain?: boolean;
  /** Handle or register name. A fresh target is allocated when omitted. */
  target?: (
    context: PostProcessingContext,
  ) => ResourceHandle | string | undefined;
  /** Output size, for down/upscaling chains. Defaults to the full viewport. */
  size?: (context: PostProcessingContext) => number[];
  /** Output format. Defaults to the effect's working format. */
  format?: (context: PostProcessingContext) => GPUTextureFormat;
  uniforms?: (context: PostProcessingContext) => PassUniforms;
  clearValue?: GPUColor;
}

export interface PostProcessingEffect {
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
  enabled?: (context: PostProcessingContext) => boolean;
  passes: (context: PostProcessingContext) => PostProcessingSubPass[];
}

const constantsKey = (constants: Record<string, number | boolean>) =>
  Object.keys(constants)
    .sort()
    .map((key) => `${key}=${constants[key]}`)
    .join(",");

/**
 * Post-processing as frame graph passes.
 *
 * Each sub-pass declares what it reads and writes; the graph handles the rest.
 * That removes two things the previous implementation did by hand: a mutable
 * target dictionary keyed by view and pass name, and a per-view cache other
 * systems reached into for the AO texture. Outputs are ordinary handles now,
 * published in the view's register under the name any reader can ask for.
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
  postProcessingPipelines: new Map<string, RenderPipeline>(),
  /**
   * Fetch an effect module once. A failed import is remembered as null so a
   * missing or broken effect doesn't retry every frame.
   */
  loadPostProcessingEffect(name: string): Promise<void> | undefined {
    if (this.postProcessingEffects.has(name)) return;

    let loading = this.postProcessingLoading.get(name);
    if (!loading) {
      loading = import(`./post-processing/${name}.js`)
        .then((module: { default: PostProcessingEffect }) => {
          if (typeof module.default?.passes !== "function") {
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
   */
  getPostProcessingPipeline(
    key: string,
    subPass: PostProcessingSubPass,
    defines: Set<string>,
    constants: Record<string, number | boolean>,
  ) {
    const variantKey = `${key}|${definesKey(defines)}|${constantsKey(constants)}`;
    return this.postProcessingPipelines.getOrInsertComputed(variantKey, () => {
      const source = subPass.shader(defines);
      return {
        vertex: source,
        fragment: source,
        depthWriteEnabled: false,
        // WGSL `override ...: bool` constants are authored as JS booleans;
        // pex-gpu's RenderPipeline.constants is Record<string, number>
        // (GPUPipelineConstantValue is a `double`), so coerce here rather than
        // lean on the browser's WebIDL ToNumber() conversion to do it for us.
        ...(Object.keys(constants).length && {
          constants: mapValues(constants, Number),
        }),
        ...(subPass.blend && { blend: subPass.blend }),
      };
    });
  },

  /**
   * Main pass outputs the enabled effects need.
   *
   * Only a module that has arrived can answer, so an effect switched on this
   * frame contributes from the next one. That costs nothing: its passes are
   * already a frame behind for the same reason, and an effect whose inputs are
   * missing sits the frame out rather than failing.
   *
   * Loading starts here — before the main pass is declared, rather than after
   * it — so the frame that fetches a module is also the one that can act on
   * what it asks for.
   */
  postProcessingOutputs(cameraEntity: Entity): string[] {
    const component = cameraEntity.postProcessing as
      Record<string, unknown> | undefined;
    if (!component) return [];

    const outputs: string[] = [];
    for (const name of EFFECT_ORDER) {
      if (!UNCONDITIONAL.has(name) && !component[name]) continue;

      // Never awaited. The caller's frame segment acquired the swapchain
      // texture when it opened, and a module fetch is long enough for the
      // browser to present in the meantime — which destroys that texture and
      // takes the whole command buffer with it, bakes included. That failure is
      // invisible and permanent: the sky and reflection probe bake once, into
      // the frame this would have straddled, and clear their dirty flags either
      // way.
      this.loadPostProcessingEffect(name);

      const effect = this.postProcessingEffects.get(name);
      if (effect?.outputs) outputs.push(...effect.outputs);
    }
    return outputs;
  },

  /** Declare the passes of every enabled effect anchored at `stage`. */
  /**
   * Stages the enabled effects will declare passes at, so the pipeline can make
   * sure the ones that are conditional actually run — an effect anchored at
   * `"prePass"` is asking for a pre-pass, not just for a place in the frame.
   */
  postProcessingStages(cameraEntity: Entity): Set<string> {
    const component = cameraEntity.postProcessing as
      Record<string, unknown> | undefined;
    const stages = new Set<string>();
    if (!component) return stages;

    for (const name of EFFECT_ORDER) {
      if (!UNCONDITIONAL.has(name) && !component[name]) continue;
      const effect = this.postProcessingEffects.get(name);
      if (effect) stages.add(resolveStage(effect, cameraEntity));
    }
    return stages;
  },

  renderPostProcessing({
    renderView,
    textures,
    stage,
  }: {
    renderView: RenderView;
    textures: RenderTextures;
    stage: string;
  }): void {
    const cameraEntity = renderView.cameraEntity!;
    const component = cameraEntity.postProcessing as
      Record<string, unknown> | undefined;
    if (!component) return;
    const viewId = cameraEntity.id;

    const context: PostProcessingContext = {
      ctx,
      cameraEntity,
      renderView,
      viewport: renderView.viewport,
      time: this.time,
      samplers: this.samplers,
      textures,
    };

    const resolveHandle = (
      value: ResourceHandle | string | undefined,
    ): ResourceHandle | undefined =>
      value === undefined || isResourceHandle(value)
        ? value
        : textures.require(value);

    for (const effectName of EFFECT_ORDER) {
      const effect = this.postProcessingEffects.get(effectName);
      if (!effect) continue;
      if (resolveStage(effect, cameraEntity) !== stage) continue;
      if (!UNCONDITIONAL.has(effectName) && !component[effectName]) continue;
      if (effect.enabled && !effect.enabled(context)) continue;

      for (const subPass of effect.passes(context)) {
        if (subPass.enabled && !subPass.enabled(context)) continue;

        const passKey = `${effectName}.${subPass.name}`;
        const explicitTarget = resolveHandle(subPass.target?.(context));
        const size = subPass.size?.(context) ?? [
          renderView.viewport[2]!,
          renderView.viewport[3]!,
        ];

        const output =
          explicitTarget ??
          frameGraph.createTexture({
            label: `${passKey}_${viewId}`,
            width: Math.max(1, Math.trunc(size[0]!)),
            height: Math.max(1, Math.trunc(size[1]!)),
            format:
              subPass.format?.(context) ??
              (effect.srgb ? "rgba8unorm-srgb" : "rgba16float"),
          });

        const input =
          resolveHandle(subPass.source?.(context)) ?? textures.get("color")!;

        const defines = subPass.getDefines?.(context) ?? new Set<string>();
        const constants = subPass.constants?.(context) ?? {};
        const pipeline = this.getPostProcessingPipeline(
          passKey,
          subPass,
          defines,
          constants,
        );

        // Handle-valued uniforms become read edges and are swapped for physical
        // textures before execute runs, so nothing here declares dependencies
        // twice. Only the chain input is bound for every pass; a sub-pass binds
        // the depth/normal/emissive textures it actually reads itself, so it
        // doesn't hold alive what it never samples.
        const uniforms: PassUniforms = {
          uTexture: input,
          uTextureSampler: this.samplers.linear,
          uPostProcessing: {
            viewportSize: size,
            texelSize: [1 / size[0]!, 1 / size[1]!],
            time: this.time,
          },
          ...subPass.uniforms?.(context),
        };

        const label = `postProcessing.${passKey}.${viewId}`;

        frameGraph.addPass({
          name: label,
          color: [
            {
              texture: output,
              ...(subPass.clearValue && { clearValue: subPass.clearValue }),
            },
          ],
          uniforms,
          renderView,
          execute: ({ uniforms: resolved }) => {
            this.drawFullscreen({
              label: passKey,
              pipeline,
              uniforms: resolved,
            });
          },
        });

        textures.set(passKey, output);
        if (subPass.chain) textures.set("color", output);
      }
    }
  },
});

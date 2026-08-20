import { submit, createSampler } from "pex-gpu";

import createFullscreenGeometry from "../../fullscreen-geometry.js";
import { NAMESPACE, definesKey } from "../../utils.js";
import { isResourceHandle } from "../../frame-graph/types.js";

import type { Entity, GpuContext, RenderView } from "../../types.js";
import type {
  FrameGraph,
  PassUniforms,
  ResourceHandle,
} from "../../frame-graph/index.js";

/**
 * Effects run in this order. An effect is declared when the postProcessing
 * component has a truthy key of the same name. Its module is only fetched once
 * it is first needed, so a scene without bloom never downloads or parses the
 * bloom shaders.
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

/** Samplers a sub-pass binds alongside the textures it reads. */
export interface PostProcessingSamplers {
  /** Filtered, clamped: color reads, and the SMAA area lookup. */
  linear: GPUSampler;
  /** Unfiltered, clamped: depth reads, and the SMAA search lookup. */
  nearest: GPUSampler;
  /** Filtered, repeating: the tiled SSAO noise textures. */
  linearRepeat: GPUSampler;
}

export interface PostProcessingContext {
  ctx: GpuContext;
  cameraEntity: Entity;
  renderView: RenderView;
  viewport: number[];
  time: number;
  samplers: PostProcessingSamplers;
  /** Current end of the chain — what a sub-pass reads unless it names a source. */
  color: ResourceHandle;
  depth?: ResourceHandle;
  normal?: ResourceHandle;
  emissive?: ResourceHandle;
  /** Outputs published so far, keyed "<effect>.<subPass>". */
  targets: Map<string, ResourceHandle>;
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
  /** Handle, or a "<effect>.<subPass>" key. Defaults to the current image. */
  source?: (context: PostProcessingContext) => ResourceHandle | string | undefined;
  /**
   * This sub-pass's output becomes the current image, which every later
   * sub-pass reads by default. Off unless set: most sub-passes write data only
   * their own effect consumes — a visibility buffer, a bloom pyramid level, an
   * edge mask — and leave the image alone.
   */
  chain?: boolean;
  /** Handle or key. A fresh target is allocated when omitted. */
  target?: (context: PostProcessingContext) => ResourceHandle | string | undefined;
  /** Output size, for down/upscaling chains. Defaults to the full viewport. */
  size?: (context: PostProcessingContext) => number[];
  /** Output format. Defaults to the effect's working format. */
  format?: (context: PostProcessingContext) => GPUTextureFormat;
  uniforms?: (context: PostProcessingContext) => PassUniforms;
  clearValue?: GPUColor;
}

export interface PostProcessingEffect {
  name: string;
  /** Targets are display-referred from this effect onwards. */
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
 * systems reached into for the AO texture. Targets are ordinary handles now,
 * published on the blackboard for anyone who needs them.
 */
export default ({ ctx, frameGraph }: { ctx: GpuContext; frameGraph: FrameGraph }) => ({
  postProcessingEffects: new Map<string, PostProcessingEffect | null>(),
  postProcessingLoading: new Map<string, Promise<void>>(),
  postProcessingPipelines: new Map<string, Record<string, unknown>>(),
  fullscreenGeometry: createFullscreenGeometry(ctx),
  postProcessingSamplers: {
    linear: createSampler(ctx, { filter: "linear" }),
    nearest: createSampler(ctx, { filter: "nearest" }),
    linearRepeat: createSampler(ctx, {
      filter: "linear",
      addressMode: "repeat",
    }),
  } as PostProcessingSamplers,

  /**
   * Fetch an effect module once. A failed import is remembered as null so a
   * missing or broken effect doesn't retry every frame.
   */
  loadPostProcessingEffect(this: any, name: string): Promise<void> | undefined {
    if (this.postProcessingEffects.has(name)) return;

    let loading = this.postProcessingLoading.get(name);
    if (!loading) {
      loading = import(`./post-processing/${name}.js`)
        .then((module: { default: PostProcessingEffect }) => {
          if (typeof module.default?.passes !== "function") {
            throw new Error(`"${name}" does not export a PostProcessingEffect.`);
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
   * pex-gpu keys compiled pipelines by descriptor identity, so each shader
   * variant needs one stable object for the lifetime of the system.
   */
  getPostProcessingPipeline(
    this: any,
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
        ...(Object.keys(constants).length && { constants }),
        ...(subPass.blend && { blend: subPass.blend }),
      };
    });
  },

  renderPostProcessing(
    this: any,
    {
      renderView,
      color,
      depth,
      normal,
      emissive,
    }: {
      renderView: RenderView;
      color: ResourceHandle;
      depth?: ResourceHandle;
      normal?: ResourceHandle;
      emissive?: ResourceHandle;
    },
  ): ResourceHandle {
    const cameraEntity = renderView.cameraEntity!;
    const component = cameraEntity.postProcessing as Record<string, unknown>;
    const viewId = cameraEntity.id;
    const { colorFormat, srgbColorFormat } = this.descriptors.postProcessing;

    const context: PostProcessingContext = {
      ctx,
      cameraEntity,
      renderView,
      viewport: renderView.viewport,
      time: this.time,
      samplers: this.postProcessingSamplers,
      color,
      ...(depth && { depth }),
      ...(normal && { normal }),
      ...(emissive && { emissive }),
      targets: new Map<string, ResourceHandle>(),
    };

    // Start any module this frame wants and carry on with the ones already
    // resolved: an effect first appears the frame after it is switched on.
    //
    // Never awaited. The caller's frame segment acquired the swapchain texture
    // when it opened, and a module fetch is long enough for the browser to
    // present in the meantime — which destroys that texture and takes the whole
    // command buffer with it, bakes included. That failure is invisible and
    // permanent: the sky and reflection probe bake once, into the frame this
    // would have straddled, and clear their dirty flags either way.
    for (const name of EFFECT_ORDER) {
      if (UNCONDITIONAL.has(name) || component[name]) {
        this.loadPostProcessingEffect(name);
      }
    }

    const resolveTarget = (
      value: ResourceHandle | string | undefined,
    ): ResourceHandle | undefined => {
      if (value === undefined) return undefined;
      if (isResourceHandle(value)) return value;
      const handle = context.targets.get(value);
      if (!handle) {
        console.warn(
          NAMESPACE,
          "post-processing",
          `unknown target "${value}"`,
        );
      }
      return handle;
    };

    for (const effectName of EFFECT_ORDER) {
      const effect = this.postProcessingEffects.get(effectName);
      if (!effect) continue;
      if (!UNCONDITIONAL.has(effectName) && !component[effectName]) continue;
      if (effect.enabled && !effect.enabled(context)) continue;

      for (const subPass of effect.passes(context)) {
        if (subPass.enabled && !subPass.enabled(context)) continue;

        const passKey = `${effectName}.${subPass.name}`;
        const explicitTarget = resolveTarget(subPass.target?.(context));
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
              (effect.srgb ? srgbColorFormat : colorFormat),
          });

        const input = resolveTarget(subPass.source?.(context)) ?? context.color;

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
        // the depth/normal/emissive targets it actually reads itself, so it
        // doesn't hold alive what it never samples.
        const uniforms: PassUniforms = {
          uTexture: input,
          uTextureSampler: this.postProcessingSamplers.linear,
          uPostProcessing: {
            viewportSize: size,
            texelSize: [1 / size[0]!, 1 / size[1]!],
            time: this.time,
          },
          ...subPass.uniforms?.(context),
        };

        frameGraph.addPass({
          name: `PostProcessing.${passKey}_${viewId}`,
          color: [
            {
              texture: output,
              ...(subPass.clearValue && { clearValue: subPass.clearValue }),
            },
          ],
          uniforms,
          renderView,
          execute: ({ uniforms: resolved }) => {
            submit(ctx, {
              label: passKey,
              attributes: this.fullscreenGeometry.triangle.attributes,
              count: this.fullscreenGeometry.triangle.count,
              pipeline,
              uniforms: resolved,
            });
          },
        });

        context.targets.set(passKey, output);
        frameGraph.blackboard.set(`postProcessing.${viewId}.${passKey}`, output);

        if (subPass.chain) context.color = output;
      }
    }

    return context.color;
  },
});

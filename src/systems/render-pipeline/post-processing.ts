import { submit } from "pex-gpu";

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
 * component has a truthy key of the same name, or when it is marked `always`.
 * Its module is only fetched once it is first needed, so a scene without bloom
 * never downloads or parses the bloom shaders.
 */
const EFFECT_ORDER = [
  "ssao",
  "dof",
  "bloom",
  "combine",
  "smaa",
  "final",
] as const;

export interface PostProcessingContext {
  ctx: GpuContext;
  cameraEntity: Entity;
  renderView: RenderView;
  viewport: number[];
  time: number;
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
  blend?: boolean;
  enabled?: (context: PostProcessingContext) => boolean;
  /** Handle, or a "<effect>.<subPass>" key. Defaults to the chain's color. */
  source?: (context: PostProcessingContext) => ResourceHandle | string | undefined;
  /** Handle or key. A fresh target is allocated when omitted. */
  target?: (context: PostProcessingContext) => ResourceHandle | string | undefined;
  /** Output size, for down/upscaling chains. Defaults to the full viewport. */
  size?: (context: PostProcessingContext) => number[];
  uniforms?: (context: PostProcessingContext) => PassUniforms;
  clearValue?: GPUColor;
}

export interface PostProcessingEffect {
  name: string;
  /** Targets are display-referred from this effect onwards. */
  srgb?: boolean;
  /** Declare even when the component has no key of this name. */
  always?: boolean;
  enabled?: (context: PostProcessingContext) => boolean;
  passes: (context: PostProcessingContext) => PostProcessingSubPass[];
}

/**
 * Post-processing as frame graph passes.
 *
 * Each sub-pass declares what it reads and writes; the graph handles the rest.
 * That removes three things the previous implementation had to do by hand: a
 * mutable target dictionary keyed by view and pass name, an explicit
 * "if no target, this is now the chain output" reassignment, and a per-view
 * cache that other systems reached into for the AO texture. Targets are now
 * ordinary handles, published on the blackboard for anyone who needs them.
 */
export default ({ ctx, frameGraph }: { ctx: GpuContext; frameGraph: FrameGraph }) => ({
  postProcessingEffects: new Map<string, PostProcessingEffect | null>(),
  postProcessingLoading: new Map<string, Promise<void>>(),
  postProcessingPipelines: new Map<string, Record<string, unknown>>(),
  fullscreenGeometry: createFullscreenGeometry(ctx),

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
            throw new Error(
              `"${name}" does not export a PostProcessingEffect. Effects still on the pre-WebGPU GLSL flagDefinitions format need porting to a WGSL shader generator first.`,
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
   * pex-gpu keys compiled pipelines by descriptor identity, so each shader
   * variant needs one stable object for the lifetime of the system.
   */
  getPostProcessingPipeline(
    this: any,
    key: string,
    subPass: PostProcessingSubPass,
    defines: Set<string>,
  ) {
    const variantKey = `${key}|${definesKey(defines)}`;
    return this.postProcessingPipelines.getOrInsertComputed(variantKey, () => {
      const source = subPass.shader(defines);
      return {
        vertex: source,
        fragment: source,
        depthWriteEnabled: false,
        ...(subPass.blend && { blend: true }),
      };
    });
  },

  async renderPostProcessing(
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
  ): Promise<ResourceHandle> {
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
      color,
      ...(depth && { depth }),
      ...(normal && { normal }),
      ...(emissive && { emissive }),
      targets: new Map<string, ResourceHandle>(),
    };

    // Resolve every module this frame needs before declaring anything, so the
    // chain is complete on the first frame an effect is switched on.
    await Promise.all(
      EFFECT_ORDER.map((name) =>
        this.postProcessingEffects.get(name)?.always || component[name]
          ? this.loadPostProcessingEffect(name)
          : undefined,
      ).filter(Boolean),
    );

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
      if (!effect.always && !component[effectName]) continue;
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
            format: effect.srgb ? srgbColorFormat : colorFormat,
          });

        const input = resolveTarget(subPass.source?.(context)) ?? context.color;

        const defines = subPass.getDefines?.(context) ?? new Set<string>();
        const pipeline = this.getPostProcessingPipeline(
          passKey,
          subPass,
          defines,
        );

        // Handle-valued uniforms become read edges and are swapped for physical
        // textures before execute runs, so nothing here declares dependencies
        // twice.
        const uniforms: PassUniforms = {
          uTexture: input,
          ...(depth && { uDepthTexture: depth }),
          ...(normal && { uNormalTexture: normal }),
          ...(emissive && { uEmissiveTexture: emissive }),
          uViewport: renderView.viewport,
          uViewportSize: size,
          uTexelSize: [1 / size[0]!, 1 / size[1]!],
          uTime: this.time,
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

        // A sub-pass writing into a target it named is a side channel (a blur
        // feeding back into its own source, say); only an allocated target
        // advances the chain.
        if (!explicitTarget) context.color = output;
      }
    }

    return context.color;
  },
});

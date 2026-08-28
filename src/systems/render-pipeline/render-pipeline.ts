import { submit, createSampler, generateMipmaps, isGpuTexture } from "pex-gpu";
import type { RenderCommand, RenderPipeline } from "pex-gpu";

import shadowMappingPipelineMethods from "./shadow-mapping.js";
import postProcessingPipelineMethods from "./post-processing.js";
import cullingPipelineMethods from "./culling.js";
import createFullscreenGeometry from "../../fullscreen-geometry.js";
import { SCENE_OUTPUT_MEMBERS } from "../../shaders/wgsl.js";
import { blitShader } from "../../shaders/blit.js";
import { grabPassShader } from "../../shaders/grab-pass.js";
import { depthResolveShader } from "../../shaders/depth-resolve.js";
import { RenderTextures } from "./render-textures.js";
import { getDefaultViewport, mapValues } from "../../utils.js";

import type { Entity, SystemOptions } from "../../types.js";
import type {
  ColorAttachmentDeclaration,
  DepthStencilAttachmentDeclaration,
  ResourceHandle,
} from "../../frame-graph/index.js";

const BLIT_WGSL = blitShader();
const BLIT_PREMULTIPLIED_WGSL = blitShader(new Set(["USE_PREMULTIPLIED_ALPHA"]));
const GRAB_PASS_WGSL = grabPassShader();

/**
 * Render pipeline system
 *
 * Adds:
 *
 * - "_near", "_far", "_radiusUV" and "_sceneBboxInLightSpace" to light components
 *   that cast shadows
 * - "_shadowCubemap" to pointLight components and "_shadowMap" to other light
 *   components
 */
export default ({ ctx, frameGraph }: SystemOptions) => ({
  type: "render-pipeline-system",
  time: 0,
  /** Frames rendered, from the engine. Indexes every per-frame sequence. */
  frameIndex: 0,
  debug: false,
  debugRender: "",
  reversibleToneMap: false,

  fullscreen: createFullscreenGeometry(ctx),

  // Every filtering state the pipeline and its effects sample with. One object
  // per state rather than one per call site: pex-gpu keys its bind group cache
  // by sampler identity, so two equal-but-distinct samplers are two entries.
  samplers: {
    linear: createSampler(ctx, { filter: "linear" }),
    nearest: createSampler(ctx, { filter: "nearest" }),
    linearRepeat: createSampler(ctx, {
      filter: "linear",
      addressMode: "repeat",
    }),
  },
  /**
   * Premultiply on the way out, as a canvas configured `alphaMode:
   * "premultiplied"` requires. Follows the context, and settable for a caller
   * presenting somewhere else.
   *
   * Getting it wrong shows only where alpha is neither 0 nor 1 — a faded
   * output, or the soft edges of blended geometry — which is why it follows the
   * one place that knows rather than being repeated per app.
   */
  premultipliedAlpha: ctx.alphaMode === "premultiplied",

  // One stable descriptor object per variant: pex-gpu keys compiled pipelines
  // by identity, so swapping fields on a shared object recompiles every frame.
  blitPipeline: {
    vertex: BLIT_WGSL,
    fragment: BLIT_WGSL,
    depthWriteEnabled: false,
  },
  blitPremultipliedPipeline: {
    vertex: BLIT_PREMULTIPLIED_WGSL,
    fragment: BLIT_PREMULTIPLIED_WGSL,
    depthWriteEnabled: false,
  },
  grabPipeline: {
    vertex: GRAB_PASS_WGSL,
    fragment: GRAB_PASS_WGSL,
    depthWriteEnabled: false,
  },
  /**
   * Resolve the depth buffer under MSAA so it can be sampled. Off means
   * anything reading depth — ambient occlusion, depth of field, fog, SMAA's
   * depth edges — sits out the frame instead, and `render()` hands back the
   * multisampled buffer, which `RenderTextures.get` will refuse to hand to a
   * reader.
   *
   * Off by default only because MSAA itself currently hangs the GPU in the
   * multisampled scene pass; the resolve was measured innocent of that and can
   * go back on once it is fixed.
   */
  depthResolve: false,
  depthResolvePipelines: new Map<number, RenderPipeline>(),

  /** One variant per MSAA level, since the sample loop is unrolled per count. */
  getDepthResolvePipeline(sampleCount: number) {
    return this.depthResolvePipelines.getOrInsertComputed(sampleCount, () => {
      const source = depthResolveShader(sampleCount);
      return {
        vertex: source,
        fragment: source,
        // Writes @builtin(frag_depth) over the whole target, so the test only
        // has to let every fragment through.
        depthWriteEnabled: true,
        depthCompare: "always" as GPUCompareFunction,
      };
    });
  },

  /**
   * Costs a second geometry pass, and buys two things: fragments that end up
   * hidden are rejected before the expensive shader runs, and geometry exists
   * before lighting, which is what ambient occlusion needs to be an input to
   * shading rather than a multiply over the result.
   *
   * Off by default — for a scene with little overdraw and a cheap shader the
   * extra pass is a net loss.
   */
  depthPrePass: false,

  /** Always produced. Effects add to it — "normal", "emissive". */
  outputs: new Set(["color", "depth"]),
  colorFormat: "rgba16float" as GPUTextureFormat,
  depthFormat: "depth24plus" as GPUTextureFormat,
  /**
   * Outputs whose contents are not colour, and so want neither the working
   * colour format nor its channel count. Motion vectors are a screen-space
   * offset: two channels, and signed, which rules out the UNORM formats.
   */
  outputFormats: {
    velocity: "rg16float",
    responsive: "r8unorm",
  } as Record<string, GPUTextureFormat>,

  ...shadowMappingPipelineMethods({ frameGraph }),
  ...postProcessingPipelineMethods({ ctx, frameGraph }),
  ...cullingPipelineMethods(),

  /** The fullscreen triangle, drawn by whatever the command asks for. */
  drawFullscreen(command: RenderCommand) {
    submit(ctx, {
      attributes: this.fullscreen.triangle.attributes,
      count: this.fullscreen.triangle.count,
      ...command,
    });
  },

  /** Dispatch one pass' draws to every renderer implementing its entry point. */
  drawMeshes({
    renderers,
    renderView,
    colorTextures,
    msaa,
    entitiesInView,
    shadowMappingLight,
    transparent,
    transmitted,
    cullFaceMode,
    textures,
    prePass,
    normalOutput,
  }: any) {
    const options = {
      outputs: colorTextures ?? {},
      // Two different things, and conflating them hides one: whether the
      // attachment is multisampled — which decides coverage-based alpha
      // testing — and whether the scene is tone mapped for a reversible
      // resolve, which is an opt-in on top of it.
      multisampled: msaa,
      msaa: this.reversibleToneMap && msaa,
      textures,
    };

    const draw = (method: string, entities: Entity[], passOptions: any) => {
      for (let i = 0; i < renderers.length; i++) {
        renderers[i][method]?.(renderView, entities, passOptions);
      }
    };

    // Nothing is shaded in the pre-pass, so none of the frame's images apply.
    if (prePass) return draw("renderPrePass", entitiesInView, { normalOutput });
    if (shadowMappingLight) {
      return draw("renderShadow", entitiesInView, {
        ...options,
        shadowMappingLight,
      });
    }

    const visible = this.cullEntities(entitiesInView, renderView.camera);
    if (transparent) return draw("renderTransparent", visible, options);

    draw("renderOpaque", visible, { ...options, transmitted, cullFaceMode });
    // A transmission pass draws over an image that already has its background.
    if (!transmitted) draw("renderBackground", entitiesInView, options);
  },

  // Async because post-processing effects are imported on demand, so a frame
  // that first enables one waits for its module. Nothing here touches the GPU:
  // the graph only records declarations, and execution happens after compile.
  async update(entities: Entity[], options: any = {}) {
    let {
      time,
      frameIndex = 0,
      renderView,
      renderers,
      drawToScreen = true,
    } = options;

    this.time = time;
    this.frameIndex = frameIndex;

    // Without a view, the first camera in the scene draws to the whole canvas.
    if (!renderView) {
      const entity = entities.find((entity) => entity.camera)!;
      renderView = {
        cameraEntity: entity,
        camera: entity.camera,
        viewport: getDefaultViewport(ctx),
      };
    }

    const { cameraEntity, camera } = renderView;
    const [, , width, height] = renderView.viewport;
    const postProcessing = cameraEntity.postProcessing;
    const viewId = cameraEntity.id;

    // What the main pass produces, from three places: the pipeline's own
    // outputs, what the enabled post-processing effects declared they sample,
    // and whatever anything else asks for at the "outputs" stage. Effects are
    // asked directly rather than through the stage because the pipeline owns
    // them; everything outside it joins here, before any of this is allocated.
    const outputs = new Set<string>(this.outputs);
    for (const name of this.postProcessingOutputs(cameraEntity)) {
      outputs.add(name);
    }
    await frameGraph.stage("outputs", { outputs, renderView });

    // Temporal antialiasing supersedes multisampling: it resolves geometric
    // aliasing across frames rather than within one, and the two cannot be
    // stacked anyway — the accumulated image is single-sample and WebGPU has no
    // way to load it back into a multisampled attachment.
    const useTAA = !!postProcessing?.taa;

    // WebGPU only guarantees 1 and 4; anything else fails texture creation and
    // then cascades through every pipeline and bind group built against it.
    const requestedSampleCount = useTAA ? 1 : postProcessing?.msaa?.sampleCount;
    const sampleCount = requestedSampleCount > 1 ? 4 : 1;
    const msaa = sampleCount > 1;

    const renderPassView = {
      ...renderView,
      viewport: [0, 0, width, height],
    };
    const textures = new RenderTextures(frameGraph, renderPassView);

    if (requestedSampleCount > 1 && requestedSampleCount !== sampleCount) {
      textures.report(
        `msaa.sampleCount ${requestedSampleCount} is not a supported sample count — using ${sampleCount}.`,
      );
    }

    if (useTAA && postProcessing?.msaa?.sampleCount > 1) {
      textures.report(
        'both "taa" and "msaa" are enabled. Temporal antialiasing supersedes multisampling — rendering single-sample.',
      );
    }

    // Ordered by `SCENE_OUTPUT_MEMBERS`, not by which effect asked for what: the
    // shaders number their `@location`s from that list, and a location selects
    // the attachment at the same index. Ordering by the asking effect instead
    // puts each buffer's contents in the next buffer along as soon as two
    // effects contribute — silently, wherever the formats happen to be
    // component-compatible.
    const sceneOutputs = SCENE_OUTPUT_MEMBERS.map(({ name }) => name);
    const colorOutputs = [
      "color",
      ...sceneOutputs.filter((name) => outputs.has(name)),
      // Whatever the "outputs" stage added: a renderer from outside numbers its
      // own locations, and an unknown name has no slot here to claim.
      ...outputs.difference(new Set(["color", "depth", ...sceneOutputs])),
    ];

    const colorTextures: Record<string, ResourceHandle> = {};
    const msaaColorTextures: Record<string, ResourceHandle> = {};
    for (const name of colorOutputs) {
      const descriptor = {
        width,
        height,
        format: this.outputFormats[name] ?? this.colorFormat,
      };
      colorTextures[name] = frameGraph.createTexture({
        label: `renderPipeline.${name}.${viewId}`,
        ...descriptor,
      });
      textures.set(name, colorTextures[name]!);

      if (msaa) {
        msaaColorTextures[name] = frameGraph.createTexture({
          label: `renderPipeline.${name}MSAA.${viewId}`,
          ...descriptor,
          sampleCount,
        });
      }
    }

    // WebGPU has no depth resolve — GPURenderPassDepthStencilAttachment has no
    // resolveTarget — so under MSAA the depth buffer stays multisampled and is
    // what gets handed back. Anything wanting single-sample depth needs an
    // explicit resolve pass of its own.
    let depthTexture: ResourceHandle | undefined;
    if (outputs.has("depth")) {
      depthTexture = frameGraph.createTexture({
        label: `renderPipelineDepth${msaa ? "MSAA" : ""}.${viewId}`,
        width,
        height,
        format: this.depthFormat,
        ...(msaa && { sampleCount }),
      });
      textures.set("depth", depthTexture);
    }

    frameGraph.blackboard.set(`renderTextures.${viewId}`, textures);

    /**
     * Resolved per pass, not captured once, so a pass injected mid-scene can
     * republish an image and have the passes after it draw into that one.
     *
     * MSAA cannot: WebGPU has no way to load a single-sample image back into
     * the multisampled attachment its resolve target came from. Reads still
     * work — the resolve runs at the end of every pass declaring it — but a
     * replacement has nowhere to go, so it is reported rather than dropped.
     */
    const colorTarget = (name: string): ColorAttachmentDeclaration => {
      const published = textures.get(name) ?? colorTextures[name]!;
      if (!msaa) return { texture: published };

      if (published !== colorTextures[name]) {
        textures.report(
          `"${name}" was republished as ${textures.explain(published)} while the scene passes were still drawing, which MSAA cannot pick up. Move the pass to a stage after them, or turn MSAA off.`,
        );
      }
      return {
        texture: msaaColorTextures[name]!,
        resolveTarget: colorTextures[name]!,
      };
    };
    const depthTarget = (): DepthStencilAttachmentDeclaration => ({
      texture: depthTexture!,
    });

    /**
     * Republishes the depth buffer as something readers can bind.
     *
     * WebGPU has no depth resolve, so under MSAA the depth buffer stays
     * multisampled and `textures.get("depth")` rightly refuses to hand it back
     * — which is enough to make ambient occlusion, depth of field, fog and
     * SMAA's depth edges all sit out. One fullscreen pass over the samples is
     * what lets them run with MSAA on at all.
     *
     * Declared where depth is first complete, since an effect anchored at the
     * pre-pass stage reads it there.
     */
    const declareDepthResolve = () => {
      if (!msaa || !depthTexture || !this.depthResolve) return;

      const label = `depthResolve.${viewId}`;
      const resolved = frameGraph.createTexture({
        label: `renderPipelineDepthResolved.${viewId}`,
        width,
        height,
        format: this.depthFormat,
      });
      const pipeline = this.getDepthResolvePipeline(sampleCount);

      frameGraph.addPass({
        name: label,
        depth: { texture: resolved, depthClearValue: 1 },
        uniforms: { uDepthTexture: depthTexture },
        renderView: renderPassView,
        execute: ({ uniforms }) => {
          this.drawFullscreen({ label, pipeline, uniforms });
        },
      });

      // A newer version under the same name: readers asking for "depth" get
      // this one, and the multisampled original stays reachable for anything
      // that explicitly accepts it.
      textures.set("depth", resolved);
    };

    const layer = cameraEntity.layer;

    /**
     * A stage boundary. Every stage is an anchor, not just "postProcessing",
     * which is what lets an effect declare its passes mid-frame and still read
     * and publish through the same register as the rest.
     *
     * External callbacks run before the effects anchored there, so an effect
     * sees what they published.
     */
    const effectsByStage = this.postProcessingEffectsByStage(cameraEntity);

    const stage = async (name: string) => {
      await frameGraph.stage(name, textures);
      this.renderPostProcessing({
        renderView: renderPassView,
        textures,
        effects: effectsByStage.get(name),
      });
      // Consumed, so whatever is left at the end named a stage this frame never
      // opened.
      effectsByStage.delete(name);
    };

    await stage("lights");

    // Declared once per frame and shared by every camera looking at the same
    // layer, since a shadow map depends on the light and the scene only.
    const { shadowMaps } = this.declareShadowMaps(entities, renderers, layer);

    // An entity without a layer belongs to every view; a camera with one sees
    // only those plus its own.
    const entitiesInView = layer
      ? entities.filter((entity) => !entity.layer || entity.layer === layer)
      : entities.filter((entity) => !entity.layer);

    const drawMeshOptions = {
      renderers,
      renderView,
      msaa,
      entitiesInView,
      shadowMappingLight: false,
      transparent: false,
      transmitted: false,
    };

    /**
     * One pass of scene geometry, differing only in what it draws and where.
     *
     * `outputs` is both the attachment list and what the renderers declare
     * their fragment outputs from — the shaders number their `@location()`s
     * from it, so the two can never be allowed to disagree.
     *
     * A renderer names the images it samples through `inputs` — the frame's
     * ambient occlusion, the grabbed background — rather than the pipeline
     * threading one parameter per texture down to it. Resolving them here is
     * what makes the ask a real read edge; a name nothing published is simply
     * absent from the map the renderer receives.
     */
    const scenePass = (
      name: string,
      passOptions: any,
      {
        outputs = {
          color: colorTextures.color!,
          ...(colorTextures.responsive && {
            responsive: colorTextures.responsive,
          }),
        },
        clearColor,
        depthClearValue,
      }: {
        outputs?: Record<string, ResourceHandle>;
        clearColor?: number[];
        depthClearValue?: number;
      } = {},
    ) => {
      const inputs: Record<string, ResourceHandle> = {};
      for (const renderer of renderers) {
        for (const input of renderer.inputs?.(passOptions) ?? []) {
          const handle = textures.get(input);
          if (handle) inputs[input] = handle;
        }
      }

      frameGraph.addPass({
        name: `${name}.${viewId}`,
        color: Object.keys(outputs).map((output, index) => ({
          ...colorTarget(output),
          ...(index === 0 && clearColor && { clearValue: clearColor }),
        })),
        ...(depthTexture && {
          depth: {
            ...depthTarget(),
            ...(depthClearValue !== undefined && { depthClearValue }),
          },
        }),
        reads: [...shadowMaps, ...Object.values(inputs)],
        renderView: renderPassView,
        execute: ({ resolveTexture }) => {
          this.drawMeshes({
            ...passOptions,
            colorTextures: outputs,
            textures: mapValues(inputs, resolveTexture),
          });
        },
      });
    };

    // An effect anchored at "prePass" is asking for a pre-pass, not just for a
    // place in the frame — ambient occlusion consumed as a lighting input only
    // exists if the geometry it reads was drawn first.
    //
    // Temporal antialiasing is not one of them: it reads depth, which the main
    // pass writes either way, and motion vectors, which the main pass writes
    // because the background needs them too. A pre-pass is a cost/benefit call
    // about overdraw, so it stays with `depthPrePass`.
    const usePrePass =
      (this.depthPrePass || effectsByStage.has("prePass")) && !!depthTexture;

    const prePassNormal = usePrePass && !!colorTextures.normal;

    const mainOutputs = prePassNormal
      ? Object.fromEntries(
          Object.entries(colorTextures).filter(([name]) => name !== "normal"),
        )
      : colorTextures;

    if (usePrePass) {
      frameGraph.addPass({
        name: `depthPrePass.${viewId}`,
        color: prePassNormal ? [colorTarget("normal")] : [],
        depth: { ...depthTarget(), depthClearValue: 1 },
        renderView: renderPassView,
        execute: () => {
          this.drawMeshes({
            ...drawMeshOptions,
            prePass: true,
            normalOutput: prePassNormal,
          });
        },
      });

      declareDepthResolve();

      await stage("prePass");
    }

    await stage("opaque");

    scenePass("opaque", drawMeshOptions, {
      outputs: mainOutputs,
      clearColor: camera.clearColor ?? [0, 0, 0, 1],
      // The pre-pass already cleared it; loading what it wrote is what lets the
      // depth test reject before the fragment shader runs.
      ...(!usePrePass && { depthClearValue: 1 }),
    });

    // Without a pre-pass this is the first point depth is complete.
    if (!usePrePass) declareDepthResolve();

    const hasTransparent = entitiesInView.some(
      (entity) => entity.material?.blend,
    );
    const hasTransmitted = entitiesInView.some(
      (entity) => entity.material?.transmission,
    );

    if (hasTransparent) {
      await stage("transparent");
      scenePass("transparent", { ...drawMeshOptions, transparent: true });
    }

    if (hasTransmitted) {
      await stage("transmission");

      const mipLevelCount = 1 + Math.floor(Math.log2(Math.max(width, height)));
      const hasBackTransmitted = entitiesInView.some(
        (entity) => entity.material?.transmission && !entity.material.cullFace,
      );

      const grabPass = (name: string) => {
        const label = `${name}.${viewId}`;
        const grab = frameGraph.createTexture({
          label,
          width,
          height,
          format: this.colorFormat,
          mipLevelCount,
        });

        frameGraph.addPass({
          name: label,
          color: [{ texture: grab }],
          uniforms: { uTexture: textures.get("color")! },
          renderView: renderPassView,
          execute: ({ uniforms }) => {
            this.drawFullscreen({
              label,
              pipeline: this.grabPipeline,
              uniforms,
            });
          },
        });

        if (mipLevelCount > 1) {
          frameGraph.addPass({
            name: `${label}.mips`,
            type: "raw",
            writes: [
              { handle: grab, usage: GPUTextureUsage.RENDER_ATTACHMENT },
            ],
            execute: ({ resolveTexture, encoder }) => {
              generateMipmaps(ctx, resolveTexture(grab), { encoder: encoder! });
            },
          });
        }

        // Republished per grab, so the pass declared next picks up the image as
        // of that point rather than the one the previous grab left behind.
        textures.set("transmission.grab", grab);
      };

      const transmitted = { ...drawMeshOptions, transmitted: true };

      grabPass("grab");

      // Back faces first, against their own grab: a double-sided transmissive
      // surface refracts what is behind it, which includes its own far side.
      if (hasBackTransmitted) {
        scenePass("transmissionBack", {
          ...transmitted,
          cullFaceMode: "front",
        });
        grabPass("grabTransmissionBack");
      }

      scenePass("transmissionFront", {
        ...transmitted,
        ...(hasBackTransmitted && { cullFaceMode: "back" }),
      });
    }

    // if (this.reversibleToneMap && msaa) {
    //   const inverseToneMapped = frameGraph.createTexture({
    //     label: `inverseToneMapColor_${viewId}`,
    //     width,
    //     height,
    //     format: this.colorFormat,
    //   });

    //   frameGraph.addPass({
    //     name: `InverseToneMapPass_${viewId}`,
    //     color: [{ texture: inverseToneMapped }],
    //     uniforms: { uTexture: textures.get("color")! },
    //     renderView: renderPassView,
    //     execute: ({ uniforms }) => {
    //       submit(ctx, {
    //         label: "drawInverseToneMapFullScreenTriangle",
    //         attributes: this.fullscreen.triangle.attributes,
    //         count: this.fullscreen.triangle.count,
    //         pipeline: this.descriptors.reversibleToneMap.pipelineDesc,
    //         uniforms,
    //       });
    //     },
    //   });
    //   textures.set("color", inverseToneMapped);
    // }
    await stage("postProcessing");

    await stage("present");

    // Silent otherwise: "transparent" and "transmission" open only if the scene
    // has such geometry, and "outputs" is raised before the register exists.
    for (const [name, effects] of effectsByStage) {
      textures.report(
        `${effects.map((effect) => `"${effect.name}"`).join(", ")} declared at the "${name}" stage, which this frame never opened, so nothing was drawn for them.`,
      );
    }

    const color = textures.require("color")!;

    if (drawToScreen !== false) {
      // Pointing the presented image at an intermediate leaves everything that
      // only fed the original output unreferenced, so the graph culls it.
      //
      // The picker takes any name on the register, so what comes back has to be
      // checked rather than assumed: the blit samples `texture_2d<f32>` with a
      // filtering sampler, and "depth" is a name a caller will reach for first.
      // Reporting and falling back to the frame's image beats failing
      // validation somewhere further down.
      const presented =
        (this.debugRender &&
          textures.require(this.debugRender, { filterableFloat: true })) ||
        color;

      const label = `blit.${viewId}`;
      frameGraph.addPass({
        name: label,
        // No color handles: the canvas is the target.
        uniforms: {
          uTexture: presented,
          uTextureSampler: this.samplers.linear,
        },
        renderView,
        // Its whole point is a side effect on the swapchain, which the graph
        // has no resource for.
        neverCull: true,
        execute: ({ uniforms }) => {
          this.drawFullscreen({
            label,
            pipeline: this.premultipliedAlpha
              ? this.blitPremultipliedPipeline
              : this.blitPipeline,
            uniforms,
            viewport: renderView.viewport,
          });
        },
      });
    }

    const outputTextures: Record<string, ResourceHandle> = {
      ...colorTextures,
      color,
      // The resolved one under MSAA: "depth" is an advertised output, so what
      // comes back has to be something the caller can actually bind. The cost
      // is that the resolve is never culled while MSAA is on.
      ...(depthTexture && { depth: textures.get("depth") ?? depthTexture }),
    };
    for (const handle of Object.values(outputTextures)) {
      frameGraph.exportTexture(handle);
    }
    return outputTextures;
  },

  dispose(entities: Entity[]) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      if (entity.material) {
        for (const property of Object.values(entity.material) as any[]) {
          if (isGpuTexture(property)) property.dispose();
        }
      }
    }

    // Descriptors, not GPU objects: pex-gpu holds the compiled pipelines in a
    // WeakMap keyed by these, so releasing them is what lets those go.
    this.postProcessingPipelines.clear();
    this.depthResolvePipelines.clear();
  },
});

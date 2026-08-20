import { submit, createSampler, isGpuTexture } from "pex-gpu";

import addDescriptors from "./descriptors.js";
import shadowMappingPipelineMethods from "./shadow-mapping.js";
import postProcessingPipelineMethods from "./post-processing.js";
import cullingPipelineMethods from "./culling.js";
import createFullscreenGeometry from "../../fullscreen-geometry.js";
import { getDefaultViewport } from "../../utils.js";

import type { Entity, SystemOptions } from "../../types.js";
import type {
  ColorAttachmentDeclaration,
  DepthStencilAttachmentDeclaration,
  ResourceHandle,
} from "../../frame-graph/index.js";

/**
 * Render pipeline system
 *
 * Adds:
 *
 * - "_near", "_far", "_radiusUV" and "_sceneBboxInLightSpace" to light components
 *   that cast shadows
 * - "_shadowCubemap" to pointLight components and "_shadowMap" to other light
 *   components
 *
 * Declares its passes into the frame graph rather than submitting them: the
 * graph decides ordering, which passes survive, which targets share memory and
 * which attachment contents are worth storing.
 */
export default ({ ctx, frameGraph }: SystemOptions) => ({
  type: "render-pipeline-system",
  time: 0,
  debug: false,
  debugRender: "",
  reversibleToneMap: false,

  descriptors: addDescriptors(ctx),
  fullscreen: createFullscreenGeometry(ctx),

  // Sampler for the fullscreen blit of the HDR main pass target to the canvas.
  blitSampler: createSampler(ctx, { filter: "linear" }),

  outputs: new Set(["color", "depth"]), // "normal", "emissive"

  ...shadowMappingPipelineMethods({ frameGraph }),
  ...postProcessingPipelineMethods({ ctx, frameGraph }),
  ...cullingPipelineMethods(),

  getAttachmentsLocations(colorAttachments: any) {
    return Object.fromEntries(
      Object.keys(colorAttachments ?? {}).map((key, index) => [key, index]),
    );
  },

  drawMeshes(
    this: any,
    {
      renderers,
      renderView,
      colorAttachments,
      msaa,
      entitiesInView,
      shadowMappingLight,
      transparent,
      transmitted,
      cullFaceMode,
      backgroundColorTexture,
    }: any,
  ) {
    const options = {
      attachmentsLocations: this.getAttachmentsLocations(colorAttachments),
      msaa: this.reversibleToneMap && msaa,
    };

    if (shadowMappingLight) {
      for (let i = 0; i < renderers.length; i++) {
        renderers[i].renderShadow?.(renderView, entitiesInView, {
          ...options,
          shadowMappingLight,
        });
      }
    } else {
      if (transparent) {
        for (let i = 0; i < renderers.length; i++) {
          renderers[i].renderTransparent?.(
            renderView,
            this.cullEntities(entitiesInView, renderView.camera),
            options,
          );
        }
      } else {
        for (let i = 0; i < renderers.length; i++) {
          renderers[i].renderOpaque?.(
            renderView,
            this.cullEntities(entitiesInView, renderView.camera),
            {
              ...options,
              transmitted,
              cullFaceMode,
              backgroundColorTexture: transmitted
                ? backgroundColorTexture
                : null,
            },
          );
        }
        if (!transmitted) {
          for (let i = 0; i < renderers.length; i++) {
            renderers[i].renderBackground?.(
              renderView,
              entitiesInView,
              options,
            );
          }
        }
      }
    }
  },

  /**
   * One downsample-blit pass per mip level of the grab texture. Each level is
   * its own graph node, so the graph orders the write of level N before level
   * N+1 reads it — generateMipmaps can't be used mid-frame, as its immediate
   * queue.submit would run before the batched frame encoder.
   *
   * The read of the previous level is a sub-resource view resolved inside
   * execute rather than a declared read: a pass may not declare the same handle
   * as both read and write, and the write-after-write edge between consecutive
   * levels already provides the ordering.
   */
  generateGrabMips(
    this: any,
    grabTexture: ResourceHandle,
    levels: number,
    name: string,
  ) {
    for (let level = 1; level < levels; level++) {
      frameGraph.addPass({
        name: `${name}Mip${level}`,
        color: [{ texture: grabTexture, level }],
        execute: ({ resolveView }) => {
          submit(ctx, {
            label: `grabMip${level}`,
            attributes: this.fullscreen.triangle.attributes,
            count: this.fullscreen.triangle.count,
            pipeline: this.descriptors.grabPass.downsamplePipelineDesc,
            uniforms: {
              uTexture: resolveView(grabTexture, { level: level - 1 }),
              uSampler: this.blitSampler,
            },
          });
        },
      });
    }
  },

  // Async because post-processing effects are imported on demand, so a frame
  // that first enables one waits for its module. Nothing here touches the GPU:
  // the graph only records declarations, and execution happens after compile.
  async update(this: any, entities: Entity[], options: any = {}) {
    let { time, renderView, renderers, drawToScreen = true } = options;

    this.time = time;

    const cameraEntity = entities.find((entity) => entity.camera);

    renderView ||= {
      camera: cameraEntity!.camera,
      viewport: getDefaultViewport(ctx),
    };
    const postProcessing = renderView.cameraEntity.postProcessing;

    const width = renderView.viewport[2];
    const height = renderView.viewport[3];
    const viewId = renderView.cameraEntity.id;

    // Which G-buffer outputs the frame needs. Declaring one that nothing reads
    // is harmless — the graph culls the write and never allocates the target.
    const outputs = new Set<string>(this.outputs);
    if (postProcessing?.ssao) outputs.add("normal");
    if (postProcessing?.bloom) outputs.add("emissive");

    const msaaSampleCount = postProcessing?.msaa?.sampleCount;
    const msaa = msaaSampleCount > 0;

    const { colorFormat, depthFormat } = this.descriptors.mainPass;

    // ─── Attachments ─────────────────────────────────────────────────────────
    const colorAttachments: Record<string, ResourceHandle> = {};
    for (const name of outputs) {
      if (name === "depth") continue;
      colorAttachments[name] = frameGraph.createTexture({
        label: `mainPass_${name}_${viewId}`,
        width,
        height,
        format: colorFormat,
      });
    }

    // WebGPU has no depth resolve — GPURenderPassDepthStencilAttachment has no
    // resolveTarget — so under MSAA the depth buffer stays multisampled and is
    // what gets handed back. Anything wanting single-sample depth needs an
    // explicit resolve pass of its own.
    let depthAttachment: ResourceHandle | undefined;
    if (outputs.has("depth")) {
      depthAttachment = frameGraph.createTexture({
        label: `mainPassDepth${msaa ? "MSAA" : ""}_${viewId}`,
        width,
        height,
        format: depthFormat,
        ...(msaa && { sampleCount: msaaSampleCount }),
      });
    }

    // Multisampled color is resolved into the single-sample attachments above;
    // nothing samples it, so the graph marks it memoryless.
    const msaaColor: Record<string, ResourceHandle> = {};
    if (msaa) {
      for (const name of Object.keys(colorAttachments)) {
        msaaColor[name] = frameGraph.createTexture({
          label: `mainPass_${name}MSAA_${viewId}`,
          width,
          height,
          format: colorFormat,
          sampleCount: msaaSampleCount,
        });
      }
    }

    const colorTarget = (name: string): ColorAttachmentDeclaration =>
      msaa
        ? { texture: msaaColor[name]!, resolveTarget: colorAttachments[name]! }
        : { texture: colorAttachments[name]! };
    const depthTarget = (): DepthStencilAttachmentDeclaration => ({
      texture: depthAttachment!,
    });

    const layer = renderView.cameraEntity.layer;

    // ─── Shadow maps ─────────────────────────────────────────────────────────
    // Declared once per frame and shared by every camera looking at the same
    // layer, since a shadow map depends on the light and the scene only.
    const { shadowMaps } = this.declareShadowMaps(entities, renderers, layer);

    // Filter entities by layer
    const entitiesInView = layer
      ? entities.filter((entity) => !entity.layer || entity.layer === layer)
      : entities.filter((entity) => !entity.layer);

    // We might be drawing to part of the screen
    const renderPassView = {
      ...renderView,
      viewport: [0, 0, width, height],
    };

    const drawMeshOptions = {
      renderers,
      renderView,
      msaa,
      entitiesInView,
      shadowMappingLight: false,
      transparent: false,
      transmitted: false,
    };

    // ─── Main pass ───────────────────────────────────────────────────────────
    frameGraph.addPass({
      name: `MainPass_${viewId}`,
      color: Object.keys(colorAttachments).map((name, index) => ({
        ...colorTarget(name),
        ...(index === 0 && {
          clearValue: renderView.camera.clearColor ?? [0, 0, 0, 1],
        }),
      })),
      ...(depthAttachment && {
        depth: { ...depthTarget(), depthClearValue: 1 },
      }),
      reads: shadowMaps,
      renderView: renderPassView,
      execute: () => {
        this.drawMeshes({ ...drawMeshOptions, colorAttachments });
      },
    });

    const hasTransparent = entitiesInView.some(
      (entity) => entity.material?.blend,
    );
    const hasTransmitted = entitiesInView.some(
      (entity) => entity.material?.transmission,
    );

    // ─── Transparent pass ────────────────────────────────────────────────────
    // Same attachments as the main pass and nothing read in between, so the
    // graph folds the two into a single beginRenderPass.
    if (hasTransparent) {
      frameGraph.addPass({
        name: `TransparentPass_${viewId}`,
        color: [colorTarget("color")],
        ...(depthAttachment && { depth: depthTarget() }),
        reads: shadowMaps,
        renderView: renderPassView,
        execute: () => {
          this.drawMeshes({
            ...drawMeshOptions,
            colorAttachments: { color: colorAttachments.color! },
            transparent: true,
          });
        },
      });
    }

    // ─── Transmission ────────────────────────────────────────────────────────
    if (hasTransmitted) {
      // Full viewport size (not prev-power-of-two): the transmission shader
      // samples it with full-screen [0, 1] coords, so a smaller top-left
      // anchored copy would misalign refraction. NPOT mip chains are fine in
      // WebGPU, so the old POT constraint no longer applies.
      const mipLevelCount = 1 + Math.floor(Math.log2(Math.max(width, height)));
      const hasBackTransmitted = entitiesInView.some(
        (entity) => entity.material?.transmission && !entity.material.cullFace,
      );

      const grabPass = (name: string) => {
        const grab = frameGraph.createTexture({
          label: `${name}_${viewId}`,
          width,
          height,
          format: this.descriptors.grabPass.colorFormat,
          mipLevelCount,
        });

        frameGraph.addPass({
          name: `${name}Copy_${viewId}`,
          color: [{ texture: grab }],
          uniforms: { uTexture: colorAttachments.color! },
          renderView: { ...renderView, viewport: renderPassView.viewport },
          execute: ({ uniforms }) => {
            submit(ctx, {
              label: "grabPassCopyTexture",
              attributes: this.fullscreen.triangle.attributes,
              count: this.fullscreen.triangle.count,
              pipeline: this.descriptors.grabPass.copyTexturePipelineDesc,
              uniforms,
            });
          },
        });

        this.generateGrabMips(grab, mipLevelCount, `${name}_${viewId}`);
        // Published so debug views can show what refraction actually sampled.
        frameGraph.blackboard.set(`transmission.grab.${viewId}`, grab);
        return grab;
      };

      let grab = grabPass("GrabPass");

      if (hasBackTransmitted) {
        frameGraph.addPass({
          name: `TransmissionBackPass_${viewId}`,
          color: [colorTarget("color")],
          ...(depthAttachment && { depth: depthTarget() }),
          reads: [...shadowMaps, grab],
          renderView: renderPassView,
          execute: ({ resolveTexture }) => {
            this.drawMeshes({
              ...drawMeshOptions,
              colorAttachments: { color: colorAttachments.color! },
              transmitted: true,
              cullFaceMode: "front",
              backgroundColorTexture: resolveTexture(grab),
            });
          },
        });

        grab = grabPass("GrabTransmissionBackPass");
      }

      const frontGrab = grab;
      frameGraph.addPass({
        name: `TransmissionFrontPass_${viewId}`,
        color: [colorTarget("color")],
        ...(depthAttachment && { depth: depthTarget() }),
        reads: [...shadowMaps, frontGrab],
        renderView: renderPassView,
        execute: ({ resolveTexture }) => {
          this.drawMeshes({
            ...drawMeshOptions,
            colorAttachments: { color: colorAttachments.color! },
            transmitted: true,
            cullFaceMode: hasBackTransmitted ? "back" : undefined,
            backgroundColorTexture: resolveTexture(frontGrab),
          });
        },
      });
    }

    let color = colorAttachments.color!;

    // ─── Inverse tone map ────────────────────────────────────────────────────
    if (this.reversibleToneMap && msaa) {
      const inverseToneMapped = frameGraph.createTexture({
        label: `inverseToneMapColor_${viewId}`,
        width,
        height,
        format: colorFormat,
      });

      frameGraph.addPass({
        name: `InverseToneMapPass_${viewId}`,
        color: [{ texture: inverseToneMapped }],
        uniforms: { uTexture: color },
        renderView: renderPassView,
        execute: ({ uniforms }) => {
          submit(ctx, {
            label: "drawInverseToneMapFullScreenTriangle",
            attributes: this.fullscreen.triangle.attributes,
            count: this.fullscreen.triangle.count,
            pipeline: this.descriptors.reversibleToneMap.pipelineDesc,
            uniforms,
          });
        },
      });
      color = inverseToneMapped;
    }

    await frameGraph.stage("beforePostProcessing");

    // ─── Post-processing ─────────────────────────────────────────────────────
    if (postProcessing) {
      color = this.renderPostProcessing({
        renderView: renderPassView,
        color,
        // Multisampled depth can't be sampled (see the attachment note above),
        // so under MSAA the effects that read it — SSAO, DoF, fog — sit this
        // frame out rather than fail validation. Lifting that needs a depth
        // resolve pass.
        ...(!msaa && depthAttachment && { depth: depthAttachment }),
        normal: colorAttachments.normal,
        emissive: colorAttachments.emissive,
      });
    }

    // ─── Present ─────────────────────────────────────────────────────────────
    // Pointing the presented image at an intermediate leaves everything that
    // only fed the original output unreferenced, so the graph culls it.
    if (this.debugRender) {
      const debugTexture =
        colorAttachments[this.debugRender] ??
        (frameGraph.blackboard.get(
          `postProcessing.${viewId}.${this.debugRender}`,
        ) as ResourceHandle) ??
        (frameGraph.blackboard.get(this.debugRender) as ResourceHandle);
      if (debugTexture) color = debugTexture;
    }

    if (drawToScreen !== false) {
      const presented = color;
      frameGraph.addPass({
        name: `BlitPass_${viewId}`,
        // No color handles: the canvas is the target.
        uniforms: { uTexture: presented, uTextureSampler: this.blitSampler },
        renderView,
        // Its whole point is a side effect on the swapchain, which the graph
        // has no resource for.
        neverCull: true,
        execute: ({ uniforms }) => {
          submit(ctx, {
            label: "drawBlitFullScreenTriangle",
            attributes: this.fullscreen.triangle.attributes,
            count: this.fullscreen.triangle.count,
            pipeline: this.descriptors.blit.pipelineDesc,
            viewport: renderView.viewport,
            uniforms,
          });
        },
      });
    }

    // Returned to the caller, which reads them outside the graph. `color` is
    // the end of the chain, so it may be a post-processed target rather than
    // the main pass attachment of the same name.
    const renderTargets: Record<string, ResourceHandle> = {
      ...colorAttachments,
      color,
      ...(depthAttachment && { depth: depthAttachment }),
    };
    for (const handle of Object.values(renderTargets)) {
      frameGraph.exportTexture(handle);
    }
    return renderTargets;
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
  },
});

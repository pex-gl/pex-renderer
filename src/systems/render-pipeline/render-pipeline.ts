import { submit, createSampler, isGpuTexture } from "pex-gpu";

import addDescriptors from "./descriptors.js";
import shadowMappingPipelineMethods from "./shadow-mapping.js";
import postProcessingPipelineMethods from "./post-processing.js";
import cullingPipelineMethods from "./culling.js";
import createFullscreenGeometry from "../../fullscreen-geometry.js";
import { RenderTextures } from "./render-textures.js";
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
 */
export default ({ ctx, frameGraph }: SystemOptions) => ({
  type: "render-pipeline-system",
  time: 0,
  debug: false,
  debugRender: "",
  reversibleToneMap: false,

  descriptors: addDescriptors(ctx),
  fullscreen: createFullscreenGeometry(ctx),

  blitSampler: createSampler(ctx, { filter: "linear" }),

  outputs: new Set(["color", "depth"]), // "normal", "emissive"
  colorFormat: "rgba16float" as GPUTextureFormat,
  depthFormat: "depth24plus" as GPUTextureFormat,

  ...shadowMappingPipelineMethods({ frameGraph }),
  ...postProcessingPipelineMethods({ ctx, frameGraph }),
  ...cullingPipelineMethods(),

  getAttachmentsLocations(colorAttachments: any) {
    return Object.fromEntries(
      Object.keys(colorAttachments ?? {}).map((key, index) => [key, index]),
    );
  },

  drawMeshes({
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
  }: any) {
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
  generateGrabMips(grabTexture: ResourceHandle, levels: number, name: string) {
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
  async update(entities: Entity[], options: any = {}) {
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

    const outputs = new Set<string>(this.outputs);
    if (postProcessing?.ssao) outputs.add("normal");
    if (postProcessing?.bloom) outputs.add("emissive");

    const sampleCount = postProcessing?.msaa?.sampleCount;
    const msaa = sampleCount > 0;

    const colorAttachments: Record<string, ResourceHandle> = {};
    for (const name of outputs) {
      if (name === "depth") continue;
      colorAttachments[name] = frameGraph.createTexture({
        label: `renderPipeline.${name}.${viewId}`,
        width,
        height,
        format: this.colorFormat,
      });
    }

    const msaaColor: Record<string, ResourceHandle> = {};
    if (msaa) {
      for (const name of Object.keys(colorAttachments)) {
        msaaColor[name] = frameGraph.createTexture({
          label: `renderPipeline.${name}MSAA.${viewId}`,
          width,
          height,
          format: this.colorFormat,
          sampleCount,
        });
      }
    }

    // WebGPU has no depth resolve — GPURenderPassDepthStencilAttachment has no
    // resolveTarget — so under MSAA the depth buffer stays multisampled and is
    // what gets handed back. Anything wanting single-sample depth needs an
    // explicit resolve pass of its own.
    let depthAttachment: ResourceHandle | undefined;
    if (outputs.has("depth")) {
      depthAttachment = frameGraph.createTexture({
        label: `renderPipelineDepth${msaa ? "MSAA" : ""}.${viewId}`,
        width,
        height,
        format: this.depthFormat,
        ...(msaa && { sampleCount }),
      });
    }

    // We might be drawing to part of the screen
    const renderPassView = {
      ...renderView,
      viewport: [0, 0, width, height],
    };

    // Frame register
    const textures = new RenderTextures(frameGraph, renderPassView);
    for (const [name, handle] of Object.entries(colorAttachments)) {
      textures.set(name, handle);
    }
    if (depthAttachment) textures.set("depth", depthAttachment);
    frameGraph.blackboard.set(`renderTextures.${viewId}`, textures);

    /**
     * Resolved per pass, not captured once: a pass injected between the scene
     * passes can publish a modified image and have the ones after it draw into
     * that instead. They keep the same depth attachment, so blending and depth
     * testing carry on against the geometry already drawn.
     *
     * MSAA is the exception, and a hard one: the multisampled attachment holds
     * the samples the resolve target was derived from, and WebGPU cannot load a
     * single-sample image back into it. Mid-scene reads still work — the
     * resolve runs at the end of every pass that declares it — but a
     * replacement has nowhere to go, so it is reported rather than silently
     * dropped.
     */
    const colorTarget = (name: string): ColorAttachmentDeclaration => {
      const published = textures.get(name) ?? colorAttachments[name]!;
      if (!msaa) return { texture: published };

      if (published !== colorAttachments[name]) {
        textures.report(
          `"${name}" was republished as ${textures.explain(published)} while the scene passes were still drawing, which MSAA cannot pick up. Move the pass to a stage after them, or turn MSAA off.`,
        );
      }
      return {
        texture: msaaColor[name]!,
        resolveTarget: colorAttachments[name]!,
      };
    };
    const depthTarget = (): DepthStencilAttachmentDeclaration => ({
      texture: depthAttachment!,
    });

    const layer = renderView.cameraEntity.layer;

    await frameGraph.stage("lights", textures);

    // Declared once per frame and shared by every camera looking at the same
    // layer, since a shadow map depends on the light and the scene only.
    const { shadowMaps } = this.declareShadowMaps(entities, renderers, layer);

    // Filter entities by layer
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

    await frameGraph.stage("opaque", textures);

    frameGraph.addPass({
      name: `opaque.${viewId}`,
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

    if (hasTransparent) {
      await frameGraph.stage("transparent", textures);

      frameGraph.addPass({
        name: `transparent.${viewId}`,
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

    if (hasTransmitted) {
      await frameGraph.stage("transmission", textures);

      const mipLevelCount = 1 + Math.floor(Math.log2(Math.max(width, height)));
      const hasBackTransmitted = entitiesInView.some(
        (entity) => entity.material?.transmission && !entity.material.cullFace,
      );

      const grabPass = (name: string) => {
        const grab = frameGraph.createTexture({
          label: `${name}.${viewId}`,
          width,
          height,
          format: this.descriptors.grabPass.colorFormat,
          mipLevelCount,
        });

        frameGraph.addPass({
          name: `${name}.${viewId}`,
          color: [{ texture: grab }],
          uniforms: { uTexture: textures.get("color")! },
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
        textures.set("transmission.grab", grab);
        return grab;
      };

      let grab = grabPass("grab");

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

        grab = grabPass("grabTransmissionBack");
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

    // ─── Inverse tone map ────────────────────────────────────────────────────
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

    await frameGraph.stage("postProcessing", textures);

    // ─── Post-processing ─────────────────────────────────────────────────────
    if (postProcessing) {
      this.renderPostProcessing({ renderView: renderPassView, textures });
    }

    // ─── Present ─────────────────────────────────────────────────────────────
    const color = textures.require("color")!;

    // Pointing the presented image at an intermediate leaves everything that
    // only fed the original output unreferenced, so the graph culls it.
    const presented =
      (this.debugRender && textures.get(this.debugRender)) || color;

    if (drawToScreen !== false) {
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
    // the end of the chain, so it may be a post-processed texture rather than
    // the main pass attachment of the same name.
    const outputTextures: Record<string, ResourceHandle> = {
      ...colorAttachments,
      color,
      ...(depthAttachment && { depth: depthAttachment }),
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
  },
});

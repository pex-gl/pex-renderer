import { parser as ShaderParser } from "pex-shaders";
import { submit, createSampler, isGpuTexture } from "pex-gpu";

import addDescriptors from "./descriptors.js";
import shadowMappingPipelineMethods from "./shadow-mapping.js";
// import postProcessingPipelineMethods from "./post-processing.js";
import cullingPipelineMethods from "./culling.js";
import { getDefaultViewport } from "../../utils.js";

import type { Entity, SystemOptions } from "../../types.js";

/**
 * Render pipeline system
 *
 * Adds:
 *
 * - "_near", "_far", "_radiusUV" and "_sceneBboxInLightSpace" to light components
 *   that cast shadows
 * - "_shadowCubemap" to pointLight components and "_shadowMap" to other light
 *   components
 * - "_targets" to postProcessing components
 */
export default ({ ctx, resourceCache, renderGraph }: SystemOptions) => ({
  type: "render-pipeline-system",
  cache: {} as Record<number, any>,
  time: 0,
  debug: false,
  debugRender: "",
  renderers: [],
  reversibleToneMap: false,

  descriptors: addDescriptors(ctx),

  // Sampler for the fullscreen blit of the HDR main pass target to the canvas.
  blitSampler: createSampler(ctx, { filter: "linear" }),

  outputs: new Set(["color", "depth"]), // "normal", "emissive"

  ...shadowMappingPipelineMethods({ renderGraph, resourceCache }),
  // ...postProcessingPipelineMethods({ ctx, renderGraph, resourceCache }),
  ...cullingPipelineMethods({ renderGraph, resourceCache }),

  getAttachmentsLocations(colorAttachments: any) {
    return Object.fromEntries(
      Object.keys(colorAttachments).map((key, index) => [key, index]),
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

  // Builds the grab texture's mip chain with one downsample-blit render pass per
  // level. Each is its own render-graph node, so the graph orders the write of
  // level-1 before its read — generateMipmaps can't be used mid-frame, as its
  // immediate queue.submit would run before the batched frame encoder.
  generateGrabMips(this: any, grabTexture: any) {
    const fullscreenTriangle = resourceCache.fullscreenTriangle();
    const pipeline = resourceCache.pipeline(
      this.descriptors.grabPass.downsamplePipelineDesc,
    );

    for (let level = 1; level < grabTexture.mipLevelCount; level++) {
      const sourceView = grabTexture.texture.createView({
        baseMipLevel: level - 1,
        mipLevelCount: 1,
      });
      renderGraph.renderPass({
        name: `GrabMipPass${level}`,
        uses: [grabTexture],
        pass: resourceCache.pass({
          name: `grabMipPass${level}`,
          color: [{ texture: grabTexture, level }],
        }),
        render: () => {
          submit(ctx, {
            label: `grabMip${level}Cmd`,
            attributes: fullscreenTriangle.attributes,
            count: fullscreenTriangle.count,
            pipeline,
            uniforms: {
              uTexture: sourceView,
              uSampler: this.blitSampler,
            },
          });
        },
      });
    }
  },

  update(this: any, entities: Entity[], options: any = {}) {
    let { time, renderView, renderers, drawToScreen = true } = options;

    this.time = time;

    const shadowCastingEntities = entities.filter(
      (entity) => entity.geometry && entity.material?.castShadows,
    );
    const cameraEntity = entities.find((entity) => entity.camera);

    renderView ||= {
      camera: cameraEntity!.camera,
      viewport: getDefaultViewport(ctx),
    };
    const postProcessing = renderView.cameraEntity.postProcessing;

    // Setup attachments. Can be overwritten by PostProcessingPass
    const outputs = new Set(this.outputs);

    if (postProcessing?.ssao) outputs.add("normal");
    if (postProcessing?.bloom) outputs.add("emissive");

    const msaaSampleCount = postProcessing?.msaa?.sampleCount;
    const msaa = msaaSampleCount > 0;

    const colorAttachments: any = {};
    const colorAttachmentsMSAA: any = {};
    let depthAttachment: any;
    let depthAttachmentMSAA: any;

    // TODO: this should be done on the fly by render graph
    this.descriptors.mainPass.outputTextureDesc.width = renderView.viewport[2];
    this.descriptors.mainPass.outputTextureDesc.height = renderView.viewport[3];

    colorAttachments.color = resourceCache.texture2D(
      this.descriptors.mainPass.outputTextureDesc,
    );

    if (outputs.has("depth")) {
      this.descriptors.mainPass.outputDepthTextureDesc.width =
        renderView.viewport[2];
      this.descriptors.mainPass.outputDepthTextureDesc.height =
        renderView.viewport[3];
      depthAttachment = resourceCache.texture2D(
        this.descriptors.mainPass.outputDepthTextureDesc,
      );
      depthAttachment.name = `mainPassDepth (id: ${depthAttachment.id})`;

      if (msaa) {
        depthAttachmentMSAA = {
          texture: resourceCache.renderbuffer({
            width: this.descriptors.mainPass.outputDepthTextureDesc.width,
            height: this.descriptors.mainPass.outputDepthTextureDesc.height,
            pixelFormat:
              this.descriptors.mainPass.outputDepthTextureDesc.pixelFormat,
            sampleCount: msaaSampleCount,
          }),
          resolveTarget: depthAttachment,
        };

        depthAttachmentMSAA.name = `mainPassDepthMSAA (id: ${depthAttachmentMSAA.texture.id})`;
      }
    }

    if (outputs.has("normal")) {
      colorAttachments.normal = resourceCache.texture2D(
        this.descriptors.mainPass.outputTextureDesc,
      );
    }

    if (outputs.has("emissive")) {
      colorAttachments.emissive = resourceCache.texture2D(
        this.descriptors.mainPass.outputTextureDesc,
      );
    }

    for (const name of Object.keys(colorAttachments)) {
      const texture = colorAttachments[name];
      texture.name = `mainPass${name} (id: ${texture.id})`;

      if (msaa) {
        colorAttachmentsMSAA[name] = {
          texture: resourceCache.renderbuffer({
            width: this.descriptors.mainPass.outputTextureDesc.width,
            height: this.descriptors.mainPass.outputTextureDesc.height,
            pixelFormat:
              this.descriptors.mainPass.outputTextureDesc.pixelFormat,
            sampleCount: msaaSampleCount,
          }),
          resolveTarget: texture,
        };
        colorAttachmentsMSAA[name].name =
          `mainPass${name}MSAA (id: ${colorAttachmentsMSAA[name].texture.id})`;
      }
    }

    // Update shadow maps
    if (shadowCastingEntities.length) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]!;

        if (
          entity.directionalLight?.castShadows &&
          this.checkLight(entity.directionalLight, entity)
        ) {
          this.renderDirectionalLightShadowMap(
            entity,
            entities,
            renderers,
            colorAttachments,
            shadowCastingEntities,
          );
        }
        if (
          entity.pointLight?.castShadows &&
          this.checkLight(entity.pointLight, entity)
        ) {
          this.renderPointLightShadowMap(
            entity,
            entities,
            renderers,
            colorAttachments,
          );
        }
        if (
          entity.spotLight?.castShadows &&
          this.checkLight(entity.spotLight, entity)
        ) {
          this.renderSpotLightShadowMap(
            entity,
            entities,
            renderers,
            colorAttachments,
            shadowCastingEntities,
          );
        }
        if (
          entity.areaLight?.castShadows &&
          this.checkLight(entity.areaLight, entity)
        ) {
          this.renderSpotLightShadowMap(
            entity,
            entities,
            renderers,
            colorAttachments,
            shadowCastingEntities,
          );
        }
      }
    }

    // TODO: this also get entities with shadowmap regardless of castShadows changes
    const shadowMaps = entities
      .map(
        (entity) =>
          entity.directionalLight?._shadowMap ||
          entity.spotLight?._shadowMap ||
          entity.areaLight?._shadowMap ||
          entity.pointLight?._shadowCubemap,
      )
      .filter(Boolean);

    // Filter entities by layer
    const layer = renderView.cameraEntity.layer;
    const entitiesInView = layer
      ? entities.filter((entity) => !entity.layer || entity.layer === layer)
      : entities.filter((entity) => !entity.layer);

    //we might be drawing to part of the screen
    const renderPassView = {
      ...renderView,
      viewport: [0, 0, renderView.viewport[2], renderView.viewport[3]],
    };

    // Main pass
    renderGraph.renderPass({
      name: `MainPass${msaa ? "MSAA" : ""} [${renderView.viewport}]`,
      uses: [...shadowMaps],
      renderView: renderPassView,
      pass: resourceCache.pass({
        name: "mainPass",
        color: Object.values(msaa ? colorAttachmentsMSAA : colorAttachments),
        depth: msaa ? depthAttachmentMSAA : depthAttachment,
        clearColor: renderView.camera.clearColor ?? [0, 0, 0, 1],
        clearDepth: 1,
      }),
      render: () => {
        this.drawMeshes({
          renderers,
          renderView,
          colorAttachments,
          msaa,
          entitiesInView,
          shadowMappingLight: false,
          transparent: false,
          transmitted: false,
        });
      },
    });

    const hasTransparent = entitiesInView.some(
      (entity) => entity.material?.blend,
    );
    const hasTransmitted = entitiesInView.some(
      (entity) => entity.material?.transmission,
    );

    // Transparent pass
    if (hasTransparent) {
      renderGraph.renderPass({
        name: `TransparentPass${msaa ? "MSAA" : ""} [${renderView.viewport}]`,
        uses: shadowMaps,
        renderView: renderPassView,
        pass: resourceCache.pass({
          name: "transparentPass",
          color: [(msaa ? colorAttachmentsMSAA : colorAttachments).color],
          depth: msaa ? depthAttachmentMSAA : depthAttachment,
        }),
        render: () => {
          this.drawMeshes({
            renderers,
            renderView,
            colorAttachments: { color: colorAttachments.color },
            msaa,
            entitiesInView,
            shadowMappingLight: false,
            transparent: true,
            transmitted: false,
          });
        },
      });
    }

    // Transmission pass
    if (hasTransmitted) {
      // Grab pass. Full viewport size (not prev-power-of-two): the transmission
      // shader samples it with full-screen [0,1] coords, so a smaller top-left
      // anchored copy would misalign refraction. NPOT mip chains are fine in
      // WebGPU, so the old POT constraint no longer applies.
      const viewport = [0, 0, renderView.viewport[2], renderView.viewport[3]];
      this.descriptors.grabPass.colorCopyTextureDesc.width = viewport[2];
      this.descriptors.grabPass.colorCopyTextureDesc.height = viewport[3];
      const grabPassColorCopyTexture = resourceCache.texture2D(
        this.descriptors.grabPass.colorCopyTextureDesc,
      );
      grabPassColorCopyTexture.name = `grabPassOutput (id: ${grabPassColorCopyTexture.id})`;

      const fullscreenTriangle = resourceCache.fullscreenTriangle();

      const grabPassCopyCmd = {
        name: "grabPassCopyTextureCmd",
        attributes: fullscreenTriangle.attributes,
        count: fullscreenTriangle.count,
        pipeline: resourceCache.pipeline(
          this.descriptors.grabPass.copyTexturePipelineDesc,
        ),
        uniforms: {
          uTexture: colorAttachments.color,
        },
      };

      renderGraph.renderPass({
        name: `GrabPass [${viewport}]`,
        uses: [colorAttachments.color],
        renderView: { ...renderView, viewport },
        pass: resourceCache.pass({
          name: "grabPass",
          color: [grabPassColorCopyTexture],
        }),
        render: () => {
          submit(ctx, grabPassCopyCmd);
        },
      });

      this.generateGrabMips(grabPassColorCopyTexture);

      const hasBackTransmitted = entitiesInView.some(
        (entity) => entity.material?.transmission && !entity.material.cullFace,
      );

      if (hasBackTransmitted) {
        renderGraph.renderPass({
          name: `TransmissionBackPass${msaa ? "MSAA" : ""} [${renderView.viewport}]`,
          uses: [...shadowMaps, grabPassColorCopyTexture],
          renderView: renderPassView,
          pass: resourceCache.pass({
            name: "transmissionBackPass",
            color: [(msaa ? colorAttachmentsMSAA : colorAttachments).color],
            depth: msaa ? depthAttachmentMSAA : depthAttachment,
          }),
          render: () => {
            this.drawMeshes({
              renderers,
              renderView,
              //why this is passed?, we are rendering here colorAttachments.color
              colorAttachments: { color: colorAttachments.color },
              msaa,
              entitiesInView,
              shadowMappingLight: false,
              transparent: false,
              transmitted: true,
              cullFaceMode: "front",
              backgroundColorTexture: grabPassColorCopyTexture,
            });
          },
        });
        const copyUniforms = {
          uniforms: {
            uTexture: colorAttachments.color,
          },
        };

        renderGraph.renderPass({
          name: `GrabTransmissionBackPass [${viewport}]`,
          uses: [colorAttachments.color],
          renderView: { ...renderView, viewport },
          pass: resourceCache.pass({
            name: "grabTransmissionBackPass",
            color: [grabPassColorCopyTexture],
          }),
          render: () => {
            submit(ctx, grabPassCopyCmd, [copyUniforms]);
          },
        });

        this.generateGrabMips(grabPassColorCopyTexture);
      }

      renderGraph.renderPass({
        name: `TransmissionFrontPass${msaa ? "MSAA" : ""} [${renderView.viewport}]`,
        uses: [...shadowMaps, grabPassColorCopyTexture],
        renderView: renderPassView,
        pass: resourceCache.pass({
          name: "transmissionFrontPass",
          color: [(msaa ? colorAttachmentsMSAA : colorAttachments).color],
          depth: msaa ? depthAttachmentMSAA : depthAttachment,
        }),
        render: () => {
          this.drawMeshes({
            renderers,
            renderView,
            colorAttachments: { color: colorAttachments.color },
            msaa,
            entitiesInView,
            shadowMappingLight: false,
            transparent: false,
            transmitted: true,
            cullFaceMode: hasBackTransmitted ? "back" : undefined,
            backgroundColorTexture: grabPassColorCopyTexture,
          });
        },
      });
    }

    // Inverse Tone Mapping
    if (this.reversibleToneMap && msaa) {
      const inverseToneMapColorTexture = resourceCache.texture2D({
        ...this.descriptors.mainPass.outputTextureDesc,
        width: renderView.viewport[2],
        height: renderView.viewport[3],
      });
      inverseToneMapColorTexture.name = `inverseToneMapColor (id: ${inverseToneMapColorTexture.id})`;

      const fullscreenTriangle = resourceCache.fullscreenTriangle();

      // TODO: cache
      const pipelineDesc = {
        ...this.descriptors.reversibleToneMap.pipelineDesc,
      };
      pipelineDesc.vert = ShaderParser.build(ctx, pipelineDesc.vert);
      pipelineDesc.frag = ShaderParser.build(ctx, pipelineDesc.frag);

      const inverseToneMapCmd = {
        name: "drawInverseToneMapFullScreenTriangleCmd",
        attributes: fullscreenTriangle.attributes,
        count: fullscreenTriangle.count,
        pipeline: resourceCache.pipeline(pipelineDesc),
        uniforms: {
          uTexture: colorAttachments.color,
        },
      };

      renderGraph.renderPass({
        name: `InverseToneMapPass [${renderView.viewport}]`,
        uses: [colorAttachments.color],
        renderView: renderPassView,
        pass: resourceCache.pass({
          name: "inverseToneMapPass",
          color: [inverseToneMapColorTexture],
        }),
        render: () => {
          submit(ctx, inverseToneMapCmd);
        },
      });
      colorAttachments.color = inverseToneMapColorTexture;
    }

    // Post-processing pass
    if (postProcessing) {
      this.renderPostProcessing(
        renderPassView,
        colorAttachments,
        depthAttachment,
        this.descriptors,
      );
    }

    if (drawToScreen !== false) {
      const fullscreenTriangle = resourceCache.fullscreenTriangle();

      const blitCmd = {
        name: "drawBlitFullScreenTriangleCmd",
        attributes: fullscreenTriangle.attributes,
        count: fullscreenTriangle.count,
        pipeline: resourceCache.pipeline(this.descriptors.blit.pipelineDesc),
      };

      renderGraph.renderPass({
        name: `BlitPass [${renderView.viewport}]`,
        uses: [colorAttachments.color],
        renderView,
        render: () => {
          submit(ctx, {
            ...blitCmd,
            viewport: renderView.viewport,
            uniforms: {
              uTexture: colorAttachments.color,
              uSampler: this.blitSampler,
            },
          });
        },
      });
    }

    if (this.debugRender) {
      let debugTexture = colorAttachments[this.debugRender];
      debugTexture ||= this.tempBaseRenderer?.cache.targets[this.debugRender];

      if (debugTexture) {
        colorAttachments.color = debugTexture;
      }
    }

    // Return the original object: the color attachment value can be modified
    // after post processing renderGraph.renderPass so values are final after
    // renderGraph.endFrame()
    return Object.assign(colorAttachments, { depth: depthAttachment });
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

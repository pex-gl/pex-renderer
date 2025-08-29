import { utils } from "pex-math";
import { parser as ShaderParser } from "pex-shaders";

import addDescriptors from "./descriptors.js";
import shadowMappingPipelineMethods from "./shadow-mapping.js";
import postProcessingPipelineMethods from "./post-processing.js";
import cullingPipelineMethods from "./culling.js";
import { getDefaultViewport } from "../../utils.js";

/**
 * Render pipeline system
 *
 * Adds:
 * - "_near", "_far", "_radiusUV" and "_sceneBboxInLightSpace" to light components that cast shadows
 * - "_shadowCubemap" to pointLight components and "_shadowMap" to other light components
 * - "_targets" to postProcessing components
 * @param {import("../../types.js").SystemOptions} options
 * @returns {import("../../types.js").System}
 * @alias module:systems.renderPipeline
 */
export default ({ ctx, resourceCache, renderGraph }) => ({
  type: "render-pipeline-system",
  cache: {},
  time: 0,
  debug: false,
  debugRender: "",
  renderers: [],

  descriptors: addDescriptors(ctx),

  outputs: new Set(["color", "depth"]), // "normal", "emissive"

  ...shadowMappingPipelineMethods({ renderGraph, resourceCache }),
  ...postProcessingPipelineMethods({ ctx, renderGraph, resourceCache }),
  ...cullingPipelineMethods({ renderGraph, resourceCache }),

  getAttachmentsLocations(colorAttachments) {
    return Object.fromEntries(
      Object.keys(colorAttachments).map((key, index) => [key, index]),
    );
  },

  drawMeshes({
    renderers,
    renderView,
    colorAttachments,
    entitiesInView,
    shadowMappingLight,
    transparent,
    transmitted,
    cullFaceMode,
    backgroundColorTexture,
  }) {
    renderView.exposure ||= 1;
    renderView.toneMap ||= null;
    renderView.outputEncoding ||= ctx.Encoding.Linear;

    const options = {
      attachmentsLocations: this.getAttachmentsLocations(colorAttachments),
    };

    if (shadowMappingLight) {
      for (let i = 0; i < renderers.length; i++) {
        renderers[i].renderShadow?.(renderView, entitiesInView, {
          ...options,
          shadowMappingLight,
        });
      }
    } else {
      if (!transparent) {
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
      } else {
        for (let i = 0; i < renderers.length; i++) {
          renderers[i].renderTransparent?.(
            renderView,
            this.cullEntities(entitiesInView, renderView.camera),
            options,
          );
        }
      }
    }
  },

  update(entities, options = {}) {
    let { time, renderView, renderers, drawToScreen = true } = options;

    this.time = time;

    const shadowCastingEntities = entities.filter(
      (entity) => entity.geometry && entity.material?.castShadows,
    );
    const cameraEntities = entities.filter((entity) => entity.camera);

    renderView ||= {
      camera: cameraEntities[0].camera,
      viewport: getDefaultViewport(ctx),
    };
    const postProcessing = renderView.cameraEntity.postProcessing;

    // Set the render pipeline encoding and tone mapping settings before blit
    // Output will depend on camera settings
    if (drawToScreen) {
      // Render pipeline is linear.
      // Output is tone mapped in "BlitPass" or in post-processing "final"
      renderView.outputEncoding ||= ctx.Encoding.Linear;
      renderView.exposure ||= 1;
      renderView.toneMap ||= null;
    } else {
      // Output depends on camera settings
      // Render pipeline is gamma so we assume tone map should be applied
      // but only if no post-processing "final"
      if (
        renderView.camera.outputEncoding === ctx.Encoding.Gamma &&
        !postProcessing
      ) {
        renderView.outputEncoding ||= renderView.camera.outputEncoding;
        renderView.exposure ||= renderView.camera.exposure;
        renderView.toneMap ||= renderView.camera.toneMap;
      } else {
        // Render pipeline is linear.
        // Tone mapping needs to happen manually on the returned color attachment
        renderView.outputEncoding ||= ctx.Encoding.Linear;
        renderView.exposure ||= 1;
        renderView.toneMap ||= null;
      }
    }

    // Setup attachments. Can be overwritten by PostProcessingPass
    const outputs = new Set(this.outputs);

    if (postProcessing?.ssao) outputs.add("normal");
    if (postProcessing?.bloom) outputs.add("emissive");

    const msaaSampleCount = postProcessing?.msaa?.sampleCount;

    if (msaaSampleCount) {
      renderView.toneMap = "reversibleToneMap";
      renderView.exposure = 1;
      renderView.outputEncoding = ctx.Encoding.Linear;
    }

    const colorAttachments = {};
    const colorAttachmentsMSAA = {};
    let depthAttachment;
    let depthAttachmentMSAA;

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

      if (msaaSampleCount) {
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

    for (let name of Object.keys(colorAttachments)) {
      const texture = colorAttachments[name];
      texture.name = `mainPass${name} (id: ${texture.id})`;

      if (msaaSampleCount) {
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
        const entity = entities[i];

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
      name: `MainPass${msaaSampleCount ? "MSAA" : ""} [${renderView.viewport}]`,
      uses: [...shadowMaps],
      renderView: renderPassView,
      pass: resourceCache.pass({
        name: "mainPass",
        color: Object.values(
          msaaSampleCount ? colorAttachmentsMSAA : colorAttachments,
        ),
        depth: msaaSampleCount ? depthAttachmentMSAA : depthAttachment,
        clearColor: renderView.camera.clearColor,
        clearDepth: 1,
      }),
      render: () => {
        this.drawMeshes({
          renderers,
          renderView,
          colorAttachments,
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
        name: `TransparentPass${msaaSampleCount ? "MSAA" : ""} [${renderView.viewport}]`,
        uses: shadowMaps,
        renderView: renderPassView,
        pass: resourceCache.pass({
          name: "transparentPass",
          color: [
            (msaaSampleCount ? colorAttachmentsMSAA : colorAttachments).color,
          ],
          depth: msaaSampleCount ? depthAttachmentMSAA : depthAttachment,
        }),
        render: () => {
          this.drawMeshes({
            renderers,
            renderView,
            colorAttachments: { color: colorAttachments.color },
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
      // Grab pass
      const viewport = [
        0,
        0,
        utils.prevPowerOfTwo(renderView.viewport[2]),
        utils.prevPowerOfTwo(renderView.viewport[3]),
      ];
      // const viewport = [0, 0, renderView.viewport[2], renderView.viewport[3]];
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
          uViewport: viewport,
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
          ctx.submit(grabPassCopyCmd);
        },
      });

      const hasBackTransmitted = entitiesInView.some(
        (entity) => entity.material?.transmission && !entity.material.cullFace,
      );

      if (hasBackTransmitted) {
        renderGraph.renderPass({
          name: `TransmissionBackPass${msaaSampleCount ? "MSAA" : ""} [${renderView.viewport}]`,
          uses: [...shadowMaps, grabPassColorCopyTexture],
          renderView: renderPassView,
          pass: resourceCache.pass({
            name: "transmissionBackPass",
            color: [
              (msaaSampleCount ? colorAttachmentsMSAA : colorAttachments).color,
            ],
            depth: msaaSampleCount ? depthAttachmentMSAA : depthAttachment,
          }),
          render: () => {
            this.drawMeshes({
              renderers,
              renderView,
              //why this is passed?, we are rendering here colorAttachments.color
              colorAttachments: { color: colorAttachments.color },
              entitiesInView,
              shadowMappingLight: false,
              transparent: false,
              transmitted: true,
              cullFaceMode: ctx.Face.Front,
              backgroundColorTexture: grabPassColorCopyTexture,
            });
          },
        });
        const viewport = grabPassCopyCmd.uniforms.uViewport;
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
            ctx.submit(grabPassCopyCmd, copyUniforms);
          },
        });
      }

      renderGraph.renderPass({
        name: `TransmissionFrontPass${msaaSampleCount ? "MSAA" : ""} [${renderView.viewport}]`,
        uses: [...shadowMaps, grabPassColorCopyTexture],
        renderView: renderPassView,
        pass: resourceCache.pass({
          name: "transmissionFrontPass",
          color: [
            (msaaSampleCount ? colorAttachmentsMSAA : colorAttachments).color,
          ],
          depth: msaaSampleCount ? depthAttachmentMSAA : depthAttachment,
        }),
        render: () => {
          this.drawMeshes({
            renderers,
            renderView,
            colorAttachments: { color: colorAttachments.color },
            entitiesInView,
            shadowMappingLight: false,
            transparent: false,
            transmitted: true,
            cullFaceMode: hasBackTransmitted && ctx.Face.Back,
            backgroundColorTexture: grabPassColorCopyTexture,
          });
        },
      });
    }

    // Inverse Tone Mapping
    if (msaaSampleCount) {
      const inverseToneMapColorTexture = resourceCache.texture2D({
        ...this.descriptors.mainPass.outputTextureDesc,
        width: renderView.viewport[2],
        height: renderView.viewport[3],
      });
      inverseToneMapColorTexture.name = `inverseToneMapColor (id: ${inverseToneMapColorTexture.id})`;

      const fullscreenTriangle = resourceCache.fullscreenTriangle();

      // TODO: cache
      const pipelineDesc = { ...this.descriptors.blit.pipelineDesc };
      pipelineDesc.vert = ShaderParser.build(ctx, pipelineDesc.vert);
      pipelineDesc.frag = ShaderParser.build(ctx, pipelineDesc.frag, [
        `TONE_MAP ${renderView.toneMap}Inverse`,
      ]);

      const inverseToneMapCmd = {
        name: "drawInverseToneMapFullScreenTriangleCmd",
        attributes: fullscreenTriangle.attributes,
        count: fullscreenTriangle.count,
        pipeline: resourceCache.pipeline(pipelineDesc),
        uniforms: {
          uTexture: colorAttachments.color,
          uExposure: 1,
          uOutputEncoding: ctx.Encoding.Linear,
        },
      };

      renderGraph.renderPass({
        name: `InverseToneMapPass [${renderView.viewport}]`,
        uses: [colorAttachments.color],
        renderView,
        pass: resourceCache.pass({
          name: "inverseToneMapPass",
          color: [inverseToneMapColorTexture],
        }),
        render: () => {
          ctx.submit(inverseToneMapCmd);
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

      let exposure = renderView.camera.exposure; //FIXME MARCIN: what's the point of setting renderView.exposure then?
      let toneMap = renderView.camera.toneMap;
      let outputEncoding = renderView.camera.outputEncoding;

      // Post Processing already uses renderView.camera settings
      if (postProcessing) {
        exposure = 1;
        toneMap = null;
        outputEncoding = ctx.Encoding.Linear;
      }

      // TODO: cache
      const pipelineDesc = { ...this.descriptors.blit.pipelineDesc };
      pipelineDesc.vert = ShaderParser.build(ctx, pipelineDesc.vert);
      pipelineDesc.frag = ShaderParser.build(
        ctx,
        pipelineDesc.frag,
        [toneMap && `TONE_MAP ${toneMap}`].filter(Boolean),
      );

      const blitCmd = {
        name: "drawBlitFullScreenTriangleCmd",
        attributes: fullscreenTriangle.attributes,
        count: fullscreenTriangle.count,
        pipeline: resourceCache.pipeline(pipelineDesc),
      };

      renderGraph.renderPass({
        name: `BlitPass [${renderView.viewport}]`,
        uses: [colorAttachments.color],
        renderView,
        render: () => {
          ctx.submit(blitCmd, {
            uniforms: {
              uExposure: exposure,
              uOutputEncoding: outputEncoding,
              uTexture: colorAttachments.color,
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

  dispose(entities) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.material) {
        for (let property of Object.values(entity.material)) {
          if (
            property?.class === "texture" &&
            ctx.resources.indexOf(property) !== -1
          ) {
            ctx.dispose(property);
          }
        }
      }
    }
  },
});

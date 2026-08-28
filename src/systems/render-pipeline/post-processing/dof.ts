import { dofShader } from "../../../shaders/post-processing/dof.js";

import type { PostProcessingEffect } from "../post-processing.js";

/**
 * Depth of field.
 *
 * First of the image-space effects after the temporal resolve, because it reads
 * a circle of confusion per pixel from the depth buffer: motion blur smears the
 * image out of correspondence with that depth, and defocusing a streak by the
 * depth of whatever the streak is passing over is wrong at every pixel of it.
 * Before bloom for the same reason it is before motion blur — out-of-focus
 * highlights should glare as the bokeh shows them, not as the sharp image
 * would.
 */
const dof: PostProcessingEffect = {
  name: "dof",
  declare({ cameraEntity, viewport, textures, samplers, pass }) {
    const depth = textures.get("depth");
    if (!depth) return;

    const camera = cameraEntity.camera!;
    const component = cameraEntity.postProcessing!.dof!;

    pass({
      name: "main",
      shader: dofShader,
      chain: true,
      defines: new Set([
        component.type === "upitis" ? "USE_DOF_UPITIS" : "USE_DOF_GUSTAFSSON",
        ...(component.focusOnScreenPoint ? ["USE_FOCUS_ON_SCREEN_POINT"] : []),
      ]),
      constants: {
        DOF_NUM_SAMPLES: component.samples!,
        USE_SHAPE_PENTAGON: component.shape === "pentagon",
        USE_DOF_DEBUG: !!component.debug,
        USE_DOF_PHYSICAL: !!component.physical,
      },
      uniforms: {
        uDoFParams: {
          near: camera.near!,
          far: camera.far!,
          viewportSize: [viewport[2]!, viewport[3]!],
          texelSize: [1 / viewport[2]!, 1 / viewport[3]!],
          chromaticAberration: component.chromaticAberration!,
          luminanceThreshold: component.luminanceThreshold!,
          luminanceGain: component.luminanceGain!,
          // Only read in physical mode, but always packed: the struct's layout
          // can't depend on the option.
          fStop: camera.fStop!,
          focalLength: camera.focalLength!,
        },
        uDoF: {
          focusDistance: component.focusDistance!,
          focusScale: component.focusScale!,
          screenPoint: component.screenPoint!,
        },
        uDepthTexture: depth,
        uDepthTextureSampler: samplers.nearest,
      },
    });
  },
};

export default dof;

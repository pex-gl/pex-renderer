import * as gpu from "pex-gpu";
import { mat4 } from "pex-math";
import random from "pex-random";

import {
  copyShader,
  hiZCopyShader,
  hiZReduceShader,
  ssrCompositeShader,
  ssrResolveShader,
  ssrTemporalShader,
  ssrTraceShader,
} from "./frame-graph-ssr-shaders.js";

// Screen-space reflections, declared entirely from outside the engine.
//
// The passes, in order:
//
//   ssr.hiZ          min-depth pyramid, one pass per mip level
//   ssr.colorPyramid the frame's image and its mip chain, for rough hits
//   ssr.trace        one ray per half-res pixel, marched through the pyramid;
//                    writes where it hit
//   ssr.resolve      neighbouring rays reused as extra samples for this pixel,
//                    weighted by the BRDF they would have had here
//   ssr.temporal     blended with the reprojected previous frame
//   ssr.history      the copy that carries that result to the next frame
//   ssr.composite    the probe's specular replaced by the traced one
//
// The last step is what makes this energy conserving rather than an overlay:
// the main pass hands back the indirect specular it applied, so the composite
// subtracts exactly the term the reflection replaces and fades back to the
// probe wherever a ray found nothing. What a ray needs beyond depth and normals
// — f0, roughness, that indirect term — comes from two extra main pass outputs
// this file adds by wrapping the renderers' shader generators, since what an
// output *is* lives in their WGSL.
//
// A ray is importance-sampled from the GGX lobe only above `mirrorRoughness`.
// Below it the ray is the mirror direction and the lobe's blur comes from the
// mip of the colour pyramid its cone footprint covers. Sampling a narrow lobe
// is the worst case for a half-resolution frame — a few pixels of angular
// spread need more rays than there are to spend, and what comes back is the
// variance rather than the blur — while one deterministic ray read at the right
// mip has the same expected value and no variance at all. It is also what makes
// the temporal pass able to converge: a deterministic ray gives it the same
// answer every frame to accumulate, instead of a new one to average.
//
// Injected at the opaque pass rather than at "postProcessing": reflections are
// a lighting term, so transparency and refraction should land on top of them,
// and the glass sphere should refract them.

// ─── G-buffer ────────────────────────────────────────────────────────────────

/**
 * Two main pass outputs the engine doesn't have, in attachment order.
 *
 * `value` is the WGSL assigned in each renderer's fragment stage: the standard
 * renderer has a shaded surface to describe, everything else in the main pass —
 * the skybox, lines, helpers — has no specular of its own, and writing zeroes
 * is what makes the trace skip those pixels.
 *
 * `indirectSpecular` is every specular term the surface got from something the
 * ray could not have found: the reflection probe, and area lights, which the
 * standard shader accumulates into the same field.
 */
export const G_BUFFER = [
  {
    name: "material",
    value: {
      "standard-renderer": "vec4f(data.f0, data.roughness)",
      default: "vec4f(0.0, 0.0, 0.0, 1.0)",
    },
  },
  {
    name: "indirectSpecular",
    value: {
      "standard-renderer": "vec4f(data.indirectSpecular, 1.0)",
      default: "vec4f(0.0)",
    },
  },
];

/** Appends a member to a generated shader's `FragmentOutput`. */
const addFragmentOutput = (source, name) =>
  source.replace(/(struct FragmentOutput \{[^}]*)\}/, (_, body) => {
    const location = (body.match(/@location\(/g) ?? []).length;
    return `${body.trimEnd()}\n  @location(${location}) ${name}: vec4f,\n}`;
  });

/**
 * Extra outputs on the main pass without touching the engine.
 *
 * Two wrappers, because a G-buffer channel is two things: a member of the
 * shader's output struct — no hook covers a struct, so the generated WGSL is
 * patched — and something assigned in the fragment stage, which every renderer
 * shader already exposes as the `fragEnd` hook.
 *
 * Both key off `outputs`, the same object the pipeline builds its attachment
 * list from, so the two can't disagree: a renderer drawing into a pass without
 * these attachments (the shadow and pre-passes) compiles without them, and the
 * struct members land in the order this file requests the names in.
 */
export function extendGBuffer(renderers) {
  for (const renderer of renderers) {
    const { getShader, getShaderOptions } = renderer;

    renderer.getShaderOptions = function (entity, options) {
      const shaderOptions = getShaderOptions.call(this, entity, options);
      const { outputs = {}, hooks = {} } = shaderOptions;

      const assignments = G_BUFFER.filter(({ name }) => outputs[name]).map(
        ({ name, value }) =>
          `output.${name} = ${value[renderer.type] ?? value.default};`,
      );
      if (!assignments.length) return shaderOptions;

      return {
        ...shaderOptions,
        hooks: {
          ...hooks,
          fragEnd: [hooks.fragEnd ?? "", ...assignments].join("\n  "),
        },
      };
    };

    renderer.getShader = function (defines, options) {
      const source = getShader.call(this, defines, options);
      return G_BUFFER.reduce(
        (wgsl, { name }) =>
          options.outputs?.[name] ? addFragmentOutput(wgsl, name) : wgsl,
        source,
      );
    };
  }
}

// ─── Injection ───────────────────────────────────────────────────────────────

const NOISE_SIZE = 64;

/**
 * Per-pixel decorrelation for the ray sampler, above `mirrorRoughness` where
 * there is sampling to decorrelate. Two channels of white noise, shifted every
 * frame by the R2 sequence in the shader — blue noise would distribute better
 * spatially, which is what a real spatial reconstruction pass would want; the
 * five-tap cross here only needs successive frames to differ.
 */
function createNoiseTexture(ctx) {
  const prng = random.create("ssr");
  const data = new Uint8Array(NOISE_SIZE ** 2 * 4);
  for (let i = 0; i < NOISE_SIZE ** 2; i++) {
    data[i * 4] = 255 * prng.float();
    data[i * 4 + 1] = 255 * prng.float();
    data[i * 4 + 3] = 255;
  }

  return gpu.createTexture(ctx, {
    label: "ssrNoiseTexture",
    width: NOISE_SIZE,
    height: NOISE_SIZE,
    format: "rgba8unorm",
    data,
  });
}

const NO_DEFINES = new Set();

/**
 * Register the effect. Returns a handle for the settings that invalidate what
 * has been accumulated so far.
 */
export function createSSR({ ctx, renderEngine, cameraEntity, settings }) {
  const { frameGraph, renderers } = renderEngine;
  const renderPipeline = renderEngine.systems.find(
    (system) => system.type === "render-pipeline-system",
  );

  extendGBuffer(renderers);

  const noiseTexture = createNoiseTexture(ctx);

  // Requested unconditionally rather than following the enabled toggle: outputs
  // are attachments on the main pass, so a set that changes relayouts it and
  // recompiles every material pipeline.
  //
  // Colour, normal and these two is four rgba16float attachments, which is
  // exactly maxColorAttachmentBytesPerSample — the whole budget. A fifth fails
  // when the pass is created, so turning bloom on for this camera (it asks for
  // "emissive") means packing these two into one.
  frameGraph.on("outputs", ({ outputs }) => {
    outputs.add("normal");
    for (const { name } of G_BUFFER) outputs.add(name);
  });

  const inverseProjectionMatrix = mat4.create();
  const previousViewProjectionMatrix = mat4.create();
  const reprojectionMatrix = mat4.create();
  let frame = 0;
  let accumulate = false;

  // One register per view per frame, so this is what "already declared for this
  // camera this frame" means — the effect offers itself at two injection points
  // and takes the first one whose inputs exist.
  const declared = new WeakSet();

  const declare = (textures) => {
    if (!settings.enabled || !textures || declared.has(textures)) return;

    const color = textures.get("color");
    const depth = textures.get("depth");
    const normal = textures.get("normal");
    const material = textures.get("material");
    const indirectSpecular = textures.get("indirectSpecular");
    // Nothing published under one of those names, or depth is multisampled and
    // cannot be sampled: sit the frame out rather than fail validation. The
    // register hands back what a pass can bind, so there is nothing else to
    // check.
    if (!color || !depth || !normal || !material || !indirectSpecular) return;

    declared.add(textures);

    const { renderView } = textures;
    const camera = renderView.camera;
    const viewId = renderView.cameraEntity.id;
    const width = renderView.viewport[2];
    const height = renderView.viewport[3];
    const halfWidth = Math.max(1, Math.ceil(width / 2));
    const halfHeight = Math.max(1, Math.ceil(height / 2));
    const levels = 1 + Math.floor(Math.log2(Math.max(width, height)));

    // Reprojection, and only from the camera: there are no motion vectors, so a
    // moving object's reflection is rejected by the temporal pass rather than
    // followed. One camera's worth of history, which is all this example has.
    mat4.mult(
      mat4.set(reprojectionMatrix, previousViewProjectionMatrix),
      camera.inverseViewMatrix,
    );
    mat4.mult(
      mat4.set(previousViewProjectionMatrix, camera.projectionMatrix),
      camera.viewMatrix,
    );
    mat4.invert(mat4.set(inverseProjectionMatrix, camera.projectionMatrix));

    const uSSR = {
      projectionMatrix: camera.projectionMatrix,
      inverseProjectionMatrix,
      reprojectionMatrix,
      viewportSize: [width, height],
      halfSize: [halfWidth, halfHeight],
      frame: frame % 64,
      near: camera.near,
      intensity: settings.intensity,
      maxDistance: settings.maxDistance,
      thickness: settings.thickness,
      steps: settings.steps,
      maxLevel: levels - 1,
      roughnessCutoff: settings.roughnessCutoff,
      mirrorRoughness: settings.mirrorRoughness,
      historyWeight:
        accumulate && settings.temporal ? settings.historyWeight : 0,
    };
    frame++;
    accumulate = true;

    const pass = (options) =>
      renderPipeline.declareFullscreenPass(
        { renderView, textures, prefix: "ssr" },
        options,
      );

    // ── Hierarchical depth ──
    // Declared with addPass rather than through the fullscreen helper: each of
    // these draws into one mip level of the texture the previous one wrote,
    // which is a sub-resource write the helper has no vocabulary for. The
    // ordering is the graph's: level N writes after level N-1 wrote, because
    // they write the same resource, and the level N-1 view is resolved inside
    // execute — declaring it as a read would be reading and writing one handle
    // in a single pass, which is exactly what is not allowed.
    const hiZ = frameGraph.createTexture({
      label: `ssrHiZ_${viewId}`,
      width,
      height,
      format: "r32uint",
      mipLevelCount: levels,
    });

    // One stable descriptor object per shader, from the pipeline's own variant
    // cache: pex-gpu keys compiled pipelines by identity, so building one per
    // frame recompiles per frame.
    const hiZCopyPipeline = renderPipeline.getPostProcessingPipeline(
      "ssr.hiZ.copy",
      hiZCopyShader,
      NO_DEFINES,
      {},
    );
    const hiZReducePipeline = renderPipeline.getPostProcessingPipeline(
      "ssr.hiZ.reduce",
      hiZReduceShader,
      NO_DEFINES,
      {},
    );

    frameGraph.addPass({
      name: `ssr.hiZ.0.${viewId}`,
      color: [{ texture: hiZ }],
      uniforms: { uDepthTexture: depth },
      renderView,
      execute: ({ uniforms }) => {
        renderPipeline.drawFullscreen({
          label: "ssrHiZCopy",
          pipeline: hiZCopyPipeline,
          uniforms,
        });
      },
    });

    for (let level = 1; level < levels; level++) {
      frameGraph.addPass({
        name: `ssr.hiZ.${level}.${viewId}`,
        color: [{ texture: hiZ, level }],
        renderView,
        execute: ({ resolveView }) => {
          renderPipeline.drawFullscreen({
            label: "ssrHiZReduce",
            pipeline: hiZReducePipeline,
            // Never createView(): pex-gpu keys its bind group cache by view
            // identity, so a view built per frame leaks a bind group per frame.
            uniforms: {
              uPreviousLevelTexture: resolveView(hiZ, { level: level - 1 }),
            },
          });
        },
      });
    }
    textures.set("ssr.hiZ", hiZ);

    // ── Radiance to reflect ──
    // The image as it stands, with mips: a rough surface reflects a cone, not a
    // ray, and the mip matching its footprint is what stands in for the samples
    // it would otherwise take.
    const colorPyramid = frameGraph.createTexture({
      label: `ssrColorPyramid_${viewId}`,
      width,
      height,
      format: frameGraph.describe(color).format,
      mipLevelCount: levels,
    });
    pass({ name: "colorPyramid", shader: copyShader, target: colorPyramid });
    frameGraph.addPass({
      name: `ssr.colorPyramid.mips.${viewId}`,
      // Opens its own render passes on the frame's encoder, so the graph is
      // told what it touches rather than deriving it from attachments.
      type: "raw",
      writes: [{ handle: colorPyramid, usage: GPUTextureUsage.RENDER_ATTACHMENT }],
      execute: ({ resolveTexture, encoder }) => {
        gpu.generateMipmaps(ctx, resolveTexture(colorPyramid), { encoder });
      },
    });

    // ── Trace, resolve, accumulate ──
    const trace = pass({
      name: "trace",
      shader: ssrTraceShader,
      size: [halfWidth, halfHeight],
      // No colour to sample: the trace only records where a ray landed.
      source: null,
      clearValue: [0, 0, 0, 0],
      uniforms: {
        uSSR,
        uHiZTexture: hiZ,
        uDepthTexture: depth,
        uNormalTexture: normal,
        uMaterialTexture: material,
        uNoiseTexture: frameGraph.importTexture(noiseTexture, "ssrNoise"),
      },
    });

    const resolve = pass({
      name: "resolve",
      shader: ssrResolveShader,
      // A pipeline variant per value, so the toggle is a compiled-out branch
      // rather than a runtime one.
      constants: { USE_NEIGHBOUR_REUSE: settings.spatialReuse },
      size: [halfWidth, halfHeight],
      source: null,
      uniforms: {
        uSSR,
        uTraceTexture: trace,
        uColorTexture: colorPyramid,
        uColorTextureSampler: renderPipeline.samplers.linear,
        uDepthTexture: depth,
        uNormalTexture: normal,
        uMaterialTexture: material,
      },
    });

    // Kept across frames, and therefore not pooled: a pooled texture is a
    // different one next frame, which is no use to something whose whole
    // purpose is to hold the previous frame. The label is its identity here,
    // so it carries the view id and nothing that changes frame to frame.
    const history = frameGraph.createTexture({
      label: `ssrHistory_${viewId}`,
      width: halfWidth,
      height: halfHeight,
      format: "rgba16float",
      persistent: true,
    });

    const temporal = pass({
      name: "temporal",
      shader: ssrTemporalShader,
      size: [halfWidth, halfHeight],
      source: null,
      uniforms: {
        uSSR,
        uResolveTexture: resolve,
        uHistoryTexture: history,
        uHistoryTextureSampler: renderPipeline.samplers.linear,
        uDepthTexture: depth,
      },
    });

    // Two textures rather than a ping-pong, for two reasons: a pass may not
    // read and write one handle, and a persistent resource is reallocated when
    // the usage it was created with changes — which is what alternating between
    // being read and being written every other frame would do, silently
    // throwing away the history it exists to keep.
    pass({ name: "history", shader: copyShader, source: temporal, target: history });

    pass({
      name: "composite",
      shader: ssrCompositeShader,
      uniforms: {
        uSSR,
        uReflectionTexture: temporal,
        uDepthTexture: depth,
        uNormalTexture: normal,
        uMaterialTexture: material,
        uIndirectSpecularTexture: indirectSpecular,
      },
      // Publishes the result as the frame's image: post-processing, the blit
      // and every scene pass still to be declared read "color" when their turn
      // comes, and this is what they now find.
      chain: true,
    });
  };

  // Against a pass rather than a phase. Right after the opaque pass is a
  // position, not a stage, and every pass is an injection point under its own
  // name — so the pipeline declares nothing for this, and the transparent and
  // transmission passes, which resolve their attachment from the register when
  // they declare, draw into the image this produced.
  frameGraph.afterPass(`opaque.${cameraEntity.id}`, ({ renderView }) => {
    // Not under MSAA: the scene passes are still drawing into the multisampled
    // attachment, which no single-sample image can be loaded back into, so
    // republishing here is reported and ignored. The stage below runs after the
    // resolve, where every reader and writer of the image is single-sample.
    if (renderView.cameraEntity.postProcessing?.msaa?.sampleCount > 1) return;

    declare(frameGraph.blackboard.get(`renderTextures.${renderView.cameraEntity.id}`));
  });

  // Whatever the anchor above could not serve: MSAA, or a frame where depth was
  // not sampleable until the pipeline resolved it.
  frameGraph.on("postProcessing", declare);

  return {
    /** Drop what has been accumulated: a settings change invalidates it. */
    invalidate() {
      accumulate = false;
    },
  };
}

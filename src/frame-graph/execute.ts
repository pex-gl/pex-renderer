import { submit } from "pex-gpu";
import { frameState } from "pex-gpu/internals";

import { NAMESPACE } from "../utils.js";
import { isResourceHandle } from "./types.js";
import { requirePhase } from "./state.js";

import type {
  ColorAttachment,
  DepthStencilAttachment,
  RenderCommand,
  RenderPassDescriptor,
  Uniforms,
} from "pex-gpu";

import type { GpuBuffer, GpuContext, GpuTexture } from "../types.js";
import type { GraphState } from "./state.js";
import type {
  CompiledColorAttachment,
  CompiledDepthStencilAttachment,
  CompiledPass,
  CompiledPlan,
  PassContext,
  PassUniforms,
  PhysicalResource,
  ResourceHandle,
  SubResourceView,
} from "./types.js";

const RESOLVE_HINT =
  "Capture the handle in setup and resolve it inside a pass's execute.";

// ─── Views ───────────────────────────────────────────────────────────────────

/**
 * Sub-resource views, keyed on the raw `GPUTexture` so entries are collected
 * with it. Caching is a correctness requirement, not an optimisation: pex-gpu
 * keys bind groups by view identity and can only prune them through the
 * `GpuTexture` wrapper, so a view built per frame leaks a bind group per frame.
 */
const viewCache = new WeakMap<GPUTexture, Map<string, GPUTextureView>>();

/** Every field that makes two views of one texture interchangeable. */
const viewKey = (descriptor: GPUTextureViewDescriptor) =>
  `${descriptor.dimension ?? ""}|${descriptor.baseMipLevel ?? 0}|${
    descriptor.mipLevelCount ?? 0
  }|${descriptor.baseArrayLayer ?? 0}|${descriptor.arrayLayerCount ?? 0}`;

export function textureView(
  texture: GpuTexture,
  descriptor: GPUTextureViewDescriptor,
): GPUTextureView {
  const views = viewCache.getOrInsertComputed(texture.texture, () => new Map());
  return views.getOrInsertComputed(viewKey(descriptor), () =>
    texture.texture.createView(descriptor),
  );
}

/**
 * Attachments must target exactly one mip level and one array layer, and a
 * default view spans all of them. So the texture's shape decides whether an
 * explicit view is needed, not whether a sub-resource was asked for: a cube
 * needs one even for layer 0.
 */
export function attachmentView(
  texture: GpuTexture,
  layer?: number,
  level?: number,
): GPUTextureView | undefined {
  const layered = texture.depthOrArrayLayers > 1;
  if (!layered && texture.mipLevelCount === 1) return undefined;

  return textureView(texture, {
    ...(layered && {
      dimension: "2d" as const,
      baseArrayLayer: layer ?? 0,
      arrayLayerCount: 1,
    }),
    baseMipLevel: level ?? 0,
    mipLevelCount: 1,
  });
}

// ─── Pass descriptors ────────────────────────────────────────────────────────

const physical = (
  plan: CompiledPlan,
  handle: ResourceHandle,
): PhysicalResource => {
  const resource = plan.physical[handle.index];
  if (!resource) {
    throw new Error(
      `${NAMESPACE}: "${handle.name}" has no physical resource. It was culled, or it belongs to a different frame's plan.`,
    );
  }
  return resource;
};

/** Attachments are always textures. */
const physicalTexture = (plan: CompiledPlan, handle: ResourceHandle) =>
  physical(plan, handle) as GpuTexture;

const buildColorAttachment = (
  plan: CompiledPlan,
  attachment: CompiledColorAttachment,
): ColorAttachment => {
  const texture = physicalTexture(plan, attachment.handle);
  const view = attachmentView(texture, attachment.layer, attachment.level);
  return {
    texture,
    ...(view && { view }),
    ...(attachment.resolveTarget && {
      resolveTarget: physicalTexture(plan, attachment.resolveTarget),
    }),
    ...(attachment.clearValue !== undefined && {
      clearValue: attachment.clearValue,
    }),
    loadOp: attachment.loadOp,
    storeOp: attachment.storeOp,
  };
};

const buildDepthAttachment = (
  plan: CompiledPlan,
  depth: CompiledDepthStencilAttachment,
): DepthStencilAttachment => {
  const texture = physicalTexture(plan, depth.handle);
  const view = attachmentView(texture, depth.layer);
  return {
    texture,
    ...(view && { view }),
    depthLoadOp: depth.loadOp,
    depthStoreOp: depth.storeOp,
    ...(depth.depthClearValue !== undefined && {
      depthClearValue: depth.depthClearValue,
    }),
    ...(depth.stencilClearValue !== undefined && {
      stencilClearValue: depth.stencilClearValue,
    }),
  };
};

const buildPassDescriptor = (
  plan: CompiledPlan,
  pass: CompiledPass,
): RenderPassDescriptor => {
  // No color handles means the canvas: pex-gpu treats an omitted
  // colorAttachments as the swapchain, and an explicit [] as depth-only.
  const isCanvasTarget = pass.color.length === 0 && !pass.depth;

  return {
    ...(!isCanvasTarget && {
      colorAttachments: pass.color.map((attachment) =>
        buildColorAttachment(plan, attachment),
      ),
    }),
    ...(pass.depth && {
      depthStencilAttachment: buildDepthAttachment(plan, pass.depth),
    }),
  };
};

/** Swap handle-valued entries for their physical resources. */
const resolveUniforms = (
  uniforms: PassUniforms | undefined,
  resolve: (handle: ResourceHandle) => PhysicalResource,
): Uniforms => {
  if (!uniforms) return {};

  const resolved: Uniforms = {};
  for (const [key, value] of Object.entries(uniforms)) {
    resolved[key] = isResourceHandle(value) ? resolve(value) : value;
  }
  return resolved;
};

// ─── Execution ───────────────────────────────────────────────────────────────

export default function execute(
  ctx: GpuContext,
  state: GraphState,
  plan: CompiledPlan,
  /** Messages already logged, so a pass that throws every frame logs once. */
  reportedErrors: Set<string>,
): void {
  // Bound once: the resolvers a pass is handed close over this frame's plan.
  const resolve = (handle: ResourceHandle) => {
    requirePhase(
      state,
      "executing",
      `resolving "${handle.name}"`,
      RESOLVE_HINT,
    );
    return physical(plan, handle);
  };
  const resolveTexture = (handle: ResourceHandle) =>
    resolve(handle) as GpuTexture;
  const resolveBuffer = (handle: ResourceHandle) =>
    resolve(handle) as GpuBuffer;
  const resolveView = (
    handle: ResourceHandle,
    { level, levelCount, layer, layerCount, dimension }: SubResourceView = {},
  ) =>
    textureView(resolveTexture(handle), {
      ...(dimension && { dimension }),
      baseMipLevel: level ?? 0,
      mipLevelCount: levelCount ?? 1,
      baseArrayLayer: layer ?? 0,
      ...(layerCount !== undefined && { arrayLayerCount: layerCount }),
    });

  const runSubPasses = (pass: CompiledPass, encoder?: GPUCommandEncoder) => {
    state.phase = "executing";
    try {
      for (const subPass of pass.subPasses) {
        const declaration = state.passes[subPass.declarationIndex]!;
        const context: PassContext = {
          ctx,
          resolveTexture,
          resolveBuffer,
          resolveView,
          uniforms: resolveUniforms(declaration.uniforms, resolve),
          ...(declaration.renderView && {
            renderView: declaration.renderView,
          }),
          viewport: pass.viewport,
          ...(encoder && { encoder }),
        };

        try {
          subPass.execute(context);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          if (!reportedErrors.has(err.message)) {
            reportedErrors.add(err.message);
            console.error(
              NAMESPACE,
              "frame-graph",
              `pass "${subPass.name}" crashed.`,
              err,
            );
          }
        }
      }
    } finally {
      state.phase = "compiled";
    }
  };

  for (const pass of plan.passes) {
    if (pass.type === "raw") {
      // No render or compute pass to open: the callback records straight into
      // the frame's live encoder, or hands it to a pex-gpu helper that opens
      // its own passes on it (eg. generateMipmaps) — which couldn't run nested
      // inside a pass this loop already opened.
      runSubPasses(pass, frameState(ctx).encoder);
      continue;
    }

    // Scoped submit keeps the render pass open for the nested draws.
    const command: RenderCommand = {
      label: pass.label,
      pass: buildPassDescriptor(plan, pass),
    };

    submit(ctx, command, () => runSubPasses(pass));
  }
}

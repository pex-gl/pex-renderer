import { isTextureDescriptor } from "../../frame-graph/state.js";
import { NAMESPACE } from "../../utils.js";

import type { FrameGraph, ResourceHandle } from "../../frame-graph/index.js";
import type { RenderView } from "../../types.js";

/** What a reader needs of a texture before it will bind it. */
export interface TextureRequirements {
  format?: GPUTextureFormat;
  /**
   * Accept a multisampled texture. Off by default: `get` hands back what a pass
   * can bind, and WebGPU has no way to sample a multisampled texture.
   */
  multisampled?: boolean;
}

const explainRequirements = ({ format, multisampled }: TextureRequirements) =>
  [format && `format ${format}`, !multisampled && "single-sample"]
    .filter(Boolean)
    .join(" and ") || "no requirement";

/**
 * The images one view has produced so far this frame, under the names the rest
 * of the frame knows them by.
 *
 * Reading a name and publishing under a name are the only two operations, and
 * everything uses them: the pipeline's own passes, each post-processing
 * sub-pass, and anything injected at a `frameGraph.stage()`. Injecting a pass
 * and declaring one are therefore the same act — declare passes, publish the
 * last one's output under the name the next reader will ask for.
 *
 * `"color"` is the frame's image: whatever was published under it last is what
 * post-processing reads, what the debug picker defaults to and what the blit
 * presents. `"depth"`, `"normal"` and `"emissive"` come from the main pass when
 * the pipeline was asked for them; post-processing publishes each sub-pass
 * output as `"<effect>.<subPass>"`. Names are otherwise free-form.
 *
 * Attachments and sampled results share the register, which is why it is named
 * for what the entries are — textures — and not for what half of them happen to
 * be bound as.
 *
 * Handles belong to the frame being declared, so a register is only meaningful
 * until the next `setup()` clears the graph.
 */
export class RenderTextures {
  frameGraph: FrameGraph;
  renderView: RenderView;
  /**
   * Every handle published under a name, oldest first. History is what keeps a
   * mismatch local — see `get`.
   */
  versions = new Map<string, ResourceHandle[]>();

  constructor(frameGraph: FrameGraph, renderView: RenderView) {
    this.frameGraph = frameGraph;
    this.renderView = renderView;
  }

  /** Publish `handle` as the current value of `name`. */
  set(name: string, handle: ResourceHandle): void {
    this.versions.getOrInsertComputed(name, () => []).push(handle);
  }

  /**
   * Most recent handle published under `name` that meets `requirements`.
   *
   * Older versions are considered when the newest does not qualify, and the
   * substitution is reported: a pass that publishes an unusable `"color"` then
   * costs its own contribution and one error naming it, rather than a frame
   * that fails validation somewhere downstream. Nothing qualifying — the
   * pipeline was never asked for that output, or depth is multisampled under
   * MSAA — is not an error here, it is the answer: readers are expected to
   * check and sit the frame out.
   */
  get(
    name: string,
    requirements: TextureRequirements = {},
  ): ResourceHandle | undefined {
    const versions = this.versions.get(name);
    if (!versions) return undefined;

    for (let i = versions.length - 1; i >= 0; i--) {
      const handle = versions[i]!;
      if (!this.meets(handle, requirements)) continue;

      if (i !== versions.length - 1) {
        this.report(
          `"${name}" was last published as ${this.explain(versions.at(-1)!)}, which is not ${explainRequirements(requirements)}. Falling back to ${this.explain(handle)}.`,
        );
      }
      return handle;
    }
    return undefined;
  }

  /** `get`, reporting once when nothing published under `name` qualifies. */
  require(
    name: string,
    requirements: TextureRequirements = {},
  ): ResourceHandle | undefined {
    const handle = this.get(name, requirements);
    if (handle) return handle;

    const latest = this.versions.get(name)?.at(-1);
    this.report(
      latest
        ? `no "${name}" texture that is ${explainRequirements(requirements)}: the frame published ${this.explain(latest)}.`
        : `nothing published under "${name}" this frame. Available: ${[...this.versions.keys()].join(", ")}.`,
    );
    return undefined;
  }

  meets(handle: ResourceHandle, requirements: TextureRequirements): boolean {
    const descriptor = this.frameGraph.describe(handle);
    if (!descriptor || !isTextureDescriptor(descriptor)) return false;
    if (requirements.format && descriptor.format !== requirements.format) {
      return false;
    }
    return requirements.multisampled || (descriptor.sampleCount ?? 1) === 1;
  }

  /** A handle as it reads in a diagnostic: name, format, size, sample count. */
  explain(handle: ResourceHandle): string {
    const descriptor = this.frameGraph.describe(handle);
    if (!descriptor || !isTextureDescriptor(descriptor)) {
      return `"${handle.name}" (not a texture)`;
    }
    const samples =
      (descriptor.sampleCount ?? 1) > 1 ? ` ×${descriptor.sampleCount}` : "";
    return `"${handle.name}" (${descriptor.format} ${descriptor.width}×${descriptor.height}${samples})`;
  }

  report(message: string): void {
    if (this.frameGraph.reportedErrors.has(message)) return;
    this.frameGraph.reportedErrors.add(message);
    console.error(NAMESPACE, "render-textures", message);
  }
}

export default RenderTextures;

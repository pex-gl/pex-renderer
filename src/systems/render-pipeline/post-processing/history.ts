import type { Entity } from "../../../types.js";
import type {
  ResourceHandle,
  TextureDescriptor,
} from "../../../frame-graph/index.js";
import type { PostProcessingContext } from "../post-processing.js";

/**
 * What the last frame left behind for a camera, so this one can tell whether
 * the history textures hold anything worth blending.
 */
interface HistoryState {
  width: number;
  height: number;
  frameIndex: number;
}

/**
 * History bookkeeping for an effect accumulating across frames, one per effect
 * as each tracks its own textures.
 *
 * Kept by the effect rather than on the camera component because nothing else
 * reads it — and weakly, so a discarded camera entity does not pin an entry.
 *
 * The returned function records this frame and reports whether the previous
 * one's history is usable: not when the textures were just allocated (first
 * frame for this camera), reallocated (a resize changed their shape), left
 * behind by a frame that is not the one immediately before this, or describing
 * a view this one does not continue from (a cut, via
 * `cameraSystem.resetTemporal`).
 */
export function createHistoryTracker() {
  const states = new WeakMap<Entity, HistoryState>();

  return (
    cameraEntity: Entity,
    frameIndex: number,
    width: number,
    height: number,
  ): boolean => {
    const state = states.get(cameraEntity);
    states.set(cameraEntity, { width, height, frameIndex });

    return (
      !cameraEntity.camera!._temporalReset &&
      !!state &&
      state.width === width &&
      state.height === height &&
      state.frameIndex === frameIndex - 1
    );
  };
}

/**
 * Two histories alternating by frame parity, because a pass may not read and
 * write one handle. Persistent: their contents have to survive to the next
 * frame, which is the one thing the pool's per-frame recycling would otherwise
 * take away. Declared both ways round every frame, as the read side has no
 * producing pass this frame and only a persistent declaration gives it a handle
 * at all.
 */
export const createHistoryPair = (
  createTexture: PostProcessingContext["createTexture"],
  label: string,
  viewId: Entity["id"],
  descriptor: Omit<TextureDescriptor, "label" | "persistent">,
): [ResourceHandle, ResourceHandle] => [
  createTexture({
    label: `${label}0.${viewId}`,
    ...descriptor,
    persistent: true,
  }),
  createTexture({
    label: `${label}1.${viewId}`,
    ...descriptor,
    persistent: true,
  }),
];

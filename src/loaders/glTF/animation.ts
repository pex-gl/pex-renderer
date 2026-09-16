import { getAccessor } from "./accessor.js";
import {
  GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER,
  normalizeData,
} from "./common.js";

import type * as GLTF from "types-gltf";
import type { ResolvedGltf } from "./types.js";

export interface ResolvedAnimationChannel {
  input: Float32Array;
  output: number[][];
  interpolation: string;
  /**
   * Raw glTF node index — resolved to an entity by
   * loaders/glTF/pex-renderer.ts.
   */
  targetNodeIndex: number;
  path: "translation" | "rotation" | "scale" | "weights";
}

/**
 * Resolves an animation's channels/samplers into per-keyframe output arrays.
 * `weights` channels group output values by the target mesh's declared morph
 * target count (from the glTF document, not from any built entity).
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/animation.schema.json
 */
export function resolveAnimation(
  animation: GLTF.Animation,
  gltf: ResolvedGltf,
  index: number,
): { name: string; duration: number; channels: ResolvedAnimationChannel[] } {
  const accessors = gltf.accessors!;
  const bufferViews = gltf.bufferViews!;

  const channels: ResolvedAnimationChannel[] = animation.channels.map(
    (channel) => {
      // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/animation.sampler.schema.json
      const sampler = animation.samplers[channel.sampler]!;
      const input = getAccessor(accessors[sampler.input]!, bufferViews);
      const output = getAccessor(accessors[sampler.output]!, bufferViews);
      const targetNode = gltf.nodes![channel.target.node!]!;

      const outputValues = output.normalized
        ? normalizeData(output._data)
        : output._data;

      const stride =
        channel.target.path === "weights"
          ? (gltf.meshes![targetNode.mesh!]!.weights?.length ?? 1)
          : GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER[output.type]!;

      const outputData: number[][] = [];
      for (let i = 0; i < outputValues.length; i += stride) {
        outputData.push(Array.from(outputValues.slice(i, i + stride)));
      }

      return {
        // The spec fixes a sampler's input accessor to SCALAR/FLOAT.
        input: input._data as Float32Array,
        output: outputData,
        interpolation: sampler.interpolation ?? "LINEAR",
        targetNodeIndex: channel.target.node!,
        path: channel.target.path,
      };
    },
  );

  const duration = channels.reduce(
    (duration, { input }) => Math.max(duration, input.at(-1) ?? 0),
    0,
  );

  return { name: animation.name || `Animation ${index}`, duration, channels };
}

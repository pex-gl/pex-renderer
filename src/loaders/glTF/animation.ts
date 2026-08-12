import { getAccessor } from "./accessor.js";
import { GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER, normalizeData } from "./common.js";

export interface ResolvedAnimationChannel {
  input: Float32Array;
  output: number[][];
  interpolation: string;
  /** Raw glTF node index — resolved to an entity by loaders/glTF/pex-renderer.ts. */
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
  animation: any,
  gltf: { accessors: any[]; bufferViews: any[]; nodes: any[]; meshes: any[] },
  index: number,
): { name: string; duration: number; channels: ResolvedAnimationChannel[] } {
  const channels: ResolvedAnimationChannel[] = animation.channels.map(
    (channel: any) => {
      // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/animation.sampler.schema.json
      const sampler = animation.samplers[channel.sampler];
      const input = getAccessor(gltf.accessors[sampler.input], gltf.bufferViews);
      const output = getAccessor(gltf.accessors[sampler.output], gltf.bufferViews);
      const targetNode = gltf.nodes[channel.target.node];

      const outputValues = output.normalized
        ? normalizeData(output._data)
        : output._data;

      let stride = GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER[output.type]!;
      if (channel.target.path === "weights") {
        stride = gltf.meshes[targetNode.mesh].weights?.length ?? 1;
      }

      const outputData: number[][] = [];
      for (let i = 0; i < outputValues.length; i += stride) {
        outputData.push(Array.from(outputValues.slice(i, i + stride)));
      }

      return {
        input: input._data,
        output: outputData,
        interpolation: sampler.interpolation,
        targetNodeIndex: channel.target.node,
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

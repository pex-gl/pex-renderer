import { mat4, quat } from "pex-math";

export interface ResolvedNodeTransform {
  position: number[];
  rotation: number[];
  scale: number[];
}

/**
 * Resolves a glTF node's local transform, decomposing `matrix` into TRS when
 * present.
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/node.schema.json
 */
export function resolveNodeTransform(node: any): ResolvedNodeTransform {
  if (node.matrix) {
    const mn = mat4.create();
    const scale = [
      Math.hypot(node.matrix[0], node.matrix[1], node.matrix[2]),
      Math.hypot(node.matrix[4], node.matrix[5], node.matrix[6]),
      Math.hypot(node.matrix[8], node.matrix[9], node.matrix[10]),
    ];
    for (const col of [0, 1, 2]) {
      mn[col] = node.matrix[col] / scale[0]!;
      mn[col + 4] = node.matrix[col + 4] / scale[1]!;
      mn[col + 8] = node.matrix[col + 8] / scale[2]!;
    }

    return {
      position: [node.matrix[12], node.matrix[13], node.matrix[14]],
      rotation: Array.from(quat.fromMat4(quat.create(), mn)),
      scale,
    };
  }

  return {
    position: node.translation || [0, 0, 0],
    rotation: node.rotation || [0, 0, 0, 1],
    scale: node.scale || [1, 1, 1],
  };
}

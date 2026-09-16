import { getAccessor } from "./accessor.js";

import type * as GLTF from "types-gltf";
import type { ResolvedGltf } from "./types.js";

/**
 * Resolves a glTF skin's inverse bind matrices. `joints` stays as raw node
 * indices — resolving them to entities is loaders/glTF/pex-renderer.ts's job.
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/skin.schema.json
 */
export function resolveSkin(
  skin: GLTF.Skin,
  gltf: ResolvedGltf,
): { jointNodeIndices: number[]; inverseBindMatrices: Float32Array[] } {
  const accessor = getAccessor(
    gltf.accessors![skin.inverseBindMatrices!]!,
    gltf.bufferViews!,
  );

  // The spec fixes inverseBindMatrices to MAT4/FLOAT.
  const data = accessor._data as Float32Array;
  const inverseBindMatrices: Float32Array[] = [];
  for (let i = 0; i < data.length; i += 16) {
    inverseBindMatrices.push(data.slice(i, i + 16));
  }

  return { jointNodeIndices: skin.joints, inverseBindMatrices };
}

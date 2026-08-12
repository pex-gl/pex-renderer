import { getAccessor } from "./accessor.js";

/**
 * Resolves a glTF skin's inverse bind matrices. `joints` stays as raw node
 * indices — resolving them to entities is loaders/glTF/pex-renderer.ts's job.
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/skin.schema.json
 */
export function resolveSkin(
  skin: any,
  gltf: { bufferViews: any[]; accessors: any[] },
): { jointNodeIndices: number[]; inverseBindMatrices: Float32Array[] } {
  const accessor = getAccessor(
    gltf.accessors[skin.inverseBindMatrices],
    gltf.bufferViews,
  );

  const inverseBindMatrices: Float32Array[] = [];
  for (let i = 0; i < accessor._data.length; i += 16) {
    inverseBindMatrices.push(accessor._data.slice(i, i + 16));
  }

  return { jointNodeIndices: skin.joints, inverseBindMatrices };
}

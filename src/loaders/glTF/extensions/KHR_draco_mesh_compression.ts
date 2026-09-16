import { loadDraco } from "pex-loaders";

import {
  WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES,
  normalizeData,
} from "../common.js";

import type * as GLTF from "types-gltf";
import type { KHR_draco_mesh_compression } from "types-gltf/extensions";
import type { ResolvedBufferView } from "../types.js";

// pex-loaders re-exports loadDraco but not its option/result types.
type LoadDracoOptions = NonNullable<Parameters<typeof loadDraco>[1]>;

/**
 * A decoded attribute, plus the vertex layout this loader pins onto JOINTS_0 —
 * the decoder reports neither.
 */
type DracoAttribute = Awaited<ReturnType<typeof loadDraco>>[string] & {
  format?: GPUVertexFormat;
  arrayStride?: number;
};

export interface DracoOptions {
  dracoOptions?: LoadDracoOptions;
}

/**
 * Decodes a Draco-compressed primitive into its geometry attributes, keyed by
 * glTF attribute semantic name (e.g. "POSITION", "NORMAL") to stay consistent
 * with the uncompressed path.
 * https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
 */
export async function resolveDracoPrimitive(
  primitive: GLTF.MeshPrimitive,
  bufferViews: ResolvedBufferView[],
  accessors: GLTF.Accessor[],
  options: DracoOptions = {},
): Promise<Record<string, DracoAttribute> | null> {
  const dracoExt = primitive.extensions?.KHR_draco_mesh_compression as
    KHR_draco_mesh_compression.MeshPrimitive | undefined;
  if (!dracoExt) return null;

  const bufferView = bufferViews[dracoExt.bufferView]!;
  const gltfAttributeMap = dracoExt.attributes;

  const attributeIDs: Record<string, number> = {};
  const attributeTypes: Record<string, string> = {};
  const normalizedAttributes: string[] = [];

  for (const name in gltfAttributeMap) {
    attributeIDs[name] = gltfAttributeMap[name]!;
  }

  for (const name in primitive.attributes) {
    if (gltfAttributeMap[name] === undefined) continue;
    const accessor = accessors[primitive.attributes[name]!]!;
    const componentType =
      WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[accessor.componentType]!;
    attributeTypes[name] = componentType.name;
    if (accessor.normalized === true) normalizedAttributes.push(name);
  }

  // If the loader does support the Draco extension, but will not process
  // KHR_draco_mesh_compression, then the loader must load the glTF asset
  // ignoring KHR_draco_mesh_compression in primitive.
  try {
    const geometry: Record<string, DracoAttribute> = await loadDraco(
      bufferView._data,
      {
        transcodeConfig: { attributeIDs, attributeTypes, useUniqueIDs: true },
        ...options.dracoOptions,
      },
    );

    // Decoded attributes bypass resolveAttributes, so its post-decode
    // conversions have to be repeated here or they are silently skipped.
    for (const name of normalizedAttributes) {
      const attribute = geometry[name];
      if (attribute) attribute.data = normalizeData(attribute.data);
    }

    // JOINTS_0 decodes to the accessor's integer type. As on the uncompressed
    // path, the shader's vec4u reflects to uint32x4, so the actual width has to
    // be pinned from the decoded array.
    if (geometry.JOINTS_0) {
      const componentBytes = geometry.JOINTS_0.data.BYTES_PER_ELEMENT;
      geometry.JOINTS_0.format = componentBytes === 1 ? "uint8x4" : "uint16x4";
      geometry.JOINTS_0.arrayStride = componentBytes * 4;
    }

    return geometry;
  } catch (error) {
    console.warn(
      "glTF loader: error decoding Draco geometry, falling back to uncompressed.",
      error,
    );
    return null;
  }
}

import { createBuffer } from "pex-gpu";
import typedArrayInterleave from "typed-array-interleave";

import { getAccessor } from "./accessor.js";
import {
  MESH_QUANTIZATION_SCALE,
  WEBGL_CONSTANTS,
  WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES,
  normalizeData,
} from "./common.js";
import {
  resolveDracoPrimitive,
  type DracoOptions,
} from "./extensions/KHR_draco_mesh_compression.js";
import { resolveMaterial } from "./material.js";

import type { GpuContext, MorphAttribute } from "../../types.js";
import type * as GLTF from "types-gltf";
import type {
  ResolvedGeometry,
  ResolvedGltf,
  ResolvedMaterial,
  ResolvedMorphTargets,
  ResolvedPrimitive,
  TypedArray,
} from "./types.js";

/**
 * Resolves a primitive/instancing attributes map into GPU-backed descriptors
 * keyed by glTF attribute semantic name (POSITION, NORMAL, TEXCOORD_0, ...).
 * Attributes from the same (non-quantized) bufferView share one GPU buffer —
 * matching how the accessor's byteOffset/byteStride already describe an
 * interleaved layout — cached on the bufferView itself so multiple
 * primitives/attributes referencing it don't re-upload.
 */
export function resolveAttributes(
  attributesMap: Record<string, number>,
  gltf: ResolvedGltf,
  ctx: GpuContext,
): ResolvedGeometry {
  const attributes: ResolvedGeometry = {};

  for (const name in attributesMap) {
    const accessor = getAccessor(
      gltf.accessors![attributesMap[name]!]!,
      gltf.bufferViews!,
    );

    // The conversions below rewrite values CPU-side and compose: an accessor
    // may legally be sparse *and* normalized, or normalized *and* a VEC3
    // COLOR_0. Each reads whatever the previous one produced, falling back to
    // the accessor's own tightly-packed copy. Setting `data` opts the
    // attribute out of the shared-bufferView buffer below, since the rewritten
    // values live only in the new array.
    let data: TypedArray | undefined;

    // Sparse accessors: getAccessor substitutes the sparse values into _data,
    // which is the only place they exist.
    if (accessor.sparse) data = accessor._data;

    // KHR_mesh_quantization: denormalize into a fresh Float32Array. Vertex
    // formats are inferred from the WGSL type rather than the accessor, so a
    // normalized integer source has to already be float data on arrival.
    if (accessor.normalized) data = normalizeData(data ?? accessor._data);

    // The vertex shader's vertexColor input is always vec4f, so a VEC3 COLOR_0
    // needs an alpha=1 channel interleaved in.
    if (name === "COLOR_0" && accessor.type === "VEC3") {
      data = typedArrayInterleave(
        Float32Array,
        [3, 1],
        data ?? accessor._data,
        new Float32Array(accessor.count).fill(1),
      );
    }

    // JOINTS_0 is an unnormalized integer accessor, UNSIGNED_BYTE or
    // UNSIGNED_SHORT per spec. The shader's `joint` input is vec4u, which
    // reflects to uint32x4 — vec4<u32> is fed by uint8x4/uint16x4/uint32x4
    // alike, so the width has to come from the accessor rather than the WGSL.
    const joints =
      name === "JOINTS_0"
        ? accessor.componentType === WEBGL_CONSTANTS.UNSIGNED_BYTE
          ? { format: "uint8x4" as const, arrayStride: 4 }
          : { format: "uint16x4" as const, arrayStride: 8 }
        : undefined;

    if (data) {
      attributes[name] = joints ? { data, ...joints } : data;
    } else {
      const bufferViewData = accessor._bufferView._data;
      let buffer = accessor._bufferView._vertexBuffer;
      if (!buffer) {
        buffer = accessor._bufferView._vertexBuffer = createBuffer(ctx, {
          usage: "vertex",
          data: bufferViewData,
        });
      }

      attributes[name] = {
        buffer,
        // The buffer holds the whole bufferView, which the offset and stride
        // below index into; `data` is this accessor's own values, which is
        // what anything reading the attribute CPU-side wants.
        data: accessor._data,
        offset: accessor.byteOffset,
        arrayStride: accessor._bufferView.byteStride ?? joints?.arrayStride,
        ...(joints && { format: joints.format }),
      };
    }
  }

  return attributes;
}

/** Resolves a primitive's indices accessor into a raw typed array + count. */
export function resolveIndices(
  indicesAccessorIndex: number | undefined,
  gltf: ResolvedGltf,
): { indices: TypedArray; count: number } | null {
  if (indicesAccessorIndex === undefined) return null;

  const accessor = getAccessor(
    gltf.accessors![indicesAccessorIndex]!,
    gltf.bufferViews!,
  );
  return { indices: accessor._data, count: accessor.count };
}

/**
 * Resolves POSITION accessor min/max into `[min, max]` bounds,
 * quantization-scaled.
 */
export function resolvePositionBounds(
  positionAccessor: GLTF.Accessor | undefined,
): number[][] | undefined {
  if (!positionAccessor?.min || !positionAccessor?.max) return undefined;

  const scale = positionAccessor.normalized
    ? (MESH_QUANTIZATION_SCALE.get(
        WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[positionAccessor.componentType]!,
      ) ?? 1)
    : 1;

  return [
    positionAccessor.min.map((v: number) => v * scale),
    positionAccessor.max.map((v: number) => v * scale),
  ];
}

// https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#primitivemode
const GLTF_PRIMITIVE_MODE = {
  POINTS: 0,
  LINES: 1,
  LINE_LOOP: 2,
  LINE_STRIP: 3,
  TRIANGLES: 4,
  TRIANGLE_STRIP: 5,
  TRIANGLE_FAN: 6,
} as const;

const GLTF_MODE_TOPOLOGY: Record<number, GPUPrimitiveTopology> = {
  [GLTF_PRIMITIVE_MODE.POINTS]: "point-list",
  [GLTF_PRIMITIVE_MODE.LINES]: "line-list",
  [GLTF_PRIMITIVE_MODE.LINE_STRIP]: "line-strip",
  [GLTF_PRIMITIVE_MODE.TRIANGLES]: "triangle-list",
  [GLTF_PRIMITIVE_MODE.TRIANGLE_STRIP]: "triangle-strip",
};

/**
 * Resolves a primitive's mode into a WebGPU topology, mutating `geometry` in
 * place. WebGPU has no LINE_LOOP/TRIANGLE_FAN topology (unlike WebGL) so both
 * are expanded here into an explicit index buffer over a supported topology:
 * LINE_LOOP closes into a line-strip by repeating the first index at the end;
 * TRIANGLE_FAN is re-triangulated into a triangle-list, fanned from index 0.
 */
function resolveTopology(
  mode: number,
  geometry: ResolvedGeometry,
): GPUPrimitiveTopology {
  if (
    mode !== GLTF_PRIMITIVE_MODE.LINE_LOOP &&
    mode !== GLTF_PRIMITIVE_MODE.TRIANGLE_FAN
  ) {
    return GLTF_MODE_TOPOLOGY[mode] ?? "triangle-list";
  }

  const existingIndices: ArrayLike<number> | undefined = geometry.indices;
  const indexCount: number = existingIndices
    ? existingIndices.length
    : (geometry.count ?? 0);
  const indexAt = (i: number): number =>
    existingIndices ? existingIndices[i]! : i;

  if (mode === GLTF_PRIMITIVE_MODE.LINE_LOOP) {
    const IndexArray = existingIndices?.constructor as
      Uint16ArrayConstructor | Uint32ArrayConstructor | undefined;
    const closed = new (IndexArray ?? Uint32Array)(indexCount + 1);
    for (let i = 0; i < indexCount; i++) closed[i] = indexAt(i);
    closed[indexCount] = indexAt(0);
    geometry.indices = closed;
    geometry.count = closed.length;
    return "line-strip";
  }

  // TRIANGLE_FAN
  const triangleCount = Math.max(0, indexCount - 2);
  const IndexArray = indexCount > 0xff_ff ? Uint32Array : Uint16Array;
  const triangles = new IndexArray(triangleCount * 3);
  for (let i = 0, t = 0; i < triangleCount; i++) {
    triangles[t++] = indexAt(0);
    triangles[t++] = indexAt(i + 1);
    triangles[t++] = indexAt(i + 2);
  }
  geometry.indices = triangles;
  geometry.count = triangles.length;
  return "triangle-list";
}

/**
 * Resolves a mesh primitive's geometry: attributes, indices, bounds and
 * primitive mode. `instancedAttributes` (from EXT_mesh_gpu_instancing) are
 * merged in as-is.
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/mesh.primitive.schema.json
 */
export async function resolvePrimitiveGeometry(
  primitive: GLTF.MeshPrimitive,
  gltf: ResolvedGltf,
  ctx: GpuContext,
  instancedAttributes: ResolvedGeometry,
  options: DracoOptions,
): Promise<ResolvedGeometry> {
  let geometry: ResolvedGeometry = {};

  // The loader must process KHR_draco_mesh_compression first: the decoded
  // attributes replace their accessor-resolved equivalents below.
  const draco = await resolveDracoPrimitive(
    primitive,
    gltf.bufferViews!,
    gltf.accessors!,
    options,
  );
  if (draco) geometry = draco;

  const remainingAttributes = { ...primitive.attributes };
  if (draco) {
    for (const name of Object.keys(draco)) delete remainingAttributes[name];
  }
  Object.assign(
    geometry,
    resolveAttributes(remainingAttributes, gltf, ctx),
    instancedAttributes,
  );

  const positionAccessor = gltf.accessors![primitive.attributes.POSITION!];
  const bounds = resolvePositionBounds(positionAccessor);
  if (bounds) geometry.bounds = bounds;

  if (!geometry.indices && primitive.indices !== undefined) {
    Object.assign(geometry, resolveIndices(primitive.indices, gltf));
  } else if (!geometry.indices && positionAccessor) {
    geometry.count = getAccessor(positionAccessor, gltf.bufferViews!).count;
  }

  // Default mode is TRIANGLES (4) when omitted, per spec.
  geometry.topology = resolveTopology(
    primitive.mode ?? GLTF_PRIMITIVE_MODE.TRIANGLES,
    geometry,
  );

  return geometry;
}

/**
 * Resolves a primitive's morph targets: `{ sources, targets, weights }`,
 * sources/targets keyed by attribute semantic.
 */
export function resolvePrimitiveMorphTargets(
  primitive: GLTF.MeshPrimitive,
  geometry: ResolvedGeometry,
  gltf: ResolvedGltf,
  weights: number[],
): ResolvedMorphTargets | null {
  if (!primitive.targets) return null;

  const sources: ResolvedMorphTargets["sources"] = {};
  const targets: ResolvedMorphTargets["targets"] = {};

  for (const target of primitive.targets) {
    for (const targetKey in target) {
      targets[targetKey] ??= [];

      const accessor = getAccessor(
        gltf.accessors![target[targetKey]!]!,
        gltf.bufferViews!,
      );
      targets[targetKey]!.push(
        accessor.normalized ? normalizeData(accessor._data) : accessor._data,
      );

      if (!sources[targetKey]) {
        const sourceAccessorIndex = primitive.attributes[targetKey];
        const sourceAccessor =
          sourceAccessorIndex === undefined
            ? undefined
            : gltf.accessors![sourceAccessorIndex];

        if (sourceAccessor?._bufferView) {
          const resolved = getAccessor(sourceAccessor, gltf.bufferViews!);
          sources[targetKey] = resolved.normalized
            ? normalizeData(resolved._data)
            : resolved._data;
        } else {
          // Draco-decoded primitives have no source accessor bufferView.
          const attribute = geometry[targetKey] as
            { data?: TypedArray } | undefined;
          sources[targetKey] = (attribute?.data ?? attribute) as MorphAttribute;
        }
      }
    }
  }

  return { sources, targets, weights: weights ?? [] };
}

/**
 * Resolves a mesh's primitives into `{ geometry, material, morph? }` entries,
 * one per primitive.
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/mesh.schema.json
 */
export async function resolveMesh(
  mesh: GLTF.Mesh,
  instancedAttributes: ResolvedGeometry,
  gltf: ResolvedGltf,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
  options: DracoOptions,
): Promise<ResolvedPrimitive[]> {
  return Promise.all(
    mesh.primitives.map(async (primitive) => {
      const geometry = await resolvePrimitiveGeometry(
        primitive,
        gltf,
        ctx,
        instancedAttributes,
        options,
      );
      const morph = resolvePrimitiveMorphTargets(
        primitive,
        geometry,
        gltf,
        mesh.weights ?? [],
      );
      const material: ResolvedMaterial | Record<string, never> =
        primitive.material === undefined
          ? {}
          : resolveMaterial(
              gltf.materials![primitive.material]!,
              gltf,
              ctx,
              samplerCache,
            );

      return { geometry, material, morph };
    }),
  );
}

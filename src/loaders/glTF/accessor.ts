import {
  GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER,
  WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES,
  GLTF_ACCESSOR_COMPONENT_TYPE_SIZE,
} from "./common.js";

/**
 * Resolves a glTF accessor's data into a typed array (`accessor._data`),
 * caching the result on the accessor object. Handles bufferView byteStride
 * mismatches and sparse accessors.
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/accessor.schema.json
 */
export function getAccessor(accessor: any, bufferViews: any[]): any {
  if (accessor._data) return accessor;

  const numberOfComponents =
    GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER[accessor.type]!;
  if (accessor.byteOffset === undefined) accessor.byteOffset = 0;

  accessor._bufferView = bufferViews[accessor.bufferView];

  const TypedArrayConstructor =
    WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[accessor.componentType]!;
  const byteSize = GLTF_ACCESSOR_COMPONENT_TYPE_SIZE[accessor.componentType]!;

  // Handle bufferView byteStride different from accessor.componentType defined byte size:
  // the accessor's own items sit `byteStride` bytes apart with unrelated bytes (padding
  // or another accessor's data) in between, so each item is copied out individually into
  // a tightly-packed array — every other consumer of `_data` assumes that layout.
  const itemBytes = byteSize * numberOfComponents;
  const byteStride = accessor._bufferView.byteStride;
  if (byteStride && byteStride !== itemBytes) {
    accessor._data = new TypedArrayConstructor(accessor.count * numberOfComponents);
    for (let i = 0; i < accessor.count; i++) {
      accessor._data.set(
        new TypedArrayConstructor(
          accessor._bufferView._data,
          accessor.byteOffset + i * byteStride,
          numberOfComponents,
        ),
        i * numberOfComponents,
      );
    }
  } else {
    accessor._data = new TypedArrayConstructor(
      accessor._bufferView._data,
      accessor.byteOffset,
      accessor.count * numberOfComponents,
    );
  }

  // Sparse accessors
  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/accessor.sparse.schema.json
  if (accessor.sparse !== undefined) {
    const TypedArrayIndicesConstructor =
      WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[
        accessor.sparse.indices.componentType
      ]!;

    const sparseIndices = new TypedArrayIndicesConstructor(
      bufferViews[accessor.sparse.indices.bufferView]._data,
      accessor.sparse.indices.byteOffset || 0,
      accessor.sparse.count,
    );

    const sparseValues = new TypedArrayConstructor(
      bufferViews[accessor.sparse.values.bufferView]._data,
      accessor.sparse.values.byteOffset || 0,
      accessor.sparse.count * numberOfComponents,
    );

    if (accessor._data !== null) {
      accessor._data = accessor._data.slice();
    }

    let valuesIndex = 0;
    for (
      let indicesIndex = 0;
      indicesIndex < sparseIndices.length;
      indicesIndex++
    ) {
      let dataIndex = sparseIndices[indicesIndex]! * numberOfComponents;
      for (
        let componentIndex = 0;
        componentIndex < numberOfComponents;
        componentIndex++
      ) {
        accessor._data[dataIndex++] = sparseValues[valuesIndex++];
      }
    }
  }

  return accessor;
}

import { aabb } from "pex-geom";
import { vec3 } from "pex-math";
import { createBuffer, updateBuffer, isGpuBuffer } from "pex-gpu";
import { NAMESPACE, TEMP_AABB } from "../utils.js";

import type {
  Attributes,
  GpuBuffer,
  GpuContext,
  VertexAttribute,
} from "pex-gpu";
import type {
  AttributeData,
  Entity,
  GeometryAttribute,
  GeometryCache,
  GeometryComponentOptions,
  SystemOptions,
} from "../types.js";

/**
 * An attribute as this system reads it off a component: the declared shapes,
 * plus the `dirty` flag anything mutating vertex data sets — which lands on a
 * plain array as readily as on a descriptor.
 */
type SourceAttribute = GeometryAttribute & { dirty?: boolean };

/**
 * The GPU-backed half of {@link SourceAttribute}, or nothing if it is plain
 * data. Discriminated on the data shapes rather than on `buffer`, which a typed
 * array has of its own.
 */
export const asDescriptor = (attribute: SourceAttribute) =>
  ArrayBuffer.isView(attribute) || Array.isArray(attribute)
    ? undefined
    : attribute;

// Keys match the WGSL vertex input names (see pex-shaders location convention),
// so a cached attribute can be handed straight to a pex-gpu draw command.
const attributeMap: Record<string, string | string[]> = {
  position: "positions",
  normal: "normals",
  tangent: "tangents",
  vertexColor: "vertexColors",
  texCoord0: ["uvs", "texCoords", "uvs0", "texCoords0"],
  texCoord1: ["uvs1", "texCoords1"],
  weight: "weights",
  joint: "joints",

  offset: "offsets",
  scale: "scales",
  rotation: "rotations",
  color: "colors",
};
const attributeMapKeys = Object.keys(attributeMap);
const instancedAttributes = new Set(["offset", "scale", "rotation", "color"]);

const indicesProps = ["cells", "indices"];

/**
 * Vertex data that places a surface, and so needs last frame's values before a
 * motion vector can be written for it: CPU-blended morph targets land in
 * `position`, and animated instancing in the instance transforms.
 */
const deformingAttributes = new Set([
  "position",
  "offset",
  "scale",
  "rotation",
]);
const previousAttributeName = (name: string) =>
  `previous${name[0]!.toUpperCase()}${name.slice(1)}`;

const BYTES_PER_INDEX = { uint16: 2, uint32: 4 } as const;

/**
 * Bytes pex-gpu will write for `data`, mirroring its coercion: a typed array
 * goes as-is, a plain array becomes floats — or indices at the buffer's own
 * format, which updateBuffer converts to.
 */
const uploadByteLength = (data: AttributeData, buffer: GpuBuffer) => {
  if (ArrayBuffer.isView(data)) return data.byteLength;
  const components = Array.isArray(data[0]) ? data[0]!.length : 1;
  return (
    data.length *
    components *
    (buffer.indexFormat
      ? BYTES_PER_INDEX[buffer.indexFormat]
      : Float32Array.BYTES_PER_ELEMENT)
  );
};

/**
 * Upload into `buffer`, or replace it when the data outgrew it: an attribute
 * array can be swapped for a larger one between frames — a geometry builder
 * doubling its capacity — and a GPU buffer cannot be resized in place.
 */
function writeBuffer(
  ctx: GpuContext,
  buffer: GpuBuffer,
  data: AttributeData,
  usage: "vertex" | "index",
) {
  if (uploadByteLength(data, buffer) <= buffer.size) {
    updateBuffer(ctx, buffer, data);
    return buffer;
  }
  buffer.dispose();
  return createBuffer(ctx, {
    usage,
    data,
    ...(buffer.indexFormat && { indexFormat: buffer.indexFormat }),
  });
}

/**
 * Ping-pong `name`'s buffer, so the data it held stays readable as
 * `previous<Name>`.
 *
 * The second buffer is allocated on the first re-upload rather than up front:
 * an attribute written once and never touched again describes a surface that
 * does not deform, and pays nothing. The cost falls only on geometry that
 * actually animates — which is also the only geometry whose previous values
 * anything would want.
 */
function keepPreviousBuffer(
  ctx: GpuContext,
  attributes: Attributes,
  name: string,
  attribute: VertexAttribute,
  data: AttributeData,
) {
  const previousName = previousAttributeName(name);
  const previous = attributes[previousName] as VertexAttribute | undefined;

  // Both halves have to hold the same shape, or the previous-value read runs
  // off the end of the smaller one. A geometry that just changed vertex count
  // has no correspondence to last frame anyway, so a grown attribute restarts
  // both halves from this frame's data.
  const grown =
    uploadByteLength(data, attribute.buffer) > attribute.buffer.size;
  if (grown) {
    attribute.buffer.dispose();
    attribute.buffer = createBuffer(ctx, { usage: "vertex", data });
  }

  if (previous) {
    // Swap, then overwrite the older of the two with this frame's data.
    attributes[previousName] = attribute;
    attributes[name] = previous;

    if (grown) {
      previous.buffer.dispose();
      previous.buffer = createBuffer(ctx, { usage: "vertex", data });
    } else {
      updateBuffer(ctx, previous.buffer, data);
    }
    return previous;
  }

  // First re-upload: the buffer in hand is last frame's, so it becomes the
  // previous and this frame gets a new one.
  attributes[previousName] = attribute;
  return (attributes[name] = {
    ...attribute,
    buffer: createBuffer(ctx, { usage: "vertex", data }),
  });
}

/** The plain data behind an attribute, which may be a GPU-backed descriptor. */
export const attributeData = (attribute: SourceAttribute): AttributeData =>
  asDescriptor(attribute)?.data ?? (attribute as AttributeData);

/**
 * Copies a field onto a cached attribute, removing it when the component has
 * none: pex-gpu reads an absent field as "infer this one", which an explicit
 * `undefined` does not spell in its type.
 */
function setAttributeField<
  K extends "offset" | "arrayStride" | "format" | "stepMode",
>(attribute: VertexAttribute, key: K, value: VertexAttribute[K] | undefined) {
  if (value === undefined) delete attribute[key];
  else attribute[key] = value;
}

function disposeAttribute(
  attribute: GpuBuffer | VertexAttribute | undefined,
): void {
  const buffer =
    (attribute as VertexAttribute | undefined)?.buffer ?? attribute;
  if (isGpuBuffer(buffer)) buffer.dispose();
}

/**
 * Geometry system
 *
 * Adds:
 *
 * - "bounds" to geometry components
 * - "dirty" to geometry components properties
 * - "_geometry" to entities as reference to internal cache
 */
export default ({ ctx }: SystemOptions) => ({
  type: "geometry-system",
  cache: {} as Record<number, GeometryCache>,
  debug: false,
  updateBounds(geometry: GeometryComponentOptions) {
    const positions = attributeData(geometry.positions!)!;
    const offsets = geometry.offsets && attributeData(geometry.offsets);

    const bounds = (geometry.bounds ||= aabb.create());

    // TODO: handle skin system?
    if (offsets?.length) {
      aabb.fromPoints(bounds, offsets);

      aabb.fromPoints(TEMP_AABB, positions);
      vec3.add(bounds[0]!, TEMP_AABB[0]!);
      vec3.add(bounds[1]!, TEMP_AABB[1]!);
    } else {
      aabb.fromPoints(bounds, positions);
    }

    bounds.dirty = false;
  },
  updateGeometryEntity(entity: Entity) {
    const geometry = entity.geometry!;
    // Attributes are reached by the names attributeMap maps to, which the
    // component type spells out one by one rather than as an index signature.
    const source = geometry as unknown as Record<
      string,
      SourceAttribute | undefined
    >;
    // count/instanceCount/indices are filled in below, or left for pex-gpu to
    // infer from the buffers.
    const cachedGeom = (this.cache[entity.id] ||= {
      geometry: null,
      attributes: {},
    } as unknown as GeometryCache);

    if (this.debug && !cachedGeom.geometry) {
      console.debug(
        NAMESPACE,
        this.type,
        "add to cache",
        entity.id,
        cachedGeom,
      );
    }

    const geometryDirty = cachedGeom.geometry !== geometry;

    // Cache geometry properties
    if (geometryDirty) {
      if (this.debug) {
        console.debug(NAMESPACE, this.type, "update", entity.id, geometry);
      }
      cachedGeom.geometry = geometry;

      cachedGeom.instanceCount = geometry.instanceCount!;
      cachedGeom.count = geometry.count!;
      cachedGeom.topology = geometry.topology;

      // Add custom attributes
      if (cachedGeom.customAttributes) {
        for (let i = 0; i < cachedGeom.customAttributes.length; i++) {
          const attributeName = cachedGeom.customAttributes[i]!;
          if (!geometry.attributes?.[attributeName]) {
            disposeAttribute(cachedGeom.attributes[attributeName]);
            delete cachedGeom.attributes[attributeName];
          }
        }
      }

      if (geometry.attributes) {
        Object.assign(cachedGeom.attributes, geometry.attributes);
        cachedGeom.customAttributes = Object.keys(geometry.attributes);
      } else {
        cachedGeom.customAttributes = [];
      }
    }

    // Everything mutated below this system also created, as a descriptor; the
    // union in `Attributes` is there for an attribute handed over as a buffer.
    const cached = cachedGeom.attributes as Record<
      string,
      VertexAttribute | undefined
    >;

    // Add index buffer
    for (let i = 0; i < indicesProps.length; i++) {
      const indicesValue = source[indicesProps[i]!];

      if (indicesValue) {
        if (!(geometryDirty || indicesValue.dirty)) continue;
        indicesValue.dirty = false;

        const descriptor = asDescriptor(indicesValue);
        const given = descriptor?.buffer ?? indicesValue;
        if (isGpuBuffer(given)) {
          cachedGeom.indices = given;
        } else {
          const data = attributeData(indicesValue);
          cachedGeom.indices = cachedGeom.indices
            ? writeBuffer(ctx, cachedGeom.indices, data, "index")
            : createBuffer(ctx, { usage: "index", data });
          cachedGeom.indices.offset = descriptor?.offset;
        }
      }
    }

    const boundsDirty = !geometry.bounds || geometry.bounds.dirty;

    // Add vertex buffers
    for (let i = 0; i < attributeMapKeys.length; i++) {
      const attributeName = attributeMapKeys[i]!;
      const mapping = attributeMap[attributeName]!;
      const attributeValue =
        source[
          Array.isArray(mapping)
            ? (mapping.find((prop) => source[prop]) ?? mapping[0]!)
            : mapping
        ];

      if (attributeValue) {
        if (!(geometryDirty || attributeValue.dirty)) continue;
        attributeValue.dirty = false;

        const descriptor = asDescriptor(attributeValue);
        const data = attributeData(attributeValue); //.data should be deprecated

        // Set the attribute
        const given = descriptor?.buffer ?? attributeValue;
        if (isGpuBuffer(given)) {
          cachedGeom.attributes[attributeName] = descriptor as VertexAttribute;
        } else {
          let attribute = cached[attributeName];
          if (attribute?.buffer) {
            attribute = deformingAttributes.has(attributeName)
              ? keepPreviousBuffer(
                  ctx,
                  cachedGeom.attributes,
                  attributeName,
                  attribute,
                  data,
                )
              : ((attribute.buffer = writeBuffer(
                  ctx,
                  attribute.buffer,
                  data,
                  "vertex",
                )),
                attribute);
          } else {
            attribute = cached[attributeName] = {
              buffer: createBuffer(ctx, { usage: "vertex", data }),
            };
          }

          setAttributeField(attribute, "offset", descriptor?.offset);
          setAttributeField(attribute, "arrayStride", descriptor?.arrayStride);
          setAttributeField(attribute, "format", descriptor?.format);

          // The pair describes the same vertices, so it has to be read the
          // same way.
          const previous = cached[previousAttributeName(attributeName)];
          if (previous) {
            setAttributeField(previous, "offset", attribute.offset);
            setAttributeField(previous, "arrayStride", attribute.arrayStride);
            setAttributeField(previous, "format", attribute.format);
          }
        }

        if (
          descriptor?.stepMode === "instance" ||
          instancedAttributes.has(attributeName)
        ) {
          cached[attributeName]!.stepMode = "instance";
          const previous = cached[previousAttributeName(attributeName)];
          if (previous) previous.stepMode = "instance";
        }
      } else if (cached[attributeName]) {
        disposeAttribute(cached[attributeName]);
        delete cached[attributeName];
      }
    }

    // Compute the bounds
    if (boundsDirty) this.updateBounds(geometry);
  },
  //TODO: should geometry components have their own id?

  //TODO: Use transducers
  //https://gist.github.com/craigdallimore/8b5b9d9e445bfa1e383c569e458c3e26
  update(entities: Entity[]) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      if (entity.geometry) {
        try {
          this.updateGeometryEntity(entity);
          entity._geometry = this.cache[entity.id]!;
        } catch (error) {
          console.error(NAMESPACE, this.type, "update failed", error, entity);
        }
      }
    }
  },
  dispose(entities?: Entity[]) {
    if (entities) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]!;

        if (entity._geometry) {
          if (entity._geometry.indices)
            disposeAttribute(entity._geometry.indices);

          for (const attribute of Object.values(entity._geometry.attributes)) {
            disposeAttribute(attribute);
          }

          delete this.cache[entity.id];
        }
      }
    } else {
      this.cache = {};
    }
  },
});

import { aabb } from "pex-geom";
import { vec3 } from "pex-math";
import { createBuffer, updateBuffer, isGpuBuffer } from "pex-gpu";
import { NAMESPACE, TEMP_AABB } from "../utils.js";

import type { GpuBuffer, GpuContext, VertexAttribute } from "pex-gpu";
import type {
  AttributeData,
  Entity,
  EntityId,
  GeometryAttribute,
  GeometryCache,
  GeometryComponentOptions,
  SystemOptions,
} from "../types.js";

type SourceAttribute = GeometryAttribute & { dirty?: boolean };

type CachedAttributes = GeometryCache["attributes"];

const isAttributeData = (value: unknown): value is AttributeData =>
  ArrayBuffer.isView(value) || Array.isArray(value);

const getAttributeDescriptor = (attribute: SourceAttribute) =>
  isAttributeData(attribute) ? undefined : attribute;

const isAttribute = (value: unknown): value is SourceAttribute | GpuBuffer =>
  isAttributeData(value) ||
  isGpuBuffer(value) ||
  (typeof value === "object" &&
    value !== null &&
    (isGpuBuffer((value as { buffer?: unknown }).buffer) ||
      isAttributeData((value as { data?: unknown }).data)));

export const getAttributeData = (attribute: SourceAttribute): AttributeData =>
  getAttributeDescriptor(attribute)?.data ?? (attribute as AttributeData);

/** Component properties holding vertex data, as opposed to draw state. */
type AttributeProp = {
  [
    K in keyof GeometryComponentOptions
  ]-?: GeometryAttribute extends GeometryComponentOptions[K] ? K : never;
}[keyof GeometryComponentOptions];

// Keys match the WGSL vertex input names (see pex-shaders location convention),
// so a cached attribute can be handed straight to a pex-gpu draw command.
const attributeMap: Record<string, AttributeProp | AttributeProp[]> = {
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

const indicesProps: AttributeProp[] = ["cells", "indices"];

/**
 * Vertex data that places a surface, so a motion vector needs last frame's
 * values: CPU-blended morph targets land in `position`, animated instancing in
 * the instance transforms. Maps to the name the second buffer is cached under.
 */
const previousNames: Record<string, string> = Object.fromEntries(
  ["position", "offset", "scale", "rotation"].map((name) => [
    name,
    `previous${name[0]!.toUpperCase()}${name.slice(1)}`,
  ]),
);

/** Fields that say how pex-gpu reads a buffer, beyond the buffer itself. */
type DescriptorField = keyof Omit<VertexAttribute, "buffer">;

const descriptorFields = [
  "offset",
  "arrayStride",
  "format",
  "stepMode",
] as const satisfies readonly DescriptorField[];

const BYTES_PER_INDEX = { uint16: 2, uint32: 4 } as const;

const buffersPerContext = new WeakMap<GpuContext, WeakSet<GpuBuffer>>();

/**
 * Buffers allocated here, and so writable and disposable here. A descriptor's
 * buffer belongs to whoever built it — a glTF bufferView is shared by every
 * primitive slicing it.
 */
const bufferCache = (ctx: GpuContext) =>
  buffersPerContext.getOrInsertComputed(ctx, () => new WeakSet<GpuBuffer>());

/** Element count pex-gpu will write for `data`: an array of vectors flattens. */
const elementCount = (data: AttributeData) =>
  ArrayBuffer.isView(data)
    ? data.length
    : data.length * (Array.isArray(data[0]) ? data[0]!.length : 1);

/**
 * Bytes pex-gpu writes per element, mirroring its coercion. A new index buffer
 * measures at the widest format its data could take: the format is settled by
 * scanning the values, which only createBuffer does.
 */
function bytesPerElement(
  data: AttributeData,
  usage: "vertex" | "index",
  buffer?: GpuBuffer,
) {
  if (buffer?.indexFormat) return BYTES_PER_INDEX[buffer.indexFormat];
  if (usage === "index") {
    return ArrayBuffer.isView(data)
      ? Math.max(data.BYTES_PER_ELEMENT, BYTES_PER_INDEX.uint16)
      : BYTES_PER_INDEX.uint32;
  }
  return ArrayBuffer.isView(data)
    ? data.BYTES_PER_ELEMENT
    : Float32Array.BYTES_PER_ELEMENT;
}

/** How to allocate, for the calls that may need to. */
interface BufferOptions {
  usage: "vertex" | "index";
  /** Elements to reserve; see `GeometryAttribute.capacity`. */
  capacity?: number | undefined;
  label?: string | undefined;
}

/**
 * Whether `buffer` takes `data` as it stands rather than be replaced. Reserved,
 * it takes anything it has room for; unreserved, it tracks its contents exactly
 * so a draw running past them raises a WebGPU range error naming the buffer,
 * instead of rendering stale geometry.
 */
function shouldReuse(
  buffer: GpuBuffer,
  data: AttributeData,
  count: number,
  { usage, capacity }: BufferOptions,
) {
  if (count * bytesPerElement(data, usage, buffer) > buffer.size) return false;
  return capacity !== undefined || count === buffer.length;
}

/**
 * Upload into `buffer`, allocating one when there is none and replacing it when
 * the data no longer matches: an attribute array can be swapped for another
 * between frames, and a GPU buffer cannot be resized.
 */
function writeBuffer(
  ctx: GpuContext,
  buffer: GpuBuffer | undefined,
  data: AttributeData,
  options: BufferOptions,
) {
  const { usage, capacity, label } = options;
  const count = elementCount(data);

  if (buffer && bufferCache(ctx).has(buffer)) {
    if (shouldReuse(buffer, data, count, options)) {
      updateBuffer(ctx, buffer, data);
      return buffer;
    }
    buffer.dispose();
  }

  const created = createBuffer(ctx, {
    usage,
    data,
    // Doubling past the reservation keeps a growing attribute from
    // reallocating every frame.
    ...(capacity !== undefined && {
      size: Math.max(capacity, count * 2) * bytesPerElement(data, usage),
    }),
    ...(label !== undefined && { label }),
  });
  bufferCache(ctx).add(created);
  return created;
}

function keepPreviousBuffer(
  ctx: GpuContext,
  attributes: CachedAttributes,
  name: string,
  previousName: string,
  attribute: VertexAttribute,
  data: AttributeData,
  options: BufferOptions,
) {
  const previous = attributes[previousName];

  // A geometry that just changed vertex count has no correspondence to last
  // frame, and the two halves would disagree on which vertex is which, so a
  // reshaped attribute restarts both from this frame's data.
  if (attribute.buffer.length !== elementCount(data)) {
    attribute.buffer = writeBuffer(ctx, attribute.buffer, data, options);
  }

  if (previous) {
    // Swap, then overwrite the older of the two with this frame's data.
    attributes[previousName] = attribute;
    attributes[name] = previous;
    previous.buffer = writeBuffer(ctx, previous.buffer, data, options);
    return;
  }

  // First re-upload: the buffer in hand is last frame's, so it becomes the
  // previous and this frame gets a new one. Allocating here rather than up
  // front leaves an attribute that never deforms paying nothing.
  attributes[previousName] = attribute;
  attributes[name] = {
    ...attribute,
    buffer: writeBuffer(ctx, undefined, data, options),
  };
}

function setAttributeField<K extends DescriptorField>(
  attribute: VertexAttribute,
  key: K,
  value: VertexAttribute[K] | undefined,
) {
  if (value === undefined) delete attribute[key];
  else attribute[key] = value;
}

function setAttributeFields(
  attribute: VertexAttribute,
  previous: VertexAttribute | undefined,
  values: { [K in DescriptorField]: VertexAttribute[K] | undefined },
) {
  for (let i = 0; i < descriptorFields.length; i++) {
    const key = descriptorFields[i]!;
    setAttributeField(attribute, key, values[key]);
    if (previous) setAttributeField(previous, key, values[key]);
  }
}

function disposeAttribute(
  ctx: GpuContext,
  attribute: GpuBuffer | VertexAttribute | undefined,
): void {
  const buffer =
    (attribute as VertexAttribute | undefined)?.buffer ?? attribute;
  if (isGpuBuffer(buffer) && bufferCache(ctx).has(buffer)) buffer.dispose();
}

function disposeGeometry(ctx: GpuContext, cachedGeom: GeometryCache) {
  disposeAttribute(ctx, cachedGeom.indices);
  for (const attribute of Object.values(cachedGeom.attributes)) {
    disposeAttribute(ctx, attribute);
  }
}

function removeAttribute(
  ctx: GpuContext,
  attributes: CachedAttributes,
  name: string,
) {
  disposeAttribute(ctx, attributes[name]);
  delete attributes[name];

  const previousName = previousNames[name];
  if (previousName) {
    disposeAttribute(ctx, attributes[previousName]);
    delete attributes[previousName];
  }
}

function updateAttribute(
  ctx: GpuContext,
  cached: CachedAttributes,
  entityId: EntityId,
  name: string,
  value: unknown,
  geometryDirty: boolean,
) {
  if (!isAttribute(value)) return;

  if (isGpuBuffer(value)) {
    if (!geometryDirty) return;
    removeAttribute(ctx, cached, name);
    cached[name] = { buffer: value };
    return;
  }

  if (!(geometryDirty || value.dirty)) return;
  value.dirty = false;

  const previousName = previousNames[name];
  const descriptor = getAttributeDescriptor(value);

  if (descriptor?.buffer) {
    removeAttribute(ctx, cached, name);
    cached[name] = descriptor as VertexAttribute;
  } else {
    const data = getAttributeData(value);
    const attribute = cached[name];
    const options: BufferOptions = {
      usage: "vertex",
      capacity: descriptor?.capacity,
      label: `${entityId} ${name}`,
    };

    if (!attribute?.buffer) {
      cached[name] = { buffer: writeBuffer(ctx, undefined, data, options) };
    } else if (previousName) {
      keepPreviousBuffer(
        ctx,
        cached,
        name,
        previousName,
        attribute,
        data,
        options,
      );
    } else {
      attribute.buffer = writeBuffer(ctx, attribute.buffer, data, options);
    }
  }

  setAttributeFields(
    cached[name]!,
    previousName ? cached[previousName] : undefined,
    {
      offset: descriptor?.offset,
      arrayStride: descriptor?.arrayStride,
      format: descriptor?.format,
      stepMode:
        descriptor?.stepMode ??
        (instancedAttributes.has(name) ? "instance" : undefined),
    },
  );
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
  cache: {} as Record<EntityId, GeometryCache>,
  debug: false,
  updateBounds(geometry: GeometryComponentOptions) {
    const positions = getAttributeData(geometry.positions!)!;
    const offsets = geometry.offsets && getAttributeData(geometry.offsets);

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

    const cachedGeom = (this.cache[entity.id] ||= {
      geometry: null,
      attributes: {},
    } as GeometryCache);
    const cached = cachedGeom.attributes;

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

    // Sync custom attributes
    if (geometryDirty) {
      if (this.debug) {
        console.debug(NAMESPACE, this.type, "update", entity.id, geometry);
      }
      cachedGeom.geometry = geometry;

      if (cachedGeom.customAttributes) {
        for (let i = 0; i < cachedGeom.customAttributes.length; i++) {
          const attributeName = cachedGeom.customAttributes[i]!;
          if (!geometry.attributes?.[attributeName]) {
            removeAttribute(ctx, cached, attributeName);
          }
        }
      }

      cachedGeom.customAttributes = geometry.attributes
        ? Object.keys(geometry.attributes)
        : [];
    }

    cachedGeom.instanceCount = geometry.instanceCount!;
    cachedGeom.count = geometry.count!;
    cachedGeom.topology = geometry.topology;

    // Add index buffer
    const indicesValue: SourceAttribute | undefined =
      geometry[indicesProps.find((prop) => geometry[prop]) ?? indicesProps[0]!];

    if (!indicesValue) {
      if (cachedGeom.indices) {
        disposeAttribute(ctx, cachedGeom.indices);
        cachedGeom.indices = undefined!;
      }
    } else if (geometryDirty || indicesValue.dirty) {
      indicesValue.dirty = false;

      const descriptor = getAttributeDescriptor(indicesValue);
      if (descriptor?.buffer) {
        disposeAttribute(ctx, cachedGeom.indices);
        cachedGeom.indices = descriptor.buffer;
      } else {
        cachedGeom.indices = writeBuffer(
          ctx,
          cachedGeom.indices,
          getAttributeData(indicesValue),
          {
            usage: "index",
            capacity: descriptor?.capacity,
            label: `${entity.id} indices`,
          },
        );
        cachedGeom.indices.offset = descriptor?.offset;
      }
    }

    const boundsDirty = !geometry.bounds || geometry.bounds.dirty;

    // Add vertex buffers
    for (let i = 0; i < attributeMapKeys.length; i++) {
      const attributeName = attributeMapKeys[i]!;
      const mapping = attributeMap[attributeName]!;
      const attributeValue =
        geometry[
          Array.isArray(mapping)
            ? (mapping.find((prop) => geometry[prop]) ?? mapping[0]!)
            : mapping
        ];

      if (attributeValue) {
        updateAttribute(
          ctx,
          cached,
          entity.id,
          attributeName,
          attributeValue,
          geometryDirty,
        );
      } else if (cached[attributeName]) {
        removeAttribute(ctx, cached, attributeName);
      }
    }

    // Add custom attributes
    for (const attributeName in geometry.attributes) {
      updateAttribute(
        ctx,
        cached,
        entity.id,
        attributeName,
        geometry.attributes[attributeName]!,
        geometryDirty,
      );
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
          disposeGeometry(ctx, entity._geometry);
          delete this.cache[entity.id];
        }
      }
    } else {
      for (const cachedGeom of Object.values(this.cache)) {
        disposeGeometry(ctx, cachedGeom);
      }
      this.cache = {};
    }
  },
});

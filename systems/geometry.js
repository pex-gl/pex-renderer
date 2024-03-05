import { aabb } from "pex-geom";
import { vec3 } from "pex-math";
import { NAMESPACE, TEMP_AABB } from "../utils.js";

const attributeMap = {
  aPosition: "positions",
  aNormal: "normals",
  aTangent: "tangents",
  aVertexColor: "vertexColors",
  aTexCoord0: ["uvs", "texCoords", "uvs0", "texCoords0"],
  aTexCoord1: ["uvs1", "texCoords1"],
  aWeight: "weights",
  aJoint: "joints",

  aOffset: "offsets",
  aScale: "scales",
  aRotation: "rotations",
  aColor: "colors",
};
const attributeMapKeys = Object.keys(attributeMap);
const instancedAttributes = ["aOffset", "aScale", "aRotation", "aColor"];

const indicesProps = ["cells", "indices"];

/**
 * Geometry system
 *
 * Adds:
 * - "bounds" to geometry components
 * - "_geometry" to entities as reference to internal cache
 * @param {import("../types.js").SystemOptions} options
 * @returns {import("../types.js").System}
 * @alias module:systems.geometry
 */
export default ({ ctx }) => ({
  type: "geometry-system",
  cache: {},
  debug: false,
  updateBoundingBox(geometry, positions, offsets) {
    if (
      positions instanceof ArrayBuffer ||
      (offsets && offsets instanceof ArrayBuffer)
    ) {
      // If bounds not manually provided or coming from glTF loader
      if (!geometry.bounds) {
        console.warn(
          NAMESPACE,
          this.type,
          `geometry.bounds can't be computed on ArrayBuffer.`,
          geometry,
        );
      }
      return;
    }

    if (geometry.bounds) {
      aabb.empty(geometry.bounds);
    } else {
      geometry.bounds = aabb.create();
    }

    if (!offsets) {
      aabb.fromPoints(geometry.bounds, positions);
    } else {
      aabb.fromPoints(geometry.bounds, offsets);

      aabb.empty(TEMP_AABB);
      aabb.fromPoints(TEMP_AABB, positions);
      vec3.add(geometry.bounds[0], TEMP_AABB[0]);
      vec3.add(geometry.bounds[1], TEMP_AABB[1]);
    }
  },
  updateGeometryEntity(entity) {
    const geometry = entity.geometry;
    this.cache[entity.id] ||= { geometry: null, attributes: {} };

    if (this.debug && !this.cache[entity.id].geometry) {
      console.debug(
        NAMESPACE,
        this.type,
        "add to cache",
        entity.id,
        this.cache[entity.id],
      );
    }

    const cachedGeom = this.cache[entity.id];

    const geometryDirty = cachedGeom.geometry !== geometry;

    // Cache geometry properties
    if (geometryDirty) {
      if (this.debug) {
        console.debug(NAMESPACE, this.type, "update", entity.id, geometry);
      }
      cachedGeom.geometry = geometry;

      cachedGeom.instances = geometry.instances;
      cachedGeom.count = geometry.count;
      cachedGeom.primitive = geometry.primitive;

      // Add custom attributes
      if (cachedGeom.customAttributes) {
        for (let i = 0; i < cachedGeom.customAttributes.length; i++) {
          const attributeName = cachedGeom.customAttributes[i];
          if (!geometry.attributes || !geometry.attributes[attributeName]) {
            ctx.dispose(
              cachedGeom.attributes[attributeName].buffer ||
                cachedGeom.attributes[attributeName],
            );
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

    // Add index buffer
    for (let i = 0; i < indicesProps.length; i++) {
      const indicesValue = geometry[indicesProps[i]];

      if (indicesValue) {
        if (!(geometryDirty || indicesValue.dirty)) continue;

        if (indicesValue.buffer?.class === "indexBuffer") {
          cachedGeom.indices = indicesValue;
        } else {
          cachedGeom.indices ||= ctx.indexBuffer([[1, 1, 1]]);
          ctx.update(cachedGeom.indices, {
            data: indicesValue.data || indicesValue,
          });
          // TODO: why not passing this to ctx.update?
          //TODO: check if mutating indexBuffer here is ok
          cachedGeom.indices.offset = indicesValue.offset;
        }
      }
    }

    // Add vertex buffers
    for (let i = 0; i < attributeMapKeys.length; i++) {
      const attributeName = attributeMapKeys[i];
      const attributeValue =
        geometry[
          Array.isArray(attributeMap[attributeName])
            ? attributeMap[attributeName].find((prop) => geometry[prop])
            : attributeMap[attributeName]
        ];

      if (attributeValue) {
        if (!(geometryDirty || attributeValue.dirty)) continue;

        const data = attributeValue.data || attributeValue; //.data should be deprecated

        // Compute the bounds for geometryDirty and/or updated "positions"/"offsets" (manually setting dirty or from animation/morph system updates)
        // TODO: handle skin system?
        if (attributeName === "aPosition" && !geometry.offsets) {
          this.updateBoundingBox(geometry, data);
        } else if (attributeName === "aOffset" && geometry.positions) {
          this.updateBoundingBox(
            geometry,
            geometry.positions.data || geometry.positions,
            data,
          );
        }

        // Set the attribute
        if (attributeValue.buffer?.class === "vertexBuffer") {
          cachedGeom.attributes[attributeName] = attributeValue;
        } else {
          cachedGeom.attributes[attributeName] ||= {
            buffer: ctx.vertexBuffer([[1, 1, 1]]),
          };

          const attribute = cachedGeom.attributes[attributeName];
          ctx.update(attribute.buffer, { data });

          // TODO: why not passing this to ctx.update?
          attribute.offset = attributeValue.offset;
          attribute.stride = attributeValue.stride;
          attribute.divisor =
            attributeValue.divisor ||
            (instancedAttributes.includes(attributeName) ? 1 : undefined);
        }
      } else if (cachedGeom.attributes[attributeName]) {
        ctx.dispose(
          cachedGeom.attributes[attributeName].buffer ||
            cachedGeom.attributes[attributeName],
        );
        delete cachedGeom.attributes[attributeName];
      }
    }
  },
  //TODO: should geometry components have their own id?

  //TODO: Use transducers
  //https://gist.github.com/craigdallimore/8b5b9d9e445bfa1e383c569e458c3e26
  update(entities) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.geometry) {
        try {
          this.updateGeometryEntity(entity);
          entity._geometry = this.cache[entity.id];
        } catch (error) {
          console.error(NAMESPACE, this.type, "update failed", error, entity);
        }
      }
    }
  },
  dispose(entities) {
    if (entities) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];

        if (entity._geometry) {
          if (entity._geometry.indices) {
            const resource =
              entity._geometry.indices.buffer || entity._geometry.indices;
            if (resource.handle) ctx.dispose(resource);
          }

          for (let attribute of Object.values(entity._geometry.attributes)) {
            const resource = attribute.buffer || attribute;
            if (resource.handle) ctx.dispose(resource);
          }

          delete this.cache[entity.id];
        }
      }
    } else {
      this.cache = {};
    }
  },
});

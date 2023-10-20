import { aabb } from "pex-geom";
import { NAMESPACE } from "../utils.js";

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
 */
export default ({ ctx }) => ({
  type: "geometry-system",
  cache: {},
  debug: false,
  updateGeometry(id, geometry) {
    this.cache[id] ||= { geometry: null, attributes: {} };

    if (this.debug && !this.cache[id].geometry) {
      console.debug(NAMESPACE, this.type, "add to cache", id, this.cache[id]);
    }

    const cachedGeom = this.cache[id];

    const geometryDirty = cachedGeom.geometry !== geometry;

    // Cache geometry properties
    if (geometryDirty) {
      if (this.debug) {
        console.debug(NAMESPACE, this.type, "update", id, geometry);
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

        // Compute the bounds
        const data = attributeValue.data || attributeValue; //.data should be deprecated
        if (
          (attributeName === "aPosition" || attributeName === "aOffset") &&
          !geometry.bounds
          // TODO: should bounds be recomputed when geometryDirty?
          // And leave to user to set geometry.bounds = null when making attribute dirty, only if wanted?
        ) {
          geometry.bounds ||= aabb.create();
          aabb.fromPoints(geometry.bounds, data);
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
          this.updateGeometry(entity.id, entity.geometry);
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

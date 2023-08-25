import { aabb } from "pex-geom";
import { NAMESPACE } from "../utils.js";

const vertexAttributeMap = {
  positions: { attribute: "aPosition" },
  normals: { attribute: "aNormal" },
  tangents: { attribute: "aTangent" },
  vertexColors: { attribute: "aVertexColor" },
  uvs: { attribute: "aTexCoord0" },
  texCoords: { attribute: "aTexCoord0" },
  texCoords0: { attribute: "aTexCoord0" },
  uvs1: { attribute: "aTexCoord1" },
  texCoords1: { attribute: "aTexCoord1" },
  weights: { attribute: "aWeight" },
  joints: { attribute: "aJoint" },
  offsets: { attribute: "aOffset", instanced: true },
  scales: { attribute: "aScale", instanced: true },
  rotations: { attribute: "aRotation", instanced: true },
  colors: { attribute: "aColor", instanced: true },
};

const vertexAttributeProps = Object.keys(vertexAttributeMap);
const indicesProps = ["cells", "indices"];

export default ({ ctx }) => ({
  type: "geometry-system",
  cache: {},
  debug: false,
  updateGeometry(id, geometry) {
    let cachedGeom = this.cache[id];
    if (!cachedGeom) {
      cachedGeom = this.cache[id] = {
        geometry: null,
        attributes: {
          // aPosition: ctx.vertexBuffer([[1, 1, 1]]),
          // aNormal: ctx.vertexBuffer([[1, 1, 1]]),
          // aUV: ctx.vertexBuffer([[1, 1]]),
          // aVertexColor: ctx.vertexBuffer([[1, 1, 1, 1]]),
        },
      };
      if (this.debug) {
        console.debug(
          NAMESPACE,
          this.type,
          "update geometry cache",
          id,
          cachedGeom,
          geometry
        );
      }
    }

    const geometryDirty = cachedGeom.geometry !== geometry;

    // Cache properties
    if (geometryDirty) {
      if (this.debug) {
        console.debug(NAMESPACE, this.type, "update geometry", id, geometry);
      }
      cachedGeom.geometry = geometry;

      cachedGeom.instances = geometry.instances;
      cachedGeom.count = geometry.count;
      cachedGeom.primitive = geometry.primitive;
    }

    for (let indicesPropName of indicesProps) {
      const indicesValue = geometry[indicesPropName];

      if (indicesValue) {
        if (!(geometryDirty || indicesValue.dirty)) continue;

        if (indicesValue.buffer && indicesValue.buffer.class == "indexBuffer") {
          cachedGeom.indices = indicesValue;
        } else {
          if (!cachedGeom.indices) {
            cachedGeom.indices = ctx.indexBuffer([[1, 1, 1]]);
          }
          ctx.update(cachedGeom.indices, {
            data: indicesValue.data || indicesValue,
          });
          //TODO: check if mutating indexBuffer here is ok
          cachedGeom.indices.offset = indicesValue.offset;
        }
      }
    }

    for (let attributePropName of vertexAttributeProps) {
      const attributeValue = geometry[attributePropName];

      if (attributeValue) {
        if (!(geometryDirty || attributeValue.dirty)) continue;

        const data = attributeValue.data || attributeValue;
        // If we have list of vectors we can calculate bounding box otherwise
        if (
          (attributePropName == "positions" ||
            attributePropName == "offsets") &&
          !geometry.bounds
        ) {
          if (Array.isArray(data) && Array.isArray(data[0])) {
            geometry.bounds = aabb.fromPoints(
              geometry.bounds || aabb.create(),
              data
            );
          } else {
            geometry.bounds = aabb.fromPoints(
              geometry.bounds || aabb.create(),
              data
            );
          }
        }

        const { attribute: attributeName, instanced } =
          vertexAttributeMap[attributePropName];

        if (
          attributeValue.buffer &&
          attributeValue.buffer.class == "vertexBuffer"
        ) {
          cachedGeom.attributes[attributeName] = attributeValue;
        } else {
          let attribute = cachedGeom.attributes[attributeName];
          if (!attribute) {
            attribute = cachedGeom.attributes[attributeName] = {
              buffer: ctx.vertexBuffer([[1, 1, 1]]),
            };
          }
          ctx.update(attribute.buffer, {
            data: attributeValue.data || attributeValue, //.data should be deprecated
          });
          attribute.offset = attributeValue.offset;
          attribute.stride = attributeValue.stride;
          attribute.divisor =
            attributeValue.divisor || (instanced ? 1 : undefined);
        }
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

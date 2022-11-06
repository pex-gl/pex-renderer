import { aabb } from "pex-geom";

export default function createGeometrySystem(opts) {
  const ctx = opts.ctx;
  const geometrySystem = {
    cache: {},
    debug: false,
  };

  const vertexAttributeMap = {
    positions: { attribute: "aPosition" },
    normals: { attribute: "aNormal" },
    tangents: { attribute: "aTangent" },
    vertexColors: { attribute: "aVertexColor" },
    uvs: { attribute: "aTexCoord0" },
    texCoords: { attribute: "aTexCoord0" },
    texCoords0: { attribute: "aTexCoord0" },
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

  //TODO: should geometry components have their own id?
  const updateGeometry = (id, geometry) => {
    let cachedGeom = geometrySystem.cache[id];
    if (!cachedGeom) {
      cachedGeom = geometrySystem.cache[id] = {
        geometry: null,
        attributes: {
          // aPosition: ctx.vertexBuffer([[1, 1, 1]]),
          // aNormal: ctx.vertexBuffer([[1, 1, 1]]),
          // aUV: ctx.vertexBuffer([[1, 1]]),
          // aVertexColor: ctx.vertexBuffer([[1, 1, 1, 1]]),
        },
      };
      if (geometrySystem.debug)
        console.debug(
          "geometry-system",
          "update geometry cache",
          id,
          cachedGeom,
          geometry
        );
    }

    // This assumes whole object has changed
    // i could do more detailed checks prop by prop
    if (cachedGeom.geometry !== geometry) {
      if (geometrySystem.debug)
        console.debug("geometry-system", "update geometry", id, geometry);
      cachedGeom.geometry = geometry;

      cachedGeom.instances = geometry.instances;
      cachedGeom.count = geometry.count;
      cachedGeom.primitive = geometry.primitive;

      for (let indicesPropName of indicesProps) {
        const indicesValue = geometry[indicesPropName];
        if (indicesValue) {
          if (
            indicesValue.buffer &&
            indicesValue.buffer.class == "indexBuffer"
          ) {
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
    }
  };

  //TODO: Use transducers
  //https://gist.github.com/craigdallimore/8b5b9d9e445bfa1e383c569e458c3e26

  const update = (geometryEntities) => {
    for (let geometryEntity of geometryEntities) {
      try {
        updateGeometry(geometryEntity.id, geometryEntity.geometry);
        geometryEntity._geometry = geometrySystem.cache[geometryEntity.id];
      } catch (e) {
        geometryEntity.error = `Geometry system update failed due to "${e.message}"`;
        console.error("Geometry update failed", e);
        console.error("Geometry update failed", geometryEntity);
        // renderIn.onTrigger = function () {};
      }
    }
  };

  geometrySystem.update = (entities) => {
    const geometryEntities = entities.filter((e) => e.geometry);
    update(geometryEntities);
  };

  return geometrySystem;
}

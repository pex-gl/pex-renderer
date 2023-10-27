import { mat4, vec3 } from "pex-math";
import { aabb } from "pex-geom";
import {
  NAMESPACE,
  TEMP_AABB,
  TEMP_MAT4,
  TEMP_BOUNDS_POINTS,
} from "../utils.js";

function updateModelMatrix(matrix, transform) {
  mat4.identity(matrix);
  if (transform.position) mat4.translate(matrix, transform.position);
  if (transform.rotation) {
    mat4.mult(matrix, mat4.fromQuat(TEMP_MAT4, transform.rotation));
  }
  if (transform.scale) mat4.scale(matrix, transform.scale);
}

/**
 * Transform system
 *
 * Adds:
 * - "worldBounds", "dirty" and "aabbDirty" to transform components
 * - "_transform" to entities as reference to internal cache
 * @returns {import("../types.js").System}
 */
export default () => ({
  type: "transform-system",
  cache: {},
  debug: false,
  updateModelMatrix,
  sort(entities) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      let parent = entity.transform;
      let depth = 0;
      while (parent) {
        parent = parent.parent;
        if (parent) depth++;
      }
      entity.transform.depth = depth;
    }
    entities.sort((a, b) => a.transform.depth - b.transform.depth);
  },
  updateModelMatrixHierarchy(matrix, transform) {
    mat4.identity(matrix);

    const parents = [];
    let parent = transform;

    while (parent) {
      // && this.cache[parent.entity.id].localModelMatrix) {
      parents.unshift(parent); // TODO: GC
      parent = parent.parent;
    }

    for (let i = 0; i < parents.length; i++) {
      const parent = parents[i];
      //TODO: there are transforms without entities ?
      if (parent.entity) {
        const cachedTransform = this.cache[parent.entity.id];
        //TODO: how this can be null
        if (cachedTransform) {
          mat4.mult(matrix, cachedTransform.localModelMatrix);
        } else {
          console.error(this.type, "missing cachedTransform", parent);
        }
      } else {
        console.error(this.type, "missing entity", parent);
      }
    }
  },
  updateTransformEntity(entity) {
    let isNotCached = false;

    if (!this.cache[entity.id]) {
      this.cache[entity.id] = {
        transform: entity.transform,
        modelMatrix: mat4.create(),
        localModelMatrix: mat4.create(),
        worldPosition: vec3.create(),
      };
      isNotCached = true;
    }

    // TODO: why is it not in this.cache[entity.id]?
    entity.transform.worldBounds ||= aabb.create();
    // TODO: is this ever used?
    // transform.worldPosition ||= vec3.create();

    if (
      // TODO: do we need to check object props in detail or that would be too expensive?
      this.cache[entity.id].transform !== entity.transform ||
      isNotCached ||
      entity.transform.dirty
    ) {
      entity.transform.dirty = false;
      this.cache[entity.id].transform = entity.transform;

      if (this.debug) {
        // console.debug(NAMESPACE, this.type, "update", entity.transform);
      }

      updateModelMatrix(
        this.cache[entity.id].localModelMatrix,
        entity.transform,
      );
    }
  },
  updateBoundingBox(transform) {
    // Get worldBounds from geometry bound and transforming them to world space
    if (
      transform.entity &&
      transform.entity.geometry &&
      transform.entity.geometry.bounds
    ) {
      try {
        if (
          transform.entity.geometry.bounds &&
          !aabb.isEmpty(transform.entity.geometry.bounds)
        ) {
          aabb.getCorners(transform.entity.geometry.bounds, TEMP_BOUNDS_POINTS);
          for (var i = 0; i < TEMP_BOUNDS_POINTS.length; i++) {
            vec3.multMat4(
              TEMP_BOUNDS_POINTS[i],
              this.cache[transform.entity.id].modelMatrix,
            );
          }
          aabb.empty(TEMP_AABB);
          aabb.fromPoints(TEMP_AABB, TEMP_BOUNDS_POINTS);
          aabb.includeAABB(transform.worldBounds, TEMP_AABB);
        }
      } catch (e) {
        debugger;
      }
    }
    // TODO: what if transform is immutable?
    // Add local worldBounds to parent worldBounds
    if (transform.parent?.worldBounds) {
      aabb.includeAABB(transform.parent.worldBounds, transform.worldBounds);
    }

    // TODO: remove? Already done after updateModelMatrixHierarchy
    // vec3.scale(this.cache[transform.entity.id].worldPosition, 0);
    // vec3.multMat4(
    //   this.cache[transform.entity.id].worldPosition,
    //   this.cache[transform.entity.id].modelMatrix
    // );
  },
  update(entities) {
    const transformEntities = entities.filter((entity) => entity.transform);

    // Update local matrix
    for (let i = 0; i < transformEntities.length; i++) {
      const entity = transformEntities[i];
      //TODO: can we use geometry component id, not entity id?
      // Self reference to give access to parent.entity.id
      entity.transform.entity ||= entity;

      this.updateTransformEntity(entity);
      entity._transform = this.cache[entity.id];
    }

    //Note: this is fine as long our components are sorted by depth
    for (let i = 0; i < transformEntities.length; i++) {
      const entity = transformEntities[i];

      // Update world matrix
      if (entity.transform.parent) {
        mat4.set(
          this.cache[entity.id].modelMatrix,
          // TODO: can we only store entity id instead of full reference?
          this.cache[entity.transform.parent.entity.id].modelMatrix,
        );
      } else {
        mat4.identity(this.cache[entity.id].modelMatrix);
      }

      mat4.mult(
        this.cache[entity.id].modelMatrix,
        this.cache[entity.id].localModelMatrix,
      );

      this.updateModelMatrixHierarchy(
        this.cache[entity.id].modelMatrix,
        entity.transform,
      );

      // Update world position
      vec3.scale(this.cache[entity.id].worldPosition, 0);
      vec3.multMat4(
        this.cache[entity.id].worldPosition,
        this.cache[entity.id].modelMatrix,
      );

      // Reset worldBounds
      aabb.empty(entity.transform.worldBounds);
    }

    // Update worldBounds, going backwards from leaves to root
    for (let i = transformEntities.length - 1; i >= 0; i--) {
      const entity = transformEntities[i];
      //TODO: can we not do updateBoundingBox every frame?
      //TODO: check for dirty
      if (
        entity.transform.worldBounds
        // && (entity.transform.aabbDirty || entity.transform.aabbDirty == undefined)
        // && aabb.isEmpty(entity.transform.worldBounds)) {
      ) {
        entity.transform.aabbDirty = false;
        this.updateBoundingBox(entity.transform);
      }
    }
  },
  dispose(entities) {
    if (entities) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (entity.transform) delete this.cache[entity.id];
      }
    } else {
      this.cache = {};
    }
  },
});

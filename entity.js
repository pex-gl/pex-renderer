export let entityCount = 0;

/**
 * Entity
 * @param {object} [components={}]
 * @returns {import("./types.js").Entity}
 * @module Entity
 * @exports module:Entity
 */
export default (components = {}) => {
  if (Array.isArray(components)) {
    throw new Error(
      "Arrays of components are deprecated. Use props object instead."
    );
  }

  return { id: entityCount++, ...components };
};

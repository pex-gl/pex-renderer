export let entityCount = 0;

/**
 * Create an entity
 * @param {import("./types.js").Entity} [components]
 * @returns {import("./types.js").Entity}
 */
export default (components = {}) => {
  if (Array.isArray(components)) {
    throw new Error(
      "Arrays of components are deprecated. Use props object instead.",
    );
  }

  return { id: entityCount++, ...components };
};

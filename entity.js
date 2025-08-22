export let entityCount = 0;

export default (components = {}) => {
  if (Array.isArray(components)) {
    throw new Error(
      "Arrays of components are deprecated. Use props object instead.",
    );
  }

  return { id: entityCount++, ...components };
};

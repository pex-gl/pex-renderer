export let entityCount = 0;

export default function createEntity(components = {}) {
  if (Array.isArray(components)) {
    throw new Error(
      "Arrays of components are deprecated. Use props object instead."
    );
  }

  const entity = {
    id: entityCount++,
    ...components,
  };
  return entity;
}

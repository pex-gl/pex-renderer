import type { Entity } from "./types.js";

export let entityCount = 0;

export default <T extends Record<string, any> = {}>(
  components: T = {} as T,
): Entity & T => {
  if (Array.isArray(components)) {
    throw new TypeError(
      "Arrays of components are deprecated. Use props object instead.",
    );
  }

  return { id: entityCount++, ...components } as Entity & T;
};

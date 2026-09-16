import type { MorphAttribute, MorphComponentOptions } from "../types.js";

/** Morph component */
export default (options: MorphComponentOptions) => ({
  weights: [],
  current:
    options.current ||
    Object.keys(options.sources).reduce(
      (current: Record<string, MorphAttribute>, attribute) => {
        //TODO: MARCIN: is that cloning arrays per attribute? what if they are typed?
        current[attribute] = [...options.sources[attribute]!];
        return current;
      },
      {},
    ),
  ...options,
});

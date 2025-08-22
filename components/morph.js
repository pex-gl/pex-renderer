/**
 * Morph component
 * @param {import("../types.js").MorphComponentOptions} options
 * @returns {object}
 * @alias module:components.morph
 */
export default (options) => ({
  weights: [],
  current:
    options.current ||
    Object.keys(options.sources).reduce((current, attribute) => {
      //TODO: MARCIN: is that cloning arrays per attribute? what if they are typed?
      current[attribute] = [...options.sources[attribute]];
      return current;
    }, {}),
  ...options,
});

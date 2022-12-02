export default function createMorph(opts = {}) {
  return {
    weights: [],
    current:
      opts.current ||
      Object.keys(opts.sources).reduce((current, attribute) => {
        current[attribute] = [...opts.sources[attribute]];
        return current;
      }, {}),
    ...opts,
  };
}

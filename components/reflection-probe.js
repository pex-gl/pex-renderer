export default (opts = {}) => {
  return {
    size: 1024,
    ...opts,
  };
  // return new ReflectionProbe(opts);
};

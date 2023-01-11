export default (opts = {}) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  bias: 0.1,
  castShadows: true,
  ...opts,
});

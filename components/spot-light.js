export default (opts) => ({
  color: [1, 1, 1, 1],
  intensity: 1,
  angle: Math.PI / 4,
  innerAngle: 0,
  range: 10,
  castShadows: true,
  bias: 0.1,
  ...opts,
});

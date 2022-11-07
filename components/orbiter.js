export default function createOrbiter(opts = {}) {
  // return new Orbiter(opts);
  return {
    target: [0, 0, 0],
    lat: 0,
    lon: 0,
    distance: 10,
    ...opts,
  };
}

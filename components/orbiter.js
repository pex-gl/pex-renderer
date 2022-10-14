export default function createOrbiter(opts = {}) {
  // return new Orbiter(opts);
  return {
    target: [0, 0, 0],
    ...opts,
  };
}

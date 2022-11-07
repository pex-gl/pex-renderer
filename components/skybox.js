export default function createSkybox(opts) {
  if (!opts.sunPosition && !opts.texture) {
    throw new Error("Skybox requires either a sunPosition or a texture");
  }
  return {
    backgroundBlur: false,
    ...opts,
  };
}

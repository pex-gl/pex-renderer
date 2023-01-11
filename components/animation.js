export default (opts) => ({
  playing: false,
  loop: false,
  time: 0, // seconds
  channels: [],
  ...opts,
});

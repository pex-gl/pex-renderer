/**
 * Vertex helper component
 * @param {import("../types.js").VertexHelperComponentOptions} [options]
 * @returns {object}
 * @module VertexHelperComponent
 * @exports module:VertexHelperComponent
 */
export default (options) => ({
  color: [0, 1, 0, 1],
  size: 1,
  attribute: "normals",
  ...options,
});

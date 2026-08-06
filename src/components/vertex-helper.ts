import type { VertexHelperComponentOptions } from "../types.js";

/** Vertex helper component */
export default (options?: VertexHelperComponentOptions) => ({
  color: [0, 1, 0, 1],
  size: 1,
  attribute: "normals",
  ...options,
});

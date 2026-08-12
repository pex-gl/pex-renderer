import type { GpuContext } from "../../types.js";

/**
 * Resolves a glTF camera definition into a generic camera data object.
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/camera.schema.json
 */
export function resolveCamera(camera: any, ctx: GpuContext): Record<string, any> {
  if (camera.type === "orthographic") {
    // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/camera.orthographic.schema.json
    return {
      name: camera.name,
      projection: "orthographic",
      near: camera.orthographic.znear,
      far: camera.orthographic.zfar,
      left: -camera.orthographic.xmag,
      right: camera.orthographic.xmag,
      top: camera.orthographic.ymag,
      bottom: -camera.orthographic.ymag,
    };
  }

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/camera.perspective.schema.json
  return {
    name: camera.name,
    projection: "perspective",
    near: camera.perspective.znear,
    far: camera.perspective.zfar ?? Infinity,
    fov: camera.perspective.yfov,
    aspect: camera.perspective.aspectRatio ?? ctx.width / ctx.height,
  };
}

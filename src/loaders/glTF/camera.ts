import type * as GLTF from "types-gltf";
import type { ResolvedCamera } from "./types.js";

/**
 * Resolves a glTF camera definition into a generic camera data object.
 *
 * The aspect ratio is the viewport's, as the camera system derives it:
 * `aspectRatio` and `xmag` are ignored rather than stretching the image.
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/camera.schema.json
 */
export function resolveCamera(camera: GLTF.Camera): ResolvedCamera {
  if (camera.type === "orthographic") {
    // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/camera.orthographic.schema.json
    return {
      name: camera.name,
      projection: "orthographic",
      near: camera.orthographic!.znear,
      far: camera.orthographic!.zfar,
      size: camera.orthographic!.ymag,
    };
  }

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/camera.perspective.schema.json
  return {
    name: camera.name,
    projection: "perspective",
    near: camera.perspective!.znear,
    far: camera.perspective!.zfar ?? Infinity,
    fov: camera.perspective!.yfov,
  };
}

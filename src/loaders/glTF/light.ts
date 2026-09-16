import type { KHR_lights_punctual } from "types-gltf/extensions";
import type { ResolvedLight } from "./types.js";

export type PunctualLight = KHR_lights_punctual.Light & {
  /** Cached result: several nodes may reference the same light. */
  _resolved?: ResolvedLight;
};

/**
 * Resolves a KHR_lights_punctual light definition, caching the result on the
 * light object.
 * https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_lights_punctual
 */
export function resolveLight(light: PunctualLight): ResolvedLight {
  if (light._resolved) return light._resolved;

  light._resolved = {
    type: light.type,
    name: light.name,
    color: light.color ?? [1, 1, 1],
    intensity: light.intensity ?? 1,
    ...((light.type === "point" || light.type === "spot") && {
      range: light.range,
    }),
    ...(light.type === "spot" && {
      innerConeAngle: light.spot?.innerConeAngle ?? 0,
      outerConeAngle: light.spot?.outerConeAngle ?? Math.PI / 4,
    }),
  };

  return light._resolved!;
}

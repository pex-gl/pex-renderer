import { mat4, vec3, vec4 } from "pex-math";
import {
  Y_UP,
  TEMP_VEC4,
  areaPowerToLuminance,
  pointPowerToIntensity,
  spotPowerToIntensity,
} from "../utils.js";

import type { Entity, LightShadowInternals, TransformCache } from "../types.js";

const Z_UP_4 = Object.freeze([0, 0, 1, 0]);

// Frostbite's windowed inverse-square falloff wants 1/range², and an infinite
// range is the window switched off rather than a division by infinity.
const getInvSqrFalloff = (range: number) =>
  Number.isFinite(range) && range > 0 ? 1 / (range * range) : 0;

/**
 * Light system
 *
 * Adds:
 *
 * - "_projectionMatrix" and "_viewMatrix" to light components
 * - "_direction" to directional and spot light components
 * - "_intensity" to every light component: the authored intensity converted to
 *   the unit the shaders integrate (see utils.ts)
 * - "_invSqrFalloff" to point and spot light components
 */
export default () => ({
  type: "light-system",
  updateLight(light: LightShadowInternals, transform?: TransformCache) {
    light._projectionMatrix ??= mat4.create();
    light._viewMatrix ??= mat4.create();

    if (transform) {
      light._direction ??= vec3.create();

      vec4.set(TEMP_VEC4, Z_UP_4 as number[]);

      // Compute direction
      vec4.multMat4(TEMP_VEC4, transform.modelMatrix);
      vec3.set(light._direction, TEMP_VEC4);
      vec3.normalize(light._direction); // TODO: is it needed?

      // Set as target
      vec3.add(TEMP_VEC4, transform.worldPosition);
      // vec4.multMat4(up, lightEntity._transform.modelMatrix);
      mat4.lookAt(
        light._viewMatrix,
        transform.worldPosition,
        TEMP_VEC4,
        Y_UP as number[],
      );
    }
  },
  update(entities: Entity[]) {
    for (let i = 0; i < entities.length; i++) {
      const {
        ambientLight,
        directionalLight,
        spotLight,
        pointLight,
        areaLight,
        transform,
        _transform,
      } = entities[i]!;

      // Luminance already, so the shader takes it as authored.
      if (ambientLight) ambientLight._intensity = ambientLight.intensity!;

      if (directionalLight) {
        this.updateLight(directionalLight, _transform);
        // Illuminance already, so the shader takes it as authored.
        directionalLight._intensity = directionalLight.intensity!;
      }

      if (spotLight) {
        this.updateLight(spotLight, _transform);
        spotLight._intensity = spotPowerToIntensity(
          spotLight.intensity!,
          spotLight.angle!,
          spotLight.focusedSpot,
        );
        spotLight._invSqrFalloff = getInvSqrFalloff(spotLight.range!);
      }

      if (areaLight) {
        this.updateLight(areaLight, _transform);
        // The emitting quad spans the transform's x and y scale.
        const scale = transform?.scale;
        areaLight._intensity = areaPowerToLuminance(
          areaLight.intensity!,
          scale?.[0] ?? 1,
          scale?.[1] ?? 1,
          areaLight.disk,
          areaLight.doubleSided,
        );
      }

      if (pointLight) {
        this.updateLight(pointLight);
        pointLight._intensity = pointPowerToIntensity(pointLight.intensity!);
        pointLight._invSqrFalloff = getInvSqrFalloff(pointLight.range!);
      }
    }
  },
});

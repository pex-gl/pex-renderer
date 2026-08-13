import type { ReflectionProbePrebakedData } from "../../../types.js";

/**
 * Resolves the scene-level `EXT_lights_image_based` reference (unlike
 * KHR_lights_punctual, this extension is scene-scoped, not node-scoped) into
 * pre-baked reflection-probe data. Returns null when the scene doesn't
 * reference one. Image sources are looked up from `gltf.images[]._img`,
 * already decoded by loaders/glTF/texture.ts's resolveImages for the whole
 * document (specularImages indices point into the same images array as
 * regular textures).
 * https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_lights_image_based/
 */
export function resolveLightsImageBased(
  scene: any,
  gltf: any,
): ReflectionProbePrebakedData | null {
  const lightIndex = scene.extensions?.EXT_lights_image_based?.light;
  if (lightIndex === undefined) return null;

  const light = gltf.extensions?.EXT_lights_image_based?.lights?.[lightIndex];
  if (!light) return null;

  return {
    specularImages: light.specularImages.map((mip: number[]) =>
      mip.map((imageIndex) => gltf.images[imageIndex]._img),
    ),
    specularImageSize: light.specularImageSize,
    irradianceCoefficients: light.irradianceCoefficients,
    rotation: light.rotation,
    intensity: light.intensity,
  };
}

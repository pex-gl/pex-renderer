import type { ReflectionProbePrebakedData } from "../../../types.js";
import type * as GLTF from "types-gltf";
import type { ResolvedGltf } from "../types.js";

interface ImageBasedLight {
  /** Indices into the document's images, outer array per mip, inner per face. */
  specularImages: number[][];
  specularImageSize: number;
  irradianceCoefficients: number[][];
  rotation?: number[];
  intensity?: number;
}

/**
 * Resolves the scene-level `EXT_lights_image_based` reference (unlike
 * KHR_lights_punctual, this extension is scene-scoped, not node-scoped) into
 * pre-baked reflection-probe data. Returns null when the scene doesn't
 * reference one. Image sources are looked up from `gltf.images[]._img`, already
 * decoded by loaders/glTF/texture.ts's resolveImages for the whole document
 * (specularImages indices point into the same images array as regular
 * textures).
 * https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_lights_image_based/
 */
export function resolveLightsImageBased(
  scene: GLTF.Scene,
  gltf: ResolvedGltf,
): ReflectionProbePrebakedData | null {
  const reference = scene.extensions?.EXT_lights_image_based as
    { light: number } | undefined;
  if (reference?.light === undefined) return null;

  const extension = gltf.extensions?.EXT_lights_image_based as
    { lights?: ImageBasedLight[] } | undefined;
  const light = extension?.lights?.[reference.light];
  if (!light) return null;

  // resolveImages has already decoded everything the document references.
  const images = gltf.images!;

  return {
    specularImages: light.specularImages.map((mip) =>
      mip.map((imageIndex) => images[imageIndex]!._img!),
    ),
    specularImageSize: light.specularImageSize,
    irradianceCoefficients: light.irradianceCoefficients,
    ...(light.rotation && { rotation: light.rotation }),
    ...(light.intensity !== undefined && { intensity: light.intensity }),
  };
}

import { resolveTexture } from "./texture.js";
import { resolveClearcoat } from "./extensions/KHR_materials_clearcoat.js";
import { resolveSheen } from "./extensions/KHR_materials_sheen.js";
import { resolveTransmission } from "./extensions/KHR_materials_transmission.js";
import { resolveDiffuseTransmission } from "./extensions/KHR_materials_diffuse_transmission.js";
import { resolveVolume } from "./extensions/KHR_materials_volume.js";
import { resolveDispersion } from "./extensions/KHR_materials_dispersion.js";
import { resolveIor } from "./extensions/KHR_materials_ior.js";
import { resolveSpecular } from "./extensions/KHR_materials_specular.js";
import { resolveEmissiveStrength } from "./extensions/KHR_materials_emissive_strength.js";
import { resolveUnlit } from "./extensions/KHR_materials_unlit.js";
import { resolvePbrSpecularGlossiness } from "./extensions/KHR_materials_pbrSpecularGlossiness.js";

import type { GpuContext } from "../../types.js";

/**
 * Resolves a glTF material into a flat, glTF-vocabulary PBR data object
 * (`baseColorFactor`, `metallicFactor`, extension fields like
 * `clearcoatFactor` flattened to the top level, ...) with textures uploaded to
 * GPU. Field names intentionally match the glTF spec, not any pex-renderer
 * component — see loaders/glTF/pex-renderer.ts for the ECS mapping.
 * https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.schema.json
 */
export function resolveMaterial(
  material: any,
  gltf: any,
  ctx: GpuContext,
  samplerCache: Map<number, GPUSampler>,
): Record<string, any> {
  const result: Record<string, any> = {
    name: material.name,
    doubleSided: !!material.doubleSided,
    alphaMode: material.alphaMode ?? "OPAQUE",
    alphaCutoff: material.alphaMode === "MASK" ? (material.alphaCutoff ?? 0.5) : undefined,
    unlit: resolveUnlit(material),
  };

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.pbrMetallicRoughness.schema.json
  const pbrMetallicRoughness = material.pbrMetallicRoughness;
  if (pbrMetallicRoughness) {
    result.baseColorFactor = pbrMetallicRoughness.baseColorFactor ?? [1, 1, 1, 1];
    result.metallicFactor = pbrMetallicRoughness.metallicFactor ?? 1;
    result.roughnessFactor = pbrMetallicRoughness.roughnessFactor ?? 1;
    if (pbrMetallicRoughness.baseColorTexture) {
      result.baseColorTexture = resolveTexture(
        pbrMetallicRoughness.baseColorTexture,
        gltf,
        ctx,
        samplerCache,
        "rgba8unorm-srgb",
      );
    }
    if (pbrMetallicRoughness.metallicRoughnessTexture) {
      result.metallicRoughnessTexture = resolveTexture(
        pbrMetallicRoughness.metallicRoughnessTexture,
        gltf,
        ctx,
        samplerCache,
      );
    }
  }

  Object.assign(
    result,
    resolveClearcoat(material, gltf, ctx, samplerCache),
    resolveSheen(material, gltf, ctx, samplerCache),
    resolveTransmission(material, gltf, ctx, samplerCache),
    resolveDiffuseTransmission(material, gltf, ctx, samplerCache),
    resolveVolume(material, gltf, ctx, samplerCache),
    resolveDispersion(material),
    resolveIor(material),
    resolveSpecular(material, gltf, ctx, samplerCache),
    resolveEmissiveStrength(material),
    resolvePbrSpecularGlossiness(material, gltf, ctx, samplerCache),
  );

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.normalTextureInfo.schema.json
  if (material.normalTexture) {
    result.normalTexture = resolveTexture(
      material.normalTexture,
      gltf,
      ctx,
      samplerCache,
    );
    result.normalTextureScale = material.normalTexture.scale ?? 1;
  }

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.occlusionTextureInfo.schema.json
  if (material.occlusionTexture) {
    result.occlusionTexture = resolveTexture(
      material.occlusionTexture,
      gltf,
      ctx,
      samplerCache,
    );
  }

  if (material.emissiveTexture) {
    result.emissiveTexture = resolveTexture(
      material.emissiveTexture,
      gltf,
      ctx,
      samplerCache,
      "rgba8unorm-srgb",
    );
  }
  if (material.emissiveFactor) {
    result.emissiveFactor = material.emissiveFactor;
  }

  return result;
}

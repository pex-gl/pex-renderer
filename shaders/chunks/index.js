import math from "./math.glsl.js";
import encodeDecode from "./encode-decode.glsl.js";
import rgbm from "./rgbm.glsl.js";
import gamma from "./gamma.glsl.js";
import lightAmbient from "./light-ambient.glsl.js";
import lightDirectional from "./light-directional.glsl.js";
import lightPoint from "./light-point.glsl.js";
import lightSpot from "./light-spot.glsl.js";
import lightArea from "./light-area.glsl.js";
import shadowing from "./shadowing.glsl.js";
import brdf from "./brdf.glsl.js";
import clearCoat from "./clear-coat.glsl.js";
import irradiance from "./irradiance.glsl.js";
import direct from "./direct.glsl.js";
import indirect from "./indirect.glsl.js";
import envMapEquirect from "./env-map-equirect.glsl.js";
import octMap from "./oct-map.glsl.js";
import octMapUvToDir from "./oct-map-uv-to-dir.glsl.js";
import textureCoordinates from "./texture-coordinates.glsl.js";
import baseColor from "./base-color.glsl.js";
import emissiveColor from "./emissive-color.glsl.js";
import alpha from "./alpha.glsl.js";
import ambientOcclusion from "./ambient-occlusion.glsl.js";
import normal from "./normal.glsl.js";
import normalPerturb from "./normal-perturb.glsl.js";
import metallicRoughness from "./metallic-roughness.glsl.js";
import specularGlossiness from "./specular-glossiness.glsl.js";
import depthRead from "./depth-read.glsl.js";
import depthUnpack from "./depth-unpack.glsl.js";
import depthPack from "./depth-pack.glsl.js";
import sky from "./sky.glsl.js";
import fog from "./fog.glsl.js";
import tonemapUncharted2 from "./tonemap-uncharted2.glsl.js";
import fxaa from "./fxaa.glsl.js";

export default {
  math,

  encodeDecode,
  rgbm,
  gamma,

  lightAmbient,
  lightDirectional,
  lightPoint,
  lightSpot,
  lightArea,
  shadowing,
  brdf,
  clearCoat,
  irradiance,
  direct,
  indirect,

  envMapEquirect,
  octMap,
  octMapUvToDir,

  textureCoordinates,
  baseColor,
  emissiveColor,
  alpha,
  ambientOcclusion,
  normal,
  normalPerturb,

  metallicRoughness,
  specularGlossiness,

  depthRead,
  depthUnpack,
  depthPack,

  sky,
  fog,
  tonemapUncharted2,
  fxaa,
};

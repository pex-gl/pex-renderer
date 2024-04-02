import { loadImage, loadArrayBuffer } from "pex-io";
import { aabb } from "pex-geom";
import { utils } from "pex-math";
import normals from "angle-normals";
import centerAndNormalize from "geom-center-and-normalize";
import parseHdr from "parse-hdr";

import * as d from "./assets/models/stanford-dragon/stanford-dragon.js";

export function getURL(url) {
  return new URL(url, import.meta.url).toString();
}

export const getEnvMap = async (ctx, url) => {
  const hdrImg = parseHdr(await loadArrayBuffer(getURL(url)));

  return ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    min: ctx.Filter.Linear,
    mag: ctx.Filter.Linear,
    flipY: true,
  });
};

export async function getTexture(ctx, file, encoding, options = {}) {
  const tex = ctx.texture2D({
    width: 1,
    height: 1,
  });
  try {
    const image = await loadImage(file);
    ctx.update(tex, {
      data: image,
      width: image.width,
      height: image.height,
      wrap: ctx.Wrap.Repeat,
      flipY: true,
      mag: ctx.Filter.Linear,
      min: ctx.Filter.LinearMipmapLinear,
      mipmap: true,
      aniso: 16,
      pixelFormat: ctx.PixelFormat.RGBA8,
      encoding: encoding || ctx.Encoding.Linear,
      ...options,
    });
    return tex;
  } catch (error) {
    console.error(error);
  }
  return tex;
}

export function updateSunPosition(skybox, elevation, azimuth) {
  const phi = utils.toRadians(90 - elevation);
  const theta = utils.toRadians(azimuth);
  skybox.sunPosition = [
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
    -Math.sin(phi) * Math.cos(theta),
  ];
}

export function debugSceneTree(entities) {
  // entities.forEach((e) => {
  //   if (!e.transform) return;

  //   let depth = 0;
  //   let parent = e.transform.parent;
  //   while (parent) {
  //     depth++;
  //     parent = parent.parent;
  //   }
  //   console.log(
  //     " ".repeat(depth * 5),
  //     e.id,
  //     e.transform?.worldBounds ? aabb.toString(e.transform.worldBounds) : "[]",
  //     e
  //   );
  // });

  entities.forEach((e, i) => {
    let pad = "";
    let transform = e.transform;
    while (transform) {
      pad += "--";
      transform = transform.parent;
    }
    const bbox = e.transform?.worldBounds
      ? aabb.toString(e.transform.worldBounds)
      : "[]";
    console.log(`${pad} ${i} ${e.name} | BBOX: ${bbox}`, e);
  });
  // console.log(s);
  // console.log("world.entities", world.entities);
}

const dragon = { ...d };
dragon.positions = centerAndNormalize(dragon.positions);
dragon.normals = normals(dragon.cells, dragon.positions);
dragon.uvs = dragon.positions.map(() => [0, 0]);

export { dragon };

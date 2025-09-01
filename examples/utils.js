import { loadImage } from "pex-io";
import { loadHdr, loadUltraHdr } from "pex-loaders";
import { aabb } from "pex-geom";
import { utils } from "pex-math";
import normals from "angle-normals";
import centerAndNormalize from "geom-center-and-normalize";

import * as d from "./assets/models/stanford-dragon/stanford-dragon.js";

export function getURL(url) {
  return new URL(url, import.meta.url).toString();
}

export const getEnvMap = async (ctx, url) => {
  if (url.endsWith(".jpg")) return await loadUltraHdr(ctx, getURL(url));

  return await loadHdr(ctx, getURL(url));
};

export async function getTexture(ctx, file, encoding, options = {}) {
  const tex = ctx.texture2D({
    width: 1,
    height: 1,
    pixelFormat:
      encoding === ctx.Encoding.SRGB
        ? ctx.PixelFormat.SRGB8_ALPHA8
        : ctx.PixelFormat.RGBA8,
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

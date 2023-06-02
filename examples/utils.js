import { loadImage } from "pex-io";
import { aabb } from "pex-geom";
import * as Primitives from "primitive-geometry";
import normals from "angle-normals";
import centerAndNormalize from "geom-center-and-normalize";

import * as d from "./assets/models/stanford-dragon/stanford-dragon.js";

export function getURL(url) {
  return new URL(url, import.meta.url).toString();
}

export async function getTexture(ctx, file, encoding) {
  const tex = ctx.texture2D({
    width: 1,
    height: 1,
    pixelFormat: ctx.PixelFormat.RGBA8,
    encoding: ctx.Encoding.SRGB,
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
      aniso: 16,
      pixelFormat: ctx.PixelFormat.RGBA8,
      encoding,
    });
    ctx.update(tex, { mipmap: true });
    return tex;
  } catch (error) {
    console.error(error);
  }
  return tex;
}

export function computeEdges({ length }, cells, stride = 3) {
  const edges = new (Primitives.utils.getCellsTypedArray(length / 3))(
    cells.length * 2
  );

  let cellIndex = 0;

  for (let i = 0; i < cells.length; i += stride) {
    for (let j = 0; j < stride; j++) {
      const a = cells[i + j];
      const b = cells[i + ((j + 1) % stride)];
      edges[cellIndex] = Math.min(a, b);
      edges[cellIndex + 1] = Math.max(a, b);
      cellIndex += 2;
    }
  }
  return edges;
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

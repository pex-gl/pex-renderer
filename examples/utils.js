import { loadImage } from "pex-io";
import { aabb } from "pex-geom";
import { mat4, quat } from "pex-math";
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
      encoding: encoding || ctx.Encoding.Linear,
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

const TEMP_MAT4 = mat4.create();

export function mat4FromPointToPoint(
  a,
  [eyex, eyey, eyez],
  [targetx, targety, targetz],
  [upx, upy, upz] = Y_UP
) {
  let z0 = targetx - eyex;
  let z1 = targety - eyey;
  let z2 = targetz - eyez;

  let len = z0 * z0 + z1 * z1 + z2 * z2;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
    z0 *= len;
    z1 *= len;
    z2 *= len;
  }

  let x0 = upy * z2 - upz * z1;
  let x1 = upz * z0 - upx * z2;
  let x2 = upx * z1 - upy * z0;

  len = x0 * x0 + x1 * x1 + x2 * x2;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
    x0 *= len;
    x1 *= len;
    x2 *= len;
  }

  upx = z1 * x2 - z2 * x1;
  upy = z2 * x0 - z0 * x2;
  upz = z0 * x1 - z1 * x0;

  len = upx * upx + upy * upy + upz * upz;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
    upx *= len;
    upy *= len;
    upz *= len;
  }

  a[0] = x0;
  a[1] = x1;
  a[2] = x2;
  a[3] = 0;
  a[4] = upx;
  a[5] = upy;
  a[6] = upz;
  a[7] = 0;
  a[8] = z0;
  a[9] = z1;
  a[10] = z2;
  a[11] = 0;
  a[12] = 0;
  a[13] = 0;
  a[14] = 0;
  a[15] = 1;
  return a;
}
export function quatFromPointToPoint(a, eye, target, up) {
  return quat.fromMat4(a, mat4FromPointToPoint(TEMP_MAT4, eye, target, up));
}

const dragon = { ...d };
dragon.positions = centerAndNormalize(dragon.positions);
dragon.normals = normals(dragon.cells, dragon.positions);
dragon.uvs = dragon.positions.map(() => [0, 0]);

export { dragon };

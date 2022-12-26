import { vec3 } from "pex-math";
import { aabb } from "pex-geom";
import { loadImage } from "pex-io";
import * as Primitives from "primitive-geometry";
import normals from "angle-normals";

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

export function centerAndNormalize(positions) {
  const result = aabb.create();
  aabb.fromPoints(result, positions);
  const center = aabb.center(result);
  const size = aabb.size(result);
  const scale = Math.max(size[0], Math.max(size[1], size[2]));

  const newPositions = [];
  for (let i = 0; i < positions.length; i++) {
    const p = vec3.copy(positions[i]);
    vec3.sub(p, center);
    vec3.scale(p, 1 / scale);
    newPositions.push(p);
  }
  return newPositions;
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

export function computeNormals(positions, cells) {
  const normals = [];

  const count = [];
  const ab = [0, 0, 0];
  const ac = [0, 0, 0];
  const n = [0, 0, 0];

  for (let fi = 0; fi < cells.length / 3; fi++) {
    const f = cells.slice(fi * 3, fi * 3 + 3);
    const a = positions.slice(f[0] * 3, f[0] * 3 + 3);
    const b = positions.slice(f[1] * 3, f[1] * 3 + 3);
    const c = positions.slice(f[2] * 3, f[2] * 3 + 3);

    vec3.normalize(vec3.sub(vec3.set(ab, b), a));
    vec3.normalize(vec3.sub(vec3.set(ac, c), a));
    vec3.normalize(vec3.cross(vec3.set(n, ab), ac));

    for (let i = 0; i < f.length; i++) {
      if (!normals[f[i]]) {
        normals[f[i]] = [0, 0, 0];
      }

      vec3.add(normals[f[i]], n);
      count[f[i]] = count[f[i]] ? 1 : count[f[i]] + 1;
    }
  }

  for (let i = 0; i < normals.length; i++) {
    if (normals[i]) {
      vec3.normalize(normals[i]);
    } else {
      normals[i] = [0, 1, 0];
    }
  }

  return Float32Array.from(normals.flat());
}

const dragon = { ...d };
dragon.positions = centerAndNormalize(dragon.positions);
dragon.normals = normals(dragon.cells, dragon.positions);
dragon.uvs = dragon.positions.map(() => [0, 0]);

export { dragon };

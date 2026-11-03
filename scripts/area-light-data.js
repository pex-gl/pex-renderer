// Generates src/systems/renderer/area-light-data.js from the LTC fit published
// with:
//
//   Real-Time Polygonal-Light Shading with Linearly Transformed Cosines.
//   Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt.
//   ACM Transactions on Graphics (Proceedings of ACM SIGGRAPH 2016) 35(4), 2016.
//   Project page: https://eheitzresearch.wordpress.com/415-2/
//
// The tables are uploaded as rgba16float, so they are packed to half floats here
// rather than at load time: the bytes match what pex-gpu would produce from the
// number arrays, at a third of the size.
//
//   node scripts/area-light-data.js

import { writeFile } from "node:fs/promises";

const COMMIT = "5c0770b74114b5dd38e9dae1b93f8486af7eac1b";
const SIZE = 64 * 64 * 4;

const url = `https://raw.githubusercontent.com/selfshadow/ltc_code/${COMMIT}/fit/results/ltc.js`;
const response = await fetch(url);
if (!response.ok) throw new Error(`${url}: ${response.status}`);
const source = await response.text();

const tables = Object.fromEntries(
  [...source.matchAll(/var (g_ltc_\d) = \[([\s\S]*?)\];/g)].map(
    ([, name, values]) => [
      name,
      values
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map(Number),
    ],
  ),
);

const encode = (name) => {
  const values = tables[name];
  if (values?.length !== SIZE || values.some(Number.isNaN)) {
    throw new Error(`${name}: expected ${SIZE} numbers`);
  }
  // WebGPU uploads are little-endian, as is every platform running this.
  const halves = new Float16Array(values);
  return new Uint8Array(
    halves.buffer,
    halves.byteOffset,
    halves.byteLength,
  ).toBase64();
};

await writeFile(
  new URL("../src/systems/renderer/area-light-data.js", import.meta.url),
  `const decode = (base64) => {
  const bytes = Uint8Array.fromBase64(base64);
  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
};

export const g_ltc_1 = decode(
  "${encode("g_ltc_1")}",
);
export const g_ltc_2 = decode(
  "${encode("g_ltc_2")}",
);
`,
);

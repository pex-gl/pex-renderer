declare module "parse-hdr" {
  interface ParsedHdr {
    shape: [width: number, height: number];
    exposure: number;
    gamma: number;
    data: Float32Array;
  }

  function parseHdr(buffer: ArrayBuffer): ParsedHdr;

  export default parseHdr;
}

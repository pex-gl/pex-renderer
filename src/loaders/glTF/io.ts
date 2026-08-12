import { MAGIC, CHUNK_TYPE } from "./common.js";

function uint8ArrayToArrayBuffer({
  buffer,
  byteOffset,
  byteLength,
}: Uint8Array): ArrayBuffer {
  return (buffer as ArrayBuffer).slice(byteOffset, byteLength + byteOffset);
}

class BinaryReader {
  _arrayBuffer: ArrayBuffer;
  _dataView: DataView;
  _byteOffset: number;

  constructor(arrayBuffer: ArrayBuffer) {
    this._arrayBuffer = arrayBuffer;
    this._dataView = new DataView(arrayBuffer);
    this._byteOffset = 0;
  }

  getPosition(): number {
    return this._byteOffset;
  }

  getLength(): number {
    return this._arrayBuffer.byteLength;
  }

  readUint32(): number {
    const value = this._dataView.getUint32(this._byteOffset, true);
    this._byteOffset += 4;
    return value;
  }

  readUint8Array(length: number): Uint8Array {
    const value = new Uint8Array(this._arrayBuffer, this._byteOffset, length);
    this._byteOffset += length;
    return value;
  }

  skipBytes(length: number): void {
    this._byteOffset += length;
  }
}

/**
 * Unpack a GLB (binary glTF) buffer into its JSON and BIN chunks.
 * https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#glb-file-format-specification
 */
function unpackBinary(data: ArrayBuffer): { json: string; bin: Uint8Array | null } {
  const binaryReader = new BinaryReader(data);

  // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#header
  const magic = binaryReader.readUint32();
  if (magic !== MAGIC) throw new Error(`Unexpected magic: ${magic}`);

  const version = binaryReader.readUint32();
  if (version !== 2) throw new Error(`Unsupported version: ${version} `);

  const length = binaryReader.readUint32();
  if (length !== binaryReader.getLength()) {
    throw new Error(
      `Length in header does not match actual data length: ${length} != ${binaryReader.getLength()}`,
    );
  }

  // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#chunks
  const chunkLength = binaryReader.readUint32();
  const chunkType = binaryReader.readUint32();
  if (chunkType !== CHUNK_TYPE.JSON) {
    throw new Error("First chunk format is not JSON");
  }

  const buffer = binaryReader.readUint8Array(chunkLength);
  const json =
    typeof TextDecoder === "undefined"
      ? Array.from(buffer, (byte) => String.fromCharCode(byte)).join("")
      : new TextDecoder().decode(buffer);

  let bin: Uint8Array | null = null;
  while (binaryReader.getPosition() < binaryReader.getLength()) {
    const chunkLength = binaryReader.readUint32();
    const chunkType = binaryReader.readUint32();

    switch (chunkType) {
      case CHUNK_TYPE.JSON: {
        throw new Error("Unexpected JSON chunk");
      }
      case CHUNK_TYPE.BIN: {
        bin = binaryReader.readUint8Array(chunkLength);
        break;
      }
      default: {
        binaryReader.skipBytes(chunkLength);
        break;
      }
    }
  }

  return { json, bin };
}

/** Splits raw input (GLB ArrayBuffer, or already-parsed/loaded JSON) into { json, bin }. */
export function loadData(data: ArrayBuffer | object): {
  json: any;
  bin?: ArrayBuffer | undefined;
} {
  if (data instanceof ArrayBuffer) {
    const unpacked = unpackBinary(data);
    return {
      json: JSON.parse(unpacked.json),
      bin: unpacked.bin ? uint8ArrayToArrayBuffer(unpacked.bin) : undefined,
    };
  }

  return { json: data };
}

export function isBase64(uri: string): boolean {
  return uri.length >= 5 && uri.slice(0, 5) === "data:";
}

export function decodeBase64(uri: string): ArrayBuffer {
  const decodedString = atob(uri.split(",", 2)[1]!);
  const bufferLength = decodedString.length;
  const bufferView = new Uint8Array(new ArrayBuffer(bufferLength));

  for (let i = 0; i < bufferLength; i++) {
    bufferView[i] = decodedString.charCodeAt(i);
  }

  return bufferView.buffer;
}

const loadJSON = require('pex-io/loadJSON')
const loadImage = require('pex-io/loadImage')
const loadBinary = require('pex-io/loadBinary')
const path = require('path')

function uint8ArrayToArrayBuffer(arr) {
  return arr.buffer.slice(arr.byteOffset, arr.byteLength + arr.byteOffset)
}

class BinaryReader {
  constructor (arrayBuffer) {
    this._arrayBuffer = arrayBuffer
    this._dataView = new DataView(arrayBuffer)
    this._byteOffset = 0
  }

  getPosition () {
    return this._byteOffset
  }

  getLength () {
    return this._arrayBuffer.byteLength
  }

  readUint32 () {
    const value = this._dataView.getUint32(this._byteOffset, true)
    this._byteOffset += 4
    return value
  }

  readUint8Array (length) {
    const value = new Uint8Array(this._arrayBuffer, this._byteOffset, length)
    this._byteOffset += length
    return value
  }

  skipBytes (length) {
    this._byteOffset += length
  }
}

function unpackBinary (data) {
  const MAGIC = 0x46546C67
  const CHUNK_TYPE = {
    JSON: 0x4E4F534A,
    BIN: 0x004E4942
  }
  const binaryReader = new BinaryReader(data)

  // Check header
  // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#header
  // uint32 magic
  // uint32 version
  // uint32 length
  const magic = binaryReader.readUint32()
  if (magic !== MAGIC) throw new Error(`Unexpected magic: ${magic}`)

  const version = binaryReader.readUint32()
  if (version !== 2) throw new Error(`Unsupported version: ${version} `)

  const length = binaryReader.readUint32()
  if (length !== binaryReader.getLength()) {
    throw new Error(
      `Length in header does not match actual data length: ${length} != ${binaryReader.getLength()}`
    )
  }

  // Decode chunks
  // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#chunks
  // uint32 chunkLength
  // uint32 chunkType
  // ubyte[] chunkData

  // JSON
  const chunkLength = binaryReader.readUint32()
  const chunkType = binaryReader.readUint32()
  if (chunkType !== CHUNK_TYPE.JSON) throw new Error('First chunk format is not JSON')

  // Decode Buffer to Text
  const buffer = binaryReader.readUint8Array(chunkLength)

  let json
  if (typeof TextDecoder !== 'undefined') {
    json = new TextDecoder().decode(buffer)
  } else {
    let result = ''
    const length = buffer.byteLength

    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(buffer[i])
    }
    json = result
  }

  // BIN
  let bin = null
  while (binaryReader.getPosition() < binaryReader.getLength()) {
    const chunkLength = binaryReader.readUint32()
    const chunkType = binaryReader.readUint32()

    switch (chunkType) {
      case CHUNK_TYPE.JSON: {
        throw new Error('Unexpected JSON chunk')
      }
      case CHUNK_TYPE.BIN: {
        bin = binaryReader.readUint8Array(chunkLength)
        break
      }
      default: {
        binaryReader.skipBytes(chunkLength)
        break
      }
    }
  }

  return {
    json: json,
    bin: bin
  }
}

function loadData (data) {
  if (data instanceof ArrayBuffer) {
    const unpacked = unpackBinary(data)

    return {
      json: JSON.parse(unpacked.json),
      bin: uint8ArrayToArrayBuffer(unpacked.bin)
    }
  }

  return { json: data }
}

function isBase64 (uri) {
  return uri.length < 5 ? false : uri.substr(0, 5) === 'data:';
}

function decodeBase64 (uri) {
  const decodedString = atob(uri.split(',')[1])
  const bufferLength = decodedString.length
  const bufferView = new Uint8Array(new ArrayBuffer(bufferLength))

  for (let i = 0; i < bufferLength; i++) {
    bufferView[i] = decodedString.charCodeAt(i);
  }

  return bufferView.buffer
}

async function loadGltf (url) {
  const extension = path.extname(url)
  const basePath = path.dirname(url)
  const isBinary = extension === '.glb'

  const { json, bin } = loadData(isBinary ? await loadBinary(url) : await loadJSON(url))

  for (let buffer of json.buffers) {
    if (isBinary) {
      buffer._data = bin
    } else {
      if (isBase64(buffer.uri)) {
        buffer._data = decodeBase64(buffer.uri)
      } else {
        buffer._data = await loadBinary(path.join(basePath, buffer.uri))
      }
    }
  }

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#uris
  if (json.images) {
    for (let image of json.images) {
      if (isBinary) {
        const bufferView = json.bufferViews[image.bufferView]
        bufferView.byteOffset = bufferView.byteOffset || 0
        const buffer = json.buffers[bufferView.buffer]
        const data = buffer._data.slice(
          bufferView.byteOffset,
          bufferView.byteOffset + bufferView.byteLength
        )
        const blob = new Blob([data], { type: image.mimeType })
        const uri = URL.createObjectURL(blob)
        image._img = await loadImage({ url: uri, crossOrigin: 'anonymous' })
      } else {
        if (isBase64(image.uri)) {
          image._img = await loadImage({ url: image.uri, crossOrigin: 'anonymous' })
        } else {
          // TODO why are we replacing uri encoded spaces?
          image._img = await loadImage({ url: path.join(basePath, image.uri).replace(/%/g, '%25'), crossOrigin: 'anonymous' })
        }
      }
    }
  }

  return json
}

module.exports = loadGltf

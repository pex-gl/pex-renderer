const { loadBinary } = require('pex-io')
const {
  read: readKTX,
  KTX2ChannelETC1S,
  KTX2ChannelUASTC,
  KTX2Flags,
  KTX2Model,
  KTX2SupercompressionScheme,
  KTX2Transfer
} = require('ktx-parse')
const { ZSTDDecoder } = require('zstddec')

const loadBasis = require('./basis.js')
const BasisFormat = loadBasis.BasisFormat

let zstd
let zstdPending

const getAlpha = (dfd) => {
  if (dfd.colorModel === KTX2Model.UASTC) {
    if ((dfd.samples[0].channelID & 0xf) === KTX2ChannelUASTC.RGBA) {
      return true
    }
    return false
  }

  if (
    dfd.samples.length === 2 &&
    (dfd.samples[1].channelID & 0xf) === KTX2ChannelETC1S.AAA
  ) {
    return true
  }
  return false
}

// Load
// - KTX: http://github.khronos.org/KTX-Specification/
// - DFD: https://www.khronos.org/registry/DataFormat/specs/1.3/dataformat.1.3.html#basicdescriptor
async function loadKtx2(data, gl, { basisOptions = {} } = {}) {
  const buffer = data instanceof ArrayBuffer ? data : await loadBinary(data)

  const ktx = readKTX(new Uint8Array(buffer))

  if (ktx.pixelDepth > 0) {
    throw new Error('Only 2D textures are currently supported.')
  }

  if (ktx.layerCount > 1) {
    throw new Error('Array textures are not currently supported.')
  }

  if (ktx.faceCount > 1) {
    throw new Error('Cube textures are not currently supported.')
  }

  const isZstd = ktx.supercompressionScheme === KTX2SupercompressionScheme.ZSTD
  if (isZstd && !zstd) {
    zstd = new ZSTDDecoder()
    zstdPending = zstd.init()
  }
  await zstdPending

  // Get levels
  const levels = []
  const width = ktx.pixelWidth
  const height = ktx.pixelHeight

  for (let levelIndex = 0; levelIndex < ktx.levels.length; levelIndex++) {
    const levelWidth = Math.max(1, Math.floor(width / 2 ** levelIndex))
    const levelHeight = Math.max(1, Math.floor(height / 2 ** levelIndex))
    let levelData = ktx.levels[levelIndex].levelData

    if (isZstd) {
      levelData = zstd.decode(
        levelData,
        ktx.levels[levelIndex].uncompressedByteLength
      )
    }

    levels.push({
      index: levelIndex,
      width: levelWidth,
      height: levelHeight,
      data: levelData
    })
  }

  // Basic Data Format Descriptor Block is always the first DFD.
  const dfd = ktx.dataFormatDescriptor[0]

  // Parse basis
  const basisFormat =
    dfd.colorModel === KTX2Model.UASTC
      ? BasisFormat.UASTC_4x4
      : BasisFormat.ETC1S

  const parseConfig = {
    levels,
    width: ktx.pixelWidth,
    height: ktx.pixelHeight,
    basisFormat,
    hasAlpha: getAlpha(dfd),
    lowLevel: true
  }

  if (basisFormat === BasisFormat.ETC1S) {
    parseConfig.globalData = ktx.globalData
  }

  return (
    // Load regular basis
    loadBasis(
      Array.from(
        levels.reduce((buffers, level) => {
          buffers.add(level.data.buffer)
          return buffers
        }, new Set())
      ),
      gl,
      {
        ...basisOptions,
        transcodeConfig: parseConfig
      }
    )
      // Add extra ktx props
      .then((texture) => ({
        ...texture,
        // srgb or linear
        encoding: dfd.transferFunction === KTX2Transfer.SRGB ? 3 : 1,
        premultiplyAlpha: !!(dfd.flags & KTX2Flags.ALPHA_PREMULTIPLIED)
      }))
  )
}

module.exports = loadKtx2

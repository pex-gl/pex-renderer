/* global BASIS */

function BasisWorker(InternalFormat, TranscoderFormat, BasisFormat) {
  let config
  let transcoderPending
  let BasisModule

  onmessage = (e) => {
    const message = e.data

    switch (message.type) {
      case 'init':
        config = message.config
        transcoderPending = new Promise((resolve) => {
          BasisModule = {
            wasmBinary: config.wasmBinary,
            onRuntimeInitialized: resolve
          }
          BASIS(BasisModule)
        }).then(() => {
          BasisModule.initializeBasis()
        })
        break

      case 'decode':
        transcoderPending.then(() => {
          try {
            const { width, height, hasAlpha, data, internalFormat } = message
              .taskConfig.lowLevel
              ? transcodeLowLevel(message.taskConfig)
              : transcode(message.buffers[0])

            const buffers = []

            for (let i = 0; i < data.length; ++i) {
              buffers.push(data[i].data.buffer)
            }

            self.postMessage(
              {
                type: 'decode',
                id: message.id,
                width,
                height,
                hasAlpha,
                data,
                internalFormat
              },
              buffers
            )
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error)

            self.postMessage({
              type: 'error',
              id: message.id,
              error: error.message
            })
          }
        })
        break
    }
  }

  function transcodeLowLevel(taskConfig) {
    const { basisFormat, width, height, hasAlpha } = taskConfig

    const { transcoderFormat, internalFormat } = getTranscoderFormat(
      basisFormat,
      width,
      height,
      hasAlpha
    )

    const blockByteLength = BasisModule.getBytesPerBlockOrPixel(
      transcoderFormat
    )

    if (!BasisModule.isFormatSupported(transcoderFormat)) {
      throw new Error(`BasisWorker: Unsupported format ${transcoderFormat}.`)
    }

    const data = []

    if (basisFormat === BasisFormat.ETC1S) {
      const transcoder = new BasisModule.LowLevelETC1SImageTranscoder()

      const {
        endpointCount,
        endpointsData,
        selectorCount,
        selectorsData,
        tablesData
      } = taskConfig.globalData

      try {
        let status = false
        status = transcoder.decodePalettes(
          endpointCount,
          endpointsData,
          selectorCount,
          selectorsData
        )
        if (!status) throw new Error('BasisWorker: decodePalettes() failed.')

        status = transcoder.decodeTables(tablesData)
        if (!status) throw new Error('BasisWorker: decodeTables() failed.')

        for (let i = 0; i < taskConfig.levels.length; i++) {
          const level = taskConfig.levels[i]
          const imageDesc = taskConfig.globalData.imageDescs[i]

          const dstByteLength = getTranscodedImageByteLength(
            transcoderFormat,
            level.width,
            level.height
          )
          const dst = new Uint8Array(dstByteLength)

          const status = transcoder.transcodeImage(
            transcoderFormat,
            dst,
            dstByteLength / blockByteLength,
            level.data,
            getWidthInBlocks(transcoderFormat, level.width),
            getHeightInBlocks(transcoderFormat, level.height),
            level.width,
            level.height,
            level.index,
            imageDesc.rgbSliceByteOffset,
            imageDesc.rgbSliceByteLength,
            imageDesc.alphaSliceByteOffset,
            imageDesc.alphaSliceByteLength,
            imageDesc.imageFlags,
            hasAlpha,
            false,
            0,
            0
          )

          if (!status) {
            throw new Error(
              `BasisWorker: transcodeImage() failed for level ${level.index}.`
            )
          }

          data.push({
            data: dst,
            width: level.width,
            height: level.height
          })
        }
      } finally {
        transcoder.delete()
      }
    } else {
      for (let i = 0; i < taskConfig.levels.length; i++) {
        const level = taskConfig.levels[i]

        const dstByteLength = getTranscodedImageByteLength(
          transcoderFormat,
          level.width,
          level.height
        )
        const dst = new Uint8Array(dstByteLength)

        const status = BasisModule.transcodeUASTCImage(
          transcoderFormat,
          dst,
          dstByteLength / blockByteLength,
          level.data,
          getWidthInBlocks(transcoderFormat, level.width),
          getHeightInBlocks(transcoderFormat, level.height),
          level.width,
          level.height,
          level.index,
          0,
          level.data.byteLength,
          0,
          hasAlpha,
          false,
          0,
          0,
          -1,
          -1
        )

        if (!status) {
          throw new Error(
            `BasisWorker: transcodeUASTCImage() failed for level ${
              level.index
            }.`
          )
        }

        data.push({ data: dst, width: level.width, height: level.height })
      }
    }

    return { width, height, hasAlpha, data, internalFormat }
  }

  function transcode(buffer) {
    const basisFile = new BasisModule.BasisFile(new Uint8Array(buffer))

    const basisFormat = basisFile.isUASTC()
      ? BasisFormat.UASTC_4x4
      : BasisFormat.ETC1S
    const width = basisFile.getImageWidth(0, 0)
    const height = basisFile.getImageHeight(0, 0)
    const levels = basisFile.getNumLevels(0)
    const hasAlpha = basisFile.getHasAlpha()

    function cleanup() {
      basisFile.close()
      basisFile.delete()
    }

    const { transcoderFormat, internalFormat } = getTranscoderFormat(
      basisFormat,
      width,
      height,
      hasAlpha
    )

    if (!width || !height || !levels) {
      cleanup()
      throw new Error('BasisWorker:	Invalid texture.')
    }

    if (!basisFile.startTranscoding()) {
      cleanup()
      throw new Error('BasisWorker: .startTranscoding failed.')
    }

    const data = []

    for (let mip = 0; mip < levels; mip++) {
      const mipWidth = basisFile.getImageWidth(0, mip)
      const mipHeight = basisFile.getImageHeight(0, mip)
      const dst = new Uint8Array(
        basisFile.getImageTranscodedSizeInBytes(0, mip, transcoderFormat)
      )

      const status = basisFile.transcodeImage(
        dst,
        0,
        mip,
        transcoderFormat,
        0,
        hasAlpha
      )

      if (!status) {
        cleanup()
        throw new Error('BasisWorker: .transcodeImage failed.')
      }

      data.push({ data: dst, width: mipWidth, height: mipHeight })
    }

    cleanup()

    return { width, height, hasAlpha, data, internalFormat }
  }

  const FORMAT_OPTIONS = [
    {
      if: 'astcSupported',
      basisFormat: [BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.ASTC_4x4, TranscoderFormat.ASTC_4x4],
      internalFormat: [
        InternalFormat.RGBA_ASTC_4x4_Format,
        InternalFormat.RGBA_ASTC_4x4_Format
      ],
      priorityETC1S: Infinity,
      priorityUASTC: 1,
      needsPowerOfTwo: false
    },
    {
      if: 'bptcSupported',
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.BC7_M5, TranscoderFormat.BC7_M5],
      internalFormat: [
        InternalFormat.RGBA_BPTC_Format,
        InternalFormat.RGBA_BPTC_Format
      ],
      priorityETC1S: 3,
      priorityUASTC: 2,
      needsPowerOfTwo: false
    },
    {
      if: 'dxtSupported',
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.BC1, TranscoderFormat.BC3],
      internalFormat: [
        InternalFormat.RGB_S3TC_DXT1_Format,
        InternalFormat.RGBA_S3TC_DXT5_Format
      ],
      priorityETC1S: 4,
      priorityUASTC: 5,
      needsPowerOfTwo: false
    },
    {
      if: 'etc2Supported',
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.ETC1, TranscoderFormat.ETC2],
      internalFormat: [
        InternalFormat.RGB_ETC2_Format,
        InternalFormat.RGBA_ETC2_EAC_Format
      ],
      priorityETC1S: 1,
      priorityUASTC: 3,
      needsPowerOfTwo: false
    },
    {
      if: 'etc1Supported',
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.ETC1, TranscoderFormat.ETC1],
      internalFormat: [
        InternalFormat.RGB_ETC1_Format,
        InternalFormat.RGB_ETC1_Format
      ],
      priorityETC1S: 2,
      priorityUASTC: 4,
      needsPowerOfTwo: false
    },
    {
      if: 'pvrtcSupported',
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [
        TranscoderFormat.PVRTC1_4_RGB,
        TranscoderFormat.PVRTC1_4_RGBA
      ],
      internalFormat: [
        InternalFormat.RGB_PVRTC_4BPPV1_Format,
        InternalFormat.RGBA_PVRTC_4BPPV1_Format
      ],
      priorityETC1S: 5,
      priorityUASTC: 6,
      needsPowerOfTwo: true
    }
  ]

  const ETC1S_OPTIONS = FORMAT_OPTIONS.sort(
    (a, b) => a.priorityETC1S - b.priorityETC1S
  )
  const UASTC_OPTIONS = FORMAT_OPTIONS.sort(
    (a, b) => a.priorityUASTC - b.priorityUASTC
  )

  function getTranscoderFormat(basisFormat, width, height, hasAlpha) {
    let transcoderFormat
    let internalFormat

    const options =
      basisFormat === BasisFormat.ETC1S ? ETC1S_OPTIONS : UASTC_OPTIONS

    for (let i = 0; i < options.length; i++) {
      const opt = options[i]

      if (!config[opt.if]) continue
      if (!opt.basisFormat.includes(basisFormat)) continue
      if (opt.needsPowerOfTwo && !(isPowerOfTwo(width) && isPowerOfTwo(height)))
        continue

      transcoderFormat = opt.transcoderFormat[hasAlpha ? 1 : 0]
      internalFormat = opt.internalFormat[hasAlpha ? 1 : 0]

      return { transcoderFormat, internalFormat }
    }

    // eslint-disable-next-line no-console
    console.warn(
      'BasisWorker: No suitable compressed texture format found. Decoding to RGBA32.'
    )

    transcoderFormat = TranscoderFormat.RGBA32
    internalFormat = InternalFormat.RGBAFormat

    return { transcoderFormat, internalFormat }
  }

  function getWidthInBlocks(transcoderFormat, width) {
    return Math.ceil(width / BasisModule.getFormatBlockWidth(transcoderFormat))
  }

  function getHeightInBlocks(transcoderFormat, height) {
    return Math.ceil(
      height / BasisModule.getFormatBlockHeight(transcoderFormat)
    )
  }

  function getTranscodedImageByteLength(transcoderFormat, width, height) {
    const blockByteLength = BasisModule.getBytesPerBlockOrPixel(
      transcoderFormat
    )

    if (BasisModule.formatIsUncompressed(transcoderFormat)) {
      return width * height * blockByteLength
    }

    if (
      transcoderFormat === TranscoderFormat.PVRTC1_4_RGB ||
      transcoderFormat === TranscoderFormat.PVRTC1_4_RGBA
    ) {
      // GL requires extra padding for very small textures:
      // https://www.khronos.org/registry/OpenGL/extensions/IMG/IMG_texture_compression_pvrtc.txt
      const paddedWidth = (width + 3) & ~3
      const paddedHeight = (height + 3) & ~3

      return (Math.max(8, paddedWidth) * Math.max(8, paddedHeight) * 4 + 7) / 8
    }

    return (
      getWidthInBlocks(transcoderFormat, width) *
      getHeightInBlocks(transcoderFormat, height) *
      blockByteLength
    )
  }

  function isPowerOfTwo(value) {
    if (value <= 2) return true

    return (value & (value - 1)) === 0 && value !== 0
  }
}

module.exports = BasisWorker

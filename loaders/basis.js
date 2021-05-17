const { loadBinary } = require('pex-io')

const BasisWorker = require('./basis-worker.js')
const WorkerPool = require('./worker-pool.js')

let workerPool

// Constants
const BasisFormat = {
  ETC1S: 0,
  UASTC_4x4: 1
}

const TranscoderFormat = {
  ETC1: 0,
  ETC2: 1,
  BC1: 2,
  BC3: 3,
  BC4: 4,
  BC5: 5,
  BC7_M6_OPAQUE_ONLY: 6,
  BC7_M5: 7,
  PVRTC1_4_RGB: 8,
  PVRTC1_4_RGBA: 9,
  ASTC_4x4: 10,
  ATC_RGB: 11,
  ATC_RGBA_INTERPOLATED_ALPHA: 12,
  RGBA32: 13,
  RGB565: 14,
  BGR565: 15,
  RGBA4444: 16
}

const InternalFormat = {
  // RGBAFormat: 1023,
  RGBAFormat: 6408, // gl.RGBA
  RGBA_ASTC_4x4_Format: 37808,
  RGBA_BPTC_Format: 36492,
  RGBA_ETC2_EAC_Format: 37496,
  RGBA_PVRTC_4BPPV1_Format: 35842,
  RGBA_S3TC_DXT5_Format: 33779,
  RGB_ETC1_Format: 36196,
  RGB_ETC2_Format: 37492,
  RGB_PVRTC_4BPPV1_Format: 35840,
  RGB_S3TC_DXT1_Format: 33776
}

// Decoder API
let transcoderPending

const getWorkerStringUrl = (transcoder, worker) => {
  const str = `const _InternalFormat = ${JSON.stringify(InternalFormat)}
const _TranscoderFormat = ${JSON.stringify(TranscoderFormat)}
const _BasisFormat = ${JSON.stringify(BasisFormat)}
${transcoder}
${worker}
BasisWorker(_InternalFormat, _TranscoderFormat, _BasisFormat)
`
  return URL.createObjectURL(new Blob([str]))
}

const getTranscoder = async (transcoderPath) =>
  transcoderPending ||
  Promise.all([
    getWorkerStringUrl(
      await (await fetch(`${transcoderPath}basis_transcoder.js`)).text(),
      BasisWorker.toString()
    ),
    await (await fetch(`${transcoderPath}basis_transcoder.wasm`)).arrayBuffer()
  ])

// Texture creation
const loadCompressedTexture = async (buffers, taskConfig = {}) => {
  const taskKey = JSON.stringify(taskConfig)

  const cachedTask = workerPool.hasTask(taskKey, buffers[0])
  if (cachedTask) return cachedTask

  let worker
  let taskId
  let taskCost = 0

  for (let i = 0; i < buffers.length; i++) {
    taskCost += buffers[i].byteLength
  }

  const texturePending = workerPool
    .getWorker(transcoderPending, taskCost)
    .then((workerData) => {
      ;({ worker: worker, taskId: taskId } = workerData)

      return new Promise((resolve, reject) => {
        worker._callbacks[taskId] = { resolve, reject }

        worker.postMessage(
          {
            type: 'decode',
            id: taskId,
            taskConfig,
            buffers
          },
          buffers
        )
      })
    })
    .then((message) => {
      const { type, id, hasAlpha, ...texture } = message

      return {
        compressed: texture.internalFormat !== InternalFormat.RGBAFormat,
        ...texture
      }
    })

  // Remove task from the task list.
  texturePending
    .catch(() => true)
    .then(() => {
      if (worker && taskId) {
        workerPool.releaseTask(worker, taskId)
      }
    })

  workerPool.taskCache.set(buffers[0], {
    key: taskKey,
    promise: texturePending
  })

  return texturePending
}

// Load
async function loadBasis(
  data,
  gl,
  {
    transcoderPath = 'assets/',
    transcodeConfig = {},
    workerLimit,
    workerConfig = {
      astcSupported: !!gl.getExtension('WEBGL_compressed_texture_astc'),
      etc1Supported: !!gl.getExtension('WEBGL_compressed_texture_etc1'),
      etc2Supported: !!gl.getExtension('WEBGL_compressed_texture_etc'),
      dxtSupported: !!gl.getExtension('WEBGL_compressed_texture_s3tc'),
      bptcSupported: !!gl.getExtension('EXT_texture_compression_bptc'),
      pvrtcSupported:
        !!gl.getExtension('WEBGL_compressed_texture_pvrtc') ||
        !!gl.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc')
    }
  } = {}
) {
  if (!workerPool) workerPool = new WorkerPool(workerLimit, workerConfig)

  transcoderPending = getTranscoder(transcoderPath)

  const hasManyBuffers = Array.isArray(data)

  const buffers = hasManyBuffers
    ? data
    : data instanceof ArrayBuffer
    ? [data]
    : [await loadBinary(data)]

  return await loadCompressedTexture(buffers, transcodeConfig)
}

module.exports = loadBasis
module.exports.BasisFormat = BasisFormat

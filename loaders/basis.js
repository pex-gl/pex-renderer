const { loadBinary } = require('pex-io')

const BasisWorker = require('./basis-worker.js')

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

// Worker pool helper
let workerLimit
let workerConfig = null

let workerPool = []
let workerNextTaskID = 1
const taskCache = new WeakMap()

const getWorker = async (taskCost) => {
  const [workerSourceURL, transcoderBinary] = await transcoderPending

  if (workerPool.length < workerLimit) {
    const worker = new Worker(workerSourceURL)

    worker._callbacks = {}
    worker._taskLoad = 0

    worker.postMessage({
      type: 'init',
      config: workerConfig,
      transcoderBinary
    })

    worker.onmessage = function(e) {
      const message = e.data

      switch (message.type) {
        case 'transcode':
          const { type, id, hasAlpha, ...texture } = message
          worker._callbacks[message.id].resolve({
            compressed: texture.internalFormat !== InternalFormat.RGBAFormat,
            ...texture
          })
          break
        case 'error':
          worker._callbacks[message.id].reject(message)
          break
        default:
          // eslint-disable-next-line no-console
          console.error(message)
      }
    }

    workerPool.push(worker)
  } else {
    workerPool.sort((a, b) => (a._taskLoad > b._taskLoad ? -1 : 1))
  }

  const worker = workerPool[workerPool.length - 1]
  worker._taskLoad += taskCost
  return worker
}

// Texture creation
const loadCompressedTexture = async (buffers, config) => {
  let worker
  let taskID

  let taskConfig = config || {}
  let taskCost = 0

  for (let i = 0; i < buffers.length; i++) {
    taskCost += buffers[i].byteLength
  }

  const texturePending = getWorker(taskCost).then((_worker) => {
    worker = _worker
    taskID = workerNextTaskID++

    return new Promise((resolve, reject) => {
      worker._callbacks[taskID] = { resolve, reject }

      worker.postMessage(
        {
          type: 'transcode',
          id: taskID,
          buffers: buffers,
          taskConfig: taskConfig
        },
        buffers
      )
    })
  })

  // Note: replaced '.finally()' with '.catch().then()' block - iOS 11 support (#19416)
  texturePending
    .catch(() => true)
    .then(() => {
      if (worker && taskID) {
        worker._taskLoad -= taskCost
        delete worker._callbacks[taskID]
      }
    })

  taskCache.set(buffers[0], { promise: texturePending })

  return texturePending
}

// Load
async function loadBasis(
  data,
  gl,
  {
    transcoderPath = 'assets/',
    transcodeConfig = {},
    workerLimit: limit = 4,
    workerConfig: config = {}
  } = {}
) {
  workerLimit = limit
  workerConfig = {
    astcSupported: !!gl.getExtension('WEBGL_compressed_texture_astc'),
    etc1Supported: !!gl.getExtension('WEBGL_compressed_texture_etc1'),
    etc2Supported: !!gl.getExtension('WEBGL_compressed_texture_etc'),
    dxtSupported: !!gl.getExtension('WEBGL_compressed_texture_s3tc'),
    bptcSupported: !!gl.getExtension('EXT_texture_compression_bptc'),
    pvrtcSupported:
      !!gl.getExtension('WEBGL_compressed_texture_pvrtc') ||
      !!gl.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc'),
    ...config
  }

  transcoderPending = getTranscoder(transcoderPath)

  const hasManyBuffers = Array.isArray(data)

  const buffers = hasManyBuffers
    ? data
    : data instanceof ArrayBuffer
    ? [data]
    : [await loadBinary(data)]

  // TODO: same logic for many buffers
  if (!hasManyBuffers && taskCache.has(buffers[0])) {
    const cachedTask = taskCache.get(buffers[0])
    return cachedTask.promise
  }

  return await loadCompressedTexture(buffers, transcodeConfig)
}

module.exports = loadBasis
module.exports.BasisFormat = BasisFormat

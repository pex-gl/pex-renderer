const promisify = require('util.promisify')
const loadJSON = promisify(require('pex-io/loadJSON'))
const loadImage = promisify(require('pex-io/loadImage'))
const loadBinary = promisify(require('pex-io/loadBinary'))
const path = require('path')

async function loadGltf (file, cb) {
  console.log('loadModel', file)

  const gltf = await loadJSON(file)
  const basePath = path.dirname(file) // TODO: fill this work with urls?

  for (let buffer of gltf.buffers) {
    const uri = path.join(basePath, buffer.uri)
    buffer._data = await loadBinary(uri)
  }

  if (gltf.images) {
    for (let image of gltf.images) {
      const uri = path.join(basePath, image.uri).replace(/%/g, '%25') // TODO why are we replacing uri encoded spaces?
      image._img = await loadImage(uri)
    }
  }

  if (cb) {
    cb(null, gltf)
  }

  return gltf
}

module.exports = loadGltf

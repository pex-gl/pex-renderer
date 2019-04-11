const loadJSON = require('pex-io/loadJSON')
const loadImage = require('pex-io/loadImage')
const loadBinary = require('pex-io/loadBinary')
const path = require('path')

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#uris
async function loadGltf (file, cb) {
  const gltf = await loadJSON(file)
  const basePath = path.dirname(file) // TODO: fill this work with urls?

  for (let buffer of gltf.buffers) {
    const uri = path.join(basePath, buffer.uri)
    buffer._data = await loadBinary(uri)
  }

  if (gltf.images) {
    for (let image of gltf.images) {
      const uri = path.join(basePath, image.uri).replace(/%/g, '%25') // TODO why are we replacing uri encoded spaces?
      image._img = await loadImage({ url: uri, crossOrigin: 'anonymous' })
    }
  }

  if (cb) {
    cb(null, gltf)
  }

  return gltf
}

module.exports = loadGltf

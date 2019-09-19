const Signal = require('signals')
const vec3 = require('pex-math').vec3

function CameraHelper(opts) {
  this.type = 'CameraHelper'
  this.entity = null
  this.color = [1, 0, 0, 1]
  this.changed = new Signal()
  this.dirty = false
  this.enabled = true

  if (opts) this.set(opts)
}

// this function gets called when the component is added
// to an enity
CameraHelper.prototype.init = function(entity) {
  this.entity = entity
}

CameraHelper.prototype.set = function(opts) {
  Object.assign(this, opts)
  this.dirty = true
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

CameraHelper.prototype.update = function() {
  if (!this.dirty) return
  this.dirty = false
}

CameraHelper.prototype.getBBoxPositionsList = function(bbox) {
  return [
    [bbox[0][0], bbox[0][1], bbox[0][2]],
    [bbox[1][0], bbox[0][1], bbox[0][2]],
    [bbox[0][0], bbox[0][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[0][1], bbox[0][2]],
    [bbox[0][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[1][2]],
    [bbox[0][0], bbox[1][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[1][2]],
    [bbox[1][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[0][2]],
    [bbox[1][0], bbox[0][1], bbox[0][2]],
    [bbox[1][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[0][1], bbox[0][2]],
    [bbox[1][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[0][2]],
    [bbox[1][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[1][2]],
    [bbox[0][0], bbox[0][1], bbox[1][2]],
    [bbox[0][0], bbox[1][1], bbox[1][2]],
    [bbox[0][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[0][1], bbox[1][2]]
  ]
}

CameraHelper.prototype.draw = function(geomBuilder, camera) {
  cType = this.entity.getComponent('Camera')
  if (cType.projection == 'orthographic') {
    let orthoTransform = this.entity.getComponent('Transform')

    let left =
      (cType.right + cType.left) / 2 -
      (cType.right - cType.left) / (2 / cType.zoom)
    let right =
      (cType.right + cType.left) / 2 +
      (cType.right - cType.left) / (2 / cType.zoom)
    let top =
      (cType.top + cType.bottom) / 2 +
      (cType.top - cType.bottom) / (2 / cType.zoom)
    let bottom =
      (cType.top + cType.bottom) / 2 -
      (cType.top - cType.bottom) / (2 / cType.zoom)

    if (cType.view) {
      const zoomW =
        1 / cType.zoom / (cType.view.size[0] / cType.view.totalSize[0])
      const zoomH =
        1 / cType.zoom / (cType.view.size[1] / cType.view.totalSize[1])
      const scaleW = (cType.right - cType.left) / cType.view.size[0]
      const scaleH = (cType.top - cType.bottom) / cType.view.size[1]

      left += scaleW * (cType.view.offset[0] / zoomW)
      right = left + scaleW * (cType.view.size[0] / zoomW)
      top -= scaleH * (cType.view.offset[1] / zoomH)
      bottom = top - scaleH * (cType.view.size[1] / zoomH)
    }
    let orthoHelperPositions = this.getBBoxPositionsList([
      [left, top, -cType.near],
      [right, bottom, -cType.far]
    ])
    orthoHelperPositions.forEach((pos) => {
      geomBuilder.addPosition(
        vec3.multMat4(vec3.copy(pos), orthoTransform.modelMatrix)
      )
      geomBuilder.addColor(this.color)
    })
  }
  if (cType.projection == 'perspective') {
    const perspectiveCameraTransform = this.entity.getComponent('Transform')

    const farCenter = [0, 0, cType.far]
    const nearCenter = [0, 0, cType.near]

    const nearHeight = 2 * Math.tan(cType.fov / 2) * cType.near
    const farHeight = 2 * Math.tan(cType.fov / 2) * cType.far

    const nearWidth = nearHeight * cType.aspect
    const farWidth = farHeight * cType.aspect

    const farTopLeft = [-(farWidth * 0.5), farHeight * 0.5, -cType.far]
    const farTopRight = [farWidth * 0.5, farHeight * 0.5, -cType.far]
    const farBottomLeft = [-(farWidth * 0.5), -(farHeight * 0.5), -cType.far]
    const farBottomRight = [farWidth * 0.5, -(farHeight * 0.5), -cType.far]

    const nearTopLeft = [-(nearWidth * 0.5), nearHeight * 0.5, -cType.near]
    const nearTopRight = [nearWidth * 0.5, nearHeight * 0.5, -cType.near]
    const nearBottomLeft = [
      -(nearWidth * 0.5),
      -(nearHeight * 0.5),
      -cType.near
    ]
    const nearBottomRight = [nearWidth * 0.5, -(nearHeight * 0.5), -cType.near]

    const perspectiveCameraHelperPositions = [
      [0, 0, 0],
      farTopLeft,
      [0, 0, 0],
      farTopRight,
      [0, 0, 0],
      farBottomLeft,
      [0, 0, 0],
      farBottomRight,

      farTopLeft,
      farTopRight,
      farTopRight,
      farBottomRight,
      farBottomRight,
      farBottomLeft,
      farBottomLeft,
      farTopLeft,

      nearTopLeft,
      nearTopRight,
      nearTopRight,
      nearBottomRight,
      nearBottomRight,
      nearBottomLeft,
      nearBottomLeft,
      nearTopLeft
    ]
    perspectiveCameraHelperPositions.forEach((pos) => {
      geomBuilder.addPosition(
        vec3.multMat4(vec3.copy(pos), perspectiveCameraTransform.modelMatrix)
      )
      geomBuilder.addColor(this.color)
    })
  }
}

// by pex-renderer convention we export factory function
// instead of the class type
module.exports = function createCameraHelper(opts) {
  return new CameraHelper(opts)
}

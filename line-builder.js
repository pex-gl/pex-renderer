const Vec2 = require('pex-math/Vec2')
const Vec3 = require('pex-math/Vec3')
const Vec4 = require('pex-math/Vec4')

function LineBuilder () {
  this._positions = []
  this._colors = []
  this._indices = []

  this.reset()
}

LineBuilder.prototype.reset = function () {
  if (!this._positions) this._positions = []
  if (!this._colors) this._colors = []
  if (!this._indices) this._indices = []

  this.lineIndex = 0

  const positions = this._positions
  const colors = this._colors
  const indices = this._indices

  for (let i = 0, len = positions.length; i < len; i++) {
    var p = positions[i]
    p[0] = 0
    p[1] = 0
    p[2] = 0
    var c = colors[i]
    c[0] = 0
    c[1] = 0
    c[2] = 0
    c[3] = 0
    var line = indices[i]
    // there is 2x less lines than points
    if (line) {
      line[0] = 0
      line[1] = 0
    }
  }
}

LineBuilder.prototype.addLine = function (from, to, colorFrom, colorTo) {
  colorFrom = colorFrom || [1, 1, 1, 1]
  colorTo = colorFrom || colorTo || [1, 1, 1, 1]

  const positions = this._positions
  const colors = this._colors
  const indices = this._indices

  const idx = this.lineIndex
  if (idx === positions.length) {
    positions.push([0, 0, 0])
    positions.push([0, 0, 0])
    colors.push([0, 0, 0, 0])
    colors.push([0, 0, 0, 0])
    indices.push([0, 0])
  }
  Vec3.set(positions[idx], from)
  Vec3.set(positions[idx + 1], to)
  if (!colorFrom || !colorFrom.length) {
    const a = colorFrom
    Vec4.set4(colors[idx], 1, 1, 1, a)
    Vec4.set4(colors[idx + 1], 1, 1, 1, a)
  } else {
    Vec4.set(colors[idx], colorFrom)
    Vec4.set(colors[idx + 1], colorTo)
  }
  Vec2.set2(indices[idx / 2], idx, idx + 1)
  this.lineIndex += 2
}

LineBuilder.prototype.makeCircle = function (opts) {
  const points = []

  for (let i = 0; i < opts.steps; i++) {
    const t = i / opts.steps * 2 * Math.PI
    const x = Math.cos(t)
    const y = Math.sin(t)
    const pos = [0, 0, 0]
    pos[opts.axis ? opts.axis[0] : 0] = x
    pos[opts.axis ? opts.axis[1] : 1] = y
    Vec3.scale(pos, opts.radius || 1)
    Vec3.add(pos, opts.center || [0, 0, 0])
    points.push(pos)
  }

  points.forEach((p, i) => {
    const from = p
    const to = points[(i + 1) % points.length]
    // TODO add colors
    this.addLine(p, to)
  })
}

LineBuilder.prototype.makePrism = function (opts) {
  const r = opts.radius
  const position = opts.position || [0, 0, 0]
  const points = [
    [0, r, 0], [r, 0, 0],
    [0, -r, 0], [r, 0, 0],

    [0, r, 0], [-r, 0, 0],
    [0, -r, 0], [-r, 0, 0],

    [0, r, 0], [0, 0, r],
    [0, -r, 0], [0, 0, r],

    [0, r, 0], [0, 0, -r],
    [0, -r, 0], [0, 0, -r],

    [-r, 0, 0], [0, 0, -r],
    [r, 0, 0], [0, 0, -r],
    [r, 0, 0], [0, 0, r],
    [-r, 0, 0], [0, 0, r]
  ]
  points.forEach((p) => Vec3.add(p, position))
  points.forEach((p, i) => {
    const from = p
    if (i === points.length - 1) return

    const to = points[i + 1]
    // TODO add colors
    this.addLine(p, to)
  })
}

LineBuilder.prototype.makeBoundingBox = function (bbox) {
  const points = [
    [-1, -1, 1],
    [ 1, -1, 1],
    [ 1, -1, -1],
    [-1, -1, -1],
    [-1, 1, 1],
    [ 1, 1, 1],
    [ 1, 1, -1],
    [-1, 1, -1]
  ]
  const lines = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7]
  ]

  if (bbox) {
    points[0][0] = bbox[0][0]
    points[1][0] = bbox[1][0]
    points[2][0] = bbox[1][0]
    points[3][0] = bbox[0][0]
    points[4][0] = bbox[0][0]
    points[5][0] = bbox[1][0]
    points[6][0] = bbox[1][0]
    points[7][0] = bbox[0][0]

    points[0][1] = bbox[0][1]
    points[1][1] = bbox[0][1]
    points[2][1] = bbox[0][1]
    points[3][1] = bbox[0][1]
    points[4][1] = bbox[1][1]
    points[5][1] = bbox[1][1]
    points[6][1] = bbox[1][1]
    points[7][1] = bbox[1][1]

    points[0][2] = bbox[1][2]
    points[1][2] = bbox[1][2]
    points[2][2] = bbox[0][2]
    points[3][2] = bbox[0][2]
    points[4][2] = bbox[1][2]
    points[5][2] = bbox[1][2]
    points[6][2] = bbox[0][2]
    points[7][2] = bbox[0][2]
  }

  lines.forEach((line) => {
    this.addLine(points[line[0]], points[line[1]])
  })
}

LineBuilder.prototype.getPositions = function () {
  return this._positions
}

module.exports = function () {
  return new LineBuilder()
}

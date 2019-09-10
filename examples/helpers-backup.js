const vec3 = require('pex-math/vec3')

function makeCircle(opts) {
  const points = []

  for (let i = 0; i < opts.steps; i++) {
    const t = (i / opts.steps) * 2 * Math.PI
    const x = Math.cos(t)
    const y = Math.sin(t)
    const pos = [0, 0, 0]
    pos[opts.axis ? opts.axis[0] : 0] = x
    pos[opts.axis ? opts.axis[1] : 1] = y
    vec3.scale(pos, opts.radius || 1)
    vec3.add(pos, opts.center || [0, 0, 0])
    points.push(pos)
  }

  const lines = points.reduce((lines, p, i) => {
    lines.push(p)
    lines.push(points[(i + 1) % points.length])
    return lines
  }, [])

  return lines
}

function makePrism(opts) {
  const r = opts.radius
  const position = opts.position || [0, 0, 0]
  // prettier-ignore
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
  points.forEach((p) => vec3.add(p, position))
  return points
}

function makeQuad(opts) {
  const w = opts.width
  const h = opts.height
  const position = opts.position || [0, 0, 0]
  // prettier-ignore
  const points = [
    [-1, -1, 0], [1, -1, 0],
    [1, -1, 0], [1, 1, 0],
    [1, 1, 0], [-1, 1, 0],
    [-1, 1, 0], [-1, -1, 0],
    [-1, -1, 0], [1, 1, 0],
    [-1, 1, 0], [1, -1, 0],

    [-1, -1, 0], [-1, -1, 1 / 2],
    [1, -1, 0], [1, -1, 1 / 2],
    [1, 1, 0], [1, 1, 1 / 2],
    [-1, 1, 0], [-1, 1, 1 / 2],
    [0, 0, 0], [0, 0, 1 / 2]
  ]
  points.forEach((p) => {
    p[0] *= w / 2
    p[1] *= h / 2
    vec3.add(p, position)
  })
  return points
}

function makeAxes(size = 10) {
  // prettier-ignore
  return [
    // X axis
    [0, 0, 0],
    [size, 0, 0],
    // Y axis
    [0, 0, 0],
    [0, size, 0],
    // Z axis
    [0, 0, 0],
    [0, 0, size]
  ]
}

module.exports = {
  makeCircle,
  makePrism,
  makeQuad,
  makeAxes
}

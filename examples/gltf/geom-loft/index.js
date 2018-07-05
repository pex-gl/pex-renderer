'use strict'
/*
let splinePoints = require('./geom-spline-points')
let interpolateArrays = require('interpolate-arrays')
const vec3 = require('pex-math/vec3')

function pathBiTangents (path) {
  var bitangents = []
  var up = [0, 0, 0]
  var right = [1, 0, 0]
  var forward = [0, 0, 0]
  var bitangent = [0, 0, 0]
  for (var i = 0; i < path.length - 1; i++) {
    var np = path[i + 1]
    var p = path[i]
    vec3.set(forward, np)
    vec3.sub(forward, p)
    vec3.normalize(forward)
    vec3.set(up, right)
    vec3.cross(up, forward)
    vec3.set(bitangent, forward)
    vec3.cross(bitangent, up)
    vec3.normalize(bitangent)
    bitangents.push(vec3.copy(bitangent))
  }
  // repeat last bitangent
  bitangents.push(bitangents[bitangents.length-1])
  return bitangents
}

function makeBranch (path, pathPoints) {
  // var path = splinePoints(points, { segmentLength: 5/100 })
  const bitangents = pathBiTangents(path)
}
*/

// var merge = require('merge');
// var geom = require('pex-geom');
// var Geometry = geom.Geometry;
// var vec2 = geom.vec2;
// var vec3 = geom.vec3;
const vec3 = require('pex-math/vec3')
const mat4 = require('pex-math/mat4')
const quat = require('pex-math/quat')
const clamp = require('pex-math/utils').clamp
// var Mat4 = geom.Mat4;
// var Quat = geom.Quat;
// var Path = geom.Path;
// var Spline1D = geom.Spline1D;
// var Spline3D = geom.Spline3D;
// var acos = Math.acos;
// var PI = Math.PI;
// var min = Math.min;
// var LineBuilder = require('./LineBuilder');

var EPSILON = 0.00001

// ### Loft ( path, options)
// `path` - path along which we will extrude the shape *{ Path/Spline = required }*
// `options` - available options *{ Object }*
//  - `numSteps` - number of extrusion steps along the path *{ Number/Int = 200 }*
//  - `numSegments` - number of sides of the extruded shape *{ Number/Int = 8 }*
//  - `r` - radius scale of the extruded shape *{ Number = 1 }*
//  - `shapePath` - shape to be extruded, if none a circle will be generated *{ Path = null }*
//  - `xShapeScale` - distorion scale along extruded shape x axis *{ Number = 1 }*
//  - `caps` - generate ending caps geometry *{ bool = false }*
//  - `initialNormal` - starting frame normal *{ vec3 = null }*
function createLoft (path, shapePath, options) {
  options = options || { }
  // options = options || {};
  // var defaults = {
    // numSteps: 200,
    // numSegments: 8,
    // r: 1,
    // shapePath: null,
    // xShapeScale: 1,
    // caps: false,
    // initialNormal: null
  // };
  // path.samplesCount = 5000;
  // if (options.shapePath && !options.numSegments) {
    // options.numSegments = options.shapePath.points.length;
  // }
  // this.options = options = merge(defaults, options);
  // this.path = path;
  // if (path.isClosed()) options.caps = false;
  // this.shapePath = options.shapePath || this.makeShapePath(options.numSegments);
  // this.rfunc = this.makeRadiusFunction(options.r);
  // this.rufunc = options.ru ? this.makeRadiusFunction(options.ru) : this.rfunc;
  // this.rvfunc = options.rv ? this.makeRadiusFunction(options.rv) : (options.ru ? this.rufunc : this.rfunc);
  // this.points = this.samplePoints(path, options.numSteps, path.isClosed());

  // TODO: accomodate closed path
  const tangents = path.map((point, i, points) => {
    if (i < points.length - 1) {
      const nextPoint = points[i + 1]
      return vec3.normalize(vec3.sub(vec3.copy(nextPoint), point))
    } else {
      const prevPoint = points[i - 1]
      return vec3.normalize(vec3.sub(vec3.copy(point), prevPoint))
    }
  })
  const isClosed = false
  const frames = makeFrames(path, tangents, isClosed)
  const g = buildGeometry(frames, shapePath, options.caps, options.radius)
  g.debugLines = []

  path.forEach((p, i) => {
    g.debugLines.push(p)
    g.debugLines.push(vec3.add(vec3.copy(p), vec3.scale(vec3.copy(frames[i].tangent), 0.2)))
    g.debugLines.push(p)
    g.debugLines.push(vec3.add(vec3.copy(p), vec3.scale(vec3.copy(frames[i].normal), 0.2)))
    g.debugLines.push(p)
    g.debugLines.push(vec3.add(vec3.copy(p), vec3.scale(vec3.copy(frames[i].binormal), 0.2)))
  })

  return g
}

function makeFrames (points, tangents, closed, rot) {
  if (rot == null) {
    rot = 0
  }
  let tangent = tangents[0]
  const atx = Math.abs(tangent[0])
  const aty = Math.abs(tangent[1])
  const atz = Math.abs(tangent[2])
  let v = null
  if (atz > atx && atz >= aty) {
    v = vec3.cross(vec3.copy(tangent), [0, 1, 0])
  } else if (aty > atx && aty >= atz) {
    v = vec3.cross(vec3.copy(tangent), [1, 0, 0])
  } else {
    v = vec3.cross(vec3.copy(tangent), [0, 0, 1])
  }

  // var normal = this.options.initialNormal || vec3.create().asCross(tangent, v).normalize()
  let normal = vec3.normalize(vec3.cross(vec3.copy(tangent), v))
  let binormal = vec3.normalize(vec3.cross(vec3.copy(tangent), normal))
  // let prevBinormal = null
  // let prevNormal = null
  let prevTangent = null
  const frames = []
  let rotation = [0, 0, 0, 1]
  let theta = 0
  v = [0, 0, 0]
  for (var i = 0; i < points.length; i++) {
    var position = points[i]
    tangent = tangents[i]
    if (i > 0) {
      normal = vec3.copy(normal)
      binormal = vec3.copy(binormal)
      prevTangent = tangents[i - 1]
      vec3.cross(vec3.set(v, prevTangent), tangent)
      if (vec3.length(v) > EPSILON) {
        vec3.normalize(v)
        theta = Math.acos(vec3.dot(prevTangent, tangent))
        quat.setAxisAngle(rotation, v, theta)
        vec3.multQuat(normal, rotation)
      }
      vec3.cross(vec3.set(binormal, tangent), normal)
    }
    var m = mat4.create()
    m[0] = binormal[0]
    m[1] = binormal[1]
    m[2] = binormal[2]
    m[3] = 0
    m[4] = normal[0]
    m[5] = normal[1]
    m[6] = normal[2]
    m[7] = 0
    m[8] = tangent[0]
    m[9] = tangent[1]
    m[10] = tangent[2]
    m[11] = 0
    m[12] = 0
    m[13] = 0
    m[14] = 0
    m[15] = 1
    frames.push({
      tangent: tangent,
      normal: normal,
      binormal: binormal,
      position: position,
      m: m
    })
  }
  if (closed) {
    const firstNormal = frames[0].normal
    const lastNormal = frames[frames.length - 1].normal
    theta = Math.acos(clamp(firstNormal.dot(lastNormal), 0, 1))
    theta /= frames.length - 1
    if (vec3.dot(tangents[0], vec3.cross(vec3.copy(firstNormal), lastNormal)) > 0) {
      theta = -theta
    }
    frames.forEach(function (frame, frameIndex) {
      quat.setAxisAngle(rotation, frame.tangent, theta * frameIndex)
      vec3.multQuat(frame.normal, frame.rotation)
      vec3.cross(vec3.set(frame.binormal, frame.tangent), frame.normal)
      mat4.set16(frame.m, binormal[0], binormal[1], binormal[2], 0, normal[0], normal[1], normal[2], 0, tangent[0], tangent[1], tangent[2], 0, 0, 0, 0, 1)
    })
  }
  return frames
}

function buildGeometry (frames, shapePath, caps, radius) {
  caps = typeof caps !== 'undefined' ? caps : false

  var index = 0
  var positions = []
  var texCoords = []
  var normals = []
  var cells = []
  for (let i = 0; i < frames.length; i++) {
    var frame = frames[i]
    for (let j = 0; j < shapePath.length; j++) {
      var p = vec3.copy(shapePath[j])
      p = [p[0], p[1], 0]
      if (radius) {
        //TODO: there is ambiguity between [r, r] and [rx, ry]
        const r = radius.length ? radius[i] : radius
        const rx = (r[0] !== undefined) ? r[0] : r
        const ry = (r[1] !== undefined) ? r[1] : rx
        p[0] *= rx
        p[1] *= ry
      }
      vec3.add(vec3.multMat4(p, frame.m), frame.position)
      positions.push(p)
      texCoords.push([j / (shapePath.length - 1), i / (frames.length - 1)])
      normals.push(vec3.normalize(vec3.sub(vec3.copy(p), frame.position)))
    }
  }

  if (caps) {
    positions.push(frames[0].position)
    texCoords.push([0, 0])
    normals.push(vec3.scale(vec3.copy(frames[0].tangent), -1))
    positions.push(frames[frames.length - 1].position)
    texCoords.push([1, 1])
    normals.push(vec3.scale(vec3.copy(frames[frames.length - 1].tangent), -1))
  }

  var numSegments = shapePath.length
  index = 0
  for (let i = 0; i < frames.length; i++) {
    for (let j = 0; j < numSegments; j++) {
      if (i < frames.length - 1) {
        cells.push([index + (j + 1) % numSegments + numSegments, index + (j + 1) % numSegments, index + j, index + j + numSegments ])
      }
    }
    index += numSegments
  }
  // if (this.path.isClosed()) {
    // index -= numSegments
    // for (j=0; j<numSegments; j++) {
      // this.faces.push([(j + 1) % numSegments, index + (j + 1) % numSegments, index + j, j])
    // }
  // }
  if (caps) {
    for (let j = 0; j < numSegments; j++) {
      cells.push([j, (j + 1) % numSegments, positions.length - 2])
      cells.push([positions.length - 1, index - numSegments + (j + 1) % numSegments, index - numSegments + j])
    }
  }

  return {
    positions: positions,
    texCoords: texCoords,
    normals: normals,
    cells: cells
  }
}

module.exports = createLoft

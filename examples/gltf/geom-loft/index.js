'use strict'
/*
let splinePoints = require('./geom-spline-points')
let interpolateArrays = require('interpolate-arrays')
const Vec3 = require('pex-math/Vec3')

function pathBiTangents (path) {
  var bitangents = []
  var up = [0, 0, 0]
  var right = [1, 0, 0]
  var forward = [0, 0, 0]
  var bitangent = [0, 0, 0]
  for (var i = 0; i < path.length - 1; i++) {
    var np = path[i + 1]
    var p = path[i]
    Vec3.set(forward, np)
    Vec3.sub(forward, p)
    Vec3.normalize(forward)
    Vec3.set(up, right)
    Vec3.cross(up, forward)
    Vec3.set(bitangent, forward)
    Vec3.cross(bitangent, up)
    Vec3.normalize(bitangent)
    bitangents.push(Vec3.copy(bitangent))
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
// var Vec2 = geom.Vec2;
// var Vec3 = geom.Vec3;
const Vec3 = require('pex-math/Vec3')
const Mat4 = require('pex-math/Mat4')
const Quat = require('pex-math/Quat')
const clamp = require('pex-math/Utils').clamp
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
//  - `initialNormal` - starting frame normal *{ Vec3 = null }*
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
      return Vec3.normalize(Vec3.sub(Vec3.copy(nextPoint), point))
    } else {
      const prevPoint = points[i - 1]
      return Vec3.normalize(Vec3.sub(Vec3.copy(point), prevPoint))
    }
  })
  const isClosed = false
  const frames = makeFrames(path, tangents, isClosed)
  const g = buildGeometry(frames, shapePath, options.caps, options.radius)
  g.debugLines = []

  path.forEach((p, i) => {
    g.debugLines.push(p)
    g.debugLines.push(Vec3.add(Vec3.copy(p), Vec3.scale(Vec3.copy(frames[i].tangent), 0.2)))
    g.debugLines.push(p)
    g.debugLines.push(Vec3.add(Vec3.copy(p), Vec3.scale(Vec3.copy(frames[i].normal), 0.2)))
    g.debugLines.push(p)
    g.debugLines.push(Vec3.add(Vec3.copy(p), Vec3.scale(Vec3.copy(frames[i].binormal), 0.2)))
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
    v = Vec3.cross(Vec3.copy(tangent), [0, 1, 0])
  } else if (aty > atx && aty >= atz) {
    v = Vec3.cross(Vec3.copy(tangent), [1, 0, 0])
  } else {
    v = Vec3.cross(Vec3.copy(tangent), [0, 0, 1])
  }

  // var normal = this.options.initialNormal || Vec3.create().asCross(tangent, v).normalize()
  let normal = Vec3.normalize(Vec3.cross(Vec3.copy(tangent), v))
  let binormal = Vec3.normalize(Vec3.cross(Vec3.copy(tangent), normal))
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
      normal = Vec3.copy(normal)
      binormal = Vec3.copy(binormal)
      prevTangent = tangents[i - 1]
      Vec3.cross(Vec3.set(v, prevTangent), tangent)
      if (Vec3.length(v) > EPSILON) {
        Vec3.normalize(v)
        theta = Math.acos(Vec3.dot(prevTangent, tangent))
        Quat.setAxisAngle(rotation, theta, v)
        Vec3.multQuat(normal, rotation)
      }
      Vec3.cross(Vec3.set(binormal, tangent), normal)
    }
    var m = Mat4.set16(Mat4.create(), binormal[0], binormal[1], binormal[2], 0, normal[0], normal[1], normal[2], 0, tangent[0], tangent[1], tangent[2], 0, 0, 0, 0, 1)
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
    if (Vec3.dot(tangents[0], Vec3.cross(Vec3.copy(firstNormal), lastNormal)) > 0) {
      theta = -theta
    }
    frames.forEach(function (frame, frameIndex) {
      Quat.setAxisAngle(rotation, theta * frameIndex, frame.tangent)
      Vec3.multQuat(frame.normal, frame.rotation)
      Vec3.cross(Vec3.set(frame.binormal, frame.tangent), frame.normal)
      Mat4.set16(frame.m, binormal[0], binormal[1], binormal[2], 0, normal[0], normal[1], normal[2], 0, tangent[0], tangent[1], tangent[2], 0, 0, 0, 0, 1)
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
      var p = Vec3.copy(shapePath[j])
      p = [p[0], p[1], 0]
      if (radius) {
        //TODO: there is ambiguity between [r, r] and [rx, ry]
        const r = radius.length ? radius[i] : radius
        const rx = (r[0] !== undefined) ? r[0] : r
        const ry = (r[1] !== undefined) ? r[1] : rx
        p[0] *= rx
        p[1] *= ry
      }
      Vec3.add(Vec3.multMat4(p, frame.m), frame.position)     
      positions.push(p)
      texCoords.push([j / (shapePath.length - 1), i / (frames.length - 1)])
      normals.push(Vec3.normalize(Vec3.sub(Vec3.copy(p), frame.position)))
    }
  }

  if (caps) {
    positions.push(frames[0].position)
    texCoords.push([0, 0])
    normals.push(Vec3.scale(Vec3.copy(frames[0].tangent), -1))
    positions.push(frames[frames.length - 1].position)
    texCoords.push([1, 1])
    normals.push(Vec3.scale(Vec3.copy(frames[frames.length - 1].tangent), -1))
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

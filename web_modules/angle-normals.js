import { g as getDefaultExportFromCjs } from './_chunks/polyfills-Ci6ALveU.js';

var angleNormals_1 = angleNormals;
function hypot(x, y, z) {
    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2));
}
function weight(s, r, a) {
    return Math.atan2(r, s - a);
}
function mulAdd(dest, s, x, y, z) {
    dest[0] += s * x;
    dest[1] += s * y;
    dest[2] += s * z;
}
function angleNormals(cells, positions) {
    var numVerts = positions.length;
    var numCells = cells.length;
    //Allocate normal array
    var normals = new Array(numVerts);
    for(var i = 0; i < numVerts; ++i){
        normals[i] = [
            0,
            0,
            0
        ];
    }
    //Scan cells, and
    for(var i = 0; i < numCells; ++i){
        var cell = cells[i];
        var a = positions[cell[0]];
        var b = positions[cell[1]];
        var c = positions[cell[2]];
        var abx = a[0] - b[0];
        var aby = a[1] - b[1];
        var abz = a[2] - b[2];
        var ab = hypot(abx, aby, abz);
        var bcx = b[0] - c[0];
        var bcy = b[1] - c[1];
        var bcz = b[2] - c[2];
        var bc = hypot(bcx, bcy, bcz);
        var cax = c[0] - a[0];
        var cay = c[1] - a[1];
        var caz = c[2] - a[2];
        var ca = hypot(cax, cay, caz);
        if (Math.min(ab, bc, ca) < 1e-6) {
            continue;
        }
        var s = 0.5 * (ab + bc + ca);
        var r = Math.sqrt((s - ab) * (s - bc) * (s - ca) / s);
        var nx = aby * bcz - abz * bcy;
        var ny = abz * bcx - abx * bcz;
        var nz = abx * bcy - aby * bcx;
        var nl = hypot(nx, ny, nz);
        nx /= nl;
        ny /= nl;
        nz /= nl;
        mulAdd(normals[cell[0]], weight(s, r, bc), nx, ny, nz);
        mulAdd(normals[cell[1]], weight(s, r, ca), nx, ny, nz);
        mulAdd(normals[cell[2]], weight(s, r, ab), nx, ny, nz);
    }
    //Normalize all the normals
    for(var i = 0; i < numVerts; ++i){
        var n = normals[i];
        var l = Math.sqrt(Math.pow(n[0], 2) + Math.pow(n[1], 2) + Math.pow(n[2], 2));
        if (l < 1e-8) {
            n[0] = 1;
            n[1] = 0;
            n[2] = 0;
            continue;
        }
        n[0] /= l;
        n[1] /= l;
        n[2] /= l;
    }
    return normals;
}
var angleNormals$1 = /*@__PURE__*/ getDefaultExportFromCjs(angleNormals_1);

export { angleNormals$1 as default };

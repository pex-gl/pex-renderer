import { t as typedArrayConstructor } from './_chunks/index-CcviitTA.js';

const createGroup = ()=>({
        name: "",
        faceData: [],
        hasUVs: false,
        hasNormals: false,
        positionOffset: 0,
        uvOffset: 0,
        normalOffset: 0
    });
function parseObj(text) {
    const lines = text.trim().split("\n");
    // Store parsed groups
    const groups = [];
    let g;
    // Store parsed attributes
    const positions = [];
    const uvs = [];
    const normals = [];
    for(let i = 0; i < lines.length; i++){
        const line = lines[i].replace(/[\s]+/, " ");
        const tokens = line.trim().split(" ");
        // Skip empty lines and commments
        if (!tokens[0] || tokens[0][0] === "#") continue;
        switch(tokens[0]){
            // geometric vertices (skipping 4th coordinate): x y z
            case "v":
                positions.push([
                    Number(tokens[1]),
                    Number(tokens[2]),
                    Number(tokens[3])
                ]);
                break;
            // texture vertices (skipping 3rd coordinate): u v
            case "vt":
                uvs.push([
                    Number(tokens[1]),
                    Number(tokens[2])
                ]);
                break;
            // vertex normals: i j k
            case "vn":
                normals.push([
                    Number(tokens[1]),
                    Number(tokens[2]),
                    Number(tokens[3])
                ]);
                break;
            // face: v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3 ...
            case "f":
                {
                    if (!g) {
                        g = createGroup();
                        g.positionOffset = positions.length;
                        g.uvOffset = uvs.length;
                        g.normalOffset = normals.length;
                        g.name = `Mesh_${groups.length}`;
                        groups.push(g);
                    }
                    const faceData = []; // Array<[v, vt, vn]>
                    for(let j = 1; j < tokens.length; j++){
                        const tokenValues = tokens[j].split("/");
                        const v = tokenValues[0];
                        const vt = tokenValues[1];
                        const vn = tokenValues[2];
                        tokenValues[0] = v && v.length > 0 ? Number(v) : null;
                        tokenValues[1] = vt && vt.length > 0 ? Number(vt) : null;
                        tokenValues[2] = vn && vn.length > 0 ? Number(vn) : null;
                        faceData.push(tokenValues);
                    }
                    // Make a triangle fan
                    const v0 = faceData[0];
                    if (Number.isFinite(v0[1])) g.hasUVs = true;
                    if (Number.isFinite(v0[2])) g.hasNormals = true;
                    for(let v = 1; v < faceData.length - 1; v++){
                        g.faceData.push([
                            v0,
                            faceData[v],
                            faceData[v + 1]
                        ]);
                    }
                    break;
                }
            // Group
            case "g":
                g = createGroup();
                g.positionOffset = positions.length;
                g.uvOffset = uvs.length;
                g.normalOffset = normals.length;
                g.name = line.slice(1).trim();
                groups.push(g);
                break;
            // Type list: http://paulbourke.net/dataformats/obj/
            // Unsupported: Vertex data
            case "vp":
            case "deg":
            case "bmat":
            case "step":
            // Unsupported: Elements
            case "p":
            case "l":
            case "curv":
            case "curv2":
            case "surf":
            // Unsupported: Free-form curve/surface body statements
            case "parm":
            case "trim":
            case "hole":
            case "scrv":
            case "sp":
            case "end":
            case "con":
            // Unsupported: Grouping
            case "s":
            case "mg":
            case "o":
            // Unsupported: Display/render attributes
            case "bevel":
            case "c_interp":
            case "d_interp":
            case "lod":
            case "usemtl":
            case "mtllib":
            case "shadow_obj":
            case "trace_obj":
            case "ctech":
            case "stech":
                console.warn(`geom-parse-obj: unsupported data type "${line}"`);
                break;
            default:
                console.error(`geom-parse-obj: unrecognized line "${line}"`);
        }
    }
    return groups.map((group)=>{
        const size = group.faceData.length * 3;
        const geometry = {
            name: group.name,
            positions: [],
            cells: new (typedArrayConstructor(size))(size)
        };
        if (group.hasNormals) geometry.normals = [];
        if (group.hasUVs) geometry.uvs = [];
        const vertexIndexMap = [];
        let numVertices = 0;
        for(let t = 0; t < group.faceData.length; t++){
            const faceData = group.faceData[t];
            for(let v = 0; v < 3; v++){
                // Try to find existing data
                const hash = faceData[v].join("-");
                let index = vertexIndexMap[hash];
                if (index === undefined) {
                    index = numVertices;
                    vertexIndexMap[hash] = index;
                    numVertices++;
                }
                geometry.cells[t * 3 + v] = index;
                let pIndex = faceData[v][0];
                pIndex = pIndex > 0 ? pIndex - 1 : group.positionOffset + pIndex;
                geometry.positions[index] = positions[pIndex];
                if (group.hasUVs) {
                    let tIndex = faceData[v][1];
                    tIndex = tIndex > 0 ? tIndex - 1 : group.uvOffset + tIndex;
                    geometry.uvs[index] = uvs[tIndex];
                }
                if (group.hasNormals) {
                    let nIndex = faceData[v][2];
                    nIndex = nIndex > 0 ? nIndex - 1 : group.normalOffset + nIndex;
                    geometry.normals[index] = normals[nIndex];
                }
            }
        }
        // Attributes length is only available now as we try to dedupe incoming data
        geometry.positions = new Float32Array(geometry.positions.flat());
        if (group.hasNormals) {
            geometry.normals = new Float32Array(geometry.normals.flat());
        }
        if (group.hasUVs) {
            geometry.uvs = new Float32Array(geometry.uvs.flat());
        }
        return geometry;
    });
}

export { parseObj as default };

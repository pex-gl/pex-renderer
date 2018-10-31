function createMeshFromGeom(ctx, g, primitiveType) {
    primitiveType = primitiveType || ctx.TRIANGLES;
    var attributes = [];
    var indices = null;

    if (g.positions) {
       attributes.push({ data: g.positions, location: ctx.ATTRIB_POSITION});
    } 

    if (g.normals) {
       attributes.push({ data: g.normals, location: ctx.ATTRIB_NORMAL});
    } 
    
    if (g.uvs) {
       attributes.push({ data: g.uvs, location: ctx.ATTRIB_TEX_COORD_0});
    } 
    
    if (g.colors) {
       attributes.push({ data: g.colors, location: ctx.ATTRIB_COLOR});
    } 
    
    if (g.cells) {
       indices = { data: g.cells };
    } 

    return ctx.createMesh(attributes, indices, primitiveType);
}


module.exports = createMeshFromGeom;

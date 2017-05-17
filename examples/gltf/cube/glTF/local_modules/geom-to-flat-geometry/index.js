function toFlatGeometry(geometry) {
  var newPositions = [];
  var newCells = [];

  var cells = geometry.cells;
  var positions = geometry.positions;

  for(var i=0; i<cells.length; i++) {
    var face = cells[i];
    var newFace = [];
    for(var j=0; j<face.length; j++) {
      newFace.push(newPositions.length);
      var v = positions[face[j]];
      newPositions.push([v[0], v[1], v[2]]);
    }
    newCells.push(newFace);
  }

  return {
    positions: newPositions,
    cells: newCells
  }
}

module.exports = toFlatGeometry;

import createGeomBuilder from "geom-builder";
import { pipeline as SHADERS } from "pex-shaders";
import { patchVS, patchFS } from "../utils.js";

const getBBoxPositionsList = function (bbox) {
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
    [bbox[1][0], bbox[0][1], bbox[1][2]],
  ];
};

export default function createHelperSystem({ ctx }) {
  let geomBuilder = createGeomBuilder({ colors: 1, positions: 1 });

  console.log("SHADERS.helper.frag", SHADERS.helper.frag);

  const helperPositionVBuffer = ctx.vertexBuffer({ data: [0, 0, 0] });
  const helperColorVBuffer = ctx.vertexBuffer({ data: [0, 0, 0, 0] });
  const drawHelperLinesCmd = {
    pipeline: ctx.pipeline({
      vert: ctx.capabilities.isWebGL2
        ? patchVS(SHADERS.helper.vert)
        : SHADERS.helper.vert,
      frag: ctx.capabilities.isWebGL2
        ? patchFS(SHADERS.helper.frag)
        : SHADERS.helper.frag,
      depthTest: true,
      primitive: ctx.Primitive.Lines,
    }),
    attributes: {
      aPosition: helperPositionVBuffer,
      aVertexColor: helperColorVBuffer,
    },
    count: 1,
  };

  const helperSystem = {
    type: "camera-system",
  };

  helperSystem.update = (entities) => {
    const cameraEntities = entities.filter((e) => e.camera);

    geomBuilder.reset();
    for (let entity of entities) {
      if (entity.transform?.position) {
        const positions = getBBoxPositionsList(entity.transform.worldBounds);
        positions.forEach((pos) => {
          geomBuilder.addPosition(pos);
          geomBuilder.addColor([1, 0, 1, 1]);
        });
        // geomBuilder.addPosition([0, 0, 0]);
        // geomBuilder.addPosition(entity.transform?.position);
        // geomBuilder.addColor([1, 0, 0, 1]);
        // geomBuilder.addColor([0, 1, 0, 1]);
      }
      // if (entity.boundingBoxHelper) {
      // if (entity.transform)
      // }
    }

    const cameraEnt = cameraEntities[0];

    ctx.update(helperPositionVBuffer, { data: geomBuilder.positions });
    ctx.update(helperColorVBuffer, { data: geomBuilder.colors });
    const cmd = drawHelperLinesCmd;
    cmd.count = geomBuilder.count;

    ctx.submit(cmd, {
      uniforms: {
        uProjectionMatrix: cameraEnt.camera.projectionMatrix,
        uViewMatrix: cameraEnt.camera.viewMatrix,
        uOutputEncoding: ctx.Encoding.Gamma,
      },
      viewport: cameraEnt.camera.viewport,
    });
  };

  return helperSystem;
}

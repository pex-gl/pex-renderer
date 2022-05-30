import createRenderer from "../index.js";
import createContext from "pex-context";
import * as io from "pex-io";
import { getURL } from "./utils.js";

const ctx = createContext();
const renderer = createRenderer(ctx);

(async () => {
  const rainbow = await io.loadImage(getURL(`assets/textures/rainbow/rainbow.jpg`));
  const logo = await io.loadImage(getURL(`assets/textures/PEX/PEX.png`));

  const rainbowEntity = renderer.entity([
    renderer.overlay({
      texture: ctx.texture2D({
        data: rainbow,
        width: rainbow.width,
        height: rainbow.height,
        pixelFormat: ctx.PixelFormat.RGBA8,
        encoding: ctx.Encoding.SRGB,
        flipY: true,
      }),
    }),
  ]);
  renderer.add(rainbowEntity);

  const logoEntity = renderer.entity([
    renderer.overlay({
      x: 100,
      y: 100,
      width: logo.width,
      height: logo.height,
      texture: ctx.texture2D({
        data: logo,
        width: logo.width,
        height: logo.height,
        pixelFormat: ctx.PixelFormat.RGBA8,
        encoding: ctx.Encoding.SRGB,
        flipY: true,
        premultiplyAlpha: true,
      }),
    }),
  ]);
  renderer.add(logoEntity);
})();

ctx.frame(() => {
  renderer.draw();
  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});

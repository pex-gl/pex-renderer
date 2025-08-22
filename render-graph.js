import { NAMESPACE } from "./utils.js";

export default (ctx) => ({
  renderPasses: [],
  beginFrame() {
    this.renderPasses.length = 0;
  },
  renderPass(options) {
    if (options.uses && ctx.debugMode) {
      console.debug(NAMESPACE, "render-graph uses", options.uses);
    }
    this.renderPasses.push(options);
  },
  endFrame() {
    //TODO: this should be render view
    for (let i = 0; i < this.renderPasses.length; i++) {
      const {
        name,
        pass,
        renderView,
        render,
        uses = [],
      } = this.renderPasses[i];

      ctx.submit(
        {
          name,
          pass,
          viewport: renderView.viewport,
          scissor: renderView.viewport,
        },
        () => {
          try {
            for (let j = 0; j < uses.length; j++) {
              const texture = uses[j];
              //FIXME: mipmap generation should happen only once
              if (texture.min === ctx.Filter.LinearMipmapLinear) {
                ctx.update(texture, { mipmap: true });
              }
            }
            if (render) render();
          } catch (error) {
            console.error(
              NAMESPACE,
              "render-graph",
              `Pass "${name}" crashed.`,
              error,
              pass,
            );
          }
        },
      );
    }
  },
});

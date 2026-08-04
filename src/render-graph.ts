import { submit } from "pex-gpu";

import { NAMESPACE } from "./utils.js";

export default (ctx) => ({
  renderPasses: [],
  errors: [],
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
    const previousErrors = new Set(this.errors);
    this.errors.length = 0;

    for (let i = 0; i < this.renderPasses.length; i++) {
      const { name, pass, render } = this.renderPasses[i];

      // Scoped submit keeps the render pass open so nested draw submits target
      // it; an omitted pass renders to the canvas.
      submit(ctx, { name, ...(pass ? { pass } : {}) }, () => {
        try {
          if (render) render();
        } catch (error) {
          if (!(error instanceof Error)) error = new Error(error);

          const { message } = error;
          if (!previousErrors.has(message)) {
            console.error(
              NAMESPACE,
              "render-graph",
              `Render Pass "${name}" crashed.`,
              error,
              pass,
            );
          }
          this.errors.push(message);
        }
      });
    }
  },
});

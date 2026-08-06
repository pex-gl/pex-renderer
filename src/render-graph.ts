import { submit } from "pex-gpu";

import { NAMESPACE } from "./utils.js";

import type { GpuContext } from "./types.js";

export interface RenderPassOptions {
  name?: string;
  // Resource-cache pass handle, not a raw RenderPassDescriptor.
  pass?: any;
  render?: () => void;
  uses?: unknown;
  [key: string]: any;
}

export default (ctx: GpuContext) => ({
  renderPasses: [] as RenderPassOptions[],
  errors: [] as string[],
  beginFrame() {
    this.renderPasses.length = 0;
  },
  renderPass(options: RenderPassOptions) {
    if (options.uses && (ctx as any).debugMode) {
      console.debug(NAMESPACE, "render-graph uses", options.uses);
    }
    this.renderPasses.push(options);
  },
  endFrame() {
    const previousErrors = new Set(this.errors);
    this.errors.length = 0;

    for (let i = 0; i < this.renderPasses.length; i++) {
      const { name, pass, render } = this.renderPasses[i]!;

      // Scoped submit keeps the render pass open so nested draw submits target
      // it; an omitted pass renders to the canvas.
      submit(
        ctx,
        { ...(name ? { label: name } : {}), ...(pass ? { pass } : {}) },
        () => {
          try {
            if (render) render();
          } catch (error) {
            const err =
              error instanceof Error ? error : new Error(String(error));
            const { message } = err;
            if (!previousErrors.has(message)) {
              console.error(
                NAMESPACE,
                "render-graph",
                `Render Pass "${name}" crashed.`,
                err,
                pass,
              );
            }
            this.errors.push(message);
          }
        },
      );
    }
  },
});

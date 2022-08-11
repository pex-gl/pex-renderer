class RenderGraph {
  constructor(ctx, dot) {
    this.renderPasses = [];
    this.ctx = ctx;
    this.dot = dot;
  }

  beginFrame() {
    this.renderPasses.length = 0;
  }

  renderPass(opts) {
    const passId = opts.pass?.id || "RenderPass " + this.renderPasses.length;
    const passName = opts.name || opts.pass?.name || null;

    this.dot.passNode(passId, passName);

    const colorTextureId = opts?.pass?.opts?.color?.[0].id;
    const colorTextureName = opts?.pass?.opts?.color?.[0].name;
    if (colorTextureId) {
      this.dot.resourceNode(colorTextureId, colorTextureName);
      this.dot.edge(passId, colorTextureId);
    }

    const depthTextureId = opts?.pass?.opts?.depth?.id;
    const depthTextureName = opts?.pass?.opts?.depth?.name;
    if (depthTextureId) {
      this.dot.resourceNode(depthTextureId, depthTextureName);
      this.dot.edge(passId, depthTextureId);
    }

    if (opts.uses) {
      if (this.ctx.debugMode) {
        console.log("render-graph uses", opts.uses);
      }
      opts.uses.forEach((tex) => {
        this.dot.edge(tex.id, passId);
      });
    }

    this.renderPasses.push(opts);
  }

  endFrame() {
    this.renderPasses.forEach((opts) => {
      const { pass, render } = opts;

      this.ctx.submit(
        {
          pass: pass,
        },
        () => {
          if (render) render();
        }
      );
    });
  }
}

export default function createRenderGraph(ctx, dot) {
  return new RenderGraph(ctx, dot);
}

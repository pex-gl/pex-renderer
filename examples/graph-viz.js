import { serializeGraph } from "@thi.ng/dot";
import { Graphviz } from "@hpcc-js/wasm-graphviz";

const graphviz = await Graphviz.load();

const dotGraph = {
  directed: true,
  attribs: {
    rankdir: "TB",
    fontname: "Inconsolata",
    fontsize: 9,
    fontcolor: "gray",
    labeljust: "l",
    labelloc: "b",
    node: {
      shape: "rect",
      style: "filled",
      fontname: "Arial",
      fontcolor: "white",
      fontsize: 11,
    },
    // edge defaults
    edge: {
      arrowsize: 0.75,
      fontname: "Inconsolata",
      fontsize: 9,
    },
  },
  // graph nodes (the keys are used as node IDs)
  // use spread operator to inject style presets
  nodes: {
    // A: { shape: "rect", label: "A" },
    // B: { shape: "rect", label: "B" },
  },
  // graph edges (w/ optional ports & extra attribs)
  edges: [
    // { src: "A", dest: "B" }
  ],
};

const containerElement = document.createElement("div");
document.body.appendChild(containerElement);

const dot = {
  containerElement,
  reset: () => {
    dotGraph.nodes = {};
    dotGraph.edges = [];
  },
  node: (id, label, props) => {
    if (Array.isArray(label)) {
      label = label
        .map((label, i) => {
          return `<f${i}> ${label}`;
        })
        .join("|");
      props = {
        ...props,
        shape: "record",
      };
    }

    dotGraph.nodes[id] = { label: label || id, ...props };
  },
  passNode: (id, name) => {
    dot.node(id, name, { fillcolor: "red", color: "darkred" });
  },
  resourceNode: (id, name) => {
    dot.node(id, name, { fillcolor: "blue", color: "darkblue" });
  },
  edge: (id1, id2) => {
    dotGraph.edges.push({ src: id1, dest: id2 });
  },
  render: () => {
    const dotStr = serializeGraph(dotGraph);
    console.debug("dotStr", dotStr);

    containerElement.innerHTML = graphviz.layout(dotStr, "svg", "dot");
    const svgElement = containerElement.querySelector("svg");

    Object.assign(svgElement.style, {
      pointerEvents: "none",
      position: "absolute",
      right: "10px",
      top: "10px",
      opacity: 0.7,
      maxWidth: `calc(75vw - 20px)`,
      maxHeight: `calc(100vh - 20px)`,
      // transformOrigin: "0 0",
      // transform: "scale(0.75)",
    });
    for (let node of svgElement.querySelectorAll(".node text")) {
      Object.assign(node.style, { pointerEvents: "all" });
    }
    svgElement.removeAttribute("width");
    svgElement.removeAttribute("height");
  },
};

const formatTextureName = ({ id, name, pixelFormat }, { id: resolveId } = {}) =>
  (name || id)
    .replace(" ", "\n")
    .replace(")", ` ${pixelFormat}${resolveId ? ` from ${resolveId}` : ``})`);

const getRenderPassGraphViz = () => ({
  needsRender: false,
  init(ctx, renderGraph) {
    const originalBeginFrame = renderGraph.beginFrame;
    renderGraph.beginFrame = (...args) => {
      if (this.needsRender) dot.reset();
      originalBeginFrame.call(renderGraph, ...args);
    };

    const originalRenderPass = renderGraph.renderPass;
    renderGraph.renderPass = (...args) => {
      if (this.needsRender) {
        const [opts] = args;
        const passId =
          opts.pass?.id || `RenderPass ${renderGraph.renderPasses.length}`;
        const passName = opts.name || opts.pass?.name;

        dot.passNode(passId, passName.replace(" ", "\n"));

        const colorAttachments = opts?.pass?.opts?.color;

        for (let i = 0; i < colorAttachments?.length; i++) {
          const colorAttachment = colorAttachments[i];
          const colorTexture =
            colorAttachment?.resolveTarget ||
            colorAttachment?.texture ||
            colorAttachment ||
            {};
          const colorTextureId = colorTexture.id;

          if (colorTextureId) {
            dot.resourceNode(
              colorTextureId,
              formatTextureName(
                colorTexture,
                colorAttachment?.resolveTarget && colorAttachment?.texture,
              ),
            );
            dot.edge(passId, colorTextureId);
          } else {
            dot.edge(passId, "Window");
          }
        }

        const depthAttachment = opts?.pass?.opts?.depth;
        const depthTexture =
          depthAttachment?.resolveTarget ||
          depthAttachment?.texture ||
          depthAttachment ||
          {};
        const depthTextureId = depthTexture.id;

        if (depthTextureId) {
          dot.resourceNode(
            depthTextureId,
            formatTextureName(
              depthTexture,
              depthAttachment?.resolveTarget && depthAttachment?.texture,
            ),
          );
          dot.edge(passId, depthTextureId);
        }

        if (opts.uses) {
          const nodes = Object.keys(dotGraph.nodes);
          opts.uses.forEach((tex) => {
            if (!nodes.includes(tex.id)) {
              dot.edge(formatTextureName(tex), passId);
            } else {
              dot.edge(tex.id, passId);
            }
          });
          if (ctx.debugMode) console.log("render-graph uses", opts.uses);
        }
      }

      originalRenderPass.call(renderGraph, ...args);
    };

    const originalEndFrame = renderGraph.endFrame;
    renderGraph.endFrame = (...args) => {
      originalEndFrame.call(renderGraph, ...args);
      if (this.needsRender) {
        dot.render();
        this.needsRender = false;
      }
    };
  },
  render() {
    this.needsRender = true;
  },
  destroy() {
    containerElement.innerHTML = "";
  },
  isRendered() {
    return containerElement.hasChildNodes();
  },
  toggle() {
    if (this.isRendered()) {
      this.destroy();
    } else {
      this.render();
    }
  },
});

export { getRenderPassGraphViz };

export default dot;

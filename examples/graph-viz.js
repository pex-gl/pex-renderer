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
  edge: (id1, id2) => {
    dotGraph.edges.push({ src: id1, dest: id2 });
  },
  // Takes a ready-made DOT string, so a caller that already has one (see
  // toDot) doesn't have to go through the node/edge builder above.
  render: (dotStr = serializeGraph(dotGraph)) => {
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
      this.draw?.();
    }
  },
};

const formatBytes = (bytes) =>
  bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;

/**
 * Graphviz DOT of a compiled frame from `frameGraph.inspect()`: passes as
 * boxes, resources as ellipses, culled nodes greyed out, load/store ops on the
 * attachment edges and physical ids on resources, so two resources sharing one
 * are visibly recycling the same allocation.
 *
 * @param {import("../src/frame-graph/index.js").GraphInspection} inspection
 * @returns {string}
 */
export function toDot(inspection) {
  const { memory, stats } = inspection;
  // "\\n" is Graphviz's own line break, not a JS newline: it has to survive
  // into the emitted string.
  const caption = [
    `${stats.declaredPasses} declared, ${stats.culledPasses} culled, ${stats.mergedPasses} merged`,
    `peak ${formatBytes(memory.peakBytes)} of ${formatBytes(memory.naiveBytes)} (saved ${formatBytes(memory.savedBytes)})`,
  ].join("\\n");

  const nodes = [];
  const edges = [];

  for (const pass of inspection.passes) {
    const label =
      pass.subPasses.length > 1 ? pass.subPasses.join("\\n+ ") : pass.name;
    nodes.push(
      `  "pass:${pass.name}" [label="${label}" fillcolor="#c62828" color=darkred];`,
    );
  }
  for (const { name, writes } of inspection.culledPasses) {
    // The unread names are the reason it went, so they belong on the node
    // rather than in a separate list nobody cross-references.
    nodes.push(
      `  "pass:${name}" [label="${name}\\n(culled: nothing reads ${writes.join(", ")})" fillcolor=gray80 color=gray50 fontcolor=gray30];`,
    );
  }

  for (const resource of inspection.resources) {
    if (resource.culled) continue;
    console.log(resource);

    const size =
      resource.width !== undefined
        ? `\\n${resource.width}×${resource.height}${resource.depth ? `x${resource.depth}` : ""} ${resource.format ?? ""}`
        : "";
    const physical =
      resource.physicalId !== undefined ? ` #${resource.physicalId}` : "";
    const badge = resource.imported
      ? " [imported]"
      : resource.transient
        ? " [memoryless]"
        : "";
    nodes.push(
      `  "res:${resource.name}" [label="${resource.name}${badge}${physical}${size}" shape=rect fillcolor="${
        resource.imported ? "#6a1b9a" : "#1565c0"
      }" color="${resource.imported ? "purple" : "darkblue"}"];`,
    );
  }

  let presentsToCanvas = false;
  for (const pass of inspection.passes) {
    for (const read of pass.reads) {
      edges.push(`  "res:${read}" -> "pass:${pass.name}";`);
    }
    for (const attachment of pass.colorAttachments) {
      edges.push(
        `  "pass:${pass.name}" -> "res:${attachment.name}" [label="${attachment.loadOp}/${attachment.storeOp}"];`,
      );
    }
    if (pass.depthAttachment) {
      edges.push(
        `  "pass:${pass.name}" -> "res:${pass.depthAttachment.name}" [style=dashed label="${pass.depthAttachment.loadOp}/${pass.depthAttachment.storeOp}"];`,
      );
    }
    // A pass with no attachments targets the swapchain, which the graph has no
    // resource for.
    if (!pass.colorAttachments.length && !pass.depthAttachment) {
      presentsToCanvas = true;
      edges.push(`  "pass:${pass.name}" -> canvas;`);
    }
  }
  if (presentsToCanvas) {
    nodes.push('  canvas [label="Canvas" fillcolor=black color=gray30];');
  }

  return [
    "digraph frameGraph {",
    "  rankdir=TB;",
    '  fontname="Inconsolata";',
    "  fontsize=9;",
    "  fontcolor=gray;",
    "  labeljust=l;",
    "  labelloc=b;",
    `  label="${caption}";`,
    '  node [shape=rect style=filled fontname="Arial" fontsize=11 fontcolor=white];',
    '  edge [fontname="Inconsolata" fontsize=9 arrowsize=0.75];',
    ...nodes,
    ...edges,
    "}",
  ].join("\n");
}

/**
 * Draws the compiled frame graph from `frameGraph.inspect()`. The DOT itself
 * comes from `toDot`, so the graph a viewer sees and the one dumped to a file
 * are the same picture.
 */
const getRenderPassGraphViz = () => ({
  ...dot,
  needsRender: false,
  init(ctx, frameGraph) {
    this.frameGraph = frameGraph;
  },
  draw() {
    const inspection = this.frameGraph?.inspect();
    if (!inspection) return;

    dot.render(toDot(inspection));
    this.needsRender = true;
  },
});

const getSceneGraphViz = () => ({
  ...dot,
  needsRender: false,
  init(entities) {
    this.entities = entities;
  },
  draw() {
    const dot = this;
    dot.reset();

    this.entities?.forEach((entity) => {
      dot.node(
        entity.id,
        `${entity.transform.depth ?? "?"}: ${entity.name || "Entity"} (${
          entity.id
        })`,
      );
      const parent = entity.transform.parent;
      if (parent) dot.edge(parent.entity.id, entity.id);
    });

    dot.render();

    this.needsRender = true;
  },
});

export { getRenderPassGraphViz, getSceneGraphViz };

export default dot;

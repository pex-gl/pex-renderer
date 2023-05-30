import { serializeGraph } from "https://esm.run/@thi.ng/dot";
import { Graphviz } from "https://esm.run/@hpcc-js/wasm/graphviz";

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

const dot = {
  reset: () => {
    (dotGraph.nodes = {}), (dotGraph.edges = []);
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
    dot.node(id, name, { fillcolor: "red", fontcolor: "white" });
  },
  resourceNode: (id, name) => {
    dot.node(id, name, { fillcolor: "blue", fontcolor: "white" });
  },
  edge: (id1, id2) => {
    dotGraph.edges.push({ src: id1, dest: id2 });
  },
  render: () => {
    const dotStr = serializeGraph(dotGraph);
    console.log("dotStr", dotStr);

    const svg = graphviz.layout(dotStr, "svg", "dot");
    const div = document.getElementById("graphviz-container");
    div.innerHTML = svg;
  },
  style: {
    texture: {
      fillcolor: "skyblue",
    },
  },
};

window.dot = dot;

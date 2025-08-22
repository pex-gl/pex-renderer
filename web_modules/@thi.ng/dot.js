const isArray = Array.isArray;

let __nextID = 0;
const __nextSubgraphID = ()=>"cluster" + __nextID++;
const __wrapQ = (x)=>`"${x}"`;
const __escape = (x)=>String(x).replace(/"/g, `\\"`).replace(/\n/g, "\\n");
const __formatGraphAttribs = (attribs, acc)=>{
    for(let a in attribs){
        let v = attribs[a];
        switch(a){
            case "bgcolor":
            case "color":
            case "fillcolor":
            case "fontcolor":
                isArray(v) && (v = v.join(","));
                break;
            case "edge":
                acc.push(`edge[${__formatAttribs(v)}];`);
                continue;
            case "node":
                acc.push(`node[${__formatAttribs(v)}];`);
                continue;
        }
        acc.push(`${a}="${__escape(v)}";`);
    }
    return acc;
};
const __formatAttribs = (attribs)=>{
    const acc = [];
    for(let a in attribs){
        let v = attribs[a];
        switch(a){
            case "color":
            case "fillcolor":
            case "fontcolor":
                isArray(v) && (v = v.join(","));
                break;
            case "label":
                if (attribs.ins || attribs.outs) {
                    v = __formatPortLabel(attribs, v);
                }
                break;
            case "url":
                a = "URL";
                break;
            case "ins":
            case "outs":
            case "src":
            case "dest":
            case "srcPort":
            case "destPort":
                continue;
        }
        acc.push(`${a}="${__escape(v)}"`);
    }
    return acc.join(", ");
};
const __formatPorts = (ports)=>{
    const acc = [];
    for(let i in ports){
        acc.push(`<${i}> ${__escape(ports[i])}`);
    }
    return `{ ${acc.join(" | ")} }`;
};
const __formatPortLabel = (node, label)=>{
    const acc = [];
    node.ins && acc.push(__formatPorts(node.ins));
    acc.push(__escape(label));
    node.outs && acc.push(__formatPorts(node.outs));
    return acc.join(" | ");
};
const serializeNode = (id, n)=>{
    const attribs = __formatAttribs(n);
    return attribs.length ? `"${id}"[${attribs}];` : `"${id}";`;
};
const serializeEdge = (e, directed = true)=>{
    const acc = [
        __wrapQ(e.src)
    ];
    e.srcPort != null && acc.push(":", __wrapQ(e.srcPort));
    acc.push(directed ? " -> " : " -- ");
    acc.push(__wrapQ(e.dest));
    e.destPort != null && acc.push(":", __wrapQ(e.destPort));
    const attribs = __formatAttribs(e);
    attribs.length && acc.push("[", attribs, "]");
    acc.push(";");
    return acc.join("");
};
const serializeGraph = (graph, isSub = false)=>{
    const directed = graph.directed !== false;
    const acc = isSub ? [
        `subgraph ${graph.id || __nextSubgraphID()} {`
    ] : [
        `${directed ? "di" : ""}graph ${graph.id || "g"} {`
    ];
    if (graph.include) {
        acc.push(graph.include);
    }
    if (graph.attribs) {
        __formatGraphAttribs(graph.attribs, acc);
    }
    for(let id in graph.nodes){
        acc.push(serializeNode(id, graph.nodes[id]));
    }
    for (let e of graph.edges){
        acc.push(serializeEdge(e, directed));
    }
    if (graph.sub) {
        for (let sub of graph.sub){
            acc.push(serializeGraph(sub, true));
        }
    }
    acc.push("}");
    return acc.join("\n");
};

export { serializeEdge, serializeGraph, serializeNode };

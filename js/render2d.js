// render2d.js
//
// SVG renderer for the 2D analytical baseline view (brief section 7).
// Reads exclusively from the shared graph store — never keeps its own
// copy of graph state.

import { store } from "./graphStore.js";
import { forceDirectedLayout, hierarchicalStageLayout } from "./layout2d.js";

const NS = "http://www.w3.org/2000/svg";

const STATE_COLOR = {
  Normal: "#5b6b7c",
  Suspicious: "#e0a72f",
  Compromised: "#e0642f",
  "Lateral-Movement Source": "#c23fbf",
  Impacted: "#e0342f",
};

const TYPE_SHAPE = {
  attacker: "triangle",
  host: "rect",
  user: "circle",
  process: "diamond",
  credential: "circle",
  file: "rect",
  network_endpoint: "hex",
};

export class Render2D {
  constructor(container) {
    this.container = container;
    this.svg = document.createElementNS(NS, "svg");
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", "100%");
    this.svg.setAttribute("viewBox", "0 0 900 600");
    container.appendChild(this.svg);

    this.edgeLayer = this._layer("edges");
    this.pathLayer = this._layer("candidate-paths");
    this.nodeLayer = this._layer("nodes");
    this.labelLayer = this._layer("labels");

    store.addEventListener("graph-loaded", () => this.relayout());
    store.addEventListener("filters-changed", () => this.render());
    store.addEventListener("timeline-changed", () => this.render());
    store.addEventListener("selection-changed", () => this.render());
    store.addEventListener("paths-changed", () => this.render());
    store.addEventListener("path-selected", () => this.render());
    store.addEventListener("layout2d-changed", () => this.relayout());
    store.addEventListener("theme-changed", () => this.render());

    this.svg.addEventListener("click", (e) => {
      if (e.target === this.svg) store.clearSelection();
    });
  }

  _layer(cls) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", cls);
    this.svg.appendChild(g);
    return g;
  }

  relayout() {
    const { nodes, edges } = store.getVisibleGraph();
    // Use the *full* graph for layout stability, not just the visible slice,
    // so nodes don't jump around as the timeline filter changes.
    const allNodes = [...store.nodes.values()];
    if (store.layout2d === "hierarchical") {
      hierarchicalStageLayout(allNodes, store.edges, { width: 900, height: 600 });
    } else {
      forceDirectedLayout(allNodes, store.edges, { width: 900, height: 600, iterations: 150 });
    }
    this.render();
  }

  render() {
    const { nodes, edges } = store.getVisibleGraph();
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const selectedPath = store.selectedPathIndex != null ? store.candidatePaths[store.selectedPathIndex] : null;
    const activeEdgeIds = new Set(selectedPath?.edgeIds ?? []);

    // ---- edges ----
    this.edgeLayer.innerHTML = "";
    for (const e of edges) {
      const a = nodeById.get(e.source), b = nodeById.get(e.target);
      if (!a || !b || a.x == null || b.x == null) continue;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
      line.setAttribute("stroke", activeEdgeIds.has(e.id) ? "#ff7d6b" : "#3a4656");
      line.setAttribute("stroke-width", activeEdgeIds.has(e.id) ? 2.2 + e.confidence * 2.5 : 1 + e.confidence * 2);
      line.setAttribute("opacity", activeEdgeIds.has(e.id) ? 0.9 : 0.35 + e.confidence * 0.5);
      line.setAttribute("marker-end", "url(#arrow)");
      line.setAttribute("class", activeEdgeIds.has(e.id) ? "edge-flow selected-edge" : "edge-flow");
      this.edgeLayer.appendChild(line);
    }

    // ---- candidate reverse-paths, ranked emphasis (brief 6.2) ----
    this.pathLayer.innerHTML = "";
    store.candidatePaths.forEach((path, pathIndex) => {
      const selected = store.selectedPathIndex === pathIndex;
      const opacity = selected ? 1 : Math.max(0.25, 1 - (path.rank - 1) * 0.3);
      const widthPx = selected ? 7 : Math.max(1.5, 6 - (path.rank - 1) * 1.5);
      for (let i = 0; i < path.nodeIds.length - 1; i++) {
        const a = nodeById.get(path.nodeIds[i]);
        const b = nodeById.get(path.nodeIds[i + 1]);
        if (!a || !b) continue;
        const line = document.createElementNS(NS, "line");
        line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
        line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
        line.setAttribute("stroke", path.rank === 1 ? "#ff5c5c" : "#ffb44d");
        line.setAttribute("stroke-width", widthPx);
        line.setAttribute("opacity", opacity);
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("class", selected ? "edge-flow selected-edge" : "edge-flow");
        if (selected) line.setAttribute("filter", "drop-shadow(0 0 8px rgba(255, 92, 92, 0.85))");
        this.pathLayer.appendChild(line);
      }
    });

    // ---- nodes ----
    this.nodeLayer.innerHTML = "";
    this.labelLayer.innerHTML = "";
    for (const n of nodes) {
      if (n.x == null) continue;
      const doi = store.degreeOfInterest(n.id);
      const opacity = store.focusNodeId ? clamp(0.15 + doi * 0.22, 0.12, 1) : 1;

      const g = document.createElementNS(NS, "g");
      g.setAttribute("transform", `translate(${n.x},${n.y})`);
      g.setAttribute("opacity", opacity);
      g.style.cursor = "pointer";
      g.addEventListener("click", (ev) => {
        ev.stopPropagation();
        store.selectNode(n.id);
      });

      const r = 8 + (n.state === "Impacted" ? 6 : n.state === "Compromised" ? 3 : 0);
      const focusBoost = store.focusNodeId && n.id === store.focusNodeId ? 1.35 : 1;
      const scaleFactor = store.focusNodeId ? clamp(0.7 + doi * 0.2, 0.8, 1.6) : 1;
      const shape = document.createElementNS(NS, "circle");
      shape.setAttribute("r", r * focusBoost * scaleFactor);
      shape.setAttribute("fill", STATE_COLOR[n.state] || "#5b6b7c");
      shape.setAttribute("stroke", n.id === store.selectedNodeId ? "#fff" : "#0b0f14");
      shape.setAttribute("stroke-width", n.id === store.selectedNodeId ? 3 : 1.5);
      shape.setAttribute("class", "node-surface");
      g.appendChild(shape);

      if (n.state === "Impacted" || n.state === "Compromised") {
        const pulse = document.createElementNS(NS, "circle");
        pulse.setAttribute("r", r);
        pulse.setAttribute("fill", "none");
        pulse.setAttribute("stroke", STATE_COLOR[n.state]);
        pulse.setAttribute("stroke-width", 2);
        pulse.setAttribute("class", "pulse-ring");
        g.appendChild(pulse);
      }

      this.nodeLayer.appendChild(g);

      const label = document.createElementNS(NS, "text");
      label.setAttribute("x", n.x);
      label.setAttribute("y", n.y - r - 6);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", "#c9d3de");
      label.setAttribute("font-size", "10");
      label.setAttribute("opacity", opacity);
      label.textContent = n.label || n.id;
      this.labelLayer.appendChild(label);
    }

    this._ensureArrowMarker();
  }

  _ensureArrowMarker() {
    if (this.svg.querySelector("#arrow")) return;
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#3a4656"></path>
      </marker>`;
    this.svg.prepend(defs);
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// render2d.js
//
// SVG renderer for the 2D analytical baseline view (brief section 7).
// Reads exclusively from the shared graph store — never keeps its own
// copy of graph state.

import { store } from "./graphStore.js";
import { forceDirectedLayout, hierarchicalStageLayout, zoneMatrixLayout } from "./layout2d.js";

const NS = "http://www.w3.org/2000/svg";

const STATE_COLOR = {
  Normal: "#5b6b7c",
  Suspicious: "#e0a72f",
  Compromised: "#e0642f",
  "Lateral-Movement Source": "#c23fbf",
  Impacted: "#e0342f",
};

const TYPE_COLOR = {
  attacker: "#ef4444",
  host: "#3b82f6",
  user: "#06b6d4",
  process: "#f97316",
  credential: "#d946ef",
  file: "#10b981",
  network_endpoint: "#8b5cf6",
};

export function normalizeType(rawType) {
  if (!rawType) return "host";
  const str = Array.isArray(rawType) ? rawType[0] : String(rawType);
  const clean = str.toLowerCase().trim();
  if (TYPE_COLOR[clean]) return clean;
  if (clean.includes("attacker")) return "attacker";
  if (clean.includes("endpoint") || clean.includes("gateway") || clean.includes("fw")) return "network_endpoint";
  if (clean.includes("cred") || clean.includes("hash")) return "credential";
  if (clean.includes("proc")) return "process";
  if (clean.includes("file")) return "file";
  if (clean.includes("user")) return "user";
  return "host";
}

export function getExactAttackRole(node, store) {
  if (!node) return "Unknown role in scenario.";

  const normType = normalizeType(node.type);
  const label = node.label || node.id || "Target";
  const zone = node.zone || "Internal Network";
  const state = node.state || "Normal";

  const edges = store ? store.edges || [] : [];
  const inEdges = edges.filter((e) => e.target === node.id);
  const outEdges = edges.filter((e) => e.source === node.id);

  const inAction = inEdges.length ? inEdges[0].type : null;
  const outAction = outEdges.length ? outEdges[0].type : null;
  const stage = inEdges.length ? inEdges[0].stage : (outEdges.length ? outEdges[0].stage : node.stage);

  if (normType.includes("attacker")) {
    if (label.toLowerCase().includes("suspicious") || label.toLowerCase().includes("alt")) {
      return `${label} is a suspicious attacker from ${zone}. It scans for another way into the network.`;
    }
    return `${label} is the main attacker from ${zone}. It starts the attack using ${outAction || "a malicious email or exploit"}.`;
  }

  if (normType.includes("endpoint") || normType.includes("gateway") || normType.includes("fw")) {
    if (label.toLowerCase().includes("fw")) {
      return `${label} is a firewall in ${zone}. It checks network traffic and received unauthorized login attempts.`;
    }
    return `${label} is a gateway in ${zone}. It was targeted during ${stage || "initial access"} using ${inAction || "phishing"}.`;
  }

  if (normType.includes("host") || normType.includes("server") || normType.includes("ws")) {
    if (state === "Impacted" || label.toLowerCase().includes("server")) {
      return `${label} is a critical host in ${zone}. It was compromised for the final attack.`;
    }
    return `${label} is a host in ${zone}. It was compromised and used to access other systems.`;
  }

  if (normType.includes("cred") || normType.includes("hash")) {
    return `${label} is stolen login information from ${zone}. The attacker used it to move to another system.`;
  }

  if (normType.includes("proc") || normType.includes("binary")) {
    return `${label} is a process running in ${zone}. It helped run the attacker's code.`;
  }

  if (normType.includes("file")) {
    return `${label} is a file in ${zone}. It was read or changed during the attack.`;
  }

  if (normType.includes("user")) {
    return `${label} is a user account in ${zone}. The attacker used it to access another system.`;
  }

  return `${label} is an asset in ${zone}. Its status is ${state.toLowerCase()}.`;
}

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

    this.svg.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    this.svg.addEventListener("pointermove", (e) => this._onPointerMove(e));
    window.addEventListener("pointerup", (e) => this._onPointerUp(e));
    
    this._dragNodeId = null;
    this._dragOffset = { x: 0, y: 0 };
    
    this.viewBox = { x: 0, y: 0, w: 1200, h: 800 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    this.svg.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });
  }

  _onWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(this.svg.getScreenCTM().inverse());

    this.viewBox.x = p.x - (p.x - this.viewBox.x) * zoomFactor;
    this.viewBox.y = p.y - (p.y - this.viewBox.y) * zoomFactor;
    this.viewBox.w *= zoomFactor;
    this.viewBox.h *= zoomFactor;
    this._updateViewBox();
  }

  _updateViewBox() {
    this.svg.setAttribute("viewBox", `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
  }

  _layer(cls) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", cls);
    this.svg.appendChild(g);
    return g;
  }

  _onPointerDown(e) {
    const target = e.target;
    const g = target.closest("g");
    if (g && g.dataset.nodeId) {
      const nodeId = g.dataset.nodeId;
      this._dragNodeId = nodeId;
      const node = store.nodes.get(nodeId);
      
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());
      
      this._dragOffset.x = svgP.x - (node.x || 0);
      this._dragOffset.y = svgP.y - (node.y || 0);
      e.preventDefault();
      return;
    }

    // Canvas background panning
    this.isPanning = true;
    this.panStart = { x: e.clientX, y: e.clientY };
  }

  _onPointerMove(e) {
    if (this._dragNodeId) {
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());
      
      const node = store.nodes.get(this._dragNodeId);
      if (node) {
        node.x = svgP.x - this._dragOffset.x;
        node.y = svgP.y - this._dragOffset.y;
        node.manualPosition = { x: node.x, y: node.y }; 
        this.render();
      }
      return;
    }

    if (this.isPanning) {
      const dx = (e.clientX - this.panStart.x) * (this.viewBox.w / this.container.clientWidth);
      const dy = (e.clientY - this.panStart.y) * (this.viewBox.h / this.container.clientHeight);
      this.viewBox.x -= dx;
      this.viewBox.y -= dy;
      this.panStart = { x: e.clientX, y: e.clientY };
      this._updateViewBox();
    }
  }

  _onPointerUp(e) {
    this._dragNodeId = null;
    this.isPanning = false;
  }

  relayout() {
    const allNodes = [...store.nodes.values()];
    // Reset manual positions on fresh relayout/load
    allNodes.forEach(n => { n.manualPosition = null; });
    
    const count = allNodes.length;
    const dynamicWidth = Math.max(1100, Math.min(2200, count * 55));
    const dynamicHeight = Math.max(750, Math.min(1400, count * 40));
    
    this.viewBox = { x: 0, y: 0, w: dynamicWidth, h: dynamicHeight };
    this._updateViewBox();

    if (store.layout2d === "hierarchical") {
      hierarchicalStageLayout(allNodes, store.edges, { width: dynamicWidth, height: dynamicHeight });
    } else if (store.layout2d === "zone") {
      zoneMatrixLayout(allNodes, store.edges, { width: dynamicWidth, height: dynamicHeight });
    } else {
      forceDirectedLayout(allNodes, store.edges, { width: dynamicWidth, height: dynamicHeight, iterations: 180 });
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
      const isEdgeSelected = activeEdgeIds.has(e.id);
      const opacity = store.selectedNodeId ? (isEdgeSelected ? 0.9 : 0.1) : (isEdgeSelected ? 0.9 : 0.35 + e.confidence * 0.5);
      
      line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
      line.setAttribute("stroke", isEdgeSelected ? "#ff7d6b" : "#8899aa");
      line.setAttribute("stroke-width", isEdgeSelected ? 2.2 + e.confidence * 2.5 : 1 + e.confidence * 2);
      line.setAttribute("opacity", opacity);
      line.setAttribute("marker-end", "url(#arrow)");
      line.setAttribute("class", isEdgeSelected ? "edge-flow selected-edge" : "edge-flow");
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
      const isSelected = n.id === store.selectedNodeId;
      
      let opacity = 1;
      if (store.selectedNodeId) {
        opacity = isSelected ? 1 : clamp(0.1 + doi * 0.15, 0.05, 0.3);
      } else if (store.focusNodeId) {
        opacity = clamp(0.15 + doi * 0.22, 0.12, 1);
      }

      const g = document.createElementNS(NS, "g");
      g.dataset.nodeId = n.id;
      g.setAttribute("transform", `translate(${n.x},${n.y})`);
      g.setAttribute("opacity", opacity);
      g.style.cursor = "pointer";
      g.addEventListener("click", (ev) => {
        ev.stopPropagation();
        store.selectNode(n.id);
      });

      const r = 16 + (n.state === "Impacted" ? 8 : n.state === "Compromised" ? 4 : 0);
      const focusBoost = isSelected ? 1.4 : (store.focusNodeId && n.id === store.focusNodeId ? 1.35 : 1);
      const scaleFactor = store.focusNodeId ? clamp(0.7 + doi * 0.2, 0.8, 1.6) : 1;
      
      const normType = normalizeType(n.type);
      const nodeColor = TYPE_COLOR[normType] || "#3b82f6";
      const strokeColor = isSelected ? "#000" : (n.state === "Impacted" ? "#ef4444" : "#fff");
      const shape = buildNodeShape(n, r * focusBoost * scaleFactor, nodeColor, strokeColor, isSelected ? 3 : 1.5);
      g.appendChild(shape);

      if (n.state === "Impacted" || n.state === "Compromised") {
        const pulse = document.createElementNS(NS, "circle");
        pulse.setAttribute("r", r * focusBoost * scaleFactor + 4);
        pulse.setAttribute("fill", "none");
        pulse.setAttribute("stroke", STATE_COLOR[n.state]);
        pulse.setAttribute("stroke-width", 2);
        pulse.setAttribute("class", "pulse-ring");
        g.appendChild(pulse);
      }

      this.nodeLayer.appendChild(g);

      // Node label pill
      const labelText = n.label || n.id;
      const isExternal = (n.zone === "Internet" || n.type === "attacker");
      const shortText = isExternal ? `Attacker: ${n.id}` : (n.label ? n.label : `Asset: ${n.id}`);
      
      const labelG = document.createElementNS(NS, "g");
      labelG.setAttribute("opacity", opacity);
      labelG.style.pointerEvents = "none";

      const textEl = document.createElementNS(NS, "text");
      textEl.setAttribute("x", n.x);
      textEl.setAttribute("y", n.y - r - 8);
      textEl.setAttribute("text-anchor", "middle");
      textEl.setAttribute("fill", isSelected ? "#0d6efd" : "#1f2937");
      textEl.setAttribute("font-size", isSelected ? "13" : "11");
      textEl.setAttribute("font-weight", isSelected ? "700" : "600");
      textEl.setAttribute("font-family", "monospace, sans-serif");
      textEl.textContent = shortText;

      // Pill backdrop rectangle
      const approxWidth = shortText.length * (isSelected ? 7.8 : 6.8) + 12;
      const rectEl = document.createElementNS(NS, "rect");
      rectEl.setAttribute("x", n.x - approxWidth / 2);
      rectEl.setAttribute("y", n.y - r - 21);
      rectEl.setAttribute("width", approxWidth);
      rectEl.setAttribute("height", 17);
      rectEl.setAttribute("rx", 4);
      rectEl.setAttribute("fill", isSelected ? "#eff6ff" : "rgba(255, 255, 255, 0.92)");
      rectEl.setAttribute("stroke", isSelected ? "#3b82f6" : "#cbd5e1");
      rectEl.setAttribute("stroke-width", isSelected ? "1.5" : "1");

      labelG.appendChild(rectEl);
      labelG.appendChild(textEl);
      this.labelLayer.appendChild(labelG);

      if (isSelected) {
        const descLabel = document.createElementNS(NS, "text");
        const descLines = wrapText(getExactAttackRole(n, store), 48);
        const descX = clamp(n.x, 110, 790);
        const descY = Math.min(n.y + r + 20, 560 - descLines.length * 16);
        descLabel.setAttribute("x", descX);
        descLabel.setAttribute("y", descY);
        descLabel.setAttribute("text-anchor", "middle");
        descLabel.setAttribute("fill", "#0d6efd");
        descLabel.setAttribute("font-size", "13");
        descLabel.setAttribute("font-weight", "700");
        descLabel.setAttribute("opacity", "1");
        descLines.forEach((line, index) => {
          const tspan = document.createElementNS(NS, "tspan");
          tspan.setAttribute("x", descX);
          tspan.setAttribute("dy", index === 0 ? "0" : "16");
          tspan.textContent = line;
          descLabel.appendChild(tspan);
        });
        this.labelLayer.appendChild(descLabel);
      }
    }

    this._ensureArrowMarker();
    this._updateInfoCard();
  }

  _initInfoCard() {
    this.infoCard = document.createElement("div");
    this.infoCard.className = "node-details-popover-2d";
    this.infoCard.style.cssText = `
      position: absolute;
      top: 15px;
      left: 15px;
      max-width: 360px;
      background: rgba(255, 255, 255, 0.98);
      border: 2px solid #0d6efd;
      border-radius: 8px;
      padding: 12px 14px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 100;
      display: none;
      pointer-events: auto;
      overflow-wrap: anywhere;
      word-break: break-word;
    `;
    this.container.appendChild(this.infoCard);
  }

  _updateInfoCard() {
    if (!this.infoCard) this._initInfoCard();
    const nodeId = store.selectedNodeId;
    if (!nodeId) {
      this.infoCard.style.display = "none";
      return;
    }
    const node = store.nodes.get(nodeId);
    if (!node) {
      this.infoCard.style.display = "none";
      return;
    }
    const normType = normalizeType(node.type);
    const color = TYPE_COLOR[normType] || "#0d6efd";
    const desc = getExactAttackRole(node, store);

    this.infoCard.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #e9ecef; padding-bottom: 6px;">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #212529;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: ${color};"></span>
          ${node.label || node.id}
        </div>
        <button id="close-card-2d" style="background: none; border: none; font-size: 18px; color: #6c757d; cursor: pointer; line-height: 1; padding: 0 4px;">&times;</button>
      </div>
      <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
        <span style="background: ${color}; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase;">${normType}</span>
        <span style="background: #e9ecef; color: #495057; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">Zone: ${node.zone || "N/A"}</span>
        <span style="background: #e9ecef; color: #495057; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">Status: ${node.state || "Normal"}</span>
      </div>
      <div style="font-size: 12px; color: #212529; line-height: 1.45; background: #f8f9fa; padding: 8px 10px; border-radius: 6px; border-left: 4px solid ${color};">
        <strong style="color: #0d6efd; display: block; margin-bottom: 3px;">🎯 Role in Attack Scenario:</strong>
        ${desc}
      </div>
    `;
    this.infoCard.style.display = "block";
    const closeBtn = this.infoCard.querySelector("#close-card-2d");
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        store.clearSelection();
      };
    }
  }

  _ensureArrowMarker() {
    if (this.svg.querySelector("#arrow")) return;
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#8899aa"></path>
      </marker>`;
    this.svg.prepend(defs);
  }
}

function buildNodeShape(node, radius, fill, stroke, strokeWidth) {
  const normType = normalizeType(node.type);
  const shapeType = TYPE_SHAPE[normType] || "circle";

  if (shapeType === "rect") {
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", (-radius).toString());
    rect.setAttribute("y", (-radius).toString());
    rect.setAttribute("width", (radius * 2).toString());
    rect.setAttribute("height", (radius * 2).toString());
    rect.setAttribute("rx", "3");
    rect.setAttribute("fill", fill);
    rect.setAttribute("stroke", stroke);
    rect.setAttribute("stroke-width", strokeWidth);
    rect.setAttribute("class", "node-surface");
    return rect;
  }

  if (shapeType === "triangle") {
    const tri = document.createElementNS(NS, "polygon");
    tri.setAttribute("points", `${0},${-radius} ${radius},${radius} ${-radius},${radius}`);
    tri.setAttribute("fill", fill);
    tri.setAttribute("stroke", stroke);
    tri.setAttribute("stroke-width", strokeWidth);
    tri.setAttribute("class", "node-surface");
    return tri;
  }

  if (shapeType === "diamond") {
    const diamond = document.createElementNS(NS, "polygon");
    diamond.setAttribute("points", `0,${-radius} ${radius},0 0,${radius} ${-radius},0`);
    diamond.setAttribute("fill", fill);
    diamond.setAttribute("stroke", stroke);
    diamond.setAttribute("stroke-width", strokeWidth);
    diamond.setAttribute("class", "node-surface");
    return diamond;
  }

  if (shapeType === "hex") {
    const hex = document.createElementNS(NS, "polygon");
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      pts.push(`${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`);
    }
    hex.setAttribute("points", pts.join(" "));
    hex.setAttribute("fill", fill);
    hex.setAttribute("stroke", stroke);
    hex.setAttribute("stroke-width", strokeWidth);
    hex.setAttribute("class", "node-surface");
    return hex;
  }

  const circle = document.createElementNS(NS, "circle");
  circle.setAttribute("r", radius);
  circle.setAttribute("fill", fill);
  circle.setAttribute("stroke", stroke);
  circle.setAttribute("stroke-width", strokeWidth);
  circle.setAttribute("class", "node-surface");
  return circle;
}

function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

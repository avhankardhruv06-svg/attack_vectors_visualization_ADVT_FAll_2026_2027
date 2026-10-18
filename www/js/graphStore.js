// graphStore.js
//
// Single source of truth for the attack graph, selection state, filters,
// and timeline position. Both the 2D and 3D renderers subscribe to this
// store and re-render themselves from it. Neither renderer is allowed to
// keep its own copy of graph state (see brief section 4, "critical
// architecture rule").

const STAGE_ORDER = [
  "Initial Access",
  "Workstation Compromise",
  "Credential Theft",
  "Lateral Movement",
  "File Server Access",
  "File Modification",
  "Impact",
];

const NODE_STATES = [
  "Normal",
  "Suspicious",
  "Compromised",
  "Lateral-Movement Source",
  "Impacted",
];

class GraphStore extends EventTarget {
  constructor() {
    super();

    /** @type {Map<string, object>} nodeId -> node */
    this.nodes = new Map();
    /** @type {Array<object>} edges: {id, source, target, type, timestamp, confidence} */
    this.edges = [];

    // Investigation state
    this.selectedNodeId = null;
    this.focusNodeId = null; // used for DOI focus+context
    this.selectedPathIndex = null;
    this.candidatePaths = []; // array of {nodeIds:[], edgeIds:[], cost, rank}
    this.pulses = []; // transient event pulses {nodeId, startedAt}
    this._lastPulseAt = new Map(); // rate limiting, nodeId -> timestamp ms

    // Timeline
    this.timeRange = [0, 1]; // [minTs, maxTs] in simulated seconds
    this.timelineCursor = 1; // current playback position (seconds)
    this.playing = false;

    // Filters (null/empty = no filter applied)
    this.filters = {
      host: null,
      user: null,
      process: null,
      eventType: null,
      severity: null, // min severity 0-1 (mapped from confidence for now)
      stage: null,
    };

    // Layout mode for the 2D view: "force" | "hierarchical"
    this.layout2d = "force";

    // Active visual theme: cosmetic only, never changes geometry/graph data
    this.theme = "standard"; // "standard" | "neural" | "organic"
  }

  // ---- Loading -----------------------------------------------------

  loadGraph(payload) {
    try {
      let raw = payload;
      if (typeof raw === "string") {
        try { raw = JSON.parse(raw); } catch (err) {}
      }
      if (Array.isArray(raw) && raw.length > 0) {
        raw = raw[0];
      }

      let nodesArr = raw?.nodes;
      let edgesArr = raw?.edges;

      if (nodesArr && !Array.isArray(nodesArr)) {
        if (Array.isArray(nodesArr.nodes)) nodesArr = nodesArr.nodes;
      }
      if (edgesArr && !Array.isArray(edgesArr)) {
        if (Array.isArray(edgesArr.edges)) edgesArr = edgesArr.edges;
      }

      const rawNodes = Array.isArray(nodesArr) ? nodesArr : (Array.isArray(raw) ? raw : []);
      const rawEdges = Array.isArray(edgesArr) ? edgesArr : [];

      this.nodes = new Map(rawNodes.map((n) => [n.id || `node-${Math.random()}`, n]));
      this.edges = rawEdges.map((e, i) => ({ id: e.id ?? `e${i}`, confidence: e.confidence ?? 0.8, ...e }));

      const ts = this.edges.map((e) => Number(e.timestamp) || 0);
      const minT = ts.length ? Math.min(...ts) : 0;
      const maxT = ts.length ? Math.max(...ts) : 100;
      this.timeRange = [minT, maxT];
      this.timelineCursor = maxT;
    } catch (err) {
      console.error("Error in loadGraph:", err);
    }
    this._emit("graph-loaded");
  }

  // ---- Derived, filtered view ---------------------------------------

  /**
   * Returns the currently visible nodes/edges after filters + timeline
   * cursor are applied. This is what both renderers should draw from.
   */
  getVisibleGraph() {
    const f = this.filters;

    const edges = this.edges.filter((e) => {
      if (e.timestamp > this.timelineCursor) return false;
      if (f.eventType && e.type !== f.eventType) return false;
      if (f.severity != null && e.confidence < f.severity) return false;

      const src = this.nodes.get(e.source);
      const dst = this.nodes.get(e.target);
      if (f.host && ![src, dst].some((n) => n?.type === "host" && n.id === f.host)) return false;
      if (f.user && ![src, dst].some((n) => n?.type === "user" && n.id === f.user)) return false;
      if (f.process && ![src, dst].some((n) => n?.type === "process" && n.id === f.process)) return false;
      if (f.stage && e.stage !== f.stage) return false;

      return true;
    });

    const nodes = [...this.nodes.values()].filter((n) => {
      if (f.host && n.type === "host" && n.id !== f.host) return false;
      if (f.user && n.type === "user" && n.id !== f.user) return false;
      if (f.process && n.type === "process" && n.id !== f.process) return false;
      return true;
    });

    return { nodes, edges };
  }

  // ---- Selection / focus ---------------------------------------------

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.focusNodeId = nodeId;
    this._emit("selection-changed", { nodeId });
  }

  clearSelection() {
    this.selectedNodeId = null;
    this.focusNodeId = null;
    this._emit("selection-changed", { nodeId: null });
  }

  setCandidatePaths(paths) {
    this.candidatePaths = paths;
    this.selectedPathIndex = paths.length ? 0 : null;
    this._emit("paths-changed", { paths });
  }

  setSelectedPathIndex(index) {
    this.selectedPathIndex = index;
    this._emit("path-selected", { index });
  }

  /** Degree of Interest: DOI(x|y) = API(x) - D(x,y). See brief section 16. */
  degreeOfInterest(nodeId) {
    if (!this.focusNodeId) return 1;
    const apiScore = this._apriori(nodeId);
    const dist = this._graphDistance(this.focusNodeId, nodeId);
    if (dist === Infinity) return -Infinity;
    return apiScore - dist;
  }

  _apriori(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return 0;
    // Higher a-priori importance for nodes already flagged as compromised/impacted.
    const stateWeight = { Normal: 0, Suspicious: 1, Compromised: 2, "Lateral-Movement Source": 2, Impacted: 3 };
    return (stateWeight[node.state] ?? 0) + 1;
  }

  _graphDistance(fromId, toId) {
    if (fromId === toId) return 0;
    // BFS over the undirected adjacency of the *visible* graph.
    const { edges } = this.getVisibleGraph();
    const adj = new Map();
    edges.forEach((e) => {
      if (!adj.has(e.source)) adj.set(e.source, []);
      if (!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.source).push(e.target);
      adj.get(e.target).push(e.source);
    });
    const seen = new Set([fromId]);
    let frontier = [fromId];
    let dist = 0;
    while (frontier.length) {
      dist += 1;
      const next = [];
      for (const id of frontier) {
        for (const n of adj.get(id) || []) {
          if (!seen.has(n)) {
            if (n === toId) return dist;
            seen.add(n);
            next.push(n);
          }
        }
      }
      frontier = next;
    }
    return Infinity;
  }

  // ---- Node state transitions & pulses -------------------------------

  setNodeState(nodeId, state, { pulseThreshold = 0.6, confidence = 1 } = {}) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    const prev = node.state;
    node.state = state;
    if (prev !== state && confidence >= pulseThreshold) {
      this._emitPulse(nodeId);
    }
    this._emit("node-state-changed", { nodeId, state });
  }

  _emitPulse(nodeId) {
    const now = performance.now();
    const last = this._lastPulseAt.get(nodeId) || 0;
    if (now - last < 500) return; // rate-limit: ~1 pulse / 500ms / node (brief section 15)
    this._lastPulseAt.set(nodeId, now);
    this.pulses.push({ nodeId, startedAt: now });
    this._emit("pulse", { nodeId });
  }

  // ---- Filters / layout / timeline -----------------------------------

  setFilter(key, value) {
    this.filters[key] = value;
    this._emit("filters-changed", { filters: this.filters });
  }

  clearFilters() {
    Object.keys(this.filters).forEach((k) => (this.filters[k] = null));
    this._emit("filters-changed", { filters: this.filters });
  }

  setLayout2d(mode) {
    this.layout2d = mode;
    this._emit("layout2d-changed", { mode });
  }

  setTheme(theme) {
    this.theme = theme; // cosmetic only — never touches nodes/edges
    this._emit("theme-changed", { theme });
  }

  setTimelineCursor(t) {
    this.timelineCursor = Math.min(this.timeRange[1], Math.max(this.timeRange[0], t));
    this._emit("timeline-changed", { cursor: this.timelineCursor });
  }

  // ---- Event bus helper ------------------------------------------------

  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

export const store = new GraphStore();
export { STAGE_ORDER, NODE_STATES };

// ui.js
//
// Investigator interface (brief sections 17-20): entity detail panel,
// filters, timeline scrubber + replay, and the ranked candidate-path list.
// Everything here reads from / writes to the shared store so 2D and 3D
// stay synchronized (brief section 4).

import { store, STAGE_ORDER } from "./graphStore.js";
import { dijkstraReversePath, yensTopKReversePaths } from "./traversal.js";

export function initUI({ render3d }) {
  const detailPanel = document.getElementById("detail-panel");
  const filtersPanel = document.getElementById("filters-panel");
  const timelineInput = document.getElementById("timeline-range");
  const timelineLabel = document.getElementById("timeline-label");
  const playBtn = document.getElementById("play-btn");
  const pathList = document.getElementById("path-list");
  const layoutSelect = document.getElementById("layout-select");
  const themeSelect = document.getElementById("theme-select");
  const runTraversalBtn = document.getElementById("run-traversal-btn");
  const kInput = document.getElementById("k-input");
  const clearFiltersBtn = document.getElementById("clear-filters-btn");

  // ---- Detail panel -----------------------------------------------------

  function renderDetailPanel() {
    const id = store.selectedNodeId;
    if (!id) {
      detailPanel.innerHTML = `<p class="muted">Select a node in either view to inspect it here.</p>`;
      return;
    }
    const node = store.nodes.get(id);
    if (!node) return;

    const related = store.edges.filter((e) => e.source === id || e.target === id);
    const relatedUsers = new Set(
      related.map((e) => (e.source === id ? e.target : e.source)).filter((oid) => store.nodes.get(oid)?.type === "user")
    );
    const connectedSystems = new Set(
      related.map((e) => (e.source === id ? e.target : e.source)).filter((oid) => store.nodes.get(oid)?.type === "host")
    );
    const lastEvent = related.reduce((max, e) => (e.timestamp > (max?.timestamp ?? -1) ? e : max), null);

    const rank = store.candidatePaths.find((p) => p.nodeIds.includes(id));
    const bestEdgeConf = related.length ? Math.max(...related.map((e) => e.confidence)) : null;
    const selectedPath = store.selectedPathIndex != null ? store.candidatePaths[store.selectedPathIndex] : null;
    const pathSummary = selectedPath ? describePath(selectedPath) : "Select a ranked path to inspect the narrative.";

    detailPanel.innerHTML = `
      <h3>${escapeHtml(node.type.toUpperCase())}: ${escapeHtml(node.label || node.id)}</h3>
      <dl>
        <dt>Status</dt><dd class="state-${slug(node.state)}">${node.state}</dd>
        <dt>Zone</dt><dd>${escapeHtml(node.zone || "—")}</dd>
        <dt>Last event</dt><dd>${lastEvent ? formatTime(lastEvent.timestamp) : "—"}</dd>
        <dt>Connected systems</dt><dd>${connectedSystems.size}</dd>
        <dt>Related users</dt><dd>${relatedUsers.size}</dd>
        <dt>Related events</dt><dd>${related.length}</dd>
        <dt>Reverse-path rank</dt><dd>${rank ? "#" + rank.rank : "—"}</dd>
        <dt>Confidence (max incident edge)</dt><dd>${bestEdgeConf != null ? bestEdgeConf.toFixed(2) : "—"}</dd>
      </dl>
      <div class="path-summary">
        <strong>Selected investigation path</strong>
        <p>${escapeHtml(pathSummary)}</p>
      </div>
      <button id="focus-node-btn">Focus camera on this node</button>
    `;
    document.getElementById("focus-node-btn")?.addEventListener("click", () => render3d.focusOnNode(id));
  }

  // ---- Filters ------------------------------------------------------------

  function renderFilters() {
    const nodes = [...store.nodes.values()];
    const hosts = unique(nodes.filter((n) => n.type === "host"));
    const users = unique(nodes.filter((n) => n.type === "user"));
    const processes = unique(nodes.filter((n) => n.type === "process"));
    const eventTypes = unique(store.edges.map((e) => ({ id: e.type, label: e.type })));

    filtersPanel.innerHTML = `
      ${selectHtml("host", "Host", hosts)}
      ${selectHtml("user", "User", users)}
      ${selectHtml("process", "Process", processes)}
      ${selectHtml("eventType", "Event type", eventTypes)}
      ${selectHtml("stage", "Attack stage", STAGE_ORDER.map((s) => ({ id: s, label: s })))}
      <label class="filter-row">
        <span>Min confidence</span>
        <input type="range" id="severity-filter" min="0" max="1" step="0.05" value="0">
        <output id="severity-out">0.00</output>
      </label>
    `;

    for (const key of ["host", "user", "process", "eventType", "stage"]) {
      document.getElementById(`filter-${key}`).addEventListener("change", (e) => {
        store.setFilter(key, e.target.value || null);
      });
    }
    const sev = document.getElementById("severity-filter");
    sev.addEventListener("input", (e) => {
      document.getElementById("severity-out").textContent = Number(e.target.value).toFixed(2);
      store.setFilter("severity", Number(e.target.value) || null);
    });
  }

  function selectHtml(key, label, items) {
    return `
      <label class="filter-row">
        <span>${label}</span>
        <select id="filter-${key}">
          <option value="">All</option>
          ${items.map((i) => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.label)}</option>`).join("")}
        </select>
      </label>`;
  }

  function unique(nodes) {
    return nodes.map((n) => ({ id: n.id, label: n.label || n.id }));
  }

  clearFiltersBtn.addEventListener("click", () => {
    store.clearFilters();
    renderFilters();
  });

  // ---- Timeline -----------------------------------------------------------

  function setupTimeline() {
    const [t0, t1] = store.timeRange;
    timelineInput.min = t0;
    timelineInput.max = t1;
    timelineInput.value = store.timelineCursor;
    updateTimelineLabel();
  }

  timelineInput.addEventListener("input", (e) => {
    store.setTimelineCursor(Number(e.target.value));
  });

  store.addEventListener("timeline-changed", () => {
    timelineInput.value = store.timelineCursor;
    updateTimelineLabel();
  });

  function updateTimelineLabel() {
    timelineLabel.textContent = `t = ${formatTime(store.timelineCursor)} / ${formatTime(store.timeRange[1])}`;
  }

  let playTimer = null;
  playBtn.addEventListener("click", () => {
    store.playing = !store.playing;
    playBtn.textContent = store.playing ? "⏸ Pause" : "▶ Replay";
    if (store.playing) {
      if (store.timelineCursor >= store.timeRange[1]) store.setTimelineCursor(store.timeRange[0]);
      playTimer = setInterval(() => {
        const next = store.timelineCursor + Math.max(1, (store.timeRange[1] - store.timeRange[0]) / 200);
        if (next >= store.timeRange[1]) {
          store.setTimelineCursor(store.timeRange[1]);
          store.playing = false;
          playBtn.textContent = "▶ Replay";
          clearInterval(playTimer);
        } else {
          store.setTimelineCursor(next);
        }
      }, 60);
    } else {
      clearInterval(playTimer);
    }
  });

  // ---- Layout / theme switches ---------------------------------------------

  layoutSelect.addEventListener("change", (e) => store.setLayout2d(e.target.value));
  themeSelect.addEventListener("change", (e) => store.setTheme(e.target.value));

  // ---- Reverse traversal ----------------------------------------------------

  runTraversalBtn.addEventListener("click", () => {
    if (!store.selectedNodeId) {
      alert("Select an impacted/compromised asset first (click a node in either view).");
      return;
    }
    const k = Math.max(1, Number(kInput.value) || 3);
    const nodes = [...store.nodes.values()];
    const paths = yensTopKReversePaths(nodes, store.edges, store.selectedNodeId, k);
    store.setCandidatePaths(paths);
  });

  function renderPathList() {
    if (!store.candidatePaths.length) {
      pathList.innerHTML = `<p class="muted">Run reverse traversal on a selected asset to see ranked candidate origins.</p>`;
      return;
    }
    pathList.innerHTML = store.candidatePaths
      .map((p, idx) => {
        const originNode = store.nodes.get(p.nodeIds[p.nodeIds.length - 1]);
        const avgConfidence = p.edgeIds.length
          ? 1 - p.cost / p.edgeIds.length
          : 1;
        const selected = store.selectedPathIndex === idx ? "selected" : "";
        return `
          <div class="path-item rank-${p.rank} ${selected}" data-path-index="${idx}">
            <strong>#${p.rank}</strong> origin: ${escapeHtml(originNode?.label || p.nodeIds[0])}
            <div class="muted">hops: ${p.edgeIds.length} · avg confidence: ${avgConfidence.toFixed(2)} · cost: ${p.cost.toFixed(2)}</div>
          </div>`;
      })
      .join("");

    pathList.querySelectorAll(".path-item").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.pathIndex);
        store.setSelectedPathIndex(idx);
      });
    });
  }

  function describePath(path) {
    if (!path || !path.nodeIds?.length) return "No path selected.";
    const labels = path.nodeIds.map((id) => {
      const node = store.nodes.get(id);
      return node?.label || node?.id || id;
    });
    return labels.join(" → ");
  }

  // ---- Wire store events to UI re-renders ------------------------------

  store.addEventListener("graph-loaded", () => { renderFilters(); setupTimeline(); renderDetailPanel(); renderPathList(); });
  store.addEventListener("selection-changed", renderDetailPanel);
  store.addEventListener("paths-changed", () => { renderPathList(); renderDetailPanel(); });
  store.addEventListener("path-selected", () => { renderPathList(); renderDetailPanel(); });
  store.addEventListener("filters-changed", renderDetailPanel);

  return { renderDetailPanel, renderFilters, renderPathList };
}

function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

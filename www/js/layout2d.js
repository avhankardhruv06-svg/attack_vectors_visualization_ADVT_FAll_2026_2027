// layout2d.js
//
// Two layouts for the 2D analytical baseline view (brief section 7):
//  1. Force-directed, using a Barnes-Hut quadtree approximation for
//     repulsion so it scales roughly O(n log n) instead of naive O(n^2).
//  2. Hierarchical / stage-ordered, a simplified Sugiyama-style layering
//     that places nodes by attack-lifecycle stage.

import { STAGE_ORDER } from "./graphStore.js";

// ---- Barnes-Hut quadtree ------------------------------------------------

class QuadNode {
  constructor(x0, y0, x1, y1) {
    this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1;
    this.mass = 0; this.cx = 0; this.cy = 0;
    this.body = null;
    this.children = null;
  }

  insert(body) {
    if (this.mass === 0 && !this.children) {
      this.body = body;
      this.mass = 1;
      this.cx = body.x; this.cy = body.y;
      return;
    }
    if (!this.children) this._subdivide();

    if (this.body) {
      this._insertIntoChild(this.body);
      this.body = null;
    }
    this._insertIntoChild(body);
    this.mass += 1;
    this.cx = (this.cx * (this.mass - 1) + body.x) / this.mass;
    this.cy = (this.cy * (this.mass - 1) + body.y) / this.mass;
  }

  _subdivide() {
    const mx = (this.x0 + this.x1) / 2;
    const my = (this.y0 + this.y1) / 2;
    this.children = [
      new QuadNode(this.x0, this.y0, mx, my),
      new QuadNode(mx, this.y0, this.x1, my),
      new QuadNode(this.x0, my, mx, this.y1),
      new QuadNode(mx, my, this.x1, this.y1),
    ];
  }

  _insertIntoChild(body) {
    const mx = (this.x0 + this.x1) / 2;
    const my = (this.y0 + this.y1) / 2;
    const idx = (body.x >= mx ? 1 : 0) + (body.y >= my ? 2 : 0);
    this.children[idx].insert(body);
  }

  /** Accumulate repulsive force on `body` into out={fx,fy}, theta controls approximation. */
  applyForce(body, out, theta = 0.8, strength = 1800) {
    if (this.mass === 0 || (this.body === body)) return;
    const dx = this.cx - body.x;
    const dy = this.cy - body.y;
    const distSq = Math.max(dx * dx + dy * dy, 0.01);
    const size = this.x1 - this.x0;

    if (!this.children || (size * size) / distSq < theta * theta) {
      const dist = Math.sqrt(distSq);
      const force = (strength * this.mass) / distSq;
      out.fx -= (dx / dist) * force;
      out.fy -= (dy / dist) * force;
    } else {
      for (const c of this.children) c.applyForce(body, out, theta, strength);
    }
  }
}

/**
 * Runs `iterations` steps of a Barnes-Hut approximated force simulation.
 * Mutates and returns node objects with .x/.y set.
 */
export function forceDirectedLayout(nodes, edges, { width = 1100, height = 700, iterations = 180 } = {}) {
  const count = nodes.length;
  // Initialize with circular/spiral dispersion to prevent collinear initialization
  const bodies = nodes.map((n, i) => {
    const angle = i * 2.399963229728653; // Golden ratio spiral
    const radius = Math.min(width, height) * 0.35 * Math.sqrt((i + 1) / (count + 1));
    return {
      id: n.id,
      x: n.x ?? (width / 2 + Math.cos(angle) * radius),
      y: n.y ?? (height / 2 + Math.sin(angle) * radius),
      vx: 0,
      vy: 0,
    };
  });
  const byId = new Map(bodies.map((b) => [b.id, b]));

  const edgeStrength = 0.015;
  const idealLength = Math.max(160, Math.min(260, 2000 / Math.max(Math.sqrt(count), 1)));
  const minNodeDist = 75; // Minimum required distance between any two node centers

  for (let it = 0; it < iterations; it++) {
    // Build quadtree bounds each iteration
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const b of bodies) {
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x); y1 = Math.max(y1, b.y);
    }
    const pad = 60;
    const tree = new QuadNode(x0 - pad, y0 - pad, x1 + pad, y1 + pad);
    for (const b of bodies) tree.insert(b);

    // Repulsion (Barnes-Hut approximated with strong repulsion)
    const repStrength = Math.max(3500, Math.min(8000, count * 180));
    for (const b of bodies) {
      const out = { fx: 0, fy: 0 };
      tree.applyForce(b, out, 0.7, repStrength);
      b.vx += out.fx * 0.012;
      b.vy += out.fy * 0.012;
    }

    // Direct pairwise hard-sphere collision repulsion for close neighbours
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minNodeDist * minNodeDist) {
          const dist = Math.max(Math.sqrt(distSq), 0.1);
          const overlap = (minNodeDist - dist) * 0.5;
          const nx = (dx / dist) * overlap;
          const ny = (dy / dist) * overlap;
          a.x -= nx;
          a.y -= ny;
          b.x += nx;
          b.y += ny;
        }
      }
    }

    // Attraction along edges (springs)
    for (const e of edges) {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const f = (dist - idealLength) * edgeStrength;
      const fx = (dx / dist) * f, fy = (dy / dist) * f;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    // Integrate + damping + boundary constraint with generous margins
    for (const b of bodies) {
      b.vx *= 0.82; b.vy *= 0.82;
      b.x += b.vx; b.y += b.vy;
      b.x = Math.min(width - 50, Math.max(50, b.x));
      b.y = Math.min(height - 50, Math.max(50, b.y));
    }
  }

  for (const n of nodes) {
    if (n.manualPosition) {
      n.x = n.manualPosition.x;
      n.y = n.manualPosition.y;
    } else {
      const b = byId.get(n.id);
      n.x = b.x; n.y = b.y;
    }
  }
  return nodes;
}

// ---- Simplified Sugiyama-style hierarchical (stage-ordered) layout -----

/**
 * Places nodes in vertical "layers" by attack stage. Within each layer,
 * if there are many nodes, arrange them in a readable multi-column grid
 * so labels and nodes never stack or overlap vertically.
 */
export function hierarchicalStageLayout(nodes, edges, { width = 1100, height = 700 } = {}) {
  const stageMap = new Map();
  STAGE_ORDER.forEach((st) => stageMap.set(st, []));
  const unstaged = [];

  const stageOf = new Map();
  for (const e of edges) {
    if (e.stage) {
      if (!stageOf.has(e.source)) stageOf.set(e.source, e.stage);
      stageOf.set(e.target, e.stage);
    }
  }

  for (const n of nodes) {
    const st = stageOf.get(n.id) || n.stage || STAGE_ORDER[0];
    if (stageMap.has(st)) {
      stageMap.get(st).push(n);
    } else {
      unstaged.push(n);
    }
  }
  if (unstaged.length) stageMap.get(STAGE_ORDER[0]).push(...unstaged);

  const activeStages = STAGE_ORDER.filter((st) => (stageMap.get(st) || []).length > 0);
  const stageColWidth = (width - 160) / Math.max(activeStages.length, 1);

  activeStages.forEach((stage, stageIdx) => {
    const list = stageMap.get(stage);
    const baseX = 90 + stageIdx * stageColWidth;

    // Distribute into multiple sub-columns if there are more than 5 nodes in this stage
    const maxRows = Math.min(Math.max(Math.floor(list.length / 2), 4), 10);
    const numSubCols = Math.ceil(list.length / maxRows);
    const subColWidth = Math.min(stageColWidth / Math.max(numSubCols, 1), 160);
    const rowStep = Math.min((height - 120) / Math.max(maxRows, 1), 65);

    list.forEach((node, idx) => {
      if (node.manualPosition) {
        node.x = node.manualPosition.x;
        node.y = node.manualPosition.y;
      } else {
        const subCol = idx % numSubCols;
        const subRow = Math.floor(idx / numSubCols);
        node.x = baseX + subCol * subColWidth;
        node.y = 60 + (subRow + 1) * rowStep;
      }
    });
  });

  return nodes;
}

export function zoneMatrixLayout(nodes, edges, { width = 1100, height = 700 } = {}) {
  const ZONES = ["Internet", "DMZ", "Corp-LAN", "Server-VLAN"];
  const zoneMap = new Map();
  ZONES.forEach((z) => zoneMap.set(z, []));
  const unknownZone = [];

  for (const n of nodes) {
    const z = n.zone || "Corp-LAN";
    if (zoneMap.has(z)) {
      zoneMap.get(z).push(n);
    } else {
      unknownZone.push(n);
    }
  }
  if (unknownZone.length) zoneMap.get("Corp-LAN").push(...unknownZone);

  const activeZones = ZONES.filter((z) => (zoneMap.get(z) || []).length > 0);
  const zoneRowHeight = (height - 120) / Math.max(activeZones.length, 1);

  activeZones.forEach((zone, zoneIdx) => {
    const list = zoneMap.get(zone);
    const baseY = 65 + zoneIdx * zoneRowHeight;

    // Arrange nodes inside each zone horizontally in multiple rows if needed
    const maxCols = Math.min(Math.max(list.length, 3), 8);
    const colStep = (width - 160) / (maxCols + 1);
    const rowStep = Math.min(zoneRowHeight / Math.max(Math.ceil(list.length / maxCols), 1), 55);

    list.forEach((node, idx) => {
      if (node.manualPosition) {
        node.x = node.manualPosition.x;
        node.y = node.manualPosition.y;
      } else {
        const col = idx % maxCols;
        const row = Math.floor(idx / maxCols);
        node.x = 80 + (col + 1) * colStep;
        node.y = baseY + row * rowStep;
      }
    });
  });

  return nodes;
}

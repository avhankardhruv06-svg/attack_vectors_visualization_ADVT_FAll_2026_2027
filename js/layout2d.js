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
export function forceDirectedLayout(nodes, edges, { width = 900, height = 600, iterations = 120 } = {}) {
  const bodies = nodes.map((n) => ({
    id: n.id,
    x: n.x ?? width / 2 + (Math.random() - 0.5) * width * 0.6,
    y: n.y ?? height / 2 + (Math.random() - 0.5) * height * 0.6,
    vx: 0,
    vy: 0,
  }));
  const byId = new Map(bodies.map((b) => [b.id, b]));

  const edgeStrength = 0.02;
  const idealLength = 90;

  for (let it = 0; it < iterations; it++) {
    // Build quadtree bounds each iteration (bodies move).
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const b of bodies) {
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x); y1 = Math.max(y1, b.y);
    }
    const pad = 50;
    const tree = new QuadNode(x0 - pad, y0 - pad, x1 + pad, y1 + pad);
    for (const b of bodies) tree.insert(b);

    // Repulsion (Barnes-Hut approximated, ~O(n log n))
    for (const b of bodies) {
      const out = { fx: 0, fy: 0 };
      tree.applyForce(b, out);
      b.vx += out.fx * 0.01;
      b.vy += out.fy * 0.01;
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

    // Integrate + damping + keep inside canvas
    for (const b of bodies) {
      b.vx *= 0.85; b.vy *= 0.85;
      b.x += b.vx; b.y += b.vy;
      b.x = Math.min(width - 20, Math.max(20, b.x));
      b.y = Math.min(height - 20, Math.max(20, b.y));
    }
  }

  for (const n of nodes) {
    const b = byId.get(n.id);
    n.x = b.x; n.y = b.y;
  }
  return nodes;
}

// ---- Simplified Sugiyama-style hierarchical (stage-ordered) layout -----

/**
 * Places nodes in vertical "layers" by attack stage. Within a layer,
 * nodes are ordered to minimize (not fully solve, this is a lightweight
 * barycenter heuristic) edge crossings from the previous layer.
 */
export function hierarchicalStageLayout(nodes, edges, { width = 900, height = 600 } = {}) {
  const stageOf = new Map();
  for (const e of edges) {
    if (!stageOf.has(e.source) && e.stage) stageOf.set(e.source, e.stage);
    if (e.stage) stageOf.set(e.target, e.stage);
  }

  const layers = STAGE_ORDER.map(() => []);
  const unstaged = [];
  for (const n of nodes) {
    const stage = stageOf.get(n.id);
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx >= 0) layers[idx].push(n);
    else unstaged.push(n);
  }
  if (unstaged.length) layers[0].push(...unstaged);

  const layerH = height / Math.max(STAGE_ORDER.length, 1);

  // Barycenter ordering pass: order each layer by avg x of predecessors.
  const xOf = new Map();
  layers.forEach((layer, li) => {
    const step = width / (layer.length + 1);
    layer.forEach((n, i) => xOf.set(n.id, (i + 1) * step));
  });

  for (let pass = 0; pass < 3; pass++) {
    layers.forEach((layer, li) => {
      if (li === 0) return;
      const scored = layer.map((n) => {
        const preds = edges.filter((e) => e.target === n.id).map((e) => xOf.get(e.source) ?? width / 2);
        const avg = preds.length ? preds.reduce((a, b) => a + b, 0) / preds.length : xOf.get(n.id);
        return { n, avg };
      });
      scored.sort((a, b) => a.avg - b.avg);
      const step = width / (scored.length + 1);
      scored.forEach((s, i) => xOf.set(s.n.id, (i + 1) * step));
    });
  }

  layers.forEach((layer, li) => {
    const y = layerH * li + layerH / 2;
    for (const n of layer) {
      n.x = xOf.get(n.id);
      n.y = y;
    }
  });

  return nodes;
}

# Reverse Attack-Path Visualization

A synchronized 2D/3D cybersecurity investigation tool. Starting from a
compromised or impacted asset, it reconstructs the most plausible chain
of preceding events using confidence-weighted reverse graph traversal,
and presents the same underlying attack graph through two linked views —
a 2D analytical baseline and a semantically-axed 3D scene.

This implements the system described in the team's project brief
("A Synchronized 2D/3D Reverse Attack-Path Visualization System for
Cybersecurity Investigation"). It's a plain HTML/JS/ES-modules app —
no build step required.

## Running it

Any static file server works, since the app uses native ES modules and
loads Three.js from a CDN via an import map. From the project root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

or

```bash
npx serve .
```

## What's implemented

- **Single source of truth** (`js/graphStore.js`) — both renderers read
  from and never fork this shared graph/selection/filter/timeline state.
- **Event simulator** (`js/simulator.js`) — generates a controlled
  ransomware attack chain plus decoy branches, as an evaluation fixture
  only. Each edge is `(src, dst, type, timestamp, confidence)`.
- **Reverse traversal engine** (`js/traversal.js`) — Dijkstra on the
  reversed graph with `w(e) = 1 - c(e)`, plus Yen's algorithm for top-k
  loopless candidate paths, rendered simultaneously with rank-based
  visual emphasis.
- **2D view** (`js/layout2d.js`, `js/render2d.js`) — Barnes-Hut
  approximated force-directed layout (~O(n log n) repulsion via a
  quadtree), and a simplified Sugiyama-style stage-hierarchical layout,
  rendered as SVG.
- **3D view** (`js/render3d.js`) — Three.js scene using a single
  `InstancedMesh` for all nodes. Semantic axes are fixed: X = network
  zone, Y = attack-lifecycle stage, Z = event time.
- **Investigator interface** (`js/ui.js`) — entity detail panel, filters
  (host/user/process/event type/stage/confidence), timeline scrubber with
  replay, and the ranked candidate-path list. All driven by the shared
  store so 2D/3D selection and filtering stay synchronized.
- **Degree of Interest (focus + context)** — `store.degreeOfInterest()`
  implements `DOI(x|y) = API(x) - D(x,y)` and fades non-relevant nodes'
  opacity rather than hard-hiding them.
- **Dynamic node states & pulses** — Normal → Suspicious → Compromised →
  Lateral-Movement Source → Impacted, with a rate-limited transient pulse
  (~1 per node per 500ms) on state change.
- **Cosmetic 3D themes** — Standard/Neural/Organic swap only material
  emissive properties on the same geometry/renderer; they never fork the
  graph or spin up separate rendering paths.

## Roadmap / intentionally deferred

Per the brief's scope-drift guidance (cut cosmetics before core
features), the following are documented but not yet built:

- Louvain community detection / structural clustering overlay (§12)
- Full semantic-zoom level system with hysteresis (§13)
- GPU vertex-shader particle event-flow animation along edges (§11)
- Frustum culling / distance-based LOD for very large graphs (§9)
- The formal within-subject 2D-vs-3D user study harness (§21)

These are additive — they don't require changing the graph store or
renderer architecture to add later.

## Project structure

```
index.html            shell: two view panes + investigator sidebar
css/style.css
js/
  graphStore.js        single source of truth + pub/sub
  simulator.js          ransomware evaluation fixture
  traversal.js           Dijkstra + Yen's k-shortest reverse paths
  layout2d.js             Barnes-Hut force layout + hierarchical layout
  render2d.js               SVG renderer
  render3d.js                 Three.js renderer (semantic axes, InstancedMesh)
  ui.js                        investigator panel / filters / timeline
  app.js                        wires everything together
```

## Design principles this follows

1. Every visual element should answer "what investigative information
   does this encode?" — if the answer is "it looks cool," it doesn't
   belong in the core view.
2. One graph, multiple projections — 2D and 3D never fork state.
3. Uncertainty is visible — candidate paths are shown ranked, not
   collapsed to one "true" answer; confidence is treated as a relative
   traversal cost, not a calibrated probability.
4. Time is a first-class dimension (3D Z-axis, timeline scrubber/replay).
5. Ransomware is a fixture, not the deliverable — the simulator is
   deliberately simple.

## License

MIT — see `LICENSE`.

# Reverse Attack-Path Visualization — Implementation Description and Status

## 1. System overview

This project is a browser-based cybersecurity investigation tool designed to support reverse attack-path analysis from a compromised or impacted asset back to the most likely prior events and origins. The system is built as a synchronized 2D/3D visualization of a single shared attack graph, with the same graph state driving both views so analyst selections, filters, and candidate paths remain consistent across representations.

The application is intentionally implemented as a lightweight static web app using HTML, CSS, and JavaScript ES modules. It does not require a build step or backend service. The current implementation is a functional prototype and demonstration platform for reverse-traversal investigation workflows.

## 2. Current project status

Status: Functional prototype / demo-ready

Implemented features:

- Shared graph state with single-source-of-truth architecture
- Synthetic ransomware incident generator for evaluation and testing
- Reverse traversal using confidence-weighted path search
- 2D analytical view using SVG rendering and layout algorithms
- 3D semantic view using Three.js with a fixed semantic axis system
- Investigator UI for node inspection, filters, timeline control, and path ranking
- Ranked reverse-path candidate list with selection synchronization
- State-based node highlighting and DOI-style focus reduction

Not yet implemented or intentionally deferred:

- Full clustering/community overlays
- Advanced semantic zooming with hysteresis
- GPU-accelerated particle event flow
- Large-graph optimization like frustum culling and LOD
- Formal user study harness

Overall maturity: This is a complete prototype for the project brief, but not yet a production-grade analyst platform for real-world enterprise deployment.

## 3. Project architecture

The application follows a modular architecture based on a central shared store. The main conceptual separation is:

1. Data model and graph state
2. Event generation / synthetic incident data
3. Reverse traversal and ranking logic
4. 2D layout and rendering
5. 3D semantic rendering
6. Investigation UI and interaction workflow
7. App bootstrapping and integration

The primary architectural rule is: both visual views read from the same graph store and never maintain separate graph state copies.

## 4. Core files and responsibilities

### index.html

The HTML shell defines:

- the top-level layout
- the 2D and 3D view panes
- the right-side investigator panel
- filter controls
- traversal controls
- timeline playback controls
- the import map for loading Three.js from a CDN

### css/style.css

Provides styling for:

- dashboard shell
- sidebar panel layout
- filter controls and selection states
- path ranking visual emphasis
- animated edge flow and pulse effects
- timeline styling

### js/graphStore.js

This is the central state management layer.

Responsibilities:

- stores all nodes and edges in a shared in-memory graph
- tracks selected node, focus node, and selected path
- stores candidate paths ranked by reverse traversal
- maintains timeline cursor and playback status
- maintains filter values for host, user, process, event type, stage, and confidence
- stores preferred 2D layout mode and 3D theme
- emits custom events to notify UI and renderers of state changes

Key concept: the graph store acts as the single source of truth and is the only shared state location.

### js/simulator.js

This module creates synthetic ransomware-style incident data.

Responsibilities:

- creates attack graph nodes with typed entities such as attacker, host, user, process, credential, file, and network endpoint
- adds edges representing attack events with a source, target, type, stage, timestamp, and confidence
- builds a primary ransomware chain plus decoy branches to create more realistic reverse-path alternatives
- sets baseline node states such as compromised or impacted assets

Important note: the simulator is intentionally a controlled evaluation fixture rather than a real intelligence ingestion engine. It exists to generate realistic incident data for the visualization and traversal logic.

### js/traversal.js

This is the analytical core of the system.

Responsibilities:

- reverse the adjacency of the graph so the search moves from impact back to origin
- compute cost using the formula $w(e) = 1 - c(e)$ where $c(e)$ is edge confidence
- find a best reverse path using Dijkstra-style traversal
- generate ranked candidate paths using a Yen-style top-k shortest-path approach
- reconstruct the node and edge IDs for display in the UI and visual overlays

Analytical assumption:

Confidence is treated as a relative event-quality or support measure, not as a statistically calibrated probability. This matches the intended use for forensic reasoning and ranking rather than precise Bayesian inference.

### js/layout2d.js

This module contains the 2D layout engine.

Responsibilities:

- force-directed layout using a Barnes-Hut quadtree approximation
- stage-based hierarchical layout using attack lifecycle ordering
- node placement logic for the analytical baseline view

Strengths:

- The force layout is intentionally lightweight and scalable for moderate graph sizes.
- The hierarchical layout preserves stage structure for clearer security storyline interpretation.

### js/render2d.js

This is the SVG renderer for the 2D view.

Responsibilities:

- draw graph edges and nodes from the current visible graph state
- apply selected path emphasis by highlighting candidate edges
- apply DOI-based opacity adjustments to emphasize focus and de-emphasize non-relevant nodes
- render node shapes based on node type and state
- render labels for nodes
- synchronize to store events like graph-loaded, filters-changed, timeline-changed, path-selected, theme-changed, and selection-changed

Implementational behavior:

- The renderer reads the store rather than maintaining a local graph copy
- The 2D layout calculates positions and then re-renders from the shared state
- Ranked reverse paths are visually emphasized in the analytical view

### js/render3d.js

This is the Three.js semantic 3D renderer.

Responsibilities:

- construct the 3D scene, camera, lighting, controls, axes, and grid
- render nodes through instanced meshes for efficiency
- map semantic axes to graph dimensions:
  - X = network zone
  - Y = attack stage
  - Z = event time
- render edges and ranked candidate paths in 3D
- allow interaction such as node selection and camera focus

Important design choices:

- Uses a single instanced mesh per node type rather than creating one mesh per node
- Keeps the same semantic axis mapping across the system to preserve consistency
- Stores no separate graph state beyond transient rendering helpers

### js/ui.js

This module handles the analyst interface.

Responsibilities:

- render entity detail panels for selected nodes
- populate available filter options from current graph state
- control timeline playback and scrubber position
- execute reverse traversal when the analyst chooses a starting node
- show ranked candidate origin paths
- link UI selection to graph selection and path selection
- support theme and layout switching

Analyst workflow:

1. Select a node in either view
2. Run reverse traversal from the selected node
3. Review ranked candidate paths
4. Inspect path narrative and node metadata
5. Apply filters and timeline controls to isolate relevant evidence

### js/app.js

This module is the bootstrap layer.

Responsibilities:

- instantiate both renderers
- initialize the investigation UI
- load the initial synthetic incident graph
- connect the regenerate incident button to the simulator
- ensure the app starts from a consistent baseline state

## 5. Reverse traversal design

The reverse attack-path engine is the core analytical mechanism of the system.

### Graph interpretation

Edges represent causal or sequential security events in the direction they occurred in the attack chronology. For reverse analysis, the implementation swaps the graph orientation so the search proceeds from the selected impacted target back toward candidate origins.

### Cost model

Each edge carries a confidence score in the range $[0, 1]$.

The traversal cost is defined as:

$$
w(e) = 1 - c(e)
$$

This means higher-confidence edges are cheaper to traverse in reverse analysis, which reflects the idea that more reliable evidence is more likely to be part of the true causal chain.

### Path ranking

The system computes the best path and then derives additional candidate alternatives using a Yen-style top-k search strategy. These are ranked from the most plausible candidate origin to the least plausible among the enumerated alternatives.

### Why this is useful

Rather than forcing a single explanation, the system presents multiple ranked hypotheses to the analyst. This is especially valuable in incident investigation because evidence often includes decoy branches, partially consistent traces, and multiple possible origins.

## 6. 2D view implementation details

The 2D view is designed as an analytical baseline surface that supports investigation and comparison with the 3D semantic view.

### Layout behavior

The 2D engine supports two layout modes:

- Force-directed layout: optimized with a Barnes-Hut quadtree approximation for repulsive force calculation
- Hierarchical layout: layered by attack stage for clearer security progression

This makes the 2D view useful both as a flexible network graph view and as a stage-structured storyline view.

### Rendering behavior

SVG is used for the 2D layer to support:

- lightweight edge drawing
- node shape rendering
- path emphasis rendering
- simple event-driven updates without a large rendering framework

The implementation uses visual emphasis for candidate paths and node focus to reinforce investigation reasoning without hiding unrelated context.

## 7. 3D view implementation details

The 3D view is the semantic projection of the same attack graph.

### Semantic axes

The design intentionally fixes the semantic interpretation of axes:

- X axis: network zone / segment
- Y axis: attack-lifecycle stage
- Z axis: event time

This gives the analyst a geographic-stage-temporal interpretation of the attack process, which is especially helpful for understanding progression across infrastructure boundaries.

### Rendering approach

The implementation uses Three.js with:

- Perspective camera and orbit controls
- Instanced meshes for node sets
- Standard materials with state color coding
- Grid and semantic axis guides
- Lighting and visual depth cues

This allows the system to keep a consistent shared graph while rendering the same information through a different visual projection.

## 8. Shared state and synchronization model

The project is designed around a shared state model that keeps all investigation logic synchronized.

The graph store manages:

- current visible graph after filters and timeline constraints
- selected node
- focus node used for DOI weighting
- active candidate paths
- node state changes
- theme and layout updates
- timeline reading and playback state

This design satisfies the architectural goal of making 2D and 3D views projections of the same graph rather than independent views with diverging state.

## 9. Focus and context logic (DOI)

The implementation includes a degree-of-interest calculation intended to help the analyst focus on relevant nodes while preserving context.

The conceptual formula is:

$$
DOI(x|y) = API(x) - D(x, y)
$$

Where:

- $API(x)$ is the prior importance of node $x$
- $D(x, y)$ is the graph distance from the focus node $y$

The UI and 2D renderer then fade non-relevant nodes while retaining them in context instead of removing them entirely. This supports investigative reasoning without losing the broader network context.

## 10. Event and state transitions

Nodes are assigned visible states such as:

- Normal
- Suspicious
- Compromised
- Lateral-Movement Source
- Impacted

These states are used for:

- color coding
- size variation
- pulse animations
- analyst-status interpretation

When a node changes state, the system emits a pulse event with rate limiting to avoid excessive animation spam. The implementation intentionally limits pulses to roughly one per node per 500 ms.

## 11. Investigation UI workflows

The current interface supports the following analyst workflow:

- Select an impacted or compromised node
- Run reverse traversal from that node
- View candidate paths ranked by plausibility
- Select a path to inspect the narrative chain
- Use filters to narrow host, user, process, event type, stage, or confidence
- Adjust timeline to inspect the progression over time
- Switch 2D layout style or 3D theme without changing underlying data

This allows an investigator to move from evidence (selected asset) to hypotheses (candidate origins) and then refine the interpretation through filters and timeline playback.

## 12. Implementation strengths

The existing implementation has several clear strengths:

- Clear separation between data, logic, rendering, and UI
- Consistent state architecture across multiple views
- Practical and understandable reverse traversal logic
- Realistic synthetic incident structure for evaluation and testing
- Good prototype-level usability for demonstration and discussion
- Small, understandable codebase with no heavy build tooling

## 13. Current limitations and known issues

The system is intentionally scoped, but several limitations remain:

### 13.1 Synthetic data only

The data generator is designed for demonstration and evaluation, not production threat intelligence ingestion. Real operational graphs would require integration with system logs, EDR telemetry, identity data, and incident-evidence sources.

### 13.2 Prototype algorithm simplifications

The path search is highly useful but simplified compared to production graph analytics systems. It is not designed for extremely large graphs or fully formalized probabilistic reasoning.

### 13.3 2D and 3D are visually informative but not performance-optimized for huge graphs

The system is designed for moderate graph sizes and demo use. It does not yet include advanced large-scale graph optimization.

### 13.4 Theme changes and cosmetic controls are intentionally not core

The 3D themes are applied without altering graph structure, which matches the design brief, but they are still cosmetic and should not be interpreted as analytical features.

### 13.5 No formal backend or persistence layer

The application is entirely client-side and in-memory. There is no storing, importing, or exporting of analysis sessions beyond the browser session runtime.

## 14. Verification and current execution status

The project is implemented and can be served as a static application. A local server can be started from the project root with:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

This project was reviewed and validated for structure and runtime readiness in the current workspace. The implementation files are present and aligned with the intended architecture. The app is suitable for local inspection and interactive demo use in its present form.

## 15. Recommended next-step roadmap

### Near-term improvements

- add graph import/export support
- improve filter persistence and state restoration
- refine path narratives for analyst readability
- add more explicit edge metadata and evidence labels

### Medium-term improvements

- introduce large-graph optimization
- implement clustering overlays and graph-community context
- improve timeline semantics and playback transitions
- extend reverse path scoring with richer evidence weighting

### Long-term direction

- integrate realistic security telemetry sources
- support analyst-driven annotation and case management
- evolve into a broader cyber-investigation workspace rather than a single graph visualization

## 16. Final assessment

This project is a complete and coherent prototype for a synchronized 2D/3D reverse attack-path visualization system. It follows the intended architecture, demonstrates the key analytical concepts described in the brief, and is in a demo-ready state for local use and presentation.

The implementation is strongest in:

- shared-state architecture
- reverse traversal and ranking logic
- dual-view synchronization
- analyst-oriented interaction model

The main gaps are in production-readiness, scale handling, and deeper integration with live security data sources, which are appropriate for a prototype but not yet for operational deployment.

In summary, the system is implemented, functional, and suitable for demonstration and further extension.

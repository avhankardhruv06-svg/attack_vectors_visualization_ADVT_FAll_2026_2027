// app.js — wires together the graph store, both renderers, and Shiny UI.

import { store } from "./graphStore.js";
import { Render2D } from "./render2d.js";
import { Render3D } from "./render3d.js";
// import { initUI } from "./ui.js"; // UI is now handled by Shiny

const view2dContainer = document.getElementById("view-2d");
const view3dContainer = document.getElementById("view-3d");

let render2d = null;
let render3d = null;

if (view2dContainer) render2d = new Render2D(view2dContainer);
if (view3dContainer) render3d = new Render3D(view3dContainer);

// Integration with Shiny
if (window.Shiny) {
  
  Shiny.addCustomMessageHandler('load_scenario_json', function(jsonStr) {
    const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    store.loadGraph(data);
    store.clearSelection();
    store.setCandidatePaths([]);
    store.setTimelineCursor(store.timeRange[1]); // default to full scenario visualization
    reportActiveToShiny();
  });

  let simInterval = null;
  let simSpeed = 1.0;

  Shiny.addCustomMessageHandler('sim_control', function(action) {
    if (action === 'play') {
      if (!simInterval) {
        if (store.timelineCursor >= store.timeRange[1]) {
          store.setTimelineCursor(store.timeRange[0]);
          reportActiveToShiny();
        }
        simInterval = setInterval(() => {
          let newTime = store.timelineCursor + (10 * simSpeed);
          if (newTime > store.timeRange[1]) {
            newTime = store.timeRange[1];
            clearInterval(simInterval);
            simInterval = null;
          }
          store.setTimelineCursor(newTime);
          reportActiveToShiny();
        }, 50);
      }
    } else if (action === 'pause') {
      if (simInterval) {
        clearInterval(simInterval);
        simInterval = null;
      }
    } else if (action === 'reset') {
      if (simInterval) {
        clearInterval(simInterval);
        simInterval = null;
      }
      store.setTimelineCursor(store.timeRange[0]);
      reportActiveToShiny();
    } else if (action === 'step') {
      let newTime = store.timelineCursor + (50 * simSpeed);
      store.setTimelineCursor(Math.min(newTime, store.timeRange[1]));
      reportActiveToShiny();
    }
  });

  Shiny.addCustomMessageHandler('sim_speed', function(val) {
    simSpeed = parseFloat(val);
  });

  Shiny.addCustomMessageHandler('set_layout_2d', function(mode) {
    store.setLayout2d(mode);
  });

  function reportActiveToShiny() {
    const visible = store.getVisibleGraph();
    const activeNodes = visible.nodes.map(n => n.id);
    const activeEdges = visible.edges; 
    Shiny.setInputValue("js_active_nodes", activeNodes);
    Shiny.setInputValue("js_active_edges_json", JSON.stringify(activeEdges));
  }
  
  store.addEventListener("timeline-changed", () => {
     // Re-render handled by graphStore subscriptions in render2d/3d
  });
}

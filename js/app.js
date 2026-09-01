// app.js — wires together the graph store, simulator, both renderers, and
// the investigator UI. This is the only file that "knows about" all the
// pieces; every module above it only depends on graphStore.js.

import { store } from "./graphStore.js";
import { simulateRansomwareIncident } from "./simulator.js";
import { Render2D } from "./render2d.js";
import { Render3D } from "./render3d.js";
import { initUI } from "./ui.js";

const view2dContainer = document.getElementById("view-2d");
const view3dContainer = document.getElementById("view-3d");

const render2d = new Render2D(view2dContainer);
const render3d = new Render3D(view3dContainer);

initUI({ render3d });

document.getElementById("regenerate-btn").addEventListener("click", () => {
  loadIncident();
});

function loadIncident() {
  const branches = Number(document.getElementById("branches-input")?.value) || 2;
  const incident = simulateRansomwareIncident({ branches });
  store.loadGraph(incident);
  store.clearSelection();
  store.setCandidatePaths([]);
}

loadIncident();

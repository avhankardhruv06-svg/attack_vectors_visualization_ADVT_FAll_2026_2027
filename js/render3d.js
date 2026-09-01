// render3d.js
//
// Three.js renderer for the 3D investigation view (brief sections 8-9).
// Semantic axes are fixed and must stay consistent:
//   X = network zone / segment  (Where?)
//   Y = attack-lifecycle stage  (Which stage?)
//   Z = event time              (When?)
//
// Uses a single InstancedMesh for node geometry (brief 9, "instanced
// rendering") instead of one mesh per node. Reads exclusively from the
// shared graph store, same as render2d.js — this is the other stateless
// projection of the same graph (brief section 4's critical rule).

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { store, STAGE_ORDER } from "./graphStore.js";
import { ZONES } from "./simulator.js";

const STATE_COLOR = {
  Normal: 0x5b6b7c,
  Suspicious: 0xe0a72f,
  Compromised: 0xe0642f,
  "Lateral-Movement Source": 0xc23fbf,
  Impacted: 0xe0342f,
};

const MAX_INSTANCES = 2000;

export class Render3D {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f14);

    this.camera = new THREE.PerspectiveCamera(55, this._aspect(), 0.1, 5000);
    this.camera.position.set(60, 60, 90);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this._buildAxesAndGrid();
    this._buildLights();

    // Instanced mesh for all nodes — geometry/material vary only by theme
    // (brief section 10: themes are cosmetic material swaps, never separate
    // renderers or separate geometry systems).
    this.nodeGeometry = new THREE.SphereGeometry(1, 16, 16);
    this.nodeMaterial = new THREE.MeshStandardMaterial({ vertexColors: true });
    this.instancedNodes = new THREE.InstancedMesh(this.nodeGeometry, this.nodeMaterial, MAX_INSTANCES);
    this.instancedNodes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 3), 3);
    this.scene.add(this.instancedNodes);

    this.edgeGroup = new THREE.Group();
    this.scene.add(this.edgeGroup);
    this.pathGroup = new THREE.Group();
    this.scene.add(this.pathGroup);
    this.flowGroup = new THREE.Group();
    this.scene.add(this.flowGroup);

    this._idByInstance = [];
    this._flowParticles = [];
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();

    this.renderer.domElement.addEventListener("click", (e) => this._onClick(e));

    store.addEventListener("graph-loaded", () => this.render());
    store.addEventListener("filters-changed", () => this.render());
    store.addEventListener("timeline-changed", () => this.render());
    store.addEventListener("selection-changed", () => this.render());
    store.addEventListener("paths-changed", () => this.render());
    store.addEventListener("path-selected", () => this.render());
    store.addEventListener("theme-changed", () => this._applyTheme());

    window.addEventListener("resize", () => this._onResize());

    this._animate();
  }

  _aspect() {
    return this.container.clientWidth / Math.max(this.container.clientHeight, 1);
  }

  _buildAxesAndGrid() {
    // Grid in X-Y plane (horizontal), Z pointing up (vertical)
    const grid = new THREE.GridHelper(160, 16, 0x22303f, 0x18202b);
    grid.rotation.x = Math.PI / 2; // Rotate so X-Y is horizontal, Z is vertical
    this.scene.add(grid);

    const axisMat = new THREE.LineBasicMaterial({ color: 0x445566 });
    const mkLine = (from, to) => {
      const g = new THREE.BufferGeometry().setFromPoints([from, to]);
      return new THREE.Line(g, axisMat);
    };

    // X-axis: left-right on grid (red-ish)
    const axisXMat = new THREE.LineBasicMaterial({ color: 0xc23f3f });
    const axisX = mkLine(new THREE.Vector3(-80, 0, 0), new THREE.Vector3(80, 0, 0));
    axisX.material = axisXMat;
    
    // Y-axis: forward-back on grid (green-ish)
    const axisYMat = new THREE.LineBasicMaterial({ color: 0x3fc23f });
    const axisY = mkLine(new THREE.Vector3(0, -80, 0), new THREE.Vector3(0, 80, 0));
    axisY.material = axisYMat;
    
    // Z-axis: vertical (blue-ish)
    const axisZMat = new THREE.LineBasicMaterial({ color: 0x3f3fc2 });
    const axisZ = mkLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 80));
    axisZ.material = axisZMat;
    
    this.scene.add(axisX, axisY, axisZ);

    const labelStyle = { color: "#dfeaf6", fontSize: 18, fontFamily: "sans-serif" };
    const makeLabel = (text, position) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      ctx.font = `${labelStyle.fontSize}px ${labelStyle.fontFamily}`;
      const width = ctx.measureText(text).width;
      canvas.width = width + 24;
      canvas.height = labelStyle.fontSize + 20;
      const ctx2 = canvas.getContext("2d");
      ctx2.font = `${labelStyle.fontSize}px ${labelStyle.fontFamily}`;
      ctx2.fillStyle = labelStyle.color;
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillText(text, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      sprite.scale.set(12, 4, 1);
      return sprite;
    };

    this.scene.add(makeLabel("X", new THREE.Vector3(85, 0, 0)));
    this.scene.add(makeLabel("Y", new THREE.Vector3(0, 85, 0)));
    this.scene.add(makeLabel("Z", new THREE.Vector3(0, 0, 85)));
  }

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(40, 80, 40);
    this.scene.add(dir);
  }

  // ---- semantic axis mapping (brief section 8) --------------------------

  _position(node, timeRange) {
    const xIdx = Math.max(0, ZONES.indexOf(node.zone));
    const x = (xIdx / Math.max(ZONES.length - 1, 1)) * 140 - 70;

    const yIdx = Math.max(0, STAGE_ORDER.indexOf(node.stage));
    const y = (yIdx / Math.max(STAGE_ORDER.length - 1, 1)) * 80 - 40;

    const [t0, t1] = timeRange;
    const tNorm = t1 > t0 ? (node.time - t0) / (t1 - t0) : 0.5;
    const z = tNorm * 80; // Z ranges from 0 to 80 (vertical, pointing up)

    return new THREE.Vector3(x, y, z);
  }

  render() {
    const { nodes, edges } = store.getVisibleGraph();

    // Derive each node's stage/time from its incident edges for axis placement.
    const stageOf = new Map();
    const timeOf = new Map();
    for (const e of edges) {
      if (e.stage) { stageOf.set(e.source, e.stage); stageOf.set(e.target, e.stage); }
      timeOf.set(e.target, e.timestamp);
      if (!timeOf.has(e.source)) timeOf.set(e.source, e.timestamp);
    }
    nodes.forEach((n) => { n.stage = stageOf.get(n.id) || STAGE_ORDER[0]; n.time = timeOf.get(n.id) ?? store.timeRange[0]; });

    const positions = new Map();
    nodes.forEach((n) => positions.set(n.id, this._position(n, store.timeRange)));

    // ---- instanced node positions/colors ----
    this._idByInstance = [];
    const dummy = new THREE.Object3D();
    nodes.slice(0, MAX_INSTANCES).forEach((n, i) => {
      const p = positions.get(n.id);
      dummy.position.copy(p);
      const scale = n.state === "Impacted" ? 2.2 : n.state === "Compromised" ? 1.7 : n.id === store.selectedNodeId ? 1.9 : 1.2;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      this.instancedNodes.setMatrixAt(i, dummy.matrix);

      const color = new THREE.Color(STATE_COLOR[n.state] ?? 0x5b6b7c);
      const doi = store.degreeOfInterest(n.id);
      if (store.focusNodeId) {
        const fade = clamp(0.15 + doi * 0.22, 0.08, 1);
        color.multiplyScalar(fade);
      }
      this.instancedNodes.setColorAt(i, color);
      this._idByInstance[i] = n.id;
    });
    this.instancedNodes.count = Math.min(nodes.length, MAX_INSTANCES);
    this.instancedNodes.instanceMatrix.needsUpdate = true;
    if (this.instancedNodes.instanceColor) this.instancedNodes.instanceColor.needsUpdate = true;

    // ---- edges as thin lines ----
    this.edgeGroup.clear();
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x3a4656, transparent: true, opacity: 0.5 });
    const edgePts = [];
    for (const e of edges) {
      const a = positions.get(e.source), b = positions.get(e.target);
      if (!a || !b) continue;
      edgePts.push(a, b);
    }
    if (edgePts.length) {
      const geo = new THREE.BufferGeometry().setFromPoints(edgePts);
      this.edgeGroup.add(new THREE.LineSegments(geo, edgeMat));
    }

    // ---- ranked candidate reverse-paths (brief 6.2) ----
    this.pathGroup.clear();
    this.flowGroup.clear();
    this._flowParticles = [];

    store.candidatePaths.forEach((path, pathIndex) => {
      const selected = store.selectedPathIndex === pathIndex;
      const opacity = selected ? 1 : Math.max(0.25, 1 - (path.rank - 1) * 0.3);
      const color = path.rank === 1 ? 0xff5c5c : 0xffb44d;
      const pts = path.nodeIds.map((id) => positions.get(id)).filter(Boolean);
      if (pts.length < 2) return;
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, linewidth: selected ? 3 : 2 });
      this.pathGroup.add(new THREE.Line(geo, mat));

      if (selected) {
        const flowMaterial = new THREE.MeshStandardMaterial({
          color: 0x7ae0ff,
          emissive: 0x4cc7ff,
          emissiveIntensity: 1.2,
          transparent: true,
          opacity: 0.95,
        });
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 10), flowMaterial.clone());
          sphere.position.copy(a.clone().lerp(b, 0.25));
          this.flowGroup.add(sphere);
          this._flowParticles.push({ mesh: sphere, a, b, phase: i * 0.28 + 0.1, speed: 0.45 + i * 0.05 });
        }
      }
    });

    this._positions = positions;
  }

  focusOnNode(nodeId) {
    const p = this._positions?.get(nodeId);
    if (!p) return;
    this.controls.target.copy(p);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(p.clone().add(dir.multiplyScalar(40)));
  }

  _applyTheme() {
    // Cosmetic only: swap material params, never geometry or graph data
    // (brief section 10).
    const theme = store.theme;
    if (theme === "neural") {
      this.nodeMaterial.emissive = new THREE.Color(0x2244ff);
      this.nodeMaterial.emissiveIntensity = 0.4;
    } else if (theme === "organic") {
      this.nodeMaterial.emissive = new THREE.Color(0x22aa55);
      this.nodeMaterial.emissiveIntensity = 0.25;
    } else {
      this.nodeMaterial.emissive = new THREE.Color(0x000000);
      this.nodeMaterial.emissiveIntensity = 0;
    }
    this.nodeMaterial.needsUpdate = true;
  }

  _onClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hit = this._raycaster.intersectObject(this.instancedNodes)[0];
    if (hit && hit.instanceId != null) {
      const nodeId = this._idByInstance[hit.instanceId];
      if (nodeId) store.selectNode(nodeId);
    } else {
      store.clearSelection();
    }
  }

  _onResize() {
    this.camera.aspect = this._aspect();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  _animate = () => {
    requestAnimationFrame(this._animate);

    const t = performance.now() * 0.001;
    this._flowParticles.forEach((particle) => {
      const p = (t * particle.speed + particle.phase) % 1;
      particle.mesh.position.copy(particle.a.clone().lerp(particle.b, p));
      const pulse = 0.8 + Math.sin(t * 6 + particle.phase * 20) * 0.3;
      particle.mesh.scale.setScalar(pulse);
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

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
import { normalizeType, getExactAttackRole } from "./render2d.js";

const STATE_COLOR = {
  Normal: 0x5b6b7c,
  Suspicious: 0xe0a72f,
  Compromised: 0xe0642f,
  "Lateral-Movement Source": 0xc23fbf,
  Impacted: 0xe0342f,
};

const TYPE_COLOR = {
  attacker: 0xef4444,
  host: 0x3b82f6,
  user: 0x06b6d4,
  process: 0xf97316,
  credential: 0xd946ef,
  file: 0x10b981,
  network_endpoint: 0x8b5cf6,
};



const MAX_INSTANCES = 2000;

export class Render3D {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeef2f5);

    this.camera = new THREE.PerspectiveCamera(55, this._aspect(), 0.1, 5000);
    this.camera.position.set(70, 70, 75);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.camera.up.set(0, 0, 1); // Z is up in this visualization
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 24); // Center the floor and node volume together
    this.controls.enableDamping = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = 0.75;
    this.controls.rotateSpeed = 0.65;
    this.controls.panSpeed = 0.65;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 360;
    this.controls.minPolarAngle = 0.04;
    this.controls.maxPolarAngle = Math.PI - 0.04;
    this.controls.screenSpacePanning = false;
    this.controls.zoomToCursor = true;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.controls.update();

    this._buildAxesAndGrid();
    this._buildLights();

    // Use one instanced mesh per node type so each system class keeps its own
    // silhouette while still sharing the same graph and rendering pipeline.
    this.nodeMeshes = new Map();
    this._idByInstance = new Map();
    this.nodeLabelGroup = new THREE.Group();
    this.scene.add(this.nodeLabelGroup);
    this._buildNodeMeshes();

    this.edgeGroup = new THREE.Group();
    this.scene.add(this.edgeGroup);
    this.pathGroup = new THREE.Group();
    this.scene.add(this.pathGroup);
    this.flowGroup = new THREE.Group();
    this.scene.add(this.flowGroup);

    this._flowParticles = [];
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._dragNodeId = null;
    this._dragPlane = new THREE.Plane();
    this._dragOffset = new THREE.Vector3();

    this.renderer.domElement.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    this.renderer.domElement.addEventListener("pointermove", (e) => this._onPointerMove(e));
    window.addEventListener("pointerup", () => this._onPointerUp());
    this.renderer.domElement.addEventListener("click", (e) => this._onClick(e));

    store.addEventListener("graph-loaded", () => this.render());
    store.addEventListener("filters-changed", () => this.render());
    store.addEventListener("timeline-changed", () => this.render());
    store.addEventListener("selection-changed", () => this.render());
    store.addEventListener("paths-changed", () => this.render());
    store.addEventListener("path-selected", () => this.render());
    store.addEventListener("theme-changed", () => this._applyTheme());

    window.addEventListener("resize", () => this._onResize());
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(container);

    this._animate();
  }

  _aspect() {
    return this.container.clientWidth / Math.max(this.container.clientHeight, 1);
  }

  _buildNodeMeshes() {
    const geometries = new Map([
      ["attacker", new THREE.TetrahedronGeometry(1.5, 0)],
      ["host", new THREE.BoxGeometry(1.8, 1.8, 1.8)],
      ["user", new THREE.SphereGeometry(1.2, 20, 20)],
      ["process", new THREE.OctahedronGeometry(1.3, 0)],
      ["credential", new THREE.TorusKnotGeometry(0.7, 0.25, 72, 10)],
      ["file", new THREE.CylinderGeometry(0.9, 1.2, 1.8, 6)],
      ["network_endpoint", new THREE.CylinderGeometry(1.2, 1.4, 2.2, 8)],
    ]);

    for (const [type, geometry] of geometries.entries()) {
      const typeHex = TYPE_COLOR[type] ?? 0x3b82f6;
      const material = new THREE.MeshStandardMaterial({
        color: typeHex,
        emissive: typeHex,
        emissiveIntensity: 0.2,
        roughness: 0.25,
        metalness: 0.1,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
      mesh.count = 0;
      this.nodeMeshes.set(type, mesh);
      this._idByInstance.set(mesh, []);
      this.scene.add(mesh);
    }
  }

  _buildAxesAndGrid() {
    // Grid in X-Y plane (horizontal), Z pointing up (vertical)
    const grid = new THREE.GridHelper(160, 16, 0xcccccc, 0xdddddd);
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

    const labelStyle = { color: "#212529", fontSize: 18, fontFamily: "sans-serif" };
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
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambient);
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir1.position.set(50, 100, 80);
    this.scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dir2.position.set(-50, -50, -40);
    this.scene.add(dir2);
  }

  // ---- semantic axis mapping (brief section 8) --------------------------

  _position(node, timeRange) {
    if (node.manualPosition) {
      if (typeof node.manualPosition.clone === "function") {
        return node.manualPosition.clone();
      }
      return new THREE.Vector3(Number(node.manualPosition.x) || 0, Number(node.manualPosition.y) || 0, Number(node.manualPosition.z) || 0);
    }

    const xIdx = Math.max(0, ZONES.indexOf(node.zone));
    const x = (xIdx / Math.max(ZONES.length - 1, 1)) * 140 - 70;

    const yIdx = Math.max(0, STAGE_ORDER.indexOf(node.stage));
    const y = (yIdx / Math.max(STAGE_ORDER.length - 1, 1)) * 80 - 40;

    const [t0, t1] = timeRange || [0, 1];
    const tNorm = t1 > t0 ? ((node.time ?? t0) - t0) / (t1 - t0) : 0.5;
    const z = tNorm * 80;

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
    this.nodeMeshes.forEach((mesh) => {
      mesh.count = 0;
      this._idByInstance.set(mesh, []);
    });

    const dummy = new THREE.Object3D();
    nodes.slice(0, MAX_INSTANCES).forEach((n) => {
      const normType = normalizeType(n.type);
      const mesh = this.nodeMeshes.get(normType) ?? this.nodeMeshes.get("host");
      if (!mesh) return;
      const p = positions.get(n.id);
      const idx = mesh.count++;
      dummy.position.copy(p);
      const selectedBoost = n.id === store.selectedNodeId ? 1.35 : 1;
      const scale = n.state === "Impacted" ? 2.2 : n.state === "Compromised" ? 1.7 : 1.2;
      const typeScale = normType === "user" ? 0.95 : normType === "credential" ? 0.9 : 1;
      dummy.scale.setScalar(scale * typeScale * selectedBoost);
      dummy.rotation.set(
        normType === "file" ? Math.PI / 6 : normType === "network_endpoint" ? Math.PI / 2 : 0,
        normType === "host" ? Math.PI / 4 : 0,
        normType === "credential" ? Math.PI / 3 : 0,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);

      this._idByInstance.get(mesh)[idx] = n.id;
    });

    this.nodeMeshes.forEach((mesh) => {
      mesh.count = Math.min(mesh.count, MAX_INSTANCES);
      mesh.instanceMatrix.needsUpdate = true;
    });

    this.nodeLabelGroup.clear();
    nodes.forEach((n) => {
      const p = positions.get(n.id);
      if (!p || !n.description) return;
      const isSelected = n.id === store.selectedNodeId;
      const normType = normalizeType(n.type);
      const hexVal = TYPE_COLOR[normType] ?? 0x0d6efd;
      const hexStr = "#" + hexVal.toString(16).padStart(6, "0");

      const lines = isSelected
        ? [n.label || n.id, `Role: ${getExactAttackRole(n, store)}`]
        : this._wrapNodeLabel(n.label || n.id, "", 22);

      const canvas = document.createElement("canvas");
      const lineHeight = isSelected ? 20 : 16;
      const padding = isSelected ? 20 : 14;
      const fontSize = isSelected ? 14 : 12;

      const tempCtx = canvas.getContext("2d");
      tempCtx.font = `${isSelected ? "bold " : ""}${fontSize}px sans-serif`;
      const textWidth = Math.max(...lines.map((line) => tempCtx.measureText(line).width));
      canvas.width = Math.max(textWidth + padding * 2, 160);
      canvas.height = lines.length * lineHeight + padding * 2;

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = isSelected ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = isSelected ? hexStr : "rgba(13, 110, 253, 0.7)";
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

      lines.forEach((line, index) => {
        if (index === 0) {
          ctx.font = `bold ${fontSize + 1}px sans-serif`;
          ctx.fillStyle = hexStr;
        } else {
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = "#212529";
        }
        ctx.fillText(line, padding, padding + fontSize + index * lineHeight - 2);
      });

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(p.clone().add(new THREE.Vector3(0, 5, 2.5)));
      
      const scaleFactor = isSelected ? 2.2 : 1;
      sprite.scale.set((canvas.width / 18) * scaleFactor, (canvas.height / 18) * scaleFactor, 1);
      
      if (isSelected) {
        sprite.material.depthTest = false;
        sprite.renderOrder = 999;
      }
      this.nodeLabelGroup.add(sprite);
    });

    // ---- edges as thin lines ----
    this.edgeGroup.clear();
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x8899aa, transparent: true, opacity: store.selectedNodeId ? 0.1 : 0.5 });
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
    this._updateInfoCard();
  }

  _initInfoCard() {
    this.infoCard = document.createElement("div");
    this.infoCard.className = "node-details-popover-3d";
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
      this._lastSelectedId = null;
      return;
    }
    const node = store.nodes.get(nodeId);
    if (!node) {
      this.infoCard.style.display = "none";
      this._lastSelectedId = null;
      return;
    }
    const normType = normalizeType(node.type);
    const hexVal = TYPE_COLOR[normType] ?? 0x0d6efd;
    const hexStr = "#" + hexVal.toString(16).padStart(6, "0");
    const desc = getExactAttackRole(node, store);
    const description = node.description || desc;

    this.infoCard.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #e9ecef; padding-bottom: 6px;">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #212529;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: ${hexStr};"></span>
          ${node.label || node.id}
        </div>
        <button id="close-card-3d" style="background: none; border: none; font-size: 18px; color: #6c757d; cursor: pointer; line-height: 1; padding: 0 4px;">&times;</button>
      </div>
      <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
        <span style="background: ${hexStr}; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase;">${normType}</span>
        <span style="background: #e9ecef; color: #495057; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">Zone: ${node.zone || "N/A"}</span>
        <span style="background: #e9ecef; color: #495057; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">Stage: ${node.stage || "N/A"}</span>
        <span style="background: #e9ecef; color: #495057; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">Status: ${node.state || "Normal"}</span>
      </div>
      <div style="font-size: 12px; color: #212529; line-height: 1.45; background: #f8f9fa; padding: 8px 10px; border-radius: 6px; border-left: 4px solid ${hexStr};">
        <strong style="color: #0d6efd; display: block; margin-bottom: 3px;">Description</strong>
        ${description}
      </div>
    `;
    this.infoCard.style.display = "block";
    const closeBtn = this.infoCard.querySelector("#close-card-3d");
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        store.clearSelection();
      };
    }

    if (this._lastSelectedId !== nodeId) {
      this._lastSelectedId = nodeId;
      this.focusOnNode(nodeId);
    }
  }

  _wrapNodeLabel(label, description, maxChars) {
    const parts = [label, description].filter(Boolean);
    const lines = [];
    for (const part of parts) {
      const clean = part.replace(/\s+/g, " ").trim();
      if (!clean) continue;
      const chunks = [];
      for (let i = 0; i < clean.length; i += maxChars) {
        chunks.push(clean.slice(i, i + maxChars));
      }
      lines.push(...chunks);
    }
    return lines.slice(0, 3);
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
    const emissive = theme === "neural" ? 0x2244ff : theme === "organic" ? 0x22aa55 : 0x000000;
    const intensity = theme === "neural" ? 0.4 : theme === "organic" ? 0.25 : 0;

    this.nodeMeshes.forEach((mesh) => {
      mesh.material.emissive = new THREE.Color(emissive);
      mesh.material.emissiveIntensity = intensity;
      mesh.material.needsUpdate = true;
    });
  }

  _hitNodeIdFromPointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hit = this._raycaster.intersectObjects([...this.nodeMeshes.values()], true)[0];
    if (!hit || hit.instanceId == null || !hit.object?.isInstancedMesh) return null;
    const nodeId = this._idByInstance.get(hit.object)?.[hit.instanceId];
    return nodeId || null;
  }

  _onPointerDown(e) {
    const nodeId = this._hitNodeIdFromPointer(e);
    if (!nodeId) return;
    store.selectNode(nodeId);
    const hit = this._raycaster.intersectObjects([...this.nodeMeshes.values()], true)[0];
    if (!hit || hit.instanceId == null || !hit.object?.isInstancedMesh) return;
    this._dragNodeId = nodeId;
    const current = this._positions?.get(nodeId);
    if (!current) return;
    this._dragPlane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()).clone().multiplyScalar(-1), hit.point.clone());
    this._dragOffset.copy(hit.point).sub(current);
  }

  _onPointerMove(e) {
    if (!this._dragNodeId) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const nextPoint = new THREE.Vector3();
    if (!this._raycaster.ray.intersectPlane(this._dragPlane, nextPoint)) return;
    const node = store.nodes.get(this._dragNodeId);
    if (!node) return;
    node.manualPosition = nextPoint.clone().sub(this._dragOffset);
    this.render();
  }

  _onPointerUp() {
    this._dragNodeId = null;
  }

  _onClick(e) {
    const nodeId = this._hitNodeIdFromPointer(e);
    if (nodeId) {
      store.selectNode(nodeId);
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

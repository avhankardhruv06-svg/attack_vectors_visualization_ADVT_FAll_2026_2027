// 2D Interactive Analytical Graph Renderer
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGraphStore } from '../../graph/graphStore';
import { GraphNode, GraphEdge } from '../../graph/types';
import { computeHierarchicalLayout, runForceLayout2D } from './layouts';
import {
  ENTITY_COLORS,
  STATE_COLORS,
  THEMES,
  STAGE_LABELS,
} from '../theme/themeManager';
import { ShieldAlert, Crosshair, ZoomIn, ZoomOut, RefreshCw, Layers } from 'lucide-react';

export const Graph2DCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    filteredGraph,
    selectedNodeId,
    hoveredNodeId,
    selectNode,
    hoverNode,
    reverseTraversal,
    doiMap,
    layout2D,
    setLayout2D,
    theme,
  } = useGraphStore();

  const themeConfig = THEMES[theme];

  // Pan & Zoom Transform State
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const isDraggingCanvasRef = useRef(false);
  const isDraggingNodeRef = useRef<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Internal Node Positions
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(
    new Map()
  );

  // Animation pulse ticker for reverse path
  const animFrameRef = useRef<number | null>(null);
  const pulsePhaseRef = useRef<number>(0);

  // Calculate layout positions when nodes or layout mode changes
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    if (layout2D === 'HIERARCHICAL') {
      const posMap = computeHierarchicalLayout(filteredGraph.nodes, width, height);
      setNodePositions(posMap);
    } else {
      // Force Layout
      const sim = runForceLayout2D(
        filteredGraph.nodes,
        filteredGraph.edges,
        width,
        height,
        (simNodes) => {
          const posMap = new Map<string, { x: number; y: number }>();
          simNodes.forEach((n) => {
            const nodeX = (n as any).x ?? width / 2;
            const nodeY = (n as any).y ?? height / 2;
            posMap.set(n.id, { x: nodeX, y: nodeY });
          });
          setNodePositions(posMap);
        }
      );

      return () => {
        sim.stop();
      };
    }
  }, [filteredGraph.nodes, filteredGraph.edges, layout2D]);

  // Center view on selection or initial load
  const resetZoom = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;
    setTransform({ k: 1, x: 0, y: 0 });
  }, []);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      pulsePhaseRef.current = (pulsePhaseRef.current + 0.04) % (Math.PI * 2);

      const dpr = window.devicePixelRatio || 1;
      const width = containerRef.current?.clientWidth || 800;
      const height = containerRef.current?.clientHeight || 600;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = themeConfig.background;
      ctx.fillRect(0, 0, width, height);

      // Apply Pan & Zoom Transform
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // 1. Draw Hierarchical Column Guidelines if in Hierarchical Mode
      if (layout2D === 'HIERARCHICAL') {
        const stages = [
          'INITIAL_ACCESS',
          'EXECUTION',
          'CREDENTIAL_ACCESS',
          'LATERAL_MOVEMENT',
          'COLLECTION_EXFIL',
          'IMPACT',
        ];
        const colWidth = (width - 160) / stages.length;
        const startX = 80 + colWidth / 2;

        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = themeConfig.textMuted;

        stages.forEach((stage, idx) => {
          const colX = startX + idx * colWidth;
          // Column delimiter line
          ctx.strokeStyle = themeConfig.surfaceBorder;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(colX - colWidth / 2, 40);
          ctx.lineTo(colX - colWidth / 2, height - 40);
          ctx.stroke();
          ctx.setLineDash([]);

          // Header title
          ctx.fillStyle = themeConfig.textSecondary;
          ctx.fillText(STAGE_LABELS[stage as keyof typeof STAGE_LABELS], colX, 30);
        });
      }

      // Reverse Path Sets for Fast Lookup
      const rank1 = reverseTraversal.results[0];
      const rank2 = reverseTraversal.results[1];
      const rank3 = reverseTraversal.results[2];

      const rank1EdgeSet = new Set(rank1?.edgeIds || []);
      const rank2EdgeSet = new Set(rank2?.edgeIds || []);
      const rank3EdgeSet = new Set(rank3?.edgeIds || []);

      const activePath = reverseTraversal.results[reverseTraversal.activePathIndex];
      const activeNodeIds = new Set(activePath?.nodeIds || []);
      const activeEdgeIds = new Set(activePath?.edgeIds || []);
      const bottleneckSet = new Set(activePath?.criticalCutVertices || []);

      const isTracingActive = reverseTraversal.results.length > 0;

      // 2. Draw Edges
      filteredGraph.edges.forEach((edge) => {
        const srcPos = nodePositions.get(edge.source);
        const tgtPos = nodePositions.get(edge.target);
        if (!srcPos || !tgtPos) return;

        const isRank1 = rank1EdgeSet.has(edge.id);
        const isRank2 = rank2EdgeSet.has(edge.id);
        const isRank3 = rank3EdgeSet.has(edge.id);
        const isSelectedPathEdge = activeEdgeIds.has(edge.id);

        let strokeColor = themeConfig.edgeDefault;
        let lineWidth = 1.5 + (edge.confidence || 0.5) * 2;
        let alpha = 0.45;

        if (isTracingActive) {
          if (isRank1) {
            strokeColor = themeConfig.rank1Path;
            lineWidth = 3.5;
            alpha = 1.0;
          } else if (isRank2) {
            strokeColor = themeConfig.rank2Path;
            lineWidth = 2.5;
            alpha = 0.75;
          } else if (isRank3) {
            strokeColor = themeConfig.rank3Path;
            lineWidth = 2.0;
            alpha = 0.6;
          } else {
            alpha = 0.12; // Dim unrelated edges
          }
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;

        // Draw curved bezier edge
        const dx = tgtPos.x - srcPos.x;
        const dy = tgtPos.y - srcPos.y;
        const cx = (srcPos.x + tgtPos.x) / 2 - dy * 0.15;
        const cy = (srcPos.y + tgtPos.y) / 2 + dx * 0.15;

        ctx.beginPath();
        ctx.moveTo(srcPos.x, srcPos.y);
        ctx.quadraticCurveTo(cx, cy, tgtPos.x, tgtPos.y);
        ctx.stroke();

        // If part of active reverse path, animate backward traveling reverse pulse
        if (isSelectedPathEdge) {
          const pulseT = ((Math.sin(pulsePhaseRef.current * 2) + 1) / 2);
          // Inverse direction: travel from target toward source for reverse investigation!
          const pulseU = 1.0 - pulseT;
          const px = (1 - pulseU) * (1 - pulseU) * srcPos.x + 2 * (1 - pulseU) * pulseU * cx + pulseU * pulseU * tgtPos.x;
          const py = (1 - pulseU) * (1 - pulseU) * srcPos.y + 2 * (1 - pulseU) * pulseU * cy + pulseU * pulseU * tgtPos.y;

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Outer pulse glow
          ctx.fillStyle = strokeColor;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(px, py, 8.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Arrow head on edge target
        const angle = Math.atan2(tgtPos.y - cy, tgtPos.x - cx);
        const arrowDist = 22; // offset from node center
        const ax = tgtPos.x - Math.cos(angle) * arrowDist;
        const ay = tgtPos.y - Math.sin(angle) * arrowDist;

        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(
          ax - 8 * Math.cos(angle - Math.PI / 6),
          ay - 8 * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          ax - 8 * Math.cos(angle + Math.PI / 6),
          ay - 8 * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      });

      // 3. Draw Nodes
      filteredGraph.nodes.forEach((node) => {
        const pos = nodePositions.get(node.id);
        if (!pos) return;

        const isSelected = selectedNodeId === node.id;
        const isHovered = hoveredNodeId === node.id;
        const isInActivePath = activeNodeIds.has(node.id);
        const isBottleneck = bottleneckSet.has(node.id);
        const doi = doiMap.get(node.id) ?? 0.5;

        let nodeRadius = 18;
        if (isSelected) nodeRadius = 24;
        else if (isHovered) nodeRadius = 21;
        else if (node.type === 'HOST' || node.type === 'ATTACKER') nodeRadius = 20;

        let alpha = isTracingActive
          ? isInActivePath
            ? 1.0
            : Math.max(0.2, doi * 0.4)
          : Math.max(0.35, doi);

        ctx.save();
        ctx.globalAlpha = alpha;

        const entityColor = ENTITY_COLORS[node.type] || '#38bdf8';
        const stateColor = STATE_COLORS[node.state] || '#64748b';

        // Outer Security State Ring
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = stateColor;
        ctx.lineWidth = node.state === 'IMPACTED' || node.state === 'COMPROMISED' ? 3.5 : 2;
        ctx.stroke();

        // Pulsating glow for Impacted or Selected
        if (node.state === 'IMPACTED' || isSelected) {
          const glowRadius = nodeRadius + 8 + Math.sin(pulsePhaseRef.current) * 3;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? '#38bdf8' : stateColor;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.5;
          ctx.stroke();
          ctx.globalAlpha = alpha;
        }

        // Inner Core Node Circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = themeConfig.surface;
        ctx.fill();
        ctx.fillStyle = entityColor;
        ctx.globalAlpha = alpha * 0.25;
        ctx.fill();
        ctx.globalAlpha = alpha;

        // Node Inner Icon / Initial Letter
        ctx.fillStyle = entityColor;
        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const letter = node.type === 'ATTACKER' ? '☠' : node.type[0];
        ctx.fillText(letter, pos.x, pos.y);

        // Bottleneck Warning Shield Badge
        if (isBottleneck) {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(pos.x + nodeRadius - 2, pos.y - nodeRadius + 2, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 8px sans-serif';
          ctx.fillText('⚡', pos.x + nodeRadius - 2, pos.y - nodeRadius + 2);
        }

        // Node Label Text
        ctx.font = isSelected || isInActivePath ? 'bold 11px Inter, sans-serif' : '10px Inter, sans-serif';
        ctx.fillStyle = isSelected ? '#38bdf8' : isInActivePath ? '#fbbf24' : themeConfig.textPrimary;
        ctx.textAlign = 'center';
        ctx.fillText(node.label, pos.x, pos.y + nodeRadius + 14);

        // Subtext (Entity Type / Security State)
        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = themeConfig.textMuted;
        ctx.fillText(`${node.type} • ${node.state}`, pos.x, pos.y + nodeRadius + 26);

        ctx.restore();
      });

      ctx.restore(); // Restore pan/zoom transform
      ctx.restore(); // Restore DPR

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [
    filteredGraph,
    nodePositions,
    transform,
    selectedNodeId,
    hoveredNodeId,
    reverseTraversal,
    doiMap,
    layout2D,
    themeConfig,
  ]);

  // Pointer Interaction Handlers: Hit Detection, Pan, Drag, Zoom
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: (screenX - transform.x) / transform.k,
        y: (screenY - transform.y) / transform.k,
      };
    },
    [transform]
  );

  const findNodeAtPos = useCallback(
    (worldX: number, worldY: number): GraphNode | null => {
      for (const node of filteredGraph.nodes) {
        const pos = nodePositions.get(node.id);
        if (pos) {
          const dx = pos.x - worldX;
          const dy = pos.y - worldY;
          if (Math.sqrt(dx * dx + dy * dy) <= 26) {
            return node;
          }
        }
      }
      return null;
    },
    [filteredGraph.nodes, nodePositions]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const world = screenToWorld(clientX, clientY);
    const hitNode = findNodeAtPos(world.x, world.y);

    if (hitNode) {
      isDraggingNodeRef.current = hitNode.id;
      selectNode(hitNode.id);
    } else {
      isDraggingCanvasRef.current = true;
      dragStartRef.current = { x: clientX - transform.x, y: clientY - transform.y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const world = screenToWorld(clientX, clientY);

    if (isDraggingNodeRef.current) {
      const nodeId = isDraggingNodeRef.current;
      setNodePositions((prev) => {
        const next = new Map(prev);
        next.set(nodeId, { x: world.x, y: world.y });
        return next;
      });
      return;
    }

    if (isDraggingCanvasRef.current) {
      setTransform((prev) => ({
        ...prev,
        x: clientX - dragStartRef.current.x,
        y: clientY - dragStartRef.current.y,
      }));
      return;
    }

    // Hover hit detection
    const hitNode = findNodeAtPos(world.x, world.y);
    hoverNode(hitNode ? hitNode.id : null);
  };

  const handlePointerUp = () => {
    isDraggingCanvasRef.current = false;
    isDraggingNodeRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform((prev) => {
      const newK = Math.max(0.2, Math.min(4.0, prev.k * zoomFactor));
      return {
        k: newK,
        x: mouseX - (mouseX - prev.x) * (newK / prev.k),
        y: mouseY - (mouseY - prev.y) * (newK / prev.k),
      };
    });
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none bg-slate-950">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Floating 2D View Controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-lg p-1.5 shadow-xl">
        <button
          onClick={() => setTransform((p) => ({ ...p, k: Math.min(4, p.k * 1.2) }))}
          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setTransform((p) => ({ ...p, k: Math.max(0.2, p.k * 0.8) }))}
          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={resetZoom}
          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition"
          title="Reset View"
        >
          <RefreshCw size={16} />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <button
          onClick={() => setLayout2D(layout2D === 'HIERARCHICAL' ? 'FORCE' : 'HIERARCHICAL')}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded transition"
        >
          <Layers size={14} />
          <span>{layout2D === 'HIERARCHICAL' ? 'Hierarchical Stages' : 'Force Directed'}</span>
        </button>
      </div>

      {/* 2D HUD Legend Badge */}
      <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-lg px-3 py-1.5 pointer-events-none">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
          <Crosshair size={14} />
          <span>2D ANALYTICAL PROJECTION</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-300 font-sans">{layout2D}</span>
        </div>
      </div>
    </div>
  );
};

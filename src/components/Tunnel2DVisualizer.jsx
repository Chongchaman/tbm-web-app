import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Layers,
  Eye,
  Sliders,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Compass,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Move
} from 'lucide-react';
import KeySuitabilityBadge from './KeySuitabilityBadge';

/**
 * Tunnel2DVisualizer
 * ------------------
 * Interactive 2D Tunnel & Alignment Visualizer:
 * - Renders constructed rings as individual interlocking segment blocks (UN 1.2m / RT 1.4m / LT 1.4m)
 * - Directly compares constructed segment chain vs Design Tunnel Alignment (DTA Corridor & Centerline)
 * - Interactive smooth Zoom In / Zoom Out (mouse wheel, buttons, presets) & Pan (mouse drag)
 * - Ring numbers, key types, and dimension labels on each segment
 * - Deviation vectors & color-coded deviation indicators
 * - TBM cutterhead / laser guidance tracker
 * - Interactive step playback & scrub inspector
 */
export default function Tunnel2DVisualizer({
  planResult,
  scrubStep = 1,
  onSelectStep = () => {},
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  // Zoom and Pan State
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(false);

  // View Filter Toggles
  const [showSegments, setShowSegments] = useState(true);
  const [showDTAEnvelope, setShowDTAEnvelope] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showDeviations, setShowDeviations] = useState(true);
  const [showSTAMarkers, setShowSTAMarkers] = useState(true);

  // Auto-Play Simulation State
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredRing, setHoveredRing] = useState(null);

  const rings = planResult?.plannedRings || [];
  const totalRings = rings.length;
  const currentRing = rings[scrubStep - 1] || rings[0] || {};

  // Tunnel Diameter / Radius in meters (6.3m diameter -> 3.15m radius)
  const TUNNEL_RADIUS_M = 3.15;

  // 1. Calculate Real-World Coordinate Bounds
  const bounds = useMemo(() => {
    if (!rings || rings.length === 0) {
      return { minX: -10, maxX: 50, minY: 0, maxY: 100, width: 60, height: 100, midX: 20, midY: 50 };
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    rings.forEach((r) => {
      // Check TBM and DTA bounds
      [r.startX, r.endX, r.tbmX, r.dtaStartX, r.dtaEndX, r.dtaX].forEach((x) => {
        if (typeof x === 'number' && !isNaN(x)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      });

      [r.startY, r.endY, r.tbmY, r.dtaStartY, r.dtaEndY, r.dtaY].forEach((y) => {
        if (typeof y === 'number' && !isNaN(y)) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      });
    });

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      minX = -10; maxX = 50; minY = 0; maxY = 100;
    }

    // Add padding for tunnel tube radius (3.15m) + margin
    const padding = TUNNEL_RADIUS_M + 8;
    const bMinX = minX - padding;
    const bMaxX = maxX + padding;
    const bMinY = minY - padding;
    const bMaxY = maxY + padding;
    const width = Math.max(40, bMaxX - bMinX);
    const height = Math.max(60, bMaxY - bMinY);

    return {
      minX: bMinX,
      maxX: bMaxX,
      minY: bMinY,
      maxY: bMaxY,
      width,
      height,
      midX: (bMinX + bMaxX) / 2,
      midY: (bMinY + bMaxY) / 2,
    };
  }, [rings]);

  // Base SVG Canvas Dimensions
  const canvasW = 900;
  const canvasH = isExpanded ? 650 : 460;

  // Coordinate projection from Metric meters to base SVG space (NaN-safe)
  const project = useCallback((mX, mY) => {
    const safeX = typeof mX === 'number' && !isNaN(mX) ? mX : 0;
    const safeY = typeof mY === 'number' && !isNaN(mY) ? mY : 0;

    const pad = 50;
    const availW = canvasW - pad * 2;
    const availH = canvasH - pad * 2;

    const bWidth = bounds.width > 0 ? bounds.width : 50;
    const bHeight = bounds.height > 0 ? bounds.height : 50;

    const scaleX = availW / bWidth;
    const scaleY = availH / bHeight;
    const scale = Math.min(scaleX, scaleY) || 1;

    // Center alignment in SVG
    const offsetX = pad + (availW - bWidth * scale) / 2;
    const offsetY = pad + (availH - bHeight * scale) / 2;

    const svgX = offsetX + (safeX - bounds.minX) * scale;
    const svgY = canvasH - (offsetY + (safeY - bounds.minY) * scale);

    return { x: isNaN(svgX) ? 0 : svgX, y: isNaN(svgY) ? 0 : svgY, scale };
  }, [bounds, canvasW, canvasH]);

  // 2. Precompute Polygons for Segments and DTA Corridor
  const segmentPolygons = useMemo(() => {
    return rings.map((r, i) => {
      const x0 = typeof r.startX === 'number' ? r.startX : (rings[i - 1]?.tbmX || 0);
      const y0 = typeof r.startY === 'number' ? r.startY : (rings[i - 1]?.tbmY || 0);
      const x1 = r.endX ?? r.tbmX;
      const y1 = r.endY ?? r.tbmY;

      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.sqrt(dx * dx + dy * dy) || (r.size / 1000) || 1.2;

      // Unit normal to the right
      const nx = dy / len;
      const ny = -dx / len;

      const R = TUNNEL_RADIUS_M;

      // 4 Metric corners
      const bl_m = { x: x0 - R * nx, y: y0 - R * ny };
      const br_m = { x: x0 + R * nx, y: y0 + R * ny };
      const fr_m = { x: x1 + R * nx, y: y1 + R * ny };
      const fl_m = { x: x1 - R * nx, y: y1 - R * ny };

      // SVG Projected corners
      const pBL = project(bl_m.x, bl_m.y);
      const pBR = project(br_m.x, br_m.y);
      const pFR = project(fr_m.x, fr_m.y);
      const pFL = project(fl_m.x, fl_m.y);

      // Midpoints
      const pCenter = project((x0 + x1) / 2, (y0 + y1) / 2);
      const pStart = project(x0, y0);
      const pEnd = project(x1, y1);

      // Angle for text rotation (in degrees)
      const angleDeg = (Math.atan2(dx, dy) * 180) / Math.PI;

      // DTA equivalent point for deviation line
      const dtaPt = project(r.dtaX, r.dtaY);

      return {
        ring: r,
        pointsStr: `${pBL.x},${pBL.y} ${pBR.x},${pBR.y} ${pFR.x},${pFR.y} ${pFL.x},${pFL.y}`,
        pBL, pBR, pFR, pFL,
        pCenter,
        pStart,
        pEnd,
        dtaPt,
        angleDeg,
      };
    });
  }, [rings, project]);

  // 3. Precompute DTA Corridor Ribbon Polygons
  const dtaCorridorPaths = useMemo(() => {
    if (rings.length === 0) return { centerPath: '', leftPath: '', rightPath: '', polygonPath: '' };

    let centerD = '';
    let leftPoints = [];
    let rightPoints = [];

    rings.forEach((r, i) => {
      const x0 = typeof r.dtaStartX === 'number' ? r.dtaStartX : (rings[i - 1]?.dtaX || 0);
      const y0 = typeof r.dtaStartY === 'number' ? r.dtaStartY : (rings[i - 1]?.dtaY || 0);
      const x1 = r.dtaEndX ?? r.dtaX;
      const y1 = r.dtaEndY ?? r.dtaY;

      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.sqrt(dx * dx + dy * dy) || 1.2;
      const nx = dy / len;
      const ny = -dx / len;
      const R = TUNNEL_RADIUS_M;

      const cPt = project(r.dtaX, r.dtaY);
      if (i === 0) {
        const startPt = project(x0, y0);
        centerD = `M ${startPt.x} ${startPt.y} L ${cPt.x} ${cPt.y}`;
        const l0 = project(x0 - R * nx, y0 - R * ny);
        const r0 = project(x0 + R * nx, y0 + R * ny);
        leftPoints.push(l0);
        rightPoints.push(r0);
      } else {
        centerD += ` L ${cPt.x} ${cPt.y}`;
      }

      const lPt = project(x1 - R * nx, y1 - R * ny);
      const rPt = project(x1 + R * nx, y1 + R * ny);
      leftPoints.push(lPt);
      rightPoints.push(rPt);
    });

    const leftPath = leftPoints.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
    const rightPath = rightPoints.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');

    // Full tube envelope polygon (forward on left, backwards on right)
    const revRight = [...rightPoints].reverse();
    const polygonPath = `${leftPath} ${revRight.reduce((acc, p) => `${acc} L ${p.x} ${p.y}`, '')} Z`;

    return { centerPath: centerD, leftPath, rightPath, polygonPath };
  }, [rings, project]);

  // 4. Mouse Zoom and Pan Handlers
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;
    setZoom((prev) => Math.min(18.0, Math.max(0.35, Number((prev * zoomFactor).toFixed(3)))));
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleFocusTBM = () => {
    if (!currentRing) return;
    const pt = project(currentRing.tbmX || 0, currentRing.tbmY || 0);
    const targetPanX = (canvasW / 2 - pt.x) * 2.5;
    const targetPanY = (canvasH / 2 - pt.y) * 2.5;
    setZoom(2.5);
    setPan({ x: targetPanX, y: targetPanY });
  };

  // Auto-play Simulation Timer
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        onSelectStep((prev) => {
          const next = typeof prev === 'number' ? prev + 1 : scrubStep + 1;
          if (next > totalRings) {
            setIsPlaying(false);
            return totalRings;
          }
          return next;
        });
      }, 350);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalRings, onSelectStep, scrubStep]);

  return (
    <div className="space-y-3 font-sans">
      {/* Top Interactive HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surf-3/80 p-3 rounded-2xl border border-white/10 text-xs font-mono">
        {/* Layer Visibility Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-text-muted text-[11px] font-sans font-bold flex items-center gap-1 mr-1">
            <Layers size={14} className="text-acc" /> ชั้นแสดงผล:
          </span>

          <button
            type="button"
            onClick={() => setShowSegments((p) => !p)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              showSegments
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-surf-2 text-text-muted border-white/5 opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400"></span>
            <span>บล็อกเซ็กเมนต์ (Rings)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDTAEnvelope((p) => !p)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              showDTAEnvelope
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                : 'bg-surf-2 text-text-muted border-white/5 opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full border border-purple-400 border-dashed"></span>
            <span>แนวท่อ DTA (6.3m Tube)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLabels((p) => !p)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              showLabels
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-surf-2 text-text-muted border-white/5 opacity-60'
            }`}
          >
            <span>🏷️ ชื่อริ่ง & คีย์</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeviations((p) => !p)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              showDeviations
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                : 'bg-surf-2 text-text-muted border-white/5 opacity-60'
            }`}
          >
            <span>📐 เส้นเบี่ยงเบน (Dev.)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSTAMarkers((p) => !p)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 ${
              showSTAMarkers
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-surf-2 text-text-muted border-white/5 opacity-60'
            }`}
          >
            <span>🚩 หมุด STA</span>
          </button>
        </div>

        {/* Zoom & Canvas Navigation Controls */}
        <div className="flex items-center gap-1.5 bg-surf-2 px-2 py-1 rounded-xl border border-white/10">
          <span className="text-[10px] text-text-muted px-1 font-bold">
            Zoom: {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(18.0, Number((z * 1.25).toFixed(2))))}
            className="p-1 rounded-lg hover:bg-white/10 text-acc transition-all"
            title="Zoom In (+)"
          >
            <ZoomIn size={15} />
          </button>

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.35, Number((z / 1.25).toFixed(2))))}
            className="p-1 rounded-lg hover:bg-white/10 text-acc transition-all"
            title="Zoom Out (-)"
          >
            <ZoomOut size={15} />
          </button>

          <button
            type="button"
            onClick={handleResetView}
            className="p-1 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-all"
            title="Fit to Full Alignment (Reset View)"
          >
            <RotateCcw size={14} />
          </button>

          <button
            type="button"
            onClick={handleFocusTBM}
            className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-bold transition-all flex items-center gap-1"
            title="Center View on Current TBM Ring"
          >
            <Compass size={12} /> โฟกัสหัวเจาะ
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((p) => !p)}
            className="p-1 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-all ml-1 border-l border-white/10 pl-1.5"
            title={isExpanded ? 'Collapse Canvas' : 'Expand Canvas Height'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Main SVG Interactive Map Canvas */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full bg-surf-3/95 rounded-2xl border border-white/10 relative overflow-hidden select-none transition-all shadow-inner ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ height: `${canvasH}px` }}
      >
        {/* Floating Hint Overlay */}
        <div className="absolute top-3 left-3 pointer-events-none z-10 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[11px] font-mono text-text-muted">
          <Move size={13} className="text-acc" />
          <span>คลิกลากเพื่อเลื่อน &bull; หมุนลูกกลิ้งเมาส์เพื่อซูม &bull; คลิกที่ริ่งเพื่อดูสเปก</span>
        </div>

        {/* Floating Hover Ring Tooltip HUD */}
        {hoveredRing && (
          <div className="absolute top-3 right-3 pointer-events-none z-20 bg-black/85 backdrop-blur-md border border-acc/40 p-3 rounded-xl shadow-2xl font-mono text-xs text-text space-y-1 max-w-xs animate-in fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-1">
              <span className="font-bold text-acc">{hoveredRing.ringNum} (#{hoveredRing.step})</span>
              <span className="text-[10px] text-text-muted">STA {hoveredRing.sta}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] pt-1">
              <span className="text-text-muted">Key & Size:</span>
              <span className="font-bold text-emerald-400">{hoveredRing.selectedKey} ({hoveredRing.sizeM}m)</span>
              <span className="text-text-muted">After H Lead:</span>
              <span className={`font-bold ${hoveredRing.afterH < 0 ? 'text-cyan-300' : 'text-text'}`}>{hoveredRing.afterH} mm</span>
              <span className="text-text-muted">After V Plumb:</span>
              <span className="font-bold text-purple-300">{hoveredRing.afterV} mm</span>
              <span className="text-text-muted">DTA Offset:</span>
              <span className={`font-bold ${Math.abs(hoveredRing.deviationMm) > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {hoveredRing.deviationMm > 0 ? `+${hoveredRing.deviationMm}` : hoveredRing.deviationMm} mm
              </span>
            </div>
          </div>
        )}

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 pointer-events-none z-10 flex flex-wrap items-center gap-3 bg-black/75 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500/60 border border-amber-400"></span>
            <span className="text-amber-300 font-bold">UN (1.2m)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-rose-500/60 border border-rose-400"></span>
            <span className="text-rose-300 font-bold">RT (1.4m)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-cyan-500/60 border border-cyan-400"></span>
            <span className="text-cyan-300 font-bold">LT (1.4m)</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-white/20 pl-2">
            <span className="w-4 h-0.5 bg-purple-400 border-dashed"></span>
            <span className="text-purple-300 font-bold">DTA Alignment (6.3m Tube)</span>
          </div>
        </div>

        {/* Interactive SVG Render View */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          className="w-full h-full"
          style={{ touchAction: 'none' }}
        >
          {/* Background Technical Grid Pattern */}
          <defs>
            <pattern id="techGrid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="0.8" />
            </pattern>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <rect width={canvasW} height={canvasH} fill="url(#techGrid)" />

          {/* Transform Layer for Smooth Zoom and Pan */}
          <g
            transform={`translate(${canvasW / 2 + pan.x}, ${canvasH / 2 + pan.y}) scale(${zoom}) translate(${-canvasW / 2}, ${-canvasH / 2})`}
            style={{ transition: isDragging ? 'none' : 'transform 0.08s ease-out' }}
          >
            {/* 1. DTA Envelope (Design Tube & Centerline) */}
            {showDTAEnvelope && dtaCorridorPaths.polygonPath && (
              <g className="dta-envelope">
                {/* Translucent Tube Fill */}
                <path
                  d={dtaCorridorPaths.polygonPath}
                  fill="rgba(168, 85, 247, 0.08)"
                  stroke="none"
                />

                {/* Left & Right DTA Outer Boundaries */}
                <path
                  d={dtaCorridorPaths.leftPath}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="1.2"
                  strokeDasharray="4,3"
                  opacity="0.6"
                />
                <path
                  d={dtaCorridorPaths.rightPath}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="1.2"
                  strokeDasharray="4,3"
                  opacity="0.6"
                />

                {/* DTA Centerline */}
                <path
                  d={dtaCorridorPaths.centerPath}
                  fill="none"
                  stroke="#ffab40"
                  strokeWidth="2"
                  strokeDasharray="6,4"
                  opacity="0.85"
                />
              </g>
            )}

            {/* 2. Constructed Segment Chain (Rings) */}
            {showSegments && (
              <g className="constructed-segments">
                {segmentPolygons.map((poly, idx) => {
                  const r = poly.ring;
                  const isCurrent = idx === scrubStep - 1;
                  const isHovered = hoveredRing?.step === r.step;

                  // Color Themes based on segment type
                  let fillColor = 'rgba(245, 158, 11, 0.25)';
                  let strokeColor = '#f59e0b';
                  let textColor = '#fcd34d';

                  if (r.type === 'R') {
                    fillColor = 'rgba(244, 63, 94, 0.28)';
                    strokeColor = '#f43f5e';
                    textColor = '#fda4af';
                  } else if (r.type === 'L') {
                    fillColor = 'rgba(6, 182, 212, 0.28)';
                    strokeColor = '#06b6d4';
                    textColor = '#67e8f9';
                  }

                  if (isCurrent) {
                    fillColor = 'rgba(0, 230, 118, 0.5)';
                    strokeColor = '#00e676';
                    textColor = '#ffffff';
                  } else if (isHovered) {
                    fillColor = 'rgba(255, 255, 255, 0.35)';
                    strokeColor = '#ffffff';
                  }

                  return (
                    <g
                      key={r.step}
                      className="segment-block cursor-pointer transition-opacity"
                      onClick={() => onSelectStep(idx + 1)}
                      onMouseEnter={() => setHoveredRing(r)}
                      onMouseLeave={() => setHoveredRing(null)}
                    >
                      {/* Segment Ring Quad Polygon */}
                      <polygon
                        points={poly.pointsStr}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isCurrent ? 2.5 : isHovered ? 2 : 1}
                        filter={isCurrent ? 'url(#glow)' : undefined}
                      />

                      {/* Joint Line at Ring Front */}
                      <line
                        x1={poly.pFL.x}
                        y1={poly.pFL.y}
                        x2={poly.pFR.x}
                        y2={poly.pFR.y}
                        stroke="#ffffff"
                        strokeWidth={isCurrent ? 2 : 0.75}
                        opacity={isCurrent ? 1 : 0.6}
                      />

                      {/* Ring Center Dot */}
                      <circle
                        cx={poly.pCenter.x}
                        cy={poly.pCenter.y}
                        r={isCurrent ? 4 : 1.5}
                        fill={isCurrent ? '#00e676' : strokeColor}
                      />

                      {/* Ring Labels (Number & Key) */}
                      {showLabels && (
                        <g
                          transform={`translate(${poly.pCenter.x}, ${poly.pCenter.y}) rotate(${-poly.angleDeg})`}
                          pointerEvents="none"
                        >
                          <text
                            x="0"
                            y={zoom > 1.8 ? -4 : 3}
                            fill={textColor}
                            fontSize={Math.max(7, Math.min(13, 9 * Math.sqrt(zoom)))}
                            fontFamily="JetBrains Mono, monospace"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {zoom > 1.4 ? `${r.ringNum}` : `#${r.step}`}
                          </text>

                          {zoom > 1.8 && (
                            <text
                              x="0"
                              y="7"
                              fill="#ffffff"
                              fontSize={Math.max(6, Math.min(11, 7.5 * Math.sqrt(zoom)))}
                              fontFamily="JetBrains Mono, monospace"
                              textAnchor="middle"
                              opacity="0.9"
                            >
                              {r.selectedKey} ({r.sizeM}m)
                            </text>
                          )}
                        </g>
                      )}

                      {/* Deviation connecting line from Ring Center to DTA Center */}
                      {showDeviations && (zoom > 1.2 || isCurrent || isHovered) && (
                        <g pointerEvents="none">
                          <line
                            x1={poly.pCenter.x}
                            y1={poly.pCenter.y}
                            x2={poly.dtaPt.x}
                            y2={poly.dtaPt.y}
                            stroke={
                              Math.abs(r.deviationMm) > 50
                                ? '#f43f5e'
                                : Math.abs(r.deviationMm) > 25
                                ? '#fbbf24'
                                : '#00d4ff'
                            }
                            strokeWidth={isCurrent ? 2 : 1}
                            strokeDasharray="2,2"
                          />
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* 3. TBM Centerline Trajectory Line */}
            <path
              d={rings.reduce((acc, r, i) => {
                const pt = project(r.tbmX, r.tbmY);
                return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
              }, '')}
              fill="none"
              stroke="#00d4ff"
              strokeWidth="2.5"
              pointerEvents="none"
              opacity="0.75"
            />

            {/* 4. STA Milestones & Section Boundaries */}
            {showSTAMarkers && (
              <g className="sta-markers" pointerEvents="none">
                {rings.map((r, i) => {
                  const isMilestone = i === 0 || i === rings.length - 1 || i % 10 === 0;
                  if (!isMilestone) return null;

                  const pt = project(r.dtaX, r.dtaY);
                  return (
                    <g key={`sta-${r.step}`} transform={`translate(${pt.x}, ${pt.y})`}>
                      <circle r="3" fill="#ffab40" />
                      <line x1="-12" y1="0" x2="12" y2="0" stroke="#ffab40" strokeWidth="1" />
                      <text
                        x="15"
                        y="3"
                        fill="#ffab40"
                        fontSize="9"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="bold"
                      >
                        {r.sta}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* 5. Active TBM Cutterhead / Shield Indicator */}
            {currentRing && typeof currentRing.tbmX === 'number' && (
              (() => {
                const headPt = project(currentRing.tbmX, currentRing.tbmY);
                const prevPt = project(currentRing.startX || currentRing.tbmX, currentRing.startY || (currentRing.tbmY - 1.2));
                const dx = headPt.x - prevPt.x;
                const dy = headPt.y - prevPt.y;
                const headAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

                return (
                  <g transform={`translate(${headPt.x}, ${headPt.y})`} pointerEvents="none">
                    {/* Animated Radar Pulse */}
                    <circle r="18" fill="rgba(0, 230, 118, 0.2)" className="animate-ping" />
                    <circle r="9" fill="#00e676" stroke="#ffffff" strokeWidth="2" filter="url(#glow)" />

                    {/* Forward Shield Cone */}
                    <g transform={`rotate(${headAngle})`}>
                      <polygon points="0,-7 14,0 0,7" fill="#00e676" opacity="0.9" />
                      {/* Laser Alignment Beam */}
                      <line x1="14" y1="0" x2="60" y2="0" stroke="#00e676" strokeWidth="1.5" strokeDasharray="3,2" opacity="0.8" />
                    </g>

                    {/* HUD Label */}
                    <rect x="16" y="-22" width="130" height="20" rx="5" fill="rgba(0, 0, 0, 0.85)" stroke="#00e676" strokeWidth="1" />
                    <text
                      x="22"
                      y="-8"
                      fill="#00e676"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                    >
                      TBM #{currentRing.step} ({currentRing.ringNum})
                    </text>
                  </g>
                );
              })()
            )}
          </g>
        </svg>
      </div>

      {/* Scrub Navigation Bar & Full Ring Telemetry HUD */}
      <div className="bg-surf-2 border border-white/10 p-3.5 rounded-2xl space-y-3 font-mono">
        {/* Scrubber Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectStep((p) => Math.max(1, p - 1))}
              disabled={scrubStep <= 1}
              className="p-1.5 rounded-lg bg-surf-3 border border-white/10 hover:bg-white/10 disabled:opacity-40 transition-all"
              title="Previous Ring"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                isPlaying
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                  : 'bg-acc text-black shadow-md shadow-cyan-400/20'
              }`}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? 'หยุดจำลอง' : 'เล่นจำลอง (Play)'}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStep((p) => Math.min(totalRings, p + 1))}
              disabled={scrubStep >= totalRings}
              className="p-1.5 rounded-lg bg-surf-3 border border-white/10 hover:bg-white/10 disabled:opacity-40 transition-all"
              title="Next Ring"
            >
              <ChevronRight size={16} />
            </button>

            <span className="text-text-muted text-[11px] ml-1">
              Ring <strong className="text-acc text-sm">#{scrubStep}</strong> / {totalRings}
            </span>
          </div>

          <div className="flex-1 max-w-md flex items-center gap-3">
            <input
              type="range"
              min="1"
              max={totalRings || 1}
              value={scrubStep}
              onChange={(e) => onSelectStep(Number(e.target.value))}
              className="w-full accent-acc cursor-pointer"
            />
            <span className="text-[11px] text-text-muted shrink-0 font-bold">
              {currentRing.ringNum || `R${scrubStep}`}
            </span>
          </div>
        </div>

        {/* Real-time Ring Specs HUD */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
          <div className="bg-surf-3/60 p-2 rounded-xl border border-white/5">
            <span className="text-[10px] text-text-muted block">Ring / Step</span>
            <span className="font-bold text-acc text-sm">{currentRing.ringNum} (#{currentRing.step})</span>
          </div>

          <div className="bg-surf-3/60 p-2 rounded-xl border border-white/5">
            <span className="text-[10px] text-text-muted block">Chainage STA</span>
            <span className="font-bold text-text">{currentRing.sta}</span>
          </div>

          <div className="bg-surf-3/60 p-2 rounded-xl border border-white/5">
            <span className="text-[10px] text-text-muted block">Key & Segment Size</span>
            <span className="font-bold text-emerald-400">
              {currentRing.selectedKey} ({currentRing.sizeM}m {currentRing.type === 'U' ? 'UN' : currentRing.type === 'R' ? 'RT' : 'LT'})
            </span>
          </div>

          <div className="bg-surf-3/60 p-2 rounded-xl border border-white/5">
            <span className="text-[10px] text-text-muted block">After H / V Lead</span>
            <span className="font-bold text-text">{currentRing.afterH} / {currentRing.afterV} mm</span>
          </div>

          <div className="bg-surf-3/60 p-2 rounded-xl border border-white/5">
            <span className="text-[10px] text-text-muted block">DTA Alignment Offset</span>
            <span
              className={`font-bold ${
                Math.abs(currentRing.deviationMm || 0) <= 25
                  ? 'text-emerald-400'
                  : Math.abs(currentRing.deviationMm || 0) <= 50
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {currentRing.deviationMm > 0 ? `+${currentRing.deviationMm}` : currentRing.deviationMm} mm
            </span>
          </div>

          <div className="bg-surf-3/60 p-2 rounded-xl border border-white/5 flex flex-col justify-between">
            <span className="text-[10px] text-text-muted block">Suitability Status</span>
            <KeySuitabilityBadge suitability={currentRing.suitability} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

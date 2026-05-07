'use client';
/**
 * useBuilderEngine — all interaction logic for the venue builder.
 * Keeps the main component clean.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import {
  EMPTY_LAYOUT, CAT_COLOR, centroid, snapVal, pointInPoly,
  generateRowSeats, generateBlockSeats, generateArcRowSeats,
  regularPoly, starPoly,
  type LayoutState, type BShape, type BSeat, type BText,
  type ToolId, type Category, type SeatStatus, type Snapshot,
} from './builderTypes2';
import type { Camera, DrawPreview } from './BuilderCanvas';
import { w2s, s2w } from './BuilderCanvas';

const GRID = 20;
const SEAT_HIT = 10;

function snap(v: number) { return snapVal(v, GRID); }
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

// Simple convex hull (Graham scan)
function convexHull(pts: [number,number][]): [number,number][] {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const cross = (o:[number,number],a:[number,number],b:[number,number]) =>
    (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lower: [number,number][] = [];
  for (const p of sorted) { while (lower.length>=2 && cross(lower[lower.length-2],lower[lower.length-1],p)<=0) lower.pop(); lower.push(p); }
  const upper: [number,number][] = [];
  for (const p of [...sorted].reverse()) { while (upper.length>=2 && cross(upper[upper.length-2],upper[upper.length-1],p)<=0) upper.pop(); upper.push(p); }
  return [...lower.slice(0,-1), ...upper.slice(0,-1)];
}

export function useBuilderEngine() {
  // ── Refs (hot path) ────────────────────────────────────────────────────────
  const camRef    = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const toolRef   = useRef<ToolId>('select');
  const snapRef   = useRef(true);
  const layoutRef = useRef<LayoutState>(EMPTY_LAYOUT);
  const selRef    = useRef<Set<string>>(new Set());
  const secModeRef = useRef<string | null>(null);

  const isPanning  = useRef(false);
  const isDragging = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });
  const dragOffsets = useRef<Map<string, [number, number]>>(new Map());
  const dragVtx    = useRef<{ id: string; vi: number } | null>(null);
  const drawPts    = useRef<[number, number][]>([]);
  const rowStart   = useRef<[number, number] | null>(null);
  const rectStart  = useRef<[number, number] | null>(null);
  // arcrow: [cx, cy] then radius click
  const arcRowCenter = useRef<[number, number] | null>(null);
  const arcRowRadius = useRef<number | null>(null);
  const arcRowA0     = useRef<number | null>(null);
  const mouseWorld = useRef<[number, number]>([0, 0]);

  // ── React state (UI) ───────────────────────────────────────────────────────
  const [tool, setTool]           = useState<ToolId>('select');
  const [snapOn, setSnapOn]       = useState(true);
  const [layout, setLayout]       = useState<LayoutState>(EMPTY_LAYOUT);
  const [selectedIds, setSelIds]  = useState<Set<string>>(new Set());
  const [sectionMode, setSecMode] = useState<string | null>(null);
  const [camera, setCamera]       = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [preview, setPreview]     = useState<DrawPreview>({ tool: 'select', pts: [], mouse: [0, 0], rectStart: null });
  const [history, setHistory]     = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [zoomPct, setZoomPct]     = useState(100);
  const [bgImage, setBgImage]     = useState<HTMLImageElement | null>(null);
  const [bgOpacity, setBgOpacity] = useState(0.5);
  const [venueName, setVenueName] = useState('Untitled Venue');
  const [heatmap, setHeatmap]     = useState(false);
  const [rowSeatsCount, setRowSeatsCount] = useState(0); // 0 = auto

  // keep refs in sync
  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => { selRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { secModeRef.current = sectionMode; }, [sectionMode]);
  useEffect(() => { camRef.current = camera; }, [camera]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const commit = useCallback((next: LayoutState, snapLabel?: string) => {
    setLayout(next);
    layoutRef.current = next;
    const snap: Snapshot = { id: uid(), label: snapLabel || 'Edit', ts: Date.now(), state: JSON.parse(JSON.stringify(next)) };
    setHistory(h => [snap, ...h].slice(0, 80));
    setRedoStack([]);
  }, []);

  const syncSel = useCallback((ids: Set<string>) => {
    selRef.current = ids;
    setSelIds(new Set(ids));
  }, []);

  const sw = useCallback((wx: number, wy: number): [number, number] => {
    const g = snapRef.current ? GRID : 1;
    return [snapVal(wx, g), snapVal(wy, g)];
  }, []);

  // ── Hit testing ────────────────────────────────────────────────────────────
  const hitTest = useCallback((wx: number, wy: number): string | null => {
    const { seats, shapes } = layoutRef.current;
    const secMode = secModeRef.current;

    // seats first (smaller targets)
    for (let i = seats.length - 1; i >= 0; i--) {
      const s = seats[i];
      if (secMode && s.sectionId !== secMode) continue;
      if (Math.hypot(s.x - wx, s.y - wy) <= SEAT_HIT / camRef.current.zoom) return s.id;
    }
    // shapes
    for (let i = shapes.length - 1; i >= 0; i--) {
      const sh = shapes[i];
      if (secMode && sh.id !== secMode) continue;
      if (pointInPoly(wx, wy, sh.vertices)) return sh.id;
    }
    return null;
  }, []);

  // ── Pointer down ───────────────────────────────────────────────────────────
  const onPointerDown = useCallback((wx: number, wy: number, sx: number, sy: number, e: PointerEvent) => {
    const tool = toolRef.current;
    const [swx, swy] = sw(wx, wy);

    if (e.button === 1 || tool === 'pan' || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;

    if (tool === 'section') {
      drawPts.current = [...drawPts.current, [swx, swy]];
      setPreview(p => ({ ...p, pts: drawPts.current }));
      return;
    }

    if (tool === 'row') {
      if (!rowStart.current) {
        // First click — set start point
        rowStart.current = [swx, swy];
        drawPts.current = [[swx, swy]];
        setPreview(p => ({ ...p, pts: drawPts.current }));
      } else {
        // Second click — finish the row immediately
        const p1 = rowStart.current;
        const dist = Math.hypot(swx - p1[0], swy - p1[1]);
        const count = rowSeatsCount > 0 ? rowSeatsCount : Math.max(2, Math.floor(dist / 14));
        const secMode = secModeRef.current;
        const rowId = `row-${uid()}`;
        const rowLetter = String.fromCharCode(65 + (layoutRef.current.seats.filter(s => s.sectionId === (secMode || '')).length % 26));
        const newSeats = generateRowSeats(p1, [swx, swy], count, rowId, secMode || '', rowLetter, 'STANDARD', 100);
        const next = { ...layoutRef.current, seats: [...layoutRef.current.seats, ...newSeats] };
        commit(next, 'Add row');
        rowStart.current = null;
        drawPts.current = [];
        setPreview(p => ({ ...p, pts: [] }));
        // Stay in row tool so user can draw next row immediately
      }
      return;
    }

    if (tool === 'arcrow') {
      if (!arcRowCenter.current) {
        // first click = centre
        arcRowCenter.current = [swx, swy];
      } else if (arcRowRadius.current === null) {
        // second click = radius
        arcRowRadius.current = Math.hypot(swx - arcRowCenter.current[0], swy - arcRowCenter.current[1]);
        arcRowA0.current = Math.atan2(swy - arcRowCenter.current[1], swx - arcRowCenter.current[0]) * 180 / Math.PI;
      }
      // third click handled in dblclick / second click on end angle
      return;
    }

    if (tool === 'rect' || tool === 'block' || tool === 'multirow' || tool === 'circle' || tool === 'ellipse' || tool === 'triangle' || tool === 'diamond' || tool === 'pentagon' || tool === 'hexagon' || tool === 'star') {
      rectStart.current = [swx, swy];
      setPreview(p => ({ ...p, rectStart: [swx, swy] }));
      return;
    }

    if (tool === 'text') {
      const newText: BText = { id: `txt-${uid()}`, x: swx, y: swy, text: 'Label', fontSize: 14, color: '#94a3b8' };
      const next = { ...layoutRef.current, texts: [...layoutRef.current.texts, newText] };
      commit(next, 'Add text');
      syncSel(new Set([newText.id]));
      return;
    }

    if (tool === 'select') {
      // vertex drag?
      const thresh = 8 / camRef.current.zoom;
      for (const sh of layoutRef.current.shapes) {
        if (!selRef.current.has(sh.id)) continue;
        for (let vi = 0; vi < sh.vertices.length; vi++) {
          if (Math.hypot(sh.vertices[vi][0] - wx, sh.vertices[vi][1] - wy) <= thresh) {
            dragVtx.current = { id: sh.id, vi };
            isDragging.current = true;
            return;
          }
        }
      }

      const hitId = hitTest(wx, wy);
      if (hitId) {
        const next = e.shiftKey ? new Set([...selRef.current, hitId]) : new Set([hitId]);
        syncSel(next);
        isDragging.current = true;
        dragOffsets.current.clear();
        // compute offsets for all selected seats
        layoutRef.current.seats.forEach(s => {
          if (next.has(s.id)) dragOffsets.current.set(s.id, [swx - s.x, swy - s.y]);
        });
        // compute offsets for selected shapes (move centroid)
        layoutRef.current.shapes.forEach(sh => {
          if (next.has(sh.id)) dragOffsets.current.set(sh.id, [swx - sh.cx, swy - sh.cy]);
        });
        layoutRef.current.texts.forEach(t => {
          if (next.has(t.id)) dragOffsets.current.set(t.id, [swx - t.x, swy - t.y]);
        });
      } else if (!e.shiftKey) {
        syncSel(new Set());
      }
    }
  }, [sw, hitTest, commit, syncSel]);

  // ── Pointer move ───────────────────────────────────────────────────────────
  const onPointerMove = useCallback((wx: number, wy: number, sx: number, sy: number, e: PointerEvent) => {
    const [swx, swy] = sw(wx, wy);
    mouseWorld.current = [swx, swy];
    setPreview(p => ({ ...p, mouse: [swx, swy], tool: toolRef.current }));

    if (isPanning.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      camRef.current = {
        ...camRef.current,
        x: camRef.current.x - dx / camRef.current.zoom,
        y: camRef.current.y - dy / camRef.current.zoom,
      };
      setCamera({ ...camRef.current });
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (isDragging.current && dragVtx.current) {
      const { id, vi } = dragVtx.current;
      const next = { ...layoutRef.current };
      next.shapes = next.shapes.map(sh => {
        if (sh.id !== id) return sh;
        const verts = [...sh.vertices] as [number, number][];
        verts[vi] = [swx, swy];
        const [cx, cy] = centroid(verts);
        return { ...sh, vertices: verts, cx, cy };
      });
      layoutRef.current = next;
      setLayout(next);
      return;
    }

    if (isDragging.current && selRef.current.size > 0) {
      const next = { ...layoutRef.current };
      next.seats = next.seats.map(s => {
        if (!selRef.current.has(s.id)) return s;
        const off = dragOffsets.current.get(s.id) || [0, 0];
        return { ...s, x: swx - off[0], y: swy - off[1] };
      });
      next.shapes = next.shapes.map(sh => {
        if (!selRef.current.has(sh.id)) return sh;
        const off = dragOffsets.current.get(sh.id) || [0, 0];
        const dx = swx - off[0] - sh.cx, dy = swy - off[1] - sh.cy;
        const verts = sh.vertices.map(([vx, vy]) => [vx + dx, vy + dy] as [number, number]);
        return { ...sh, vertices: verts, cx: sh.cx + dx, cy: sh.cy + dy };
      });
      next.texts = next.texts.map(t => {
        if (!selRef.current.has(t.id)) return t;
        const off = dragOffsets.current.get(t.id) || [0, 0];
        return { ...t, x: swx - off[0], y: swy - off[1] };
      });
      layoutRef.current = next;
      setLayout(next);
    }
  }, [sw]);

  // ── Pointer up ─────────────────────────────────────────────────────────────
  const onPointerUp = useCallback((wx: number, wy: number, e: PointerEvent) => {
    const tool = toolRef.current;
    const [swx, swy] = sw(wx, wy);

    if (isPanning.current) { isPanning.current = false; return; }

    if (isDragging.current) {
      isDragging.current = false;
      dragVtx.current = null;
      commit(layoutRef.current, 'Move');
      return;
    }

    if ((tool === 'rect') && rectStart.current) {
      const [x0, y0] = rectStart.current;
      const verts: [number, number][] = [[x0, y0], [swx, y0], [swx, swy], [x0, swy]];
      const [cx, cy] = centroid(verts);
      const shape: BShape = { id: `rect-${uid()}`, type: 'section', label: 'Section', category: 'STANDARD', color: CAT_COLOR['STANDARD'], vertices: verts, cx, cy };
      const next = { ...layoutRef.current, shapes: [...layoutRef.current.shapes, shape] };
      commit(next, 'Add section');
      syncSel(new Set([shape.id]));
      rectStart.current = null;
      setPreview(p => ({ ...p, rectStart: null }));
    }

    // ── Multiple Rows tool — drag rectangle → fills with parallel rows ────────
    if (tool === 'multirow' && rectStart.current) {
      const [x0, y0] = rectStart.current;
      const w = swx - x0, h = swy - y0;
      const rowSpacing = 14; // world units between rows
      const numRows = Math.max(1, Math.floor(Math.abs(h) / rowSpacing));
      const seatsPerRow = rowSeatsCount > 0 ? rowSeatsCount : Math.max(2, Math.floor(Math.abs(w) / 14));
      const secMode = secModeRef.current;
      const newSeats: BSeat[] = [];
      const ROWS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      for (let r = 0; r < numRows; r++) {
        const rowId = `mrow-${uid()}`;
        const y = y0 + (h > 0 ? r : -r) * rowSpacing + rowSpacing / 2;
        const rowLetter = ROWS[r % 26];
        const rowSeats = generateRowSeats([x0, y], [swx, y], seatsPerRow, rowId, secMode || '', rowLetter, 'STANDARD', 100);
        newSeats.push(...rowSeats);
      }
      const next = { ...layoutRef.current, seats: [...layoutRef.current.seats, ...newSeats] };
      commit(next, `Add ${numRows} rows`);
      rectStart.current = null;
      setPreview(p => ({ ...p, rectStart: null }));
    }

    // ── Geometric shape tools ─────────────────────────────────────────────────
    const SHAPE_TOOLS = ['circle','ellipse','triangle','diamond','pentagon','hexagon','star'] as const;
    if ((SHAPE_TOOLS as readonly string[]).includes(tool) && rectStart.current) {
      const [x0, y0] = rectStart.current;
      const cx = (x0 + swx) / 2, cy = (y0 + swy) / 2;
      const rx = Math.abs(swx - x0) / 2, ry = Math.abs(swy - y0) / 2;
      const r = Math.max(rx, ry); // for circle/star use uniform radius
      let verts: [number, number][];
      if (tool === 'circle')        verts = regularPoly(cx, cy, r, r, 36);
      else if (tool === 'ellipse')  verts = regularPoly(cx, cy, rx, ry, 36);
      else if (tool === 'triangle') verts = regularPoly(cx, cy, r, r, 3);
      else if (tool === 'diamond')  verts = regularPoly(cx, cy, rx, ry, 4);
      else if (tool === 'pentagon') verts = regularPoly(cx, cy, r, r, 5);
      else if (tool === 'hexagon')  verts = regularPoly(cx, cy, r, r, 6);
      else                          verts = starPoly(cx, cy, r, r * 0.45);
      const [vcx, vcy] = centroid(verts);
      const shape: BShape = { id: `${tool}-${uid()}`, type: 'section', label: tool.charAt(0).toUpperCase() + tool.slice(1), category: 'STANDARD', color: CAT_COLOR['STANDARD'], vertices: verts, cx: vcx, cy: vcy };
      const next = { ...layoutRef.current, shapes: [...layoutRef.current.shapes, shape] };
      commit(next, `Add ${tool}`);
      syncSel(new Set([shape.id]));
      rectStart.current = null;
      setPreview(p => ({ ...p, rectStart: null }));
    }

    if (tool === 'block' && rectStart.current) {
      const [x0, y0] = rectStart.current;
      const sid = `block-${uid()}`;
      const verts: [number, number][] = [[x0, y0], [swx, y0], [swx, swy], [x0, swy]];
      const [cx, cy] = centroid(verts);
      const shape: BShape = { id: sid, type: 'section', label: 'Block', category: 'STANDARD', color: CAT_COLOR['STANDARD'], vertices: verts, cx, cy };
      const { rows, seats } = generateBlockSeats(x0, y0, swx, swy, 8, 12, sid, 'STANDARD', 100);
      const next = { ...layoutRef.current, shapes: [...layoutRef.current.shapes, shape], rows: [...layoutRef.current.rows, ...rows], seats: [...layoutRef.current.seats, ...seats] };
      commit(next, 'Add block');
      syncSel(new Set([sid]));
      rectStart.current = null;
      setPreview(p => ({ ...p, rectStart: null }));
    }
  }, [sw, commit, syncSel]);

  // ── Double click ───────────────────────────────────────────────────────────
  const onDblClick = useCallback((wx: number, wy: number) => {
    const tool = toolRef.current;
    const [swx, swy] = sw(wx, wy);

    if (tool === 'section') {
      const pts = drawPts.current;
      if (pts.length >= 3) {
        const [cx, cy] = centroid(pts);
        const shape: BShape = { id: `sec-${uid()}`, type: 'section', label: 'Section', category: 'STANDARD', color: CAT_COLOR['STANDARD'], vertices: [...pts], cx, cy };
        const next = { ...layoutRef.current, shapes: [...layoutRef.current.shapes, shape] };
        commit(next, 'Add section');
        syncSel(new Set([shape.id]));
      }
      drawPts.current = [];
      setPreview(p => ({ ...p, pts: [] }));
      return;
    }

    if (tool === 'row' && rowStart.current) {
      // row is now completed on second click, not dblclick — cancel if dblclick
      rowStart.current = null;
      drawPts.current = [];
      setPreview(p => ({ ...p, pts: [] }));
      return;
    }

    if (tool === 'arcrow' && arcRowCenter.current && arcRowRadius.current !== null && arcRowA0.current !== null) {
      const a1 = Math.atan2(swy - arcRowCenter.current[1], swx - arcRowCenter.current[0]) * 180 / Math.PI;
      const secMode = secModeRef.current;
      const rowId = `arcrow-${uid()}`;
      const arcSeats = generateArcRowSeats(
        arcRowCenter.current[0], arcRowCenter.current[1],
        arcRowRadius.current, arcRowA0.current, a1,
        rowId, secMode || '', 'A', 'STANDARD', 100,
      );
      const next = { ...layoutRef.current, seats: [...layoutRef.current.seats, ...arcSeats] };
      commit(next, 'Add arc row');
      arcRowCenter.current = null; arcRowRadius.current = null; arcRowA0.current = null;
      setPreview(p => ({ ...p, pts: [], arcRowCenter: null, arcRowRadius: null }));
      return;
    }

    // Enter section mode on double-click
    if (tool === 'select') {
      const hitId = hitTest(wx, wy);
      if (hitId) {
        const shape = layoutRef.current.shapes.find(s => s.id === hitId);
        if (shape) {
          setSecMode(hitId);
          secModeRef.current = hitId;
          syncSel(new Set());
          // zoom to section
          const cam = camRef.current;
          const newCam = { ...cam, x: shape.cx, y: shape.cy, zoom: Math.max(cam.zoom, 3) };
          camRef.current = newCam;
          setCamera(newCam);
          setZoomPct(Math.round(newCam.zoom * 100));
        }
      }
    }
  }, [sw, hitTest, commit, syncSel]);

  // ── Wheel ──────────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const canvas = (e.target as HTMLCanvasElement);
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const cam = camRef.current;
    const oldZ = cam.zoom, newZ = Math.max(0.05, Math.min(40, oldZ * factor));
    const newCam = {
      x: cam.x + (sx - canvas.width / 2) * (1 / oldZ - 1 / newZ),
      y: cam.y + (sy - canvas.height / 2) * (1 / oldZ - 1 / newZ),
      zoom: newZ,
    };
    camRef.current = newCam;
    setCamera(newCam);
    setZoomPct(Math.round(newZ * 100));
  }, []);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      const map: Record<string, ToolId> = { v: 'select', s: 'section', r: 'rect', c: 'circle', e: 'ellipse', '3': 'triangle', d: 'diamond', '5': 'pentagon', '6': 'hexagon', '*': 'star', w: 'row', m: 'multirow', a: 'arcrow', b: 'block', t: 'text', h: 'pan' };
      if (map[e.key.toLowerCase()]) { const t = map[e.key.toLowerCase()]; toolRef.current = t; setTool(t); }

      if (e.key === 'Escape') {
        drawPts.current = []; rowStart.current = null; rectStart.current = null;
        arcRowCenter.current = null; arcRowRadius.current = null; arcRowA0.current = null;
        setPreview(p => ({ ...p, pts: [], rectStart: null }));
        if (secModeRef.current) { setSecMode(null); secModeRef.current = null; }
        syncSel(new Set());
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current.size > 0) {
        const ids = selRef.current;
        const next: LayoutState = {
          ...layoutRef.current,
          shapes: layoutRef.current.shapes.filter(s => !ids.has(s.id)),
          seats: layoutRef.current.seats.filter(s => !ids.has(s.id)),
          texts: layoutRef.current.texts.filter(t => !ids.has(t.id)),
          rows: layoutRef.current.rows.filter(r => !ids.has(r.id)),
        };
        commit(next, 'Delete');
        syncSel(new Set());
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [commit, syncSel]);

  // ── Undo / Redo (callable directly) ───────────────────────────────────────
  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length < 2) return h;
      const [cur, prev, ...rest] = h;
      setRedoStack(r => [cur, ...r]);
      const restored = JSON.parse(JSON.stringify(prev.state));
      layoutRef.current = restored;
      setLayout(restored);
      return [prev, ...rest];
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack(r => {
      if (r.length === 0) return r;
      const [top, ...rest] = r;
      const restored = JSON.parse(JSON.stringify(top.state));
      layoutRef.current = restored;
      setLayout(restored);
      setHistory(h => [top, ...h]);
      return rest;
    });
  }, []);

  // ── Zoom (callable directly) ───────────────────────────────────────────────
  const zoomIn = useCallback(() => {
    const cam = camRef.current;
    const newZ = Math.min(40, cam.zoom * 1.25);
    const newCam = { ...cam, zoom: newZ };
    camRef.current = newCam;
    setCamera(newCam);
    setZoomPct(Math.round(newZ * 100));
  }, []);

  const zoomOut = useCallback(() => {
    const cam = camRef.current;
    const newZ = Math.max(0.05, cam.zoom * 0.8);
    const newCam = { ...cam, zoom: newZ };
    camRef.current = newCam;
    setCamera(newCam);
    setZoomPct(Math.round(newZ * 100));
  }, []);
  const changeTool = useCallback((t: ToolId) => {
    toolRef.current = t;
    setTool(t);
    drawPts.current = []; rowStart.current = null; rectStart.current = null;
    arcRowCenter.current = null; arcRowRadius.current = null; arcRowA0.current = null;
    setPreview(p => ({ ...p, pts: [], rectStart: null, tool: t }));
  }, []);

  // ── Selection helpers ──────────────────────────────────────────────────────
  const selectedShape = layout.shapes.find(s => selectedIds.has(s.id) && selectedIds.size === 1) || null;
  const selectedSeat  = layout.seats.find(s => selectedIds.has(s.id) && selectedIds.size === 1) || null;
  const selectedText  = layout.texts.find(t => selectedIds.has(t.id) && selectedIds.size === 1) || null;

  // Derive selected row: when a single seat is selected, expose its row group
  const selectedRow = (() => {
    if (!selectedSeat || !selectedSeat.rowId) return null;
    const rowSeats = layout.seats.filter(s => s.rowId === selectedSeat.rowId);
    if (rowSeats.length === 0) return null;
    return {
      id: selectedSeat.rowId,
      sectionId: selectedSeat.sectionId,
      label: selectedSeat.label.replace(/\d+$/, ''), // row letter
      category: selectedSeat.category,
      seatCount: rowSeats.length,
      seats: rowSeats,
    };
  })();

  const updateRow = useCallback((rowId: string, u: { label?: string; category?: Category; seatCount?: number; sectionLabel?: string; rowLabelEnabled?: boolean }) => {
    const next = { ...layoutRef.current };
    if (u.label !== undefined || u.category !== undefined) {
      next.seats = next.seats.map(s => {
        if (s.rowId !== rowId) return s;
        const newLabel = u.label !== undefined ? u.label : s.label.replace(/\d+$/, '');
        const num = s.number;
        return { ...s, label: `${newLabel}${num}`, ...(u.category ? { category: u.category } : {}) };
      });
    }
    commit(next, 'Edit row');
  }, [commit]);

  const updateShape = useCallback((u: Partial<BShape>) => {
    if (!selectedShape) return;
    const next = { ...layoutRef.current, shapes: layoutRef.current.shapes.map(s => s.id === selectedShape.id ? { ...s, ...u } : s) };
    commit(next, 'Edit section');
  }, [selectedShape, commit]);

  const updateSeat = useCallback((u: Partial<BSeat>) => {
    if (!selectedSeat) return;
    const next = { ...layoutRef.current, seats: layoutRef.current.seats.map(s => s.id === selectedSeat.id ? { ...s, ...u } : s) };
    commit(next, 'Edit seat');
  }, [selectedSeat, commit]);

  const updateText = useCallback((u: Partial<BText>) => {
    if (!selectedText) return;
    const next = { ...layoutRef.current, texts: layoutRef.current.texts.map(t => t.id === selectedText.id ? { ...t, ...u } : t) };
    commit(next, 'Edit text');
  }, [selectedText, commit]);

  const deleteSelected = useCallback(() => {
    const ids = selRef.current;
    const next: LayoutState = {
      ...layoutRef.current,
      shapes: layoutRef.current.shapes.filter(s => !ids.has(s.id)),
      seats: layoutRef.current.seats.filter(s => !ids.has(s.id)),
      texts: layoutRef.current.texts.filter(t => !ids.has(t.id)),
      rows: layoutRef.current.rows.filter(r => !ids.has(r.id)),
    };
    commit(next, 'Delete');
    syncSel(new Set());
  }, [commit, syncSel]);

  const fillSection = useCallback(() => {
    if (!selectedShape) return;
    const sh = selectedShape;
    const vs = sh.vertices;
    const minX = Math.min(...vs.map(v => v[0])), maxX = Math.max(...vs.map(v => v[0]));
    const minY = Math.min(...vs.map(v => v[1])), maxY = Math.max(...vs.map(v => v[1]));
    const step = 14;
    const newSeats: BSeat[] = [];
    let row = 0;
    for (let y = minY + step; y < maxY; y += step, row++) {
      let col = 0;
      for (let x = minX + step; x < maxX; x += step, col++) {
        if (pointInPoly(x, y, vs)) {
          const rowLabel = String.fromCharCode(65 + (row % 26));
          newSeats.push({ id: `fs-${uid()}`, rowId: '', sectionId: sh.id, number: col + 1, label: `${rowLabel}${col + 1}`, x, y, price: 0, status: 'available', category: sh.category });
        }
      }
    }
    const next = { ...layoutRef.current, seats: [...layoutRef.current.seats, ...newSeats] };
    commit(next, 'Fill section');
  }, [selectedShape, commit]);

  const applyGeneratedLayout = useCallback((patch: Partial<LayoutState>) => {
    const next: LayoutState = {
      shapes: [...layoutRef.current.shapes, ...(patch.shapes || [])],
      rows: [...layoutRef.current.rows, ...(patch.rows || [])],
      seats: [...layoutRef.current.seats, ...(patch.seats || [])],
      texts: [...layoutRef.current.texts, ...(patch.texts || [])],
    };
    commit(next, 'Generate');
  }, [commit]);

  const multiUpdate = useCallback((cat?: Category, price?: number, status?: SeatStatus) => {
    const ids = selRef.current;
    const next = { ...layoutRef.current, seats: layoutRef.current.seats.map(s => {
      if (!ids.has(s.id)) return s;
      return { ...s, ...(cat ? { category: cat } : {}), ...(price !== undefined ? { price } : {}), ...(status ? { status } : {}) };
    }) };
    commit(next, 'Bulk edit');
  }, [commit]);

  const exitSectionMode = useCallback(() => {
    setSecMode(null); secModeRef.current = null;
    syncSel(new Set());
  }, [syncSel]);

  // ── Split section ──────────────────────────────────────────────────────────
  const splitSection = useCallback((shapeId: string, axis: 'h' | 'v') => {
    const shape = layoutRef.current.shapes.find(s => s.id === shapeId);
    if (!shape) return;
    const xs = shape.vertices.map(v => v[0]);
    const ys = shape.vertices.map(v => v[1]);
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;

    const uid2 = () => `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const idA = `${shapeId}-a`, idB = `${shapeId}-b`;

    let vertsA: [number,number][], vertsB: [number,number][];
    if (axis === 'v') {
      vertsA = shape.vertices.map(([x,y]) => [Math.min(x, midX), y] as [number,number]);
      vertsB = shape.vertices.map(([x,y]) => [Math.max(x, midX), y] as [number,number]);
    } else {
      vertsA = shape.vertices.map(([x,y]) => [x, Math.min(y, midY)] as [number,number]);
      vertsB = shape.vertices.map(([x,y]) => [x, Math.max(y, midY)] as [number,number]);
    }

    const [cxA, cyA] = [vertsA.reduce((s,v)=>s+v[0],0)/vertsA.length, vertsA.reduce((s,v)=>s+v[1],0)/vertsA.length];
    const [cxB, cyB] = [vertsB.reduce((s,v)=>s+v[0],0)/vertsB.length, vertsB.reduce((s,v)=>s+v[1],0)/vertsB.length];

    const shapeA: typeof shape = { ...shape, id: idA, label: shape.label + '-A', vertices: vertsA, cx: cxA, cy: cyA };
    const shapeB: typeof shape = { ...shape, id: idB, label: shape.label + '-B', vertices: vertsB, cx: cxB, cy: cyB };

    const next: LayoutState = {
      ...layoutRef.current,
      shapes: layoutRef.current.shapes.filter(s => s.id !== shapeId).concat([shapeA, shapeB]),
      seats: layoutRef.current.seats.map(s => s.sectionId === shapeId
        ? { ...s, sectionId: (axis === 'v' ? s.x < midX : s.y < midY) ? idA : idB }
        : s
      ),
    };
    commit(next, `Split ${shape.label}`);
    syncSel(new Set([idA, idB]));
  }, [commit, syncSel]);

  // ── Merge sections ─────────────────────────────────────────────────────────
  const mergeSections = useCallback((ids: string[]) => {
    if (ids.length < 2) return;
    const shapes = layoutRef.current.shapes.filter(s => ids.includes(s.id));
    if (shapes.length < 2) return;
    const allVerts = shapes.flatMap(s => s.vertices);
    const cx = allVerts.reduce((a,v)=>a+v[0],0)/allVerts.length;
    const cy = allVerts.reduce((a,v)=>a+v[1],0)/allVerts.length;
    // convex hull of all vertices
    const hull = convexHull(allVerts);
    const merged = { ...shapes[0], id: `merged-${Date.now()}`, label: shapes.map(s=>s.label).join('+'), vertices: hull, cx, cy };
    const next: LayoutState = {
      ...layoutRef.current,
      shapes: layoutRef.current.shapes.filter(s => !ids.includes(s.id)).concat([merged]),
      seats: layoutRef.current.seats.map(s => ids.includes(s.sectionId) ? { ...s, sectionId: merged.id } : s),
    };
    commit(next, `Merge sections`);
    syncSel(new Set([merged.id]));
  }, [commit, syncSel]);

  // ── Rotate selection ───────────────────────────────────────────────────────
  const rotateSelected = useCallback((angleDeg: number) => {
    const ids = selRef.current;
    if (ids.size === 0) return;
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    // pivot = centroid of all selected shapes
    const shapes = layoutRef.current.shapes.filter(s => ids.has(s.id));
    const allPts = shapes.flatMap(s => s.vertices);
    const px = allPts.reduce((a,v)=>a+v[0],0)/Math.max(allPts.length,1);
    const py = allPts.reduce((a,v)=>a+v[1],0)/Math.max(allPts.length,1);
    const rot = ([x,y]: [number,number]): [number,number] => {
      const dx = x-px, dy = y-py;
      return [px + dx*cos - dy*sin, py + dx*sin + dy*cos];
    };
    const next: LayoutState = {
      ...layoutRef.current,
      shapes: layoutRef.current.shapes.map(s => ids.has(s.id)
        ? { ...s, vertices: s.vertices.map(rot), cx: rot([s.cx,s.cy])[0], cy: rot([s.cx,s.cy])[1] }
        : s
      ),
      seats: layoutRef.current.seats.map(s => ids.has(s.sectionId)
        ? { ...s, ...{ x: rot([s.x,s.y])[0], y: rot([s.x,s.y])[1] } }
        : s
      ),
    };
    commit(next, `Rotate ${angleDeg}°`);
  }, [commit]);

  const cursor = tool === 'pan' || isPanning.current ? 'grab'
    : tool === 'select' ? 'default'
    : 'crosshair';

  const counts = {
    sections: layout.shapes.filter(s => s.type === 'section').length,
    seats: layout.seats.length,
  };

  return {
    // state
    tool, snapOn, layout, selectedIds, sectionMode, camera, preview,
    history, zoomPct, bgImage, bgOpacity, venueName, cursor, counts,
    selectedShape, selectedSeat, selectedText, selectedRow, heatmap,
    // setters
    setSnapOn: (v: boolean) => { snapRef.current = v; setSnapOn(v); },
    setVenueName, setBgImage, setBgOpacity, setHeatmap, rowSeatsCount, setRowSeatsCount,
    // handlers
    changeTool, onPointerDown, onPointerMove, onPointerUp, onDblClick, onWheel,
    updateShape, updateSeat, updateText, updateRow, deleteSelected, fillSection,
    applyGeneratedLayout, multiUpdate, exitSectionMode,
    splitSection, mergeSections, rotateSelected,
    undo, redo, zoomIn, zoomOut,
    loadTemplate: (state: LayoutState) => { layoutRef.current = state; setLayout(state); syncSel(new Set()); },
    restoreSnapshot: (s: Snapshot) => { const r = JSON.parse(JSON.stringify(s.state)); layoutRef.current = r; setLayout(r); syncSel(new Set()); },
    exportLayout: () => {
      const b = new Blob([JSON.stringify({ venueName, ...layout }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${venueName.replace(/\s+/g, '_')}.json`; a.click();
    },
  };
}

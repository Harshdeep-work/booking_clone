'use client';
/**
 * useBuilderEngine — all interaction logic for the venue builder.
 * Keeps the main component clean.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import {
  EMPTY_LAYOUT, CAT_COLOR, centroid, snapVal, pointInPoly,
  generateRowSeats, generateBlockSeats, generateArcRowSeats, generateCurvedRows,
  arcPoly, regularPoly, starPoly,
  type LayoutState, type BShape, type BSeat, type BText, type BRow,
  type ToolId, type Category, type SeatStatus, type Snapshot,
  DEFAULT_LAYERS, type LayerState, type LayerId,
} from './builderTypes2';
import { packLayout, unpackLayout } from '../../utils/stadiumOptimizer';
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
  const dragBbox   = useRef<{ handle: number; origBbox: [number,number,number,number]; origShapes: typeof EMPTY_LAYOUT.shapes; origSeats: typeof EMPTY_LAYOUT.seats } | null>(null);
  const dragRotate = useRef<{ cx: number; cy: number; startAngle: number; origShapes: typeof EMPTY_LAYOUT.shapes; origSeats: typeof EMPTY_LAYOUT.seats } | null>(null);
  // Row arc handle drag: handle 0=a0, 1=a1, 2=radius
  const dragRowHandle = useRef<{ rowId: string; handle: 0 | 1 | 2; origRow: BRow } | null>(null);
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
  const [orphanDisplayModes, setOrphanDisplayModes] = useState<Record<string, 'rows' | 'seats' | 'both'>>({});
  const [orphanRenderStyles, setOrphanRenderStyles] = useState<Record<string, 'dots' | 'bar' | 'line'>>({});
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
  const [rowSeatsCount, setRowSeatsCount] = useState(0); // 0 = auto
  const [lastRowSectionId, setLastRowSectionId] = useState<string | null>(null);
  const [rowCommitTick, setRowCommitTick] = useState(0);
  const [layers, setLayers]               = useState<LayerState[]>(DEFAULT_LAYERS);
  // Persistent group for consecutive row-tool draws so letters increment A,B,C...
  const rowGroupRef = useRef<string | null>(null);

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

  const selectEntity = useCallback((id: string, multi = false) => {
    if (multi) {
      const next = new Set(selRef.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      syncSel(next);
    } else {
      syncSel(new Set([id]));
    }
  }, [syncSel]);

  const clearSelection = useCallback(() => {
    syncSel(new Set());
  }, [syncSel]);

  const sw = useCallback((wx: number, wy: number): [number, number] => {
    const g = snapRef.current ? GRID : 1;
    return [snapVal(wx, g), snapVal(wy, g)];
  }, []);

  // ── Hit testing ────────────────────────────────────────────────────────────
  const hitTest = useCallback((wx: number, wy: number): string | null => {
    const { seats, shapes } = layoutRef.current;
    const secMode = secModeRef.current;

    // 1. Text labels
    const labelsLayer = layers.find(l => l.id === 'labels');
    const labelsVisible = labelsLayer ? labelsLayer.visible : true;
    const labelsLocked = labelsLayer ? labelsLayer.locked : false;
    if (labelsVisible && !labelsLocked) {
      const { texts } = layoutRef.current;
      if (texts) {
        for (let i = texts.length - 1; i >= 0; i--) {
          const t = texts[i];
          if (Math.hypot(t.x - wx, t.y - wy) <= 12) {
            return t.id;
          }
        }
      }
    }

    // 2. Seats (smaller targets)
    const seatsLayer = layers.find(l => l.id === 'seats');
    const seatsVisible = seatsLayer ? seatsLayer.visible : true;
    const seatsLocked = seatsLayer ? seatsLayer.locked : false;
    if (seatsVisible && !seatsLocked) {
      for (let i = seats.length - 1; i >= 0; i--) {
        const s = seats[i];
        if (secMode && s.sectionId !== secMode) continue;
        if (Math.hypot(s.x - wx, s.y - wy) <= SEAT_HIT / camRef.current.zoom) return s.id;
      }
    }

    // 3. Sections/shapes
    const sectionsLayer = layers.find(l => l.id === 'sections');
    const sectionsVisible = sectionsLayer ? sectionsLayer.visible : true;
    const sectionsLocked = sectionsLayer ? sectionsLayer.locked : false;
    if (sectionsVisible && !sectionsLocked) {
      for (let i = shapes.length - 1; i >= 0; i--) {
        const sh = shapes[i];
        if (secMode && sh.id !== secMode) continue;
        if (pointInPoly(wx, wy, sh.vertices)) return sh.id;
      }
    }
    return null;
  }, [layers]);

  /** Hit-test curved row arc handles. Returns { rowId, handle } or null. */
  const hitTestRowHandle = useCallback((wx: number, wy: number): { rowId: string; handle: 0 | 1 | 2 } | null => {
    const thresh = 12 / camRef.current.zoom;
    for (const row of layoutRef.current.rows) {
      if (!row.curveCenter || row.curveRadius == null || row.curveA0 == null || row.curveA1 == null) continue;
      if (!selRef.current.has(row.id)) continue;
      const [cx, cy] = row.curveCenter;
      const r = row.curveRadius;
      const a0r = (row.curveA0 * Math.PI) / 180;
      const a1r = (row.curveA1 * Math.PI) / 180;
      const ep0 = [cx + Math.cos(a0r) * r, cy + Math.sin(a0r) * r] as [number, number];
      const ep1 = [cx + Math.cos(a1r) * r, cy + Math.sin(a1r) * r] as [number, number];
      const amid = (a0r + a1r) / 2;
      const rh = [cx + Math.cos(amid) * (r + 14 / camRef.current.zoom), cy + Math.sin(amid) * (r + 14 / camRef.current.zoom)] as [number, number];
      if (Math.hypot(ep0[0] - wx, ep0[1] - wy) <= thresh) return { rowId: row.id, handle: 0 };
      if (Math.hypot(ep1[0] - wx, ep1[1] - wy) <= thresh) return { rowId: row.id, handle: 1 };
      if (Math.hypot(rh[0] - wx, rh[1] - wy) <= thresh) return { rowId: row.id, handle: 2 };
    }
    return null;
  }, []);

  /** Hit-test a curved row stripe (click anywhere on the arc). */
  const hitTestRow = useCallback((wx: number, wy: number): string | null => {
    const thresh = 10 / camRef.current.zoom;
    for (let i = layoutRef.current.rows.length - 1; i >= 0; i--) {
      const row = layoutRef.current.rows[i];
      if (!row.curveCenter || row.curveRadius == null || row.curveA0 == null || row.curveA1 == null) continue;
      const [cx, cy] = row.curveCenter;
      const dist = Math.hypot(wx - cx, wy - cy);
      if (Math.abs(dist - row.curveRadius) > thresh) continue;
      // Check angle is within arc sweep
      let angle = Math.atan2(wy - cy, wx - cx) * 180 / Math.PI;
      const a0 = row.curveA0, a1 = row.curveA1;
      if (a1 > a0) {
        if (angle < a0) angle += 360;
        if (angle >= a0 && angle <= a1) return row.id;
      } else {
        if (angle > a0) angle -= 360;
        if (angle <= a0 && angle >= a1) return row.id;
      }
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
        // Reuse group for consecutive row draws; reset when tool changes
        if (!rowGroupRef.current) rowGroupRef.current = secMode || `grp-${uid()}`;
        const groupId = rowGroupRef.current;
        // Letter = number of existing rows in this group (A=0, B=1, ...)
        const existingRowCount = new Set(
          layoutRef.current.seats.filter(s => s.sectionId === groupId).map(s => s.rowId)
        ).size;
        const rowLetter = String.fromCharCode(65 + (existingRowCount % 26));
        const newSeats = generateRowSeats(p1, [swx, swy], count, rowId, groupId, rowLetter, 'STANDARD', 100);
        const next = { ...layoutRef.current, seats: [...layoutRef.current.seats, ...newSeats] };
        commit(next, 'Add row');
        setLastRowSectionId(groupId);
        setRowCommitTick(t => t + 1);
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

    if (tool === 'seatselect') {
      // start rubber-band rect for seat selection
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
      // ── Row arc handle drag (check first, highest priority) ────────────────
      const rowHandle = hitTestRowHandle(wx, wy);
      if (rowHandle) {
        const origRow = layoutRef.current.rows.find(r => r.id === rowHandle.rowId)!;
        dragRowHandle.current = { ...rowHandle, origRow: JSON.parse(JSON.stringify(origRow)) };
        isDragging.current = true;
        return;
      }

      // bbox handle drag? (only when ≥1 shape selected, not in section mode)
      if (!secModeRef.current && selRef.current.size > 0) {
        const selShapes = layoutRef.current.shapes.filter(s => selRef.current.has(s.id));
        if (selShapes.length > 0) {
          const allVerts = selShapes.flatMap(s => s.vertices);
          const x0 = Math.min(...allVerts.map(v => v[0]));
          const y0 = Math.min(...allVerts.map(v => v[1]));
          const x1 = Math.max(...allVerts.map(v => v[0]));
          const y1 = Math.max(...allVerts.map(v => v[1]));
          const mx2 = (x0 + x1) / 2, my2 = (y0 + y1) / 2;

          // Rotate handle: above top-center
          const rotHandleY = y0 - 24 / camRef.current.zoom;
          const rotThresh = 12 / camRef.current.zoom;
          if (Math.hypot(mx2 - wx, rotHandleY - wy) <= rotThresh) {
            dragRotate.current = {
              cx: mx2, cy: my2,
              startAngle: Math.atan2(wy - my2, wx - mx2),
              origShapes: JSON.parse(JSON.stringify(selShapes)),
              origSeats: JSON.parse(JSON.stringify(layoutRef.current.seats.filter(s => selRef.current.has(s.sectionId)))),
            };
            isDragging.current = true;
            return;
          }

          // 8 handles: TL,TC,TR,ML,MR,BL,BC,BR
          const handles: [number,number][] = [
            [x0,y0],[mx2,y0],[x1,y0],
            [x0,my2],        [x1,my2],
            [x0,y1],[mx2,y1],[x1,y1],
          ];
          const thresh = 12 / camRef.current.zoom;
          for (let hi = 0; hi < handles.length; hi++) {
            if (Math.hypot(handles[hi][0] - wx, handles[hi][1] - wy) <= thresh) {
              dragBbox.current = {
                handle: hi,
                origBbox: [x0, y0, x1, y1],
                origShapes: JSON.parse(JSON.stringify(selShapes)),
                origSeats: JSON.parse(JSON.stringify(layoutRef.current.seats.filter(s => selRef.current.has(s.sectionId)))),
              };
              isDragging.current = true;
              return;
            }
          }
        }
      }

      // vertex drag?
      const thresh = 14 / camRef.current.zoom;
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
      // Also check row arc hit
      const rowHitId = !hitId ? hitTestRow(wx, wy) : null;
      const finalHitId = hitId || rowHitId;
      if (finalHitId) {
        const next = e.shiftKey ? new Set(Array.from(selRef.current).concat(finalHitId)) : new Set([finalHitId]);
        syncSel(next);
        isDragging.current = true;
        dragOffsets.current.clear();
        layoutRef.current.seats.forEach(s => {
          if (next.has(s.id) || (s.rowId && next.has(s.rowId))) dragOffsets.current.set(s.id, [swx - s.x, swy - s.y]);
        });
        layoutRef.current.shapes.forEach(sh => {
          if (next.has(sh.id)) dragOffsets.current.set(sh.id, [swx - sh.cx, swy - sh.cy]);
        });
        layoutRef.current.texts.forEach(t => {
          if (next.has(t.id)) dragOffsets.current.set(t.id, [swx - t.x, swy - t.y]);
        });
        // also store offset for the curve center if a row is selected
        layoutRef.current.rows.forEach(r => {
          if (next.has(r.id) && r.curveCenter) dragOffsets.current.set(r.id, [swx - r.curveCenter[0], swy - r.curveCenter[1]]);
        });
      } else if (!e.shiftKey) {
        syncSel(new Set());
      }
    }
  }, [sw, hitTest, hitTestRow, hitTestRowHandle, commit, syncSel]);

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

    if (isDragging.current && dragRowHandle.current) {
      const { rowId, handle, origRow } = dragRowHandle.current;
      const [cx, cy] = origRow.curveCenter!;
      let newA0 = origRow.curveA0!, newA1 = origRow.curveA1!, newR = origRow.curveRadius!;
      const angleDeg = Math.atan2(swy - cy, swx - cx) * 180 / Math.PI;
      if (handle === 0) newA0 = angleDeg;
      else if (handle === 1) newA1 = angleDeg;
      else newR = Math.max(10, Math.hypot(swx - cx, swy - cy));

      // Recompute seat positions
      const arcLen = Math.abs(newA1 - newA0) / 360 * 2 * Math.PI * newR;
      const seatCount = Math.max(2, Math.floor(arcLen / 13));
      const newSeats: BSeat[] = Array.from({ length: seatCount }, (_, i) => {
        const t = seatCount === 1 ? 0.5 : i / (seatCount - 1);
        const a = ((newA0 + t * (newA1 - newA0)) * Math.PI) / 180;
        const orig = origRow.seats[i] || origRow.seats[origRow.seats.length - 1];
        return {
          ...(orig || {}),
          id: `seat-${rowId}-${i}`,
          rowId, sectionId: origRow.sectionId,
          number: i + 1, label: `${origRow.label}${i + 1}`,
          x: cx + Math.cos(a) * newR,
          y: cy + Math.sin(a) * newR,
          price: orig?.price ?? 100,
          status: (orig?.status ?? 'available') as BSeat['status'],
          category: origRow.category,
        };
      });

      const next = { ...layoutRef.current };
      next.rows = next.rows.map(r => r.id !== rowId ? r : { ...r, curveA0: newA0, curveA1: newA1, curveRadius: newR });
      next.seats = [...next.seats.filter(s => s.rowId !== rowId), ...newSeats];
      layoutRef.current = next;
      setLayout(next);
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

    if (isDragging.current && dragRotate.current) {
      const { cx, cy, startAngle, origShapes, origSeats } = dragRotate.current;
      const angle = Math.atan2(swy - cy, swx - cx) - startAngle;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const rotPt = (vx: number, vy: number): [number, number] => {
        const dx = vx - cx, dy = vy - cy;
        return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
      };
      const origShapeMap = new Map(origShapes.map((s: any) => [s.id, s]));
      const origSeatMap  = new Map(origSeats.map((s: any) => [s.id, s]));
      const next = { ...layoutRef.current };
      next.shapes = next.shapes.map(sh => {
        const orig = origShapeMap.get(sh.id); if (!orig) return sh;
        const verts = orig.vertices.map(([vx, vy]: [number,number]) => rotPt(vx, vy)) as [number,number][];
        const [ncx, ncy] = centroid(verts);
        return { ...sh, vertices: verts, cx: ncx, cy: ncy };
      });
      next.seats = next.seats.map(s => {
        const orig = origSeatMap.get(s.id); if (!orig) return s;
        const [nx, ny] = rotPt(orig.x, orig.y);
        return { ...s, x: nx, y: ny };
      });
      layoutRef.current = next;
      setLayout(next);
      return;
    }

    if (isDragging.current && dragBbox.current) {
      const { handle, origBbox, origShapes, origSeats } = dragBbox.current;
      const [ox0, oy0, ox1, oy1] = origBbox;
      // Determine new bbox based on which handle is dragged
      let nx0 = ox0, ny0 = oy0, nx1 = ox1, ny1 = oy1;
      // TL=0,TC=1,TR=2, ML=3,MR=4, BL=5,BC=6,BR=7
      if (handle === 0) { nx0 = swx; ny0 = swy; }
      else if (handle === 1) { ny0 = swy; }
      else if (handle === 2) { nx1 = swx; ny0 = swy; }
      else if (handle === 3) { nx0 = swx; }
      else if (handle === 4) { nx1 = swx; }
      else if (handle === 5) { nx0 = swx; ny1 = swy; }
      else if (handle === 6) { ny1 = swy; }
      else if (handle === 7) { nx1 = swx; ny1 = swy; }

      const ow = ox1 - ox0 || 1, oh = oy1 - oy0 || 1;
      const nw = nx1 - nx0 || 1, nh = ny1 - ny0 || 1;

      const scaleVert = (vx: number, vy: number): [number, number] => [
        nx0 + (vx - ox0) / ow * nw,
        ny0 + (vy - oy0) / oh * nh,
      ];

      const next = { ...layoutRef.current };
      const origShapeMap = new Map(origShapes.map(s => [s.id, s]));
      next.shapes = next.shapes.map(sh => {
        const orig = origShapeMap.get(sh.id);
        if (!orig) return sh;
        const verts = orig.vertices.map(([vx, vy]) => scaleVert(vx, vy)) as [number,number][];
        const [cx, cy] = centroid(verts);
        return { ...sh, vertices: verts, cx, cy };
      });

      const origSeatMap = new Map(origSeats.map((s: any) => [s.id, s]));
      next.seats = next.seats.map(s => {
        const orig = origSeatMap.get(s.id);
        if (!orig) return s;
        const [nx, ny] = scaleVert(orig.x, orig.y);
        return { ...s, x: nx, y: ny };
      });

      layoutRef.current = next;
      setLayout(next);
      return;
    }

    if (isDragging.current && selRef.current.size > 0) {
      const next = { ...layoutRef.current };
      next.seats = next.seats.map(s => {
        if (!selRef.current.has(s.id) && !(s.rowId && selRef.current.has(s.rowId))) return s;
        const off = dragOffsets.current.get(s.id) || [0, 0];
        return { ...s, x: swx - off[0], y: swy - off[1] };
      });
      next.rows = next.rows.map(r => {
        if (!selRef.current.has(r.id) || !r.curveCenter) return r;
        const off = dragOffsets.current.get(r.id) || [0, 0];
        return { ...r, curveCenter: [swx - off[0], swy - off[1]] };
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
      dragBbox.current = null;
      dragRotate.current = null;
      dragRowHandle.current = null;
      commit(layoutRef.current, 'Move');
      return;
    }

    if (tool === 'seatselect' && rectStart.current) {
      const [x0, y0] = rectStart.current;
      const rx0 = Math.min(x0, swx), rx1 = Math.max(x0, swx);
      const ry0 = Math.min(y0, swy), ry1 = Math.max(y0, swy);
      const isClick = (rx1 - rx0 < 5) && (ry1 - ry0 < 5);

      let nextSel = selRef.current;

      if (isClick) {
        const hitId = hitTest(wx, wy);
        const rowHitId = !hitId ? hitTestRow(wx, wy) : null;
        const finalHitId = hitId || rowHitId;
        if (finalHitId) {
          nextSel = e.shiftKey ? new Set(Array.from(selRef.current).concat(finalHitId)) : new Set([finalHitId]);
        } else if (!e.shiftKey) {
          nextSel = new Set();
        }
      } else {
        const insideSeats = layoutRef.current.seats
          .filter(s => s.x >= rx0 && s.x <= rx1 && s.y >= ry0 && s.y <= ry1)
          .map(s => s.id);
        const insideRows = layoutRef.current.rows
          .filter(r => r.curveCenter && r.curveCenter[0] >= rx0 && r.curveCenter[0] <= rx1 && r.curveCenter[1] >= ry0 && r.curveCenter[1] <= ry1)
          .map(r => r.id);
        const inside = [...insideSeats, ...insideRows];
        if (inside.length > 0) {
          nextSel = e.shiftKey ? new Set([...selRef.current, ...inside]) : new Set(inside);
        } else if (!e.shiftKey) {
          nextSel = new Set();
        }
      }
      
      syncSel(nextSel);
      rectStart.current = null;
      setPreview(p => ({ ...p, rectStart: null }));
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
      // Each multirow group gets a unique sectionId so display mode is independent
      const groupId = secMode || `grp-${uid()}`;
      const newSeats: BSeat[] = [];
      const ROWS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      for (let r = 0; r < numRows; r++) {
        const rowId = `mrow-${uid()}`;
        const y = y0 + (h > 0 ? r : -r) * rowSpacing + rowSpacing / 2;
        const rowLetter = ROWS[r % 26];
        const rowSeats = generateRowSeats([x0, y], [swx, y], seatsPerRow, rowId, groupId, rowLetter, 'STANDARD', 100);
        newSeats.push(...rowSeats);
      }
      const next = { ...layoutRef.current, seats: [...layoutRef.current.seats, ...newSeats] };
      commit(next, `Add ${numRows} rows`);
      setLastRowSectionId(groupId);
      setRowCommitTick(t => t + 1);
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
      const map: Record<string, ToolId> = { v: 'select', q: 'seatselect', s: 'section', r: 'rect', c: 'circle', e: 'ellipse', '3': 'triangle', d: 'diamond', '5': 'pentagon', '6': 'hexagon', '*': 'star', w: 'row', m: 'multirow', a: 'arcrow', b: 'block', t: 'text', h: 'pan' };
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

  const zoomReset = useCallback(() => {
    const newCam = { x: 0, y: 0, zoom: 1 };
    camRef.current = newCam;
    setCamera(newCam);
    setZoomPct(100);
  }, []);

  const zoomFit = useCallback((canvasW: number, canvasH: number) => {
    const lay = layoutRef.current;
    const allX: number[] = [];
    const allY: number[] = [];
    lay.shapes.forEach(s => s.vertices.forEach(([x, y]) => { allX.push(x); allY.push(y); }));
    lay.seats.forEach(s => { allX.push(s.x); allY.push(s.y); });
    if (allX.length === 0) { zoomReset(); return; }
    const minX = Math.min(...allX), maxX = Math.max(...allX);
    const minY = Math.min(...allY), maxY = Math.max(...allY);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const pad = 60;
    const z = Math.min(
      (canvasW - pad * 2) / Math.max(maxX - minX, 1),
      (canvasH - pad * 2) / Math.max(maxY - minY, 1),
      20
    );
    const newCam = { x: cx, y: cy, zoom: z };
    camRef.current = newCam;
    setCamera(newCam);
    setZoomPct(Math.round(z * 100));
  }, [zoomReset]);
  const changeTool = useCallback((t: ToolId) => {
    toolRef.current = t;
    setTool(t);
    drawPts.current = []; rowStart.current = null; rectStart.current = null;
    arcRowCenter.current = null; arcRowRadius.current = null; arcRowA0.current = null;
    if (t !== 'row') rowGroupRef.current = null; // reset group when leaving row tool
    setPreview(p => ({ ...p, pts: [], rectStart: null, tool: t }));
  }, []);

  // ── Selection helpers ──────────────────────────────────────────────────────
  const selectedShape = layout.shapes.find(s => selectedIds.has(s.id) && selectedIds.size === 1) || null;
  const selectedSeat  = layout.seats.find(s => selectedIds.has(s.id) && selectedIds.size === 1) || null;
  const selectedText  = layout.texts.find(t => selectedIds.has(t.id) && selectedIds.size === 1) || null;

  // Derive selected row: when a single seat is selected, expose its row group
  // OR when a row and its seats are selected
  const selectedRow = (() => {
    if (selectedIds.size === 0) return null;
    
    let targetRowId: string | null = null;

    if (selectedIds.size === 1) {
      const id = Array.from(selectedIds)[0];
      const seat = layout.seats.find(s => s.id === id);
      if (seat && seat.rowId) targetRowId = seat.rowId;
      else if (layout.rows.some(r => r.id === id)) targetRowId = id;
    } else {
      // Multiple items selected. Check if they ALL belong to the same row
      const arr = Array.from(selectedIds);
      const firstId = arr[0];
      let candRowId = layout.rows.find(r => r.id === firstId)?.id;
      if (!candRowId) {
        const seat = layout.seats.find(s => s.id === firstId);
        if (seat?.rowId) candRowId = seat.rowId;
      }
      
      if (candRowId) {
        // Verify ALL selected items are either this row or seats in this row
        const allBelong = arr.every(id => {
          if (id === candRowId) return true;
          const seat = layout.seats.find(s => s.id === id);
          return seat && seat.rowId === candRowId;
        });
        if (allBelong) targetRowId = candRowId;
      }
    }

    if (!targetRowId) return null;

    const rowSeats = layout.seats.filter(s => s.rowId === targetRowId);
    if (rowSeats.length === 0) return null;
    const directRow = layout.rows.find(r => r.id === targetRowId);

    return {
      id: targetRowId,
      sectionId: rowSeats[0].sectionId,
      label: directRow?.label || rowSeats[0].label.replace(/\d+$/, ''),
      category: directRow?.category || rowSeats[0].category,
      seatCount: rowSeats.length,
      seats: rowSeats,
      curveRadius: directRow?.curveRadius,
    };
  })();

  // ── Split row: move selected seat IDs into a new row ─────────────────────
  const splitRow = useCallback((rowId: string, seatIds: string[]) => {
    if (seatIds.length === 0) return;
    const layout = layoutRef.current;
    const splitSet = new Set(seatIds);

    // Find sectionId from the split seats directly (handles __norow__ keys too)
    const anySplitSeat = layout.seats.find(s => splitSet.has(s.id));
    if (!anySplitSeat) return;
    const sectionId = anySplitSeat.sectionId;

    // All seats in the original row (match by rowId OR by being in splitSet)
    const rowSeats = layout.seats
      .filter(s => s.rowId === rowId || (rowId.startsWith('__norow__') && s.sectionId === sectionId && !s.rowId))
      .sort((a, b) => a.number - b.number);

    // Generate new row label
    const existingLabels = [...new Set(layout.seats.filter(s => s.sectionId === sectionId).map(s => s.label.replace(/\d+$/, '')))];
    const increment = (s: string): string => {
      const chars = s.split('');
      for (let i = chars.length - 1; i >= 0; i--) {
        if (chars[i] < 'Z') { chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1); return chars.join(''); }
        chars[i] = 'A';
      }
      return 'A' + chars.join('');
    };
    const sortedLabels = [...existingLabels].sort((a, b) => a.length !== b.length ? a.length - b.length : a.localeCompare(b));
    const newLabel = increment(sortedLabels[sortedLabels.length - 1] || 'A');
    const newRowId = `row-${sectionId}-split-${uid()}`;
    const origLabel = rowSeats[0]?.label.replace(/\d+$/, '') || 'A';

    let newNum = 1;
    let origNum = 1;
    const remainingIds = new Set(rowSeats.filter(s => !splitSet.has(s.id)).map(s => s.id));

    // Compute row spacing to offset the new row so it doesn't overlap
    // Use average Y of split seats vs remaining seats, or fall back to 14
    const splitSeats = rowSeats.filter(s => splitSet.has(s.id));
    const remainSeats = rowSeats.filter(s => !splitSet.has(s.id));
    let offsetY = 14;
    if (remainSeats.length > 0 && splitSeats.length > 0) {
      // Find nearest other row in the section to determine spacing
      const allRowIds = [...new Set(layout.seats.filter(s => s.sectionId === sectionId).map(s => s.rowId))].filter(r => r !== rowId);
      if (allRowIds.length > 0) {
        const rowAvgY = rowSeats.reduce((s, r) => s + r.y, 0) / rowSeats.length;
        const otherAvgYs = allRowIds.map(rid => {
          const rs = layout.seats.filter(s => s.rowId === rid);
          return rs.reduce((s, r) => s + r.y, 0) / rs.length;
        });
        const nearest = otherAvgYs.reduce((a, b) => Math.abs(b - rowAvgY) < Math.abs(a - rowAvgY) ? b : a);
        offsetY = Math.abs(nearest - rowAvgY) || 14;
      }
    }

    const newSeats = layout.seats.map(s => {
      if (splitSet.has(s.id)) {
        const n = newNum++;
        return { ...s, rowId: newRowId, number: n, label: `${newLabel}${n}`, y: s.y + offsetY };
      }
      if (remainingIds.has(s.id)) {
        const n = origNum++;
        return { ...s, number: n, label: `${origLabel}${n}` };
      }
      return s;
    });

    commit({ ...layout, seats: newSeats }, 'Split row');
  }, [commit]);

  // ── Add row (panel-driven, auto-positions below last row) ───────────────────
  const addRow = useCallback((sectionId: string, rowLabel: string, seatCount: number, price: number, category: Category, color?: string) => {
    // Find the section shape to determine width
    const shape = layoutRef.current.shapes.find(s => s.id === sectionId);
    const existingSeats = layoutRef.current.seats.filter(s => s.sectionId === sectionId);

    // Determine X extents from section shape or existing seats
    let x0 = -60, x1 = 60, baseY = 0;
    if (shape && shape.vertices.length > 0) {
      const xs = shape.vertices.map(v => v[0]);
      const ys = shape.vertices.map(v => v[1]);
      x0 = Math.min(...xs) + 8;
      x1 = Math.max(...xs) - 8;
      baseY = Math.min(...ys) + 8;
    }

    // Find the lowest Y of existing rows in this section
    if (existingSeats.length > 0) {
      const maxY = Math.max(...existingSeats.map(s => s.y));
      baseY = maxY + 14; // 14 world units row spacing
    }

    const rowId = `row-${sectionId}-${uid()}`;
    const newSeats: BSeat[] = Array.from({ length: seatCount }, (_, i) => {
      const t = seatCount === 1 ? 0.5 : i / (seatCount - 1);
      const x = x0 + t * (x1 - x0);
      return {
        id: `seat-${rowId}-${i}`,
        rowId,
        sectionId,
        number: i + 1,
        label: `${rowLabel}${i + 1}`,
        x, y: baseY,
        price,
        status: 'available' as const,
        category,
        ...(color ? { color } : {}),
      };
    });

    const next: LayoutState = {
      ...layoutRef.current,
      seats: [...layoutRef.current.seats, ...newSeats],
    };
    commit(next, `Add row ${rowLabel}`);
  }, [commit]);

  // ── Add concentric curved rows ─────────────────────────────────────────────
  const addCurvedRows = useCallback((
    sectionId: string,
    cx: number, cy: number,
    innerRadius: number,
    rowCount: number,
    rowSpacing: number,
    a0deg: number, a1deg: number,
    category: Category,
    price: number,
  ) => {
    const existingLabels = layoutRef.current.seats
      .filter(s => s.sectionId === sectionId)
      .map(s => s.label.replace(/\d+$/, ''));
    const uniqueLabels = [...new Set(existingLabels)];
    const startIdx = uniqueLabels.length;
    const outerRadius = innerRadius + rowCount * rowSpacing;
    const { rows: newRows, seats: newSeats } = generateCurvedRows(
      cx, cy, innerRadius, rowCount, rowSpacing, a0deg, a1deg,
      sectionId, category, price, startIdx,
    );
    // Stamp arc metadata onto the section shape so it renders as filled arc bands
    const next: LayoutState = {
      ...layoutRef.current,
      shapes: layoutRef.current.shapes.map(s => s.id !== sectionId ? s : {
        ...s,
        arcCenter: [cx, cy] as [number, number],
        arcInnerR: innerRadius,
        arcOuterR: outerRadius,
        arcA0: a0deg,
        arcA1: a1deg,
      }),
      rows: [...layoutRef.current.rows, ...newRows],
      seats: [...layoutRef.current.seats, ...newSeats],
    };
    commit(next, `Add ${rowCount} curved rows`);
  }, [commit]);

  /** Create a new arc-shaped section + fill it with curved rows in one shot */
  const createArcSection = useCallback((
    label: string,
    cx: number, cy: number,
    innerRadius: number,
    rowCount: number,
    rowSpacing: number,
    a0deg: number, a1deg: number,
    category: Category,
    price: number,
  ) => {
    const outerRadius = innerRadius + rowCount * rowSpacing;
    const verts = arcPoly(cx, cy, innerRadius, outerRadius, a0deg, a1deg, 32);
    const [scx, scy] = centroid(verts);
    const sectionId = `sec-arc-${uid()}`;
    const shape: BShape = {
      id: sectionId, type: 'section', label,
      category, color: CAT_COLOR[category],
      vertices: verts, cx: scx, cy: scy,
      arcCenter: [cx, cy], arcInnerR: innerRadius, arcOuterR: outerRadius,
      arcA0: a0deg, arcA1: a1deg,
    };
    const { rows: newRows, seats: newSeats } = generateCurvedRows(
      cx, cy, innerRadius, rowCount, rowSpacing, a0deg, a1deg,
      sectionId, category, price, 0,
    );
    const next: LayoutState = {
      ...layoutRef.current,
      shapes: [...layoutRef.current.shapes, shape],
      rows: [...layoutRef.current.rows, ...newRows],
      seats: [...layoutRef.current.seats, ...newSeats],
    };
    commit(next, `Create arc section ${label}`);
    syncSel(new Set([sectionId]));
  }, [commit, syncSel]);

  /** Remove all seats from a row (row stripe stays visible) */
  const clearRowSeats = useCallback((rowId: string) => {
    const next = { ...layoutRef.current, seats: layoutRef.current.seats.filter(s => s.rowId !== rowId) };
    commit(next, 'Clear row seats');
  }, [commit]);

  /** Re-generate seats for a curved row that has no seats */
  const restoreRowSeats = useCallback((rowId: string) => {
    const row = layoutRef.current.rows.find(r => r.id === rowId);
    if (!row?.curveCenter || row.curveRadius == null || row.curveA0 == null || row.curveA1 == null) return;
    const [cx, cy] = row.curveCenter;
    const arcLen = Math.abs(row.curveA1 - row.curveA0) / 360 * 2 * Math.PI * row.curveRadius;
    const count = Math.max(2, Math.floor(arcLen / 13));
    const newSeats: BSeat[] = Array.from({ length: count }, (_, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const a = ((row.curveA0! + t * (row.curveA1! - row.curveA0!)) * Math.PI) / 180;
      return {
        id: `seat-${rowId}-r-${i}`,
        rowId, sectionId: row.sectionId,
        number: i + 1, label: `${row.label}${i + 1}`,
        x: cx + Math.cos(a) * row.curveRadius!,
        y: cy + Math.sin(a) * row.curveRadius!,
        price: row.priceOverride ?? 100,
        status: 'available' as const,
        category: row.category,
      };
    });
    const next = { ...layoutRef.current, seats: [...layoutRef.current.seats, ...newSeats] };
    commit(next, 'Restore row seats');
  }, [commit]);
  const duplicateRow = useCallback((sourceRowId: string) => {
    const sourceSeats = layoutRef.current.seats.filter(s => s.rowId === sourceRowId).sort((a,b) => a.number - b.number);
    if (sourceSeats.length === 0) return;

    const sectionId = sourceSeats[0].sectionId;
    const existingLabels = layoutRef.current.seats.filter(s => s.sectionId === sectionId).map(s => s.label.replace(/\d+$/, ''));
    const sourceLabel = sourceSeats[0].label.replace(/\d+$/, '');

    // Refined incrementer inside duplicate too
    const increment = (s: string): string => {
      const chars = s.split('');
      for (let i = chars.length - 1; i >= 0; i--) {
        if (chars[i] < 'Z') {
          chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
          return chars.join('');
        }
        chars[i] = 'A';
      }
      return 'A' + chars.join('');
    };
    const nextLabel = increment(sourceLabel);

    const newRowId = `row-${sectionId}-${uid()}`;
    const newSeats: BSeat[] = sourceSeats.map(s => ({
      ...s,
      id: `seat-${newRowId}-${s.number}`,
      rowId: newRowId,
      label: `${nextLabel}${s.number}`,
      y: s.y + 14, // shift down by one row spacing
    }));

    const next: LayoutState = {
      ...layoutRef.current,
      seats: [...layoutRef.current.seats, ...newSeats],
    };
    commit(next, `Duplicate row ${sourceLabel} → ${nextLabel}`);
  }, [commit]);

  const deleteRow = useCallback((rowId: string) => {
    const next: LayoutState = {
      ...layoutRef.current,
      seats: layoutRef.current.seats.filter(s => s.rowId !== rowId),
      rows: layoutRef.current.rows.filter(r => r.id !== rowId),
    };
    commit(next, 'Delete row');
    // Clear selection if a deleted seat was selected
    const deletedIds = layoutRef.current.seats.filter(s => s.rowId === rowId).map(s => s.id);
    syncSel(new Set(Array.from(selRef.current).filter(id => !deletedIds.includes(id))));
  }, [commit, syncSel]);

  const updateRow = useCallback((rowId: string, u: { label?: string; category?: Category; color?: string; seatCount?: number; sectionLabel?: string; rowLabelEnabled?: boolean; curveRadius?: number; seatSpacing?: number; price?: number; numberScheme?: string }) => {
    const next = { ...layoutRef.current };
    if (u.label !== undefined || u.category !== undefined || u.color !== undefined) {
      next.seats = next.seats.map(s => {
        if (s.rowId !== rowId) return s;
        const newLabel = u.label !== undefined ? u.label : s.label.replace(/\d+$/, '');
        const num = s.number;
        return { ...s, label: `${newLabel}${num}`, ...(u.category ? { category: u.category } : {}), ...(u.color !== undefined ? { color: u.color } : {}) };
      });
      // Also update BRow record
      next.rows = next.rows.map(r => r.id !== rowId ? r : {
        ...r,
        ...(u.label !== undefined ? { label: u.label } : {}),
        ...(u.category !== undefined ? { category: u.category } : {}),
        ...(u.color !== undefined ? { color: u.color } : {}),
      });
    }
    // Add/remove seats when seatCount changes
    if (u.seatCount !== undefined) {
      const rowSeats = next.seats.filter(s => s.rowId === rowId).sort((a,b) => a.number - b.number);
      const diff = u.seatCount - rowSeats.length;
      if (diff < 0) {
        // Remove from end
        const toRemove = new Set(rowSeats.slice(diff).map(s => s.id));
        next.seats = next.seats.filter(s => !toRemove.has(s.id));
      } else if (diff > 0 && rowSeats.length >= 2) {
        // Add seats extending the row direction
        const last = rowSeats[rowSeats.length - 1];
        const prev = rowSeats[rowSeats.length - 2];
        const dx = last.x - prev.x, dy = last.y - prev.y;
        const newSeats = Array.from({ length: diff }, (_, i) => ({
          ...last,
          id: `seat-${rowId}-ext-${Date.now()}-${i}`,
          number: last.number + i + 1,
          label: `${last.label.replace(/\d+$/, '')}${last.number + i + 1}`,
          x: last.x + dx * (i + 1),
          y: last.y + dy * (i + 1),
        }));
        next.seats = [...next.seats, ...newSeats];
      }
    }
    // Re-space seats when seatSpacing changes
    if (u.seatSpacing !== undefined) {
      const rowSeats = next.seats.filter(s => s.rowId === rowId).sort((a,b) => a.number - b.number);
      if (rowSeats.length > 1) {
        const dx = rowSeats[1].x - rowSeats[0].x;
        const dy = rowSeats[1].y - rowSeats[0].y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const startX = rowSeats[0].x, startY = rowSeats[0].y;
        next.seats = next.seats.map(s => {
          if (s.rowId !== rowId) return s;
          const idx = rowSeats.findIndex(r => r.id === s.id);
          return { ...s, x: startX + ux * idx * u.seatSpacing!, y: startY + uy * idx * u.seatSpacing! };
        });
      }
    }
    // Renumber seats when numberScheme changes
    if (u.numberScheme !== undefined) {
      const rowSeats = next.seats.filter(s => s.rowId === rowId).sort((a,b) => a.number - b.number);
      const rowLabel = rowSeats[0]?.label.replace(/\d+$/, '') || '';
      const count = rowSeats.length;
      next.seats = next.seats.map(s => {
        if (s.rowId !== rowId) return s;
        const idx = rowSeats.findIndex(r => r.id === s.id);
        let num: number;
        if (u.numberScheme === 'odd') num = idx * 2 + 1;
        else if (u.numberScheme === 'even') num = idx * 2 + 2;
        else if (u.numberScheme === 'rtl') num = count - idx;
        else num = idx + 1;
        return { ...s, number: num, label: `${rowLabel}${num}` };
      });
    }
    // Update price for all seats in the row
    if (u.price !== undefined) {
      next.seats = next.seats.map(s =>
        s.rowId === rowId ? { ...s, price: u.price! } : s
      );
    }
    commit(next, 'Edit row');
  }, [commit]);

  const updateShape = useCallback((u: Partial<BShape>, shapeId?: string) => {
    const id = shapeId ?? selectedShape?.id;
    if (!id) return;

    const currentShape = layoutRef.current.shapes.find(s => s.id === id);
    if (!currentShape) return;

    const next = { ...layoutRef.current };

    if (u.scale !== undefined && u.scale !== (currentShape.scale ?? 1)) {
      const oldScale = currentShape.scale ?? 1;
      const newScale = u.scale;
      const factor = newScale / oldScale;
      const cx = currentShape.cx;
      const cy = currentShape.cy;

      next.shapes = next.shapes.map(s => {
        if (s.id !== id) return s;
        return {
          ...s,
          ...u,
          vertices: s.vertices.map(([x, y]) => [
            cx + (x - cx) * factor,
            cy + (y - cy) * factor
          ] as [number, number])
        };
      });

      next.seats = next.seats.map(s => {
        if (s.sectionId !== id) return s;
        return {
          ...s,
          x: cx + (s.x - cx) * factor,
          y: cy + (s.y - cy) * factor
        };
      });
    } else if (u.rotation !== undefined && u.rotation !== (currentShape.rotation ?? 0)) {
      const oldRot = currentShape.rotation ?? 0;
      const newRot = u.rotation;
      const diffRad = ((newRot - oldRot) * Math.PI) / 180;
      const cos = Math.cos(diffRad);
      const sin = Math.sin(diffRad);
      const cx = currentShape.cx;
      const cy = currentShape.cy;

      next.shapes = next.shapes.map(s => {
        if (s.id !== id) return s;
        return {
          ...s,
          ...u,
          vertices: s.vertices.map(([x, y]) => {
            const dx = x - cx;
            const dy = y - cy;
            return [
              cx + dx * cos - dy * sin,
              cy + dx * sin + dy * cos
            ] as [number, number];
          })
        };
      });

      next.seats = next.seats.map(s => {
        if (s.sectionId !== id) return s;
        const dx = s.x - cx;
        const dy = s.y - cy;
        return {
          ...s,
          x: cx + dx * cos - dy * sin,
          y: cy + dx * sin + dy * cos
        };
      });
    } else {
      if (u.blockPrice !== undefined) {
        next.seats = next.seats.map(s => s.sectionId === id ? { ...s, price: u.blockPrice! } : s);
      }
      next.shapes = next.shapes.map(s => s.id === id ? { ...s, ...u } : s);
    }

    commit(next, 'Edit section');
  }, [selectedShape, commit]);

  const updateSeat = useCallback((u: Partial<BSeat>) => {
    if (!selectedSeat) return;
    const next = { ...layoutRef.current, seats: layoutRef.current.seats.map(s => s.id === selectedSeat.id ? { ...s, ...u } : s) };
    commit(next, 'Edit seat');
  }, [selectedSeat, commit]);

  const setDisplayMode = useCallback((sectionId: string, mode: 'rows' | 'seats' | 'both') => {
    const hasShape = layoutRef.current.shapes.some(s => s.id === sectionId);
    if (hasShape) {
      const next = { ...layoutRef.current, shapes: layoutRef.current.shapes.map(s => s.id === sectionId ? { ...s, displayMode: mode } : s) };
      commit(next, 'Set display mode');
    } else {
      setOrphanDisplayModes(prev => ({ ...prev, [sectionId]: mode }));
    }
  }, [commit]);

  const setRowRenderStyle = useCallback((sectionId: string, style: 'dots' | 'bar' | 'line') => {
    setOrphanRenderStyles(prev => ({ ...prev, [sectionId]: style }));
  }, []);

  // Apply row style (straight/curved/angled) to all rows in a section group
  const applyRowStyle = useCallback((sectionId: string, style: 'straight' | 'curved' | 'angled') => {
    if (style === 'straight') return; // already straight
    const next = { ...layoutRef.current };
    const groupSeats = next.seats.filter(s => s.sectionId === sectionId);
    if (groupSeats.length === 0) return;

    // Group by row
    const rowMap = new Map<string, typeof groupSeats>();
    groupSeats.forEach(s => {
      const k = s.rowId || sectionId;
      if (!rowMap.has(k)) rowMap.set(k, []);
      rowMap.get(k)!.push(s);
    });

    if (style === 'curved') {
      // Arc height = 15% of row width — clearly visible
      next.seats = next.seats.map(s => {
        if (s.sectionId !== sectionId) return s;
        const row = rowMap.get(s.rowId || sectionId);
        if (!row || row.length < 2) return s;
        const sorted = [...row].sort((a, b) => a.number - b.number);
        const rowWidth = sorted[sorted.length - 1].x - sorted[0].x;
        const curveAmount = Math.abs(rowWidth) * 0.15;
        const idx = sorted.findIndex(r => r.id === s.id);
        const t = idx / (sorted.length - 1);
        return { ...s, y: s.y - Math.sin(t * Math.PI) * curveAmount };
      });
    } else if (style === 'angled') {
      // Tilt = 20% rise over full row width
      next.seats = next.seats.map(s => {
        if (s.sectionId !== sectionId) return s;
        const row = rowMap.get(s.rowId || sectionId);
        if (!row || row.length < 2) return s;
        const sorted = [...row].sort((a, b) => a.number - b.number);
        const rowWidth = sorted[sorted.length - 1].x - sorted[0].x || 1;
        const rise = Math.abs(rowWidth) * 0.20;
        return { ...s, y: s.y + ((s.x - sorted[0].x) / rowWidth) * rise };
      });
    }
    commit(next, `Apply ${style} row style`);
  }, [commit]);

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

  const applyGeneratedLayout = useCallback((patch: Partial<LayoutState> & { _replaceSectionId?: string }) => {
    const replaceId = patch._replaceSectionId;
    const next: LayoutState = {
      shapes: [...layoutRef.current.shapes, ...(patch.shapes || [])],
      rows: replaceId
        ? [...layoutRef.current.rows.filter(r => r.sectionId !== replaceId), ...(patch.rows || [])]
        : [...layoutRef.current.rows, ...(patch.rows || [])],
      seats: replaceId
        ? [...layoutRef.current.seats.filter(s => s.sectionId !== replaceId), ...(patch.seats || [])]
        : [...layoutRef.current.seats, ...(patch.seats || [])],
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

  // ── Add aisle: push seats after a given seat# by aisle width ─────────────
  const addAisle = useCallback((sectionId: string, afterSeat: number, width: number, axis: 'v' | 'h') => {
    const next = { ...layoutRef.current };
    if (axis === 'v') {
      // Push all seats with number > afterSeat in each row rightward by width
      next.seats = next.seats.map(s => {
        if (s.sectionId !== sectionId) return s;
        const rowLabel = s.label.replace(/\d+$/, '');
        const seatNum = s.number;
        if (seatNum > afterSeat) return { ...s, x: s.x + width };
        return s;
      });
    } else {
      // Group rows by label, push rows after every `afterSeat`-th row down by width
      const rowLabels = [...new Set(next.seats.filter(s => s.sectionId === sectionId).map(s => s.label.replace(/\d+$/, '')))].sort();
      const pushRows = new Set(rowLabels.filter((_, i) => (i + 1) % afterSeat === 0 ? false : i >= afterSeat));
      // Simpler: push all rows after index `afterSeat` down
      const pushSet = new Set(rowLabels.slice(afterSeat));
      next.seats = next.seats.map(s => {
        if (s.sectionId !== sectionId) return s;
        const rowLabel = s.label.replace(/\d+$/, '');
        if (pushSet.has(rowLabel)) return { ...s, y: s.y + width };
        return s;
      });
    }
    commit(next, 'Add aisle');
  }, [commit]);

  // ── Set density: scale seat spacing around section center ─────────────────
  const setSectionDensity = useCallback((sectionId: string, scale: number) => {
    const secSeats = layoutRef.current.seats.filter(s => s.sectionId === sectionId);
    if (secSeats.length === 0) return;
    const cx = secSeats.reduce((a, s) => a + s.x, 0) / secSeats.length;
    const cy = secSeats.reduce((a, s) => a + s.y, 0) / secSeats.length;
    const next = { ...layoutRef.current, seats: layoutRef.current.seats.map(s => {
      if (s.sectionId !== sectionId) return s;
      return { ...s, x: cx + (s.x - cx) * scale, y: cy + (s.y - cy) * scale };
    })};
    commit(next, 'Set density');
  }, [commit]);

  // ── Auto balance: redistribute seats symmetrically around center X ────────
  const autoBalance = useCallback((sectionId: string) => {
    const secSeats = layoutRef.current.seats.filter(s => s.sectionId === sectionId);
    if (secSeats.length === 0) return;
    // Group by row
    const rowMap = new Map<string, typeof secSeats>();
    secSeats.forEach(s => {
      const k = s.rowId || s.label.replace(/\d+$/, '');
      if (!rowMap.has(k)) rowMap.set(k, []);
      rowMap.get(k)!.push(s);
    });
    const updMap = new Map<string, { x: number; y: number }>();
    rowMap.forEach(seats => {
      const sorted = [...seats].sort((a, b) => a.number - b.number);
      if (sorted.length < 2) return;
      const cx = sorted.reduce((a, s) => a + s.x, 0) / sorted.length;
      const spacing = (sorted[sorted.length - 1].x - sorted[0].x) / Math.max(sorted.length - 1, 1);
      const startX = cx - (spacing * (sorted.length - 1)) / 2;
      sorted.forEach((s, i) => updMap.set(s.id, { x: startX + i * spacing, y: s.y }));
    });
    const next = { ...layoutRef.current, seats: layoutRef.current.seats.map(s => {
      const upd = updMap.get(s.id); return upd ? { ...s, ...upd } : s;
    })};
    commit(next, 'Auto balance');
  }, [commit]);
  const distributeSeats = useCallback((axis: 'h' | 'v') => {
    const ids = selRef.current;
    const sel = layoutRef.current.seats.filter(s => ids.has(s.id));
    if (sel.length < 3) return;
    if (axis === 'h') {
      const sorted = [...sel].sort((a, b) => a.x - b.x);
      const x0 = sorted[0].x, x1 = sorted[sorted.length - 1].x;
      const step = (x1 - x0) / (sorted.length - 1);
      const posMap = new Map(sorted.map((s, i) => [s.id, x0 + i * step]));
      const next = { ...layoutRef.current, seats: layoutRef.current.seats.map(s => posMap.has(s.id) ? { ...s, x: posMap.get(s.id)! } : s) };
      commit(next, 'Distribute H');
    } else {
      const sorted = [...sel].sort((a, b) => a.y - b.y);
      const y0 = sorted[0].y, y1 = sorted[sorted.length - 1].y;
      const step = (y1 - y0) / (sorted.length - 1);
      const posMap = new Map(sorted.map((s, i) => [s.id, y0 + i * step]));
      const next = { ...layoutRef.current, seats: layoutRef.current.seats.map(s => posMap.has(s.id) ? { ...s, y: posMap.get(s.id)! } : s) };
      commit(next, 'Distribute V');
    }
  }, [commit]);

  // ── Set exact spacing between selected seats ──────────────────────────────
  const setSpacing = useCallback((spacing: number, axis: 'h' | 'v') => {
    const ids = selRef.current;
    const sel = layoutRef.current.seats.filter(s => ids.has(s.id));
    if (sel.length < 2) return;
    if (axis === 'h') {
      const sorted = [...sel].sort((a, b) => a.x - b.x);
      const x0 = sorted[0].x;
      const posMap = new Map(sorted.map((s, i) => [s.id, x0 + i * spacing]));
      const next = { ...layoutRef.current, seats: layoutRef.current.seats.map(s => posMap.has(s.id) ? { ...s, x: posMap.get(s.id)! } : s) };
      commit(next, 'Set spacing H');
    } else {
      const sorted = [...sel].sort((a, b) => a.y - b.y);
      const y0 = sorted[0].y;
      const posMap = new Map(sorted.map((s, i) => [s.id, y0 + i * spacing]));
      const next = { ...layoutRef.current, seats: layoutRef.current.seats.map(s => posMap.has(s.id) ? { ...s, y: posMap.get(s.id)! } : s) };
      commit(next, 'Set spacing V');
    }
  }, [commit]);

  const cursor = tool === 'pan' || isPanning.current ? 'grab'
    : dragRotate.current ? 'grabbing'
    : dragBbox.current ? (() => {
        const h = dragBbox.current!.handle;
        if (h === 0 || h === 7) return 'nwse-resize';
        if (h === 2 || h === 5) return 'nesw-resize';
        if (h === 1 || h === 6) return 'ns-resize';
        return 'ew-resize';
      })()
    : dragVtx.current ? 'nwse-resize'
    : tool === 'select' ? (() => {
        const [mx, my] = mouseWorld.current;
        const thresh = 12 / camRef.current.zoom;
        // check bbox handles first
        const selShapes = layoutRef.current.shapes.filter(s => selRef.current.has(s.id));
        if (selShapes.length > 0) {
          const allVerts = selShapes.flatMap(s => s.vertices);
          const bx0 = Math.min(...allVerts.map(v => v[0]));
          const by0 = Math.min(...allVerts.map(v => v[1]));
          const bx1 = Math.max(...allVerts.map(v => v[0]));
          const by1 = Math.max(...allVerts.map(v => v[1]));
          const bmx = (bx0+bx1)/2, bmy = (by0+by1)/2;
          const handles: [number,number][] = [[bx0,by0],[bmx,by0],[bx1,by0],[bx0,bmy],[bx1,bmy],[bx0,by1],[bmx,by1],[bx1,by1]];
          const cursors = ['nwse-resize','ns-resize','nesw-resize','ew-resize','ew-resize','nesw-resize','ns-resize','nwse-resize'];
          for (let i = 0; i < handles.length; i++) {
            if (Math.hypot(handles[i][0]-mx, handles[i][1]-my) <= thresh) return cursors[i];
          }
        }
        // check rotate handle
        if (selShapes.length > 0) {
          const allVerts2 = selShapes.flatMap(s => s.vertices);
          const bx02 = Math.min(...allVerts2.map(v => v[0]));
          const by02 = Math.min(...allVerts2.map(v => v[1]));
          const bx12 = Math.max(...allVerts2.map(v => v[0]));
          const bmx2 = (bx02 + bx12) / 2;
          const rotHY2 = by02 - 24 / camRef.current.zoom;
          if (Math.hypot(bmx2 - mx, rotHY2 - my) <= thresh) return 'grab';
        }
        const vthresh = 14 / camRef.current.zoom;
        for (const sh of layoutRef.current.shapes) {
          if (!selRef.current.has(sh.id)) continue;
          for (const v of sh.vertices) {
            if (Math.hypot(v[0] - mx, v[1] - my) <= vthresh) return 'nwse-resize';
          }
        }
        return 'default';
      })()
    : 'crosshair';

  const counts = {
    sections: layout.shapes.filter(s => s.type === 'section').length,
    seats: layout.seats.length,
  };

  return {
    // state
    tool, snapOn, layout, selectedIds, sectionMode, camera, preview,
    history, zoomPct, bgImage, bgOpacity, venueName, cursor, counts,
    selectedShape, selectedSeat, selectedText, selectedRow, orphanDisplayModes, orphanRenderStyles,
    layers, toggleLayer: (id: LayerId, key: 'visible' | 'locked') => {
      setLayers(ls => ls.map(l => l.id === id ? { ...l, [key]: !l[key] } : l));
    },
    // setters
    setSnapOn: (v: boolean) => { snapRef.current = v; setSnapOn(v); },
    setVenueName, setBgImage, setBgOpacity, rowSeatsCount, setRowSeatsCount,
    lastRowSectionId, rowCommitTick, clearLastRowSectionId: () => setLastRowSectionId(null),
    // handlers
    changeTool, onPointerDown, onPointerMove, onPointerUp, onDblClick, onWheel,
    updateShape, updateSeat, setDisplayMode, setRowRenderStyle, applyRowStyle, updateText, updateRow, deleteSelected, fillSection,
    addRow, deleteRow, duplicateRow, splitRow, addCurvedRows, createArcSection, clearRowSeats, restoreRowSeats, selectEntity, clearSelection,
    applyGeneratedLayout, multiUpdate, exitSectionMode,
    splitSection, mergeSections, rotateSelected, distributeSeats, setSpacing, addAisle, setSectionDensity, autoBalance,
    undo, redo, zoomIn, zoomOut, zoomReset, zoomFit,
    loadTemplate: (state: any) => {
      // Check if it's an optimized layout (has version 'v')
      if (state.v) {
        if (state.n) setVenueName(state.n);
        const finalState = unpackLayout(state);
        layoutRef.current = finalState;
        setLayout(finalState);
      } else {
        layoutRef.current = state;
        setLayout(state);
      }
      syncSel(new Set());
    },
    restoreSnapshot: (s: Snapshot) => { const r = JSON.parse(JSON.stringify(s.state)); layoutRef.current = r; setLayout(r); syncSel(new Set()); },
    exportLayout: () => {
      const optimized = packLayout({ ...layout, venueName } as any);
      const b = new Blob([JSON.stringify(optimized, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${venueName.replace(/\s+/g, '_')}_optimized.json`; a.click();
    },
  };
}

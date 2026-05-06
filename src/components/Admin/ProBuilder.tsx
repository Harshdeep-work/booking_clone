'use client';
/**
 * ProBuilder — Industrial Stadium Layout Builder (Solid Edition)
 * Fixed event handling and interaction engine.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Tool, Category, BuilderSection, BuilderSeat, ValidationError, LayoutSnapshot,
  CAT_COLOR, CAT_HEX, CATS, arcPoly, centroid, snapVal, validateLayout,
} from './types';
import { PropertyPanel, ValidationPanel, VersionPanel } from './BuilderPanels';

const SEAT_R = 6;
const GRID = 10;
const FONT = "'Inter', system-ui, sans-serif";

interface Camera { x:number; y:number; zoom:number }

function worldToScreen(wx:number, wy:number, cam:Camera, W:number, H:number):[number,number] { 
  return [(wx - cam.x) * cam.zoom + W/2, (wy - cam.y) * cam.zoom + H/2]; 
}
function screenToWorld(sx:number, sy:number, cam:Camera, W:number, H:number):[number,number] { 
  return [(sx - W/2) / cam.zoom + cam.x, (sy - H/2) / cam.zoom + cam.y]; 
}

// ── Modals ──────────────────────────────────────────────────────────────────
const modalOverlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' };
const modalContent: React.CSSProperties = { background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:24, width:360, boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)' };

function ModalWrap({ title, onClose, onSubmit, submitLabel, children }:{ title:string; onClose:()=>void; onSubmit:()=>void; submitLabel:string; children:React.ReactNode }) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalContent} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:18, fontWeight:800, marginBottom:20, color:'#0f172a', letterSpacing:'-0.5px' }}>{title}</div>
        {children}
        <div style={{ display:'flex', gap:10, marginTop:10 }}>
          <button onClick={onSubmit} style={{ flex:1, padding:'12px 0', background:'#3b82f6', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }}>{submitLabel}</button>
          <button onClick={onClose} style={{ flex:1, padding:'12px 0', background:'#fff', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function ProBuilder() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction State (Refs for performance and stale closure prevention)
  const camRef      = useRef<Camera>({ x:0, y:0, zoom:1 });
  const toolRef     = useRef<Tool>('select');
  const catRef      = useRef<Category>('GENERAL');
  const snapRef     = useRef(true);
  const vModeRef    = useRef(false);

  const sectionsRef = useRef<BuilderSection[]>([]);
  const seatsRef    = useRef<BuilderSeat[]>([]);
  const selIds      = useRef<Set<string>>(new Set());
  const drawPts     = useRef<[number,number][]>([]);
  const rowPts      = useRef<[number,number][]>([]);
  const mouseWorld  = useRef<[number,number]>([0,0]);
  
  const isDragging  = useRef(false);
  const isPanning   = useRef(false);
  const lastMouse   = useRef({ x:0, y:0 });
  const dragOff     = useRef<Map<string,[number,number]>>(new Map());
  const dragVtx     = useRef<{id:string; vi:number} | null>(null);
  const bgImg       = useRef<HTMLImageElement | null>(null);
  const rafRef      = useRef<number | null>(null);

  // UI State
  const [tool, setToolState]      = useState<Tool>('select');
  const [snap, setSnapState]      = useState(true);
  const [cursorPos, setCursorPos] = useState<[number,number]>([0,0]);
  const [counts, setCounts]       = useState({ sections:0, seats:0 });
  const [selSeat, setSelSeat]     = useState<any>(null);
  const [selSection, setSelSection] = useState<any>(null);
  const [multiCount, setMultiCount] = useState(0);
  const [errors, setErrors]       = useState<ValidationError[]>([]);
  const [history, setHistory]     = useState<LayoutSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<LayoutSnapshot[]>([]);
  const [rightTab, setRightTab]   = useState<'props'|'validate'|'history'>('props');
  const [modal, setModal]         = useState<'ring'|'arc'|'rect'|'ellipse'|null>(null);
  const [zoomPct, setZoomPct]     = useState(100);
  const [vMode, setVModeState]    = useState(false);

  const syncSel = useCallback(() => {
    const ids = [...selIds.current];
    setMultiCount(ids.length);
    if (ids.length === 1) {
      setSelSeat(seatsRef.current.find(s => s.id === ids[0]) || null);
      setSelSection(sectionsRef.current.find(s => s.id === ids[0]) || null);
    } else {
      setSelSeat(null);
      setSelSection(null);
    }
  }, []);

  const saveSnapshot = useCallback((name?:string) => {
    const snapObj: LayoutSnapshot = {
      id: `v-${Date.now()}`,
      name: name || `Layout ${history.length + 1}`,
      timestamp: Date.now(),
      sections: JSON.parse(JSON.stringify(sectionsRef.current)),
      seats: JSON.parse(JSON.stringify(seatsRef.current)),
    };
    setHistory(h => [snapObj, ...h].slice(0, 50));
    setRedoStack([]);
    setErrors(validateLayout(sectionsRef.current, seatsRef.current));
  }, [history.length]);

  const snapW = (wx:number, wy:number):[number,number] => {
    const g = snapRef.current ? GRID : 1;
    return [snapVal(wx, g), snapVal(wy, g)];
  };

  // ── Engine ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = canvas.width, H = canvas.height, cam = camRef.current;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, W, H);

    // Subtle Dot Grid
    ctx.save();
    ctx.fillStyle = '#cbd5e1';
    const gridSpacing = GRID * cam.zoom;
    if (gridSpacing > 8) {
      const ox = ((-cam.x * cam.zoom) + W / 2) % gridSpacing;
      const oy = ((-cam.y * cam.zoom) + H / 2) % gridSpacing;
      for (let x = ox; x < W; x += gridSpacing) {
        for (let y = oy; y < H; y += gridSpacing) {
          ctx.beginPath(); ctx.arc(x, y, 0.7, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();

    // Background Reference Image
    if (bgImg.current) {
      const img = bgImg.current;
      const sw = img.width * cam.zoom, sh = img.height * cam.zoom;
      const [sx, sy] = worldToScreen(-img.width / 2, -img.height / 2, cam, W, H);
      ctx.save(); ctx.globalAlpha = 0.3; ctx.drawImage(img, sx, sy, sw, sh); ctx.restore();
    }

    // Sections
    sectionsRef.current.forEach(sec => {
      const active = selIds.current.has(sec.id) && !vModeRef.current;
      const col = CAT_COLOR[sec.category] || '#6366f1';
      const verts = sec.vertices; 
      if (verts.length < 2) return;

      ctx.beginPath();
      const [fx, fy] = worldToScreen(verts[0][0], verts[0][1], cam, W, H);
      ctx.moveTo(fx, fy);
      for (let i = 1; i < verts.length; i++) {
        const [px, py] = worldToScreen(verts[i][0], verts[i][1], cam, W, H);
        ctx.lineTo(px, py);
      }
      ctx.closePath();

      ctx.save();
      ctx.fillStyle = active ? '#3b82f633' : col + '22';
      ctx.fill();
      ctx.strokeStyle = active ? '#2563eb' : col;
      ctx.lineWidth = active ? 2 : 1.5;
      ctx.stroke();
      ctx.restore();

      // Label
      const [lx, ly] = worldToScreen(sec.cx, sec.cy, cam, W, H);
      ctx.fillStyle = '#475569';
      ctx.font = `bold ${Math.max(10, 11 * cam.zoom)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(sec.label, lx, ly);
      
      // Handles
      if (active) {
        verts.forEach(v => {
          const [px, py] = worldToScreen(v[0], v[1], cam, W, H);
          ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#fff'; ctx.fill();
          ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.stroke();
        });
      }
    });

    // Seats
    const SCOL: Record<string, string> = { available: '#10b981', sold: '#94a3b8', locked: '#f59e0b' };
    seatsRef.current.forEach(seat => {
      const active = selIds.current.has(seat.id) && !vModeRef.current;
      const col = SCOL[seat.status] || CAT_COLOR[seat.category] || '#6366f1';
      const [px, py] = worldToScreen(seat.x, seat.y, cam, W, H);
      const r = Math.max(vModeRef.current ? 1.5 : 2.5, (SEAT_R / 2) * cam.zoom);

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#3b82f6' : col;
      ctx.fill();
      if (active) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    });

    // Drawing Previews
    const pts = toolRef.current === 'polygon' ? drawPts.current : (toolRef.current === 'row' ? rowPts.current : []);
    if (pts.length > 0 && !vModeRef.current) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const [fx, fy] = worldToScreen(pts[0][0], pts[0][1], cam, W, H);
      ctx.moveTo(fx, fy);
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = worldToScreen(pts[i][0], pts[i][1], cam, W, H);
        ctx.lineTo(px, py);
      }
      const [mx, my] = worldToScreen(mouseWorld.current[0], mouseWorld.current[1], cam, W, H);
      ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    const loop = () => { draw(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [draw]);

  // ── Resize ──
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(entries => {
      if (!canvasRef.current) return;
      const { width, height } = entries[0].contentRect;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Core Event Interaction Engine ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;

    const getMouse = (e: MouseEvent | PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const [wx, wy] = screenToWorld(sx, sy, camRef.current, canvas.width, canvas.height);
      const [swx, swy] = snapW(wx, wy);
      return { sx, sy, wx, wy, swx, swy };
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (vModeRef.current) return;
      const { swx, swy, wx, wy } = getMouse(e);
      
      if (e.button === 1 || toolRef.current === 'pan') {
        isPanning.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      if (e.button !== 0) return;

      if (toolRef.current === 'polygon') {
        drawPts.current.push([swx, swy]);
        return;
      }
      if (toolRef.current === 'row') {
        rowPts.current.push([swx, swy]);
        return;
      }
      if (toolRef.current === 'seat') {
        seatsRef.current.push({
          id: `s-${Date.now()}`,
          sectionId: '', row: 'A', number: seatsRef.current.length + 1,
          x: swx, y: swy, price: 100, status: 'available', category: catRef.current
        });
        setCounts({ sections: sectionsRef.current.length, seats: seatsRef.current.length });
        saveSnapshot();
        return;
      }

      if (toolRef.current === 'select') {
        // Vertex Hit
        const thresh = 10 / camRef.current.zoom;
        for (const sec of sectionsRef.current) {
          if (!selIds.current.has(sec.id)) continue;
          for (let i = 0; i < sec.vertices.length; i++) {
            if (Math.hypot(sec.vertices[i][0] - wx, sec.vertices[i][1] - wy) <= thresh) {
              dragVtx.current = { id: sec.id, vi: i };
              isDragging.current = true;
              canvas.setPointerCapture(e.pointerId);
              return;
            }
          }
        }

        // Object Hit
        let hitId: string | null = null;
        for (let i = seatsRef.current.length - 1; i >= 0; i--) {
          const s = seatsRef.current[i];
          if (Math.hypot(s.x - wx, s.y - wy) <= (SEAT_R / camRef.current.zoom) * 2) { hitId = s.id; break; }
        }
        if (!hitId) {
          for (let i = sectionsRef.current.length - 1; i >= 0; i--) {
            const sec = sectionsRef.current[i], vs = sec.vertices;
            let ins = false;
            for (let j = 0, k = vs.length - 1; j < vs.length; k = j++) {
              if (((vs[j][1] > wy) !== (vs[k][1] > wy)) && (wx < (vs[k][0] - vs[j][0]) * (wy - vs[j][1]) / (vs[k][1] - vs[j][1]) + vs[j][0])) ins = !ins;
            }
            if (ins) { hitId = sec.id; break; }
          }
        }

        if (hitId) {
          if (!e.shiftKey) selIds.current.clear();
          selIds.current.add(hitId);
          isDragging.current = true;
          dragOff.current.clear();
          seatsRef.current.forEach(s => { if (selIds.current.has(s.id)) dragOff.current.set(s.id, [swx - s.x, swy - s.y]); });
          canvas.setPointerCapture(e.pointerId);
        } else if (!e.shiftKey) {
          selIds.current.clear();
        }
        syncSel();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const { swx, swy } = getMouse(e);
      mouseWorld.current = [swx, swy];
      setCursorPos([Math.round(swx), Math.round(swy)]);

      if (isPanning.current) {
        camRef.current.x -= (e.clientX - lastMouse.current.x) / camRef.current.zoom;
        camRef.current.y -= (e.clientY - lastMouse.current.y) / camRef.current.zoom;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (isDragging.current && dragVtx.current) {
        const sec = sectionsRef.current.find(s => s.id === dragVtx.current!.id);
        if (sec) {
          sec.vertices[dragVtx.current!.vi] = [swx, swy];
          [sec.cx, sec.cy] = centroid(sec.vertices);
        }
        return;
      }

      if (isDragging.current && selIds.current.size > 0) {
        selIds.current.forEach(id => {
          const s = seatsRef.current.find(x => x.id === id);
          if (s) {
            const off = dragOff.current.get(id) || [0, 0];
            s.x = swx - off[0]; s.y = swy - off[1];
          }
        });
        syncSel();
      }
    };

    const handlePointerUp = () => {
      if (isDragging.current) saveSnapshot();
      isDragging.current = false;
      isPanning.current = false;
      dragVtx.current = null;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const cam = camRef.current;
      const oldZ = cam.zoom, newZ = Math.max(0.02, Math.min(50, oldZ * factor));
      cam.x += (sx - canvas.width / 2) * (1 / oldZ - 1 / newZ);
      cam.y += (sy - canvas.height / 2) * (1 / oldZ - 1 / newZ);
      cam.zoom = newZ;
      setZoomPct(Math.round(newZ * 100));
    };

    const handleDblClick = () => {
      if (toolRef.current === 'polygon') {
        const pts = drawPts.current;
        if (pts.length < 3) { drawPts.current = []; return; }
        const [cx, cy] = centroid(pts);
        sectionsRef.current.push({
          id: `sec-${Date.now()}`, label: `Sec ${sectionsRef.current.length + 1}`,
          category: catRef.current, basePrice: 100, vertices: [...pts], cx, cy
        });
        setCounts({ sections: sectionsRef.current.length, seats: seatsRef.current.length });
        drawPts.current = [];
        saveSnapshot();
      }
      if (toolRef.current === 'row') {
        const pts = rowPts.current;
        if (pts.length < 2) { rowPts.current = []; return; }
        const totalDist = pts.reduce((acc, p, i) => i === 0 ? 0 : acc + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]), 0);
        const count = Math.max(2, Math.floor(totalDist / 12));
        for (let i = 0; i < count; i++) {
          const t = i / (count - 1);
          const target = t * totalDist;
          let cur = 0, x = pts[0][0], y = pts[0][1];
          for (let j = 1; j < pts.length; j++) {
            const seg = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
            if (cur + seg >= target) {
              const f = (target - cur) / seg;
              x = pts[j - 1][0] + f * (pts[j][0] - pts[j - 1][0]);
              y = pts[j - 1][1] + f * (pts[j][1] - pts[j - 1][1]);
              break;
            }
            cur += seg;
          }
          seatsRef.current.push({ id: `sr-${Date.now()}-${i}`, sectionId: '', row: 'A', number: i + 1, x, y, price: 100, status: 'available', category: catRef.current });
        }
        setCounts({ sections: sectionsRef.current.length, seats: seatsRef.current.length });
        rowPts.current = [];
        saveSnapshot();
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('dblclick', handleDblClick);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('dblclick', handleDblClick);
    };
  }, [saveSnapshot, syncSel]);

  // ── Keyboard ──
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as any).tagName)) return;
      if (e.key === 'v' || e.key === 'V') { setToolState('select'); toolRef.current = 'select'; }
      if (e.key === 'p' || e.key === 'P') { setToolState('polygon'); toolRef.current = 'polygon'; }
      if (e.key === 'r' || e.key === 'R') { setToolState('row'); toolRef.current = 'row'; }
      if (e.key === 's' || e.key === 'S') { setToolState('seat'); toolRef.current = 'seat'; }
      if (e.key === 'h' || e.key === 'H') { setToolState('pan'); toolRef.current = 'pan'; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        selIds.current.forEach(id => {
          sectionsRef.current = sectionsRef.current.filter(x => x.id !== id);
          seatsRef.current = seatsRef.current.filter(x => x.id !== id);
        });
        selIds.current.clear(); syncSel();
        setCounts({ sections: sectionsRef.current.length, seats: seatsRef.current.length });
        saveSnapshot();
      }
    };
    window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd);
  }, [saveSnapshot, syncSel]);

  const toggleVMode = () => {
    const nv = !vMode;
    setVModeState(nv);
    vModeRef.current = nv;
  };

  const addRing = ({ innerR, outerR, divisions, category, basePrice }: any) => {
    const angleStep = 360 / divisions;
    for (let i = 0; i < divisions; i++) {
      const a1 = i * angleStep, a2 = (i + 1) * angleStep;
      const pts = arcPoly(0, 0, innerR, outerR, a1, a2);
      const [cx, cy] = centroid(pts);
      sectionsRef.current.push({ id: `ring-${Date.now()}-${i}`, label: `Sec ${i+1}`, category, basePrice, vertices: pts, cx, cy });
    }
    setCounts({ sections: sectionsRef.current.length, seats: seatsRef.current.length });
    saveSnapshot(); setModal(null);
  };

  const addArc = ({ innerR, outerR, aStart, aEnd, category, basePrice }: any) => {
    const pts = arcPoly(0, 0, innerR, outerR, aStart, aEnd);
    const [cx, cy] = centroid(pts);
    sectionsRef.current.push({ id: `arc-${Date.now()}`, label: `Sec ${sectionsRef.current.length + 1}`, category, basePrice, vertices: pts, cx, cy });
    setCounts({ sections: sectionsRef.current.length, seats: seatsRef.current.length });
    saveSnapshot(); setModal(null);
  };

  const addRect = ({ w, h, rows, cols, category, basePrice }: any) => {
    const pts: [number, number][] = [[-w/2, -h/2], [w/2, -h/2], [w/2, h/2], [-w/2, h/2]];
    const [cx, cy] = centroid(pts);
    const sid = `rect-${Date.now()}`;
    sectionsRef.current.push({ id: sid, label: `Sec ${sectionsRef.current.length + 1}`, category, basePrice, vertices: pts, cx, cy });
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        seatsRef.current.push({ id: `seat-${sid}-${r}-${c}`, sectionId: sid, row: String.fromCharCode(65 + r), number: c + 1, x: -w/2 + (c+0.5)*(w/cols), y: -h/2 + (r+0.5)*(h/rows), price: basePrice, status: 'available', category });
      }
    }
    setCounts({ sections: sectionsRef.current.length, seats: seatsRef.current.length });
    saveSnapshot(); setModal(null);
  };

  const restoreSnapshot = (snap: LayoutSnapshot) => {
    sectionsRef.current = JSON.parse(JSON.stringify(snap.sections));
    seatsRef.current = JSON.parse(JSON.stringify(snap.seats));
    selIds.current.clear(); syncSel();
    setCounts({ sections: sectionsRef.current.length, seats: seatsRef.current.length });
  };

  const fillSection = (id: string) => {
    const sec = sectionsRef.current.find(s => s.id === id); if (!sec) return;
    const vs = sec.vertices, minX = Math.min(...vs.map(v => v[0])), maxX = Math.max(...vs.map(v => v[0])), minY = Math.min(...vs.map(v => v[1])), maxY = Math.max(...vs.map(v => v[1]));
    const step = 10;
    for (let y = minY + step; y < maxY; y += step) {
      for (let x = minX + step; x < maxX; x += step) {
        let ins = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { if (((vs[i][1] > y) !== (vs[j][1] > y)) && (x < (vs[j][0] - vs[i][0]) * (y - vs[i][1]) / (vs[j][1] - vs[i][1]) + vs[i][0])) ins = !ins; }
        if (ins) seatsRef.current.push({ id: `f-${Date.now()}-${x}-${y}`, sectionId: id, row: 'F', number: seatsRef.current.length + 1, x, y, price: sec.basePrice, status: 'available', category: sec.category });
      }
    }
    setCounts({ sections: sectionsRef.current.length, seats: seatsRef.current.length });
    saveSnapshot();
  };

  return (
    <div style={{ width:'100%', height:'100vh', display:'flex', flexDirection:'column', background:'#fff', overflow:'hidden', fontFamily:FONT }}>
      
      {/* ── Top Bar ── */}
      <div style={{ height:56, borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', zIndex:100, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ background:'#3b82f6', width:30, height:30, borderRadius:8, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:15 }}>P</div>
          <span style={{ fontSize:15, fontWeight:800, color:'#0f172a' }}>PRO BUILDER</span>
          <Link href="/" style={{ fontSize:11, background:'#f8fafc', border:'1px solid #e2e8f0', padding:'6px 12px', borderRadius:6, color:'#64748b', textDecoration:'none', fontWeight:600, marginLeft:8 }}>← Exit to Site</Link>
        </div>
        <div style={{ display:'flex', gap:20, alignItems:'center' }}>
          <div style={{ display:'flex', gap:10, fontSize:11, fontWeight:700, color:'#64748b' }}>
            <span>{counts.sections} Sections</span>
            <span style={{ opacity:0.3 }}>|</span>
            <span>{counts.seats} Seats</span>
          </div>
          <button onClick={toggleVMode} style={{ padding:'8px 16px', background:vMode?'#1e293b':'#fff', color:vMode?'#fff':'#0f172a', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>{vMode ? 'Exit Viewer' : 'View Mode'}</button>
          <button onClick={() => { const b = new Blob([JSON.stringify({ sections: sectionsRef.current, seats: seatsRef.current }, null, 2)], { type: 'json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'stadium_layout.json'; a.click(); }} style={{ padding:'8px 16px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 6px -1px rgba(59, 130, 246, 0.2)' }}>Export Layout</button>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        
        {/* ── Sidebar Tools ── */}
        <div style={{ width:64, borderRight:'1px solid #e2e8f0', display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0', gap:10, background:'#fff', flexShrink:0 }}>
          {[
            { id: 'select', icon: '↖', t: 'Select' },
            { id: 'polygon', icon: '⬢', t: 'Polygon' },
            { id: 'row', icon: '⋯', t: 'Line' },
            { id: 'seat', icon: '●', t: 'Seat' },
            { id: 'pan', icon: '🖐', t: 'Pan' }
          ].map(b => (
            <button key={b.id} onClick={() => { setToolState(b.id as Tool); toolRef.current = b.id as Tool; }} style={{ width:44, height:44, borderRadius:10, border:'none', background: tool === b.id ? '#eff6ff' : 'transparent', color: tool === b.id ? '#3b82f6' : '#64748b', fontSize:20, cursor:'pointer', transition:'all 0.2s', position:'relative' }} title={b.t}>
              {b.icon}
              {tool === b.id && <div style={{ position:'absolute', right:0, top:10, bottom:10, width:3, background:'#3b82f6', borderRadius:'3px 0 0 3px' }} />}
            </button>
          ))}
          <div style={{ width:32, height:1, background:'#f1f5f9', margin:'4px 0' }} />
          <button onClick={() => { snapRef.current = !snap; setSnapState(!snap); }} style={{ width:44, height:44, borderRadius:10, border:'none', background: snap ? '#f0fdf4' : 'transparent', color: snap ? '#16a34a' : '#64748b', fontSize:18, cursor:'pointer' }} title="Snap to Grid">⊞</button>
          <button onClick={() => { const id = [...selIds.current][0]; if (id) fillSection(id); }} style={{ width:44, height:44, borderRadius:10, border:'none', background:'transparent', color:'#f59e0b', fontSize:20, cursor:'pointer' }} title="Fill Selected Section">⊡</button>
          <button onClick={() => { selIds.current.forEach(id => { sectionsRef.current = sectionsRef.current.filter(x => x.id !== id); seatsRef.current = seatsRef.current.filter(x => x.id !== id); }); selIds.current.clear(); syncSel(); setCounts({ sections: sectionsRef.current.length, seats: seatsRef.current.length }); saveSnapshot(); }} style={{ width:44, height:44, borderRadius:10, border:'none', background:'transparent', color:'#ef4444', fontSize:20, cursor:'pointer' }} title="Delete Selected">🗑</button>
        </div>

        {/* ── Main Canvas Area ── */}
        <div ref={containerRef} style={{ flex:1, position:'relative', overflow:'hidden', background:'#f8fafc' }}>
          <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block', cursor: vMode ? 'default' : (tool === 'pan' ? 'grab' : (tool === 'select' ? 'default' : 'crosshair')), touchAction:'none' }} />
          
          <div style={{ position:'absolute', bottom:16, left:16, display:'flex', gap:8 }}>
            <div style={{ background:'rgba(255,255,255,0.95)', border:'1px solid #e2e8f0', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:700, color:'#475569', boxShadow:'0 1px 2px rgba(0,0,0,0.05)' }}>X: {cursorPos[0]} &nbsp; Y: {cursorPos[1]}</div>
            <div style={{ background:'rgba(255,255,255,0.95)', border:'1px solid #e2e8f0', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:700, color:'#475569', boxShadow:'0 1px 2px rgba(0,0,0,0.05)' }}>{zoomPct}%</div>
          </div>
        </div>

        {/* ── Right Properties ── */}
        {!vMode && (
          <div style={{ width:300, borderLeft:'1px solid #e2e8f0', background:'#fff', display:'flex', flexDirection:'column', flexShrink:0 }}>
            <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0' }}>
              {(['props', 'validate', 'history'] as const).map(t => (
                <button key={t} onClick={() => setRightTab(t)} style={{ flex:1, padding:'14px 0', border:'none', background: rightTab === t ? '#f8fafc' : 'transparent', color: rightTab === t ? '#3b82f6' : '#64748b', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:1, cursor:'pointer', borderBottom: rightTab === t ? '2px solid #3b82f6' : 'none' }}>{t}</button>
              ))}
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {rightTab === 'props' && (
                <>
                  <div style={{ padding:20, borderBottom:'1px solid #f1f5f9' }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#64748b', textTransform:'uppercase', marginBottom:12, letterSpacing:1 }}>Rapid Generation</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <button onClick={() => setModal('ring')} style={{ padding:'10px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', fontSize:12, fontWeight:600, color:'#0f172a', cursor:'pointer' }}>◎ Ring</button>
                      <button onClick={() => setModal('arc')} style={{ padding:'10px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', fontSize:12, fontWeight:600, color:'#0f172a', cursor:'pointer' }}>◜ Arc</button>
                      <button onClick={() => setModal('rect')} style={{ padding:'10px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', fontSize:12, fontWeight:600, color:'#0f172a', cursor:'pointer' }}>▭ Block</button>
                      <button onClick={() => setModal('ellipse')} style={{ padding:'10px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', fontSize:12, fontWeight:600, color:'#0f172a', cursor:'pointer' }}>⬭ Ellipse</button>
                    </div>
                  </div>
                  <PropertyPanel 
                    seat={selSeat} section={selSection} multiCount={multiCount} 
                    onSeat={(u:any) => { if (selSeat) { const s = seatsRef.current.find(x => x.id === selSeat.id); if (s) { Object.assign(s, u); setSelSeat({ ...s }); } } }} 
                    onSection={(u:any) => { if (selSection) { const s = sectionsRef.current.find(x => x.id === selSection.id); if (s) { Object.assign(s, u); setSelSection({ ...s }); } } }} 
                    onMultiPrice={(p:number) => { selIds.current.forEach(id => { const s = seatsRef.current.find(x => x.id === id); if (s) s.price = p; }); saveSnapshot(); syncSel(); }} 
                    onMultiCategory={(c:string) => { selIds.current.forEach(id => { const s = seatsRef.current.find(x => x.id === id); if (s) s.category = c as Category; }); saveSnapshot(); syncSel(); }} 
                    onMultiStatus={(src:string) => { selIds.current.forEach(id => { const sx = seatsRef.current.find(x => x.id === id); if (sx) sx.status = src as any; }); saveSnapshot(); syncSel(); }} 
                  />
                </>
              )}
              {rightTab === 'validate' && <ValidationPanel errors={errors} />}
              {rightTab === 'history' && <VersionPanel history={history} onRestore={(s:any) => restoreSnapshot(s)} />}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal === 'ring' && <ModalWrap title="Generate Ring" onClose={() => setModal(null)} onSubmit={() => addRing({ innerR: 120, outerR: 180, divisions: 10, category: 'GENERAL', basePrice: 100 })} submitLabel="Create Circle"> <p style={{ fontSize: 13, color: '#64748b' }}>Generate 10 sections in a full circle.</p> </ModalWrap>}
      {modal === 'arc' && <ModalWrap title="Generate Arc" onClose={() => setModal(null)} onSubmit={() => addArc({ innerR: 120, outerR: 180, aStart: -45, aEnd: 45, category: 'GENERAL', basePrice: 100 })} submitLabel="Create Arc"> <p style={{ fontSize: 13, color: '#64748b' }}>Generate a 90-degree curved section.</p> </ModalWrap>}
      {modal === 'rect' && <ModalWrap title="Generate Block" onClose={() => setModal(null)} onSubmit={() => addRect({ w: 150, h: 100, rows: 10, cols: 15, category: 'GENERAL', basePrice: 100 })} submitLabel="Create Block"> <p style={{ fontSize: 13, color: '#64748b' }}>Generate a 10x15 grid of seats.</p> </ModalWrap>}

      <style jsx global>{`
        body { margin:0; padding:0; height:100vh; overflow:hidden; }
        * { user-select: none; }
      `}</style>
    </div>
  );
}

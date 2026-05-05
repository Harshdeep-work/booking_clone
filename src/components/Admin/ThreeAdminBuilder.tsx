'use client';
/**
 * ThreeAdminBuilder — WebGL-based seat map editor
 * - OrthographicCamera infinite 2D plane
 * - Draw section polygons (click vertices → close)
 * - Place seats (click to add)
 * - Select / move via raycasting
 * - Export JSON
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import type { MockSection, MockSeat, Category } from '@/data/mockLayout';

export type AdminTool = 'select' | 'section' | 'seat' | 'pan';

const CAT_HEX: Record<Category, number> = {
  FIELD: 0xFF6B35, PLATINUM: 0xA855F7, GOLD: 0xF59E0B,
  SILVER: 0x94A3B8, BRONZE: 0xD97706, GENERAL: 0x3B82F6,
};
const GRID_SIZE = 10;

function snap(v: number) { return Math.round(v / GRID_SIZE) * GRID_SIZE; }

interface Props {
  onExport?: (data: { sections: MockSection[]; seats: MockSeat[] }) => void;
}

export default function ThreeAdminBuilder({ onExport }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendRef  = useRef<THREE.WebGLRenderer>();
  const camRef   = useRef<THREE.OrthographicCamera>();
  const sceneRef = useRef<THREE.Scene>();
  const rafRef   = useRef<number>();

  // editor state (refs to avoid stale closures in event handlers)
  const toolRef      = useRef<AdminTool>('select');
  const categoryRef  = useRef<Category>('GENERAL');
  const sections     = useRef<MockSection[]>([]);
  const seats        = useRef<MockSeat[]>([]);
  const sectionMeshes = useRef<Map<string, THREE.Mesh>>(new Map());
  const seatMeshes    = useRef<Map<string, THREE.Mesh>>(new Map());

  // polygon drawing
  const drawPoints   = useRef<[number, number][]>([]);
  const previewLine  = useRef<THREE.Line | null>(null);
  const previewDots  = useRef<THREE.Mesh[]>([]);

  // selection / drag
  const selectedId   = useRef<string | null>(null);
  const isDragging   = useRef(false);
  const dragOffset   = useRef({ x: 0, y: 0 });
  const isPanning    = useRef(false);
  const lastMouse    = useRef({ x: 0, y: 0 });
  const zoomLevel    = useRef(1);

  // React state for UI
  const [tool, setToolState]         = useState<AdminTool>('select');
  const [category, setCategoryState] = useState<Category>('GENERAL');
  const [seatCount, setSeatCount]    = useState(0);
  const [sectionCount, setSectionCount] = useState(0);
  const [selectedInfo, setSelectedInfo] = useState<string | null>(null);

  const setTool = (t: AdminTool) => { toolRef.current = t; setToolState(t); clearDrawing(); };
  const setCategory = (c: Category) => { categoryRef.current = c; setCategoryState(c); };

  // ── helpers ────────────────────────────────────────────────────────────────
  const worldPos = useCallback((clientX: number, clientY: number): [number, number] => {
    const el  = mountRef.current!;
    const cam = camRef.current!;
    const rect = el.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const vec = new THREE.Vector3(ndcX, ndcY, 0).unproject(cam);
    return [snap(vec.x), snap(vec.y)];
  }, []);

  const clearDrawing = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (previewLine.current) { scene.remove(previewLine.current); previewLine.current = null; }
    previewDots.current.forEach(d => scene.remove(d));
    previewDots.current = [];
    drawPoints.current = [];
  }, []);

  const addPreviewDot = useCallback((x: number, y: number) => {
    const geo = new THREE.CircleGeometry(3, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const dot = new THREE.Mesh(geo, mat);
    dot.position.set(x, y, 2);
    sceneRef.current!.add(dot);
    previewDots.current.push(dot);
  }, []);

  const updatePreviewLine = useCallback((pts: [number, number][], mouseXY?: [number, number]) => {
    const scene = sceneRef.current!;
    if (previewLine.current) scene.remove(previewLine.current);
    const all = mouseXY ? [...pts, mouseXY] : pts;
    if (all.length < 2) return;
    const points = all.map(([x, y]) => new THREE.Vector3(x, y, 1.5));
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({ color: 0xFFFFFF, dashSize: 4, gapSize: 2 });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    previewLine.current = line;
    scene.add(line);
  }, []);

  const commitSection = useCallback(() => {
    const pts = drawPoints.current;
    if (pts.length < 3) { clearDrawing(); return; }
    const scene = sceneRef.current!;
    const id = `S-${Date.now()}`;
    const cat = categoryRef.current;
    const color = `#${CAT_HEX[cat].toString(16).padStart(6, '0')}`;
    const sec: MockSection = { id, label: `Section ${sections.current.length + 1}`, category: cat, color, vertices: pts, basePrice: 100 };
    sections.current.push(sec);
    setSectionCount(sections.current.length);

    // Build mesh
    const shape = new THREE.Shape();
    pts.forEach(([x, y], i) => { if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({ color: CAT_HEX[cat], transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { id, type: 'section' };
    scene.add(mesh);
    sectionMeshes.current.set(id, mesh);

    // Outline
    const outPts = [...pts, pts[0]].map(([x, y]) => new THREE.Vector3(x, y, 0.2));
    const outGeo = new THREE.BufferGeometry().setFromPoints(outPts);
    const outMat = new THREE.LineBasicMaterial({ color: CAT_HEX[cat] });
    scene.add(new THREE.Line(outGeo, outMat));

    clearDrawing();
  }, [clearDrawing]);

  const placeSeat = useCallback((x: number, y: number) => {
    const scene = sceneRef.current!;
    const cat = categoryRef.current;
    const id = `seat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const seat: MockSeat = { id, sectionId: '', row: 'A', number: seats.current.length + 1, x, y, price: 100, status: 'available', category: cat };
    seats.current.push(seat);
    setSeatCount(seats.current.length);

    const geo = new THREE.CircleGeometry(3, 10);
    const mat = new THREE.MeshBasicMaterial({ color: CAT_HEX[cat] });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 1);
    mesh.userData = { id, type: 'seat' };
    scene.add(mesh);
    seatMeshes.current.set(id, mesh);
  }, []);

  const deleteSelected = useCallback(() => {
    const id = selectedId.current;
    if (!id) return;
    const scene = sceneRef.current!;
    const sm = sectionMeshes.current.get(id);
    if (sm) { scene.remove(sm); sectionMeshes.current.delete(id); sections.current = sections.current.filter(s => s.id !== id); setSectionCount(sections.current.length); }
    const seat = seatMeshes.current.get(id);
    if (seat) { scene.remove(seat); seatMeshes.current.delete(id); seats.current = seats.current.filter(s => s.id !== id); setSeatCount(seats.current.length); }
    selectedId.current = null;
    setSelectedInfo(null);
  }, []);

  // ── build scene ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current!;
    const W = el.clientWidth, H = el.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x0d1321);
    el.appendChild(renderer.domElement);
    rendRef.current = renderer;

    const aspect = W / H;
    const fH = 300;
    const cam = new THREE.OrthographicCamera(-fH * aspect, fH * aspect, fH, -fH, 0.1, 1000);
    cam.position.set(0, 0, 100);
    cam.lookAt(0, 0, 0);
    camRef.current = cam;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Grid
    const gridHelper = new THREE.GridHelper(2000, 200, 0x1e2a3a, 0x1e2a3a);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -1;
    scene.add(gridHelper);

    // Origin cross
    const crossMat = new THREE.LineBasicMaterial({ color: 0x334155 });
    const hLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1000, 0, 0), new THREE.Vector3(1000, 0, 0)]), crossMat);
    const vLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1000, 0), new THREE.Vector3(0, 1000, 0)]), crossMat);
    scene.add(hLine, vLine);

    const animate = () => { rafRef.current = requestAnimationFrame(animate); renderer.render(scene, cam); };
    animate();

    const onResize = () => {
      const W2 = el.clientWidth, H2 = el.clientHeight;
      renderer.setSize(W2, H2);
      const a = W2 / H2, fH2 = 300 / zoomLevel.current;
      cam.left = -fH2 * a; cam.right = fH2 * a; cam.top = fH2; cam.bottom = -fH2;
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current!);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  // ── events ─────────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const cam = camRef.current!; const el = mountRef.current!;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    zoomLevel.current = Math.max(0.2, Math.min(20, zoomLevel.current * factor));
    const z = zoomLevel.current, a = el.clientWidth / el.clientHeight, fH = 300 / z;
    cam.left = -fH * a; cam.right = fH * a; cam.top = fH; cam.bottom = -fH;
    cam.updateProjectionMatrix();
  }, []);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 1 || toolRef.current === 'pan') { isPanning.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; return; }
    if (e.button !== 0) return;

    const [wx, wy] = worldPos(e.clientX, e.clientY);

    if (toolRef.current === 'section') {
      drawPoints.current.push([wx, wy]);
      addPreviewDot(wx, wy);
      updatePreviewLine(drawPoints.current);
      return;
    }

    if (toolRef.current === 'seat') { placeSeat(wx, wy); return; }

    if (toolRef.current === 'select') {
      // raycast
      const cam = camRef.current!; const el = mountRef.current!;
      const rect = el.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
      const allMeshes = [...seatMeshes.current.values(), ...sectionMeshes.current.values()];
      const hits = ray.intersectObjects(allMeshes);
      if (hits.length > 0) {
        const hit = hits[0].object as THREE.Mesh;
        const id = hit.userData.id as string;
        // deselect old
        if (selectedId.current && selectedId.current !== id) {
          const old = seatMeshes.current.get(selectedId.current) || sectionMeshes.current.get(selectedId.current);
          if (old) (old.material as THREE.MeshBasicMaterial).color.setHex(CAT_HEX[categoryRef.current] ?? 0x3B82F6);
        }
        selectedId.current = id;
        (hit.material as THREE.MeshBasicMaterial).color.setHex(0x10B981);
        const info = hit.userData.type === 'seat'
          ? `Seat: ${id}`
          : `Section: ${sections.current.find(s => s.id === id)?.label ?? id}`;
        setSelectedInfo(info);
        isDragging.current = true;
        dragOffset.current = { x: wx - hit.position.x, y: wy - hit.position.y };
      } else {
        selectedId.current = null; setSelectedInfo(null);
      }
    }
  }, [worldPos, addPreviewDot, updatePreviewLine, placeSeat]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      const cam = camRef.current!; const el = mountRef.current!;
      const dx = e.clientX - lastMouse.current.x, dy = e.clientY - lastMouse.current.y;
      const scale = (cam.right - cam.left) / el.clientWidth;
      cam.position.x -= dx * scale; cam.position.y += dy * scale;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (toolRef.current === 'section' && drawPoints.current.length > 0) {
      const [mx, my] = worldPos(e.clientX, e.clientY);
      updatePreviewLine(drawPoints.current, [mx, my]);
    }
    if (isDragging.current && selectedId.current && toolRef.current === 'select') {
      const [wx, wy] = worldPos(e.clientX, e.clientY);
      const mesh = seatMeshes.current.get(selectedId.current);
      if (mesh) { mesh.position.set(wx - dragOffset.current.x, wy - dragOffset.current.y, 1); }
    }
  }, [worldPos, updatePreviewLine]);

  const onMouseUp = useCallback(() => { isPanning.current = false; isDragging.current = false; }, []);

  const onDblClick = useCallback(() => {
    if (toolRef.current === 'section') commitSection();
  }, [commitSection]);

  useEffect(() => {
    const el = mountRef.current!;
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('dblclick', onDblClick);
    el.addEventListener('contextmenu', e => e.preventDefault());
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('dblclick', onDblClick);
    };
  }, [onWheel, onMouseDown, onMouseMove, onMouseUp, onDblClick]);

  const handleExport = () => {
    const data = { sections: sections.current, seats: seats.current };
    onExport?.(data);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'layout.json'; a.click();
  };

  const CATS: Category[] = ['FIELD', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'GENERAL'];
  const CAT_COLORS_CSS: Record<Category, string> = {
    FIELD: '#FF6B35', PLATINUM: '#A855F7', GOLD: '#F59E0B', SILVER: '#94A3B8', BRONZE: '#D97706', GENERAL: '#3B82F6',
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#0d1321' }}>
      {/* Left toolbar */}
      <div style={{ width: 56, background: '#0A0E1A', borderRight: '1px solid #1e2a3a', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 6, zIndex: 10 }}>
        {([['select', '↖', 'Select / Move'], ['section', '⬡', 'Draw Section (dbl-click to close)'], ['seat', '●', 'Place Seat'], ['pan', '✋', 'Pan']] as [AdminTool, string, string][]).map(([t, icon, title]) => (
          <button key={t} title={title} onClick={() => setTool(t)}
            style={{ width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: tool === t ? 'rgba(99,102,241,0.3)' : 'transparent',
              color: tool === t ? '#818CF8' : '#64748B',
              outline: tool === t ? '1px solid #6366F1' : 'none',
            }}>{icon}</button>
        ))}
        <div style={{ width: 32, height: 1, background: '#1e2a3a', margin: '4px 0' }} />
        <button title="Delete selected (Del)" onClick={deleteSelected}
          style={{ width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 16, background: 'transparent', color: selectedInfo ? '#EF4444' : '#374151' }}>🗑</button>
      </div>

      {/* Canvas */}
      <div ref={mountRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }} />

      {/* Right panel */}
      <div style={{ width: 220, background: '#0A0E1A', borderLeft: '1px solid #1e2a3a', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, zIndex: 10, overflowY: 'auto' }}>
        {/* Category picker */}
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Category</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {CATS.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${category === c ? CAT_COLORS_CSS[c] : '#1e2a3a'}`,
                  background: category === c ? `${CAT_COLORS_CSS[c]}22` : 'transparent',
                  color: category === c ? CAT_COLORS_CSS[c] : '#64748B',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLORS_CSS[c], display: 'inline-block' }} />
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ borderTop: '1px solid #1e2a3a', paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Stats</div>
          {[['Sections', sectionCount, '#A855F7'], ['Seats', seatCount, '#10B981']].map(([l, v, c]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
              <span style={{ color: '#64748B' }}>{l}</span>
              <span style={{ color: c as string, fontWeight: 700 }}>{v as number}</span>
            </div>
          ))}
        </div>

        {/* Selection info */}
        {selectedInfo && (
          <div style={{ borderTop: '1px solid #1e2a3a', paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Selected</div>
            <div style={{ fontSize: 12, color: '#10B981', wordBreak: 'break-all' }}>{selectedInfo}</div>
          </div>
        )}

        {/* Instructions */}
        <div style={{ borderTop: '1px solid #1e2a3a', paddingTop: 12, fontSize: 11, color: '#475569', lineHeight: 1.7 }}>
          <b style={{ color: '#64748B' }}>Tips</b><br />
          ⬡ Click to add vertices<br />
          Double-click to close section<br />
          ● Click to place seat<br />
          Scroll to zoom<br />
          Middle-drag to pan<br />
          ↖ Drag to move seats
        </div>

        {/* Export */}
        <button onClick={handleExport}
          style={{ marginTop: 'auto', padding: '10px 0', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          ⬇ Export JSON
        </button>
      </div>

      {/* Tool hint bar */}
      <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(12px)', border: '1px solid #1e2a3a', borderRadius: 99, padding: '6px 18px', fontSize: 12, color: '#94A3B8', pointerEvents: 'none', zIndex: 20 }}>
        {tool === 'section' && '⬡ Click to add vertices — Double-click to close polygon'}
        {tool === 'seat'    && '● Click anywhere to place a seat'}
        {tool === 'select'  && '↖ Click to select — Drag to move — Del to delete'}
        {tool === 'pan'     && '✋ Click and drag to pan the canvas'}
      </div>
    </div>
  );
}

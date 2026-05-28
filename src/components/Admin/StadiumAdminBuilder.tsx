'use client';
/**
 * Stadium Admin Builder
 * Generates structured stadium geometry using primitives:
 * - Add Ring: creates a full concentric ring divided into N sections
 * - Add Arc Section: single arc slice
 * - Place Seat: click to place
 * - Select + move seats
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { arcPolygon, CAT_HEX, CAT_COLOR } from '@/data/stadiumEngine';
import type { Category, StadiumSection, StadiumSeat } from '@/data/stadiumEngine';

type AdminTool = 'select' | 'draw' | 'vertex' | 'seat' | 'pan';

const CATS: Category[] = ['FIELD','PLATINUM','GOLD','SILVER','BRONZE','GENERAL'];

interface RingConfig { innerR: number; outerR: number; divisions: number; category: Category; basePrice: number; }
interface ArcConfig  { innerR: number; outerR: number; aStart: number; aEnd: number; category: Category; basePrice: number; }

export default function StadiumAdminBuilder() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendRef  = useRef<THREE.WebGLRenderer | undefined>(undefined);
  const camRef   = useRef<THREE.OrthographicCamera | undefined>(undefined);
  const sceneRef = useRef<THREE.Scene | undefined>(undefined);
  const rafRef   = useRef<number | undefined>(undefined);

  const toolRef     = useRef<AdminTool>('select');
  const catRef      = useRef<Category>('GENERAL');
  const sections    = useRef<StadiumSection[]>([]);
  const seats       = useRef<StadiumSeat[]>([]);
  const secMeshes   = useRef<Map<string, THREE.Object3D[]>>(new Map());
  const seatMeshes  = useRef<Map<string, THREE.Mesh>>(new Map());

  const isPanning      = useRef(false);
  const isDragging     = useRef(false);
  const lastMouse      = useRef({ x: 0, y: 0 });
  const zoomLevel      = useRef(1);
  const selectedId     = useRef<string | null>(null);
  const dragOffset     = useRef({ x: 0, y: 0 });
  const snapEnabled    = useRef(true);

  // polygon draw state
  const drawPts        = useRef<[number, number][]>([]);
  const previewLine    = useRef<THREE.Line | null>(null);
  const previewDots    = useRef<THREE.Mesh[]>([]);

  // vertex edit state
  const vertexHandles  = useRef<Map<string, THREE.Mesh[]>>(new Map());
  const dragVertex     = useRef<{ secId: string; vi: number } | null>(null);

  // freeform section polygons (separate from arc sections)
  const polyMeshes     = useRef<Map<string, THREE.Object3D[]>>(new Map());
  const polyData       = useRef<Map<string, [number,number][]>>(new Map());

  const [tool, setToolState]     = useState<AdminTool>('select');
  const [cat, setCatState]       = useState<Category>('GENERAL');
  const [secCount, setSecCount]  = useState(0);
  const [seatCount, setSeatCount]= useState(0);
  const [selInfo, setSelInfo]    = useState<string | null>(null);
  const [showRing, setShowRing]  = useState(false);
  const [showArc, setShowArc]    = useState(false);
  const [snap, setSnap]          = useState(true);
  const [cursorPos, setCursorPos]= useState<[number,number] | null>(null);
  const [drawPtsCount, setDrawPtsCount] = useState(0);
  const [ringCfg, setRingCfg]    = useState<RingConfig>({ innerR: 100, outerR: 150, divisions: 8, category: 'GENERAL', basePrice: 100 });
  const [arcCfg, setArcCfg]      = useState<ArcConfig>({ innerR: 100, outerR: 150, aStart: -30, aEnd: 30, category: 'GENERAL', basePrice: 100 });

  const setTool = (t: AdminTool) => {
    toolRef.current = t; setToolState(t);
    // cancel any in-progress draw
    clearDraw();
    clearVertexHandles();
  };
  const setCat  = (c: Category)  => { catRef.current = c; setCatState(c); };
  const toggleSnap = () => { snapEnabled.current = !snapEnabled.current; setSnap(snapEnabled.current); };

  const worldPos = useCallback((cx: number, cy: number): [number, number] => {
    const el = mountRef.current!, cam = camRef.current!;
    const r = el.getBoundingClientRect();
    const v = new THREE.Vector3(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1, 0).unproject(cam);
    const s = snapEnabled.current ? 5 : 1;
    return [Math.round(v.x / s) * s, Math.round(v.y / s) * s];
  }, []);

  // ── Draw helpers ────────────────────────────────────────────────────────────
  const clearDraw = useCallback(() => {
    const scene = sceneRef.current; if (!scene) return;
    if (previewLine.current) { scene.remove(previewLine.current); previewLine.current = null; }
    previewDots.current.forEach(d => scene.remove(d));
    previewDots.current = [];
    drawPts.current = [];
    setDrawPtsCount(0);
  }, []);

  const updatePreview = useCallback((pts: [number,number][], mouse?: [number,number]) => {
    const scene = sceneRef.current!;
    if (previewLine.current) { scene.remove(previewLine.current); previewLine.current = null; }
    const all = mouse ? [...pts, mouse] : pts;
    if (all.length < 2) return;
    const verts = all.map(([x,y]) => new THREE.Vector3(x, y, 1));
    const geo = new THREE.BufferGeometry().setFromPoints(verts);
    const mat = new THREE.LineDashedMaterial({ color: 0x4f6ef7, dashSize: 5, gapSize: 3 });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    previewLine.current = line;
    scene.add(line);
  }, []);

  const commitDraw = useCallback(() => {
    const pts = drawPts.current;
    if (pts.length < 3) { clearDraw(); return; }
    const scene = sceneRef.current!;
    const id = `poly-${Date.now()}`;
    const cat = catRef.current;
    const shape = new THREE.Shape();
    pts.forEach(([x,y], i) => i === 0 ? shape.moveTo(x,y) : shape.lineTo(x,y));
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({ color: CAT_HEX[cat], transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { id, type: 'poly' };
    scene.add(mesh);
    const outPts = [...pts, pts[0]].map(([x,y]) => new THREE.Vector3(x,y,0.5));
    const outLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outPts), new THREE.LineBasicMaterial({ color: CAT_HEX[cat] }));
    scene.add(outLine);
    polyMeshes.current.set(id, [mesh, outLine]);
    polyData.current.set(id, [...pts]);
    setSecCount(s => s + 1);
    clearDraw();
  }, [clearDraw]);

  // ── Vertex handle helpers ───────────────────────────────────────────────────
  const clearVertexHandles = useCallback(() => {
    const scene = sceneRef.current; if (!scene) return;
    vertexHandles.current.forEach(handles => handles.forEach(h => scene.remove(h)));
    vertexHandles.current.clear();
    dragVertex.current = null;
  }, []);

  const showVertexHandles = useCallback((id: string) => {
    const scene = sceneRef.current!;
    clearVertexHandles();
    const pts = polyData.current.get(id); if (!pts) return;
    const handles: THREE.Mesh[] = [];
    pts.forEach(([x,y], vi) => {
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(5, 12),
        new THREE.MeshBasicMaterial({ color: 0x4f6ef7 })
      );
      dot.position.set(x, y, 3);
      dot.userData = { type: 'vertex', secId: id, vi };
      scene.add(dot);
      handles.push(dot);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(5, 7, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      );
      ring.position.set(x, y, 2.5);
      scene.add(ring);
      handles.push(ring);
    });
    vertexHandles.current.set(id, handles);
  }, [clearVertexHandles]);

  const rebuildPolyMesh = useCallback((id: string) => {
    const scene = sceneRef.current!;
    const pts = polyData.current.get(id); if (!pts) return;
    const old = polyMeshes.current.get(id);
    if (old) old.forEach(o => scene.remove(o));
    const cat = catRef.current;
    const shape = new THREE.Shape();
    pts.forEach(([x,y], i) => i === 0 ? shape.moveTo(x,y) : shape.lineTo(x,y));
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: CAT_HEX[cat], transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    mesh.userData = { id, type: 'poly' };
    scene.add(mesh);
    const outPts = [...pts, pts[0]].map(([x,y]) => new THREE.Vector3(x,y,0.5));
    const outLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outPts), new THREE.LineBasicMaterial({ color: CAT_HEX[cat] }));
    scene.add(outLine);
    polyMeshes.current.set(id, [mesh, outLine]);
  }, []);

  const addSectionMesh = useCallback((sec: StadiumSection) => {
    const scene = sceneRef.current!;
    const pts = arcPolygon(0, 0, sec.innerRadius, sec.outerRadius, sec.angleStart, sec.angleEnd, 48);
    const shape = new THREE.Shape();
    pts.forEach(([x, y], i) => i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({ color: CAT_HEX[sec.category], transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { id: sec.id, type: 'section' };
    scene.add(mesh);

    const outPts = [...pts, pts[0]].map(([x, y]) => new THREE.Vector3(x, y, 0.5));
    const outGeo = new THREE.BufferGeometry().setFromPoints(outPts);
    const line = new THREE.Line(outGeo, new THREE.LineBasicMaterial({ color: CAT_HEX[sec.category] }));
    scene.add(line);

    // Label
    const c = document.createElement('canvas'); c.width = 120; c.height = 40;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(8,12,24,0.8)'; ctx.roundRect(2,2,116,36,8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(sec.shortLabel, 60, 26);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    sp.scale.set(18, 6, 1);
    sp.position.set(sec.centerX, sec.centerY, 2);
    scene.add(sp);

    secMeshes.current.set(sec.id, [mesh, line, sp]);
    sections.current.push(sec);
    setSecCount(sections.current.length);
  }, []);

  // ── Add Ring ────────────────────────────────────────────────────────────────
  const addRing = useCallback(() => {
    const { innerR, outerR, divisions, category, basePrice } = ringCfg;
    const step = 360 / divisions;
    const midR = (innerR + outerR) / 2;
    for (let i = 0; i < divisions; i++) {
      const aStart = -180 + i * step;
      const aEnd   = aStart + step;
      const a = ((aStart + aEnd) / 2) * Math.PI / 180;
      const id = `sec-${category[0]}${Date.now()}-${i}`;
      const sec: StadiumSection = {
        id, label: `${category} ${i + 1}`, shortLabel: `${i + 1}`,
        category, color: CAT_COLOR[category],
        innerRadius: innerR, outerRadius: outerR,
        angleStart: aStart, angleEnd: aEnd,
        centerX: Math.cos(a) * midR, centerY: Math.sin(a) * midR,
        basePrice, minPrice: Math.round(basePrice * 0.85),
        available: 0, total: 0,
      };
      addSectionMesh(sec);
    }
    setShowRing(false);
  }, [ringCfg, addSectionMesh]);

  // ── Add Arc ─────────────────────────────────────────────────────────────────
  const addArc = useCallback(() => {
    const { innerR, outerR, aStart, aEnd, category, basePrice } = arcCfg;
    const midR = (innerR + outerR) / 2;
    const a = ((aStart + aEnd) / 2) * Math.PI / 180;
    const id = `sec-arc-${Date.now()}`;
    const sec: StadiumSection = {
      id, label: `${category} Arc`, shortLabel: 'ARC',
      category, color: CAT_COLOR[category],
      innerRadius: innerR, outerRadius: outerR,
      angleStart: aStart, angleEnd: aEnd,
      centerX: Math.cos(a) * midR, centerY: Math.sin(a) * midR,
      basePrice, minPrice: Math.round(basePrice * 0.85),
      available: 0, total: 0,
    };
    addSectionMesh(sec);
    setShowArc(false);
  }, [arcCfg, addSectionMesh]);

  const placeSeat = useCallback((x: number, y: number) => {
    const id = `seat-${Date.now()}`;
    const seat: StadiumSeat = { id, sectionId: '', row: 'A', number: seats.current.length + 1, x, y, price: 100, status: 'available', category: catRef.current };
    seats.current.push(seat);
    setSeatCount(seats.current.length);
    const geo = new THREE.CircleGeometry(2.5, 8);
    const mat = new THREE.MeshBasicMaterial({ color: CAT_HEX[catRef.current] });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 1);
    mesh.userData = { id, type: 'seat' };
    sceneRef.current!.add(mesh);
    seatMeshes.current.set(id, mesh);
  }, []);

  const deleteSelected = useCallback(() => {
    const id = selectedId.current; if (!id) return;
    const scene = sceneRef.current!;
    const objs = secMeshes.current.get(id);
    if (objs) { objs.forEach(o => scene.remove(o)); secMeshes.current.delete(id); sections.current = sections.current.filter(s => s.id !== id); setSecCount(sections.current.length); }
    const polyObjs = polyMeshes.current.get(id);
    if (polyObjs) { polyObjs.forEach(o => scene.remove(o)); polyMeshes.current.delete(id); polyData.current.delete(id); setSecCount(s => s - 1); }
    const sm = seatMeshes.current.get(id);
    if (sm) { scene.remove(sm); seatMeshes.current.delete(id); seats.current = seats.current.filter(s => s.id !== id); setSeatCount(seats.current.length); }
    clearVertexHandles();
    selectedId.current = null; setSelInfo(null);
  }, [clearVertexHandles]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ sections: sections.current, seats: seats.current }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'stadium-layout.json'; a.click();
  };

  // ── Scene setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current!;

    // Wait for the element to have real dimensions
    let initialized = false;
    const init = () => {
      if (initialized) return;
      const W = el.clientWidth, H = el.clientHeight;
      if (W === 0 || H === 0) return;
      initialized = true;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0xf0f2f5);
    el.appendChild(renderer.domElement);
    rendRef.current = renderer;

    const fH = 350;
    const cam = new THREE.OrthographicCamera(-fH * W / H, fH * W / H, fH, -fH, 0.1, 1000);
    cam.position.set(0, 0, 100);
    camRef.current = cam;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const grid = new THREE.GridHelper(2000, 100, 0xe5e7eb, 0xf3f4f6);
    grid.rotation.x = Math.PI / 2; grid.position.z = -1;
    scene.add(grid);

    // Concentric guide circles
    [60, 100, 150, 200, 250, 300].forEach(r => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -0.5));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xd1d5db })));
    });

    const animate = () => { rafRef.current = requestAnimationFrame(animate); renderer.render(scene, cam); };
    animate();

    const onResize = () => {
      const W2 = el.clientWidth, H2 = el.clientHeight;
      renderer.setSize(W2, H2);
      const fH2 = 350 / zoomLevel.current;
      cam.left = -fH2 * W2 / H2; cam.right = fH2 * W2 / H2; cam.top = fH2; cam.bottom = -fH2;
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    ro.disconnect();
    return () => { cancelAnimationFrame(rafRef.current!); window.removeEventListener('resize', onResize); renderer.dispose(); if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement); };
    };

    const ro = new ResizeObserver(init);
    ro.observe(el);
    init(); // try immediately in case dimensions are already available
    return () => ro.disconnect();
  }, []);

  // ── Events ──────────────────────────────────────────────────────────────────
  const updateCam = useCallback(() => {
    const cam = camRef.current!, el = mountRef.current!;
    const fH = 350 / zoomLevel.current;
    cam.left = -fH * el.clientWidth / el.clientHeight; cam.right = fH * el.clientWidth / el.clientHeight;
    cam.top = fH; cam.bottom = -fH; cam.updateProjectionMatrix();
  }, []);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    zoomLevel.current = Math.max(0.2, Math.min(20, zoomLevel.current * (e.deltaY < 0 ? 1.12 : 0.89)));
    updateCam();
  }, [updateCam]);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 1 || toolRef.current === 'pan') { isPanning.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; return; }
    if (e.button !== 0) return;
    const [wx, wy] = worldPos(e.clientX, e.clientY);

    if (toolRef.current === 'draw') {
      if (e.detail === 2) { commitDraw(); return; }
      drawPts.current.push([wx, wy]);
      setDrawPtsCount(drawPts.current.length);
      // add dot
      const dot = new THREE.Mesh(new THREE.CircleGeometry(3, 10), new THREE.MeshBasicMaterial({ color: 0x4f6ef7 }));
      dot.position.set(wx, wy, 2);
      sceneRef.current!.add(dot);
      previewDots.current.push(dot);
      updatePreview(drawPts.current);
      return;
    }

    if (toolRef.current === 'seat') { placeSeat(wx, wy); return; }

    if (toolRef.current === 'vertex') {
      // check if clicking a vertex handle
      const cam = camRef.current!, el = mountRef.current!;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, cam);
      const allHandles = [...vertexHandles.current.values()].flat().filter(h => h.userData.type === 'vertex');
      const hits = ray.intersectObjects(allHandles);
      if (hits.length > 0) {
        const h = hits[0].object as THREE.Mesh;
        dragVertex.current = { secId: h.userData.secId, vi: h.userData.vi };
        isDragging.current = true;
      } else {
        // try to select a poly to show its handles
        const polyMeshList = [...polyMeshes.current.values()].map(a => a[0] as THREE.Mesh);
        const polyHits = ray.intersectObjects(polyMeshList);
        if (polyHits.length > 0) {
          const id = (polyHits[0].object as THREE.Mesh).userData.id;
          selectedId.current = id;
          setSelInfo(`Polygon ${id}`);
          showVertexHandles(id);
        }
      }
      return;
    }

    if (toolRef.current === 'select') {
      const cam = camRef.current!, el = mountRef.current!;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, cam);
      const allMeshes = [
        ...seatMeshes.current.values(),
        ...[...secMeshes.current.values()].map(a => a[0] as THREE.Mesh),
        ...[...polyMeshes.current.values()].map(a => a[0] as THREE.Mesh),
      ];
      const hits = ray.intersectObjects(allMeshes);
      if (hits.length > 0) {
        const hit = hits[0].object as THREE.Mesh;
        selectedId.current = hit.userData.id;
        setSelInfo(hit.userData.type === 'seat' ? `Seat ${hit.userData.id}` : `Section ${hit.userData.id}`);
        isDragging.current = true;
        dragOffset.current = { x: wx - hit.position.x, y: wy - hit.position.y };
        (hit.material as THREE.MeshBasicMaterial).color.setHex(0x10B981);
      } else { selectedId.current = null; setSelInfo(null); clearVertexHandles(); }
    }
  }, [worldPos, placeSeat, commitDraw, updatePreview, clearVertexHandles]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const [wx, wy] = worldPos(e.clientX, e.clientY);
    setCursorPos([Math.round(wx), Math.round(wy)]);

    if (isPanning.current) {
      const cam = camRef.current!, el = mountRef.current!;
      const scale = (cam.right - cam.left) / el.clientWidth;
      cam.position.x -= (e.clientX - lastMouse.current.x) * scale;
      cam.position.y += (e.clientY - lastMouse.current.y) * scale;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (toolRef.current === 'draw' && drawPts.current.length > 0) {
      updatePreview(drawPts.current, [wx, wy]);
      return;
    }

    if (toolRef.current === 'vertex' && isDragging.current && dragVertex.current) {
      const { secId, vi } = dragVertex.current;
      const pts = polyData.current.get(secId); if (!pts) return;
      pts[vi] = [wx, wy];
      // move handle meshes
      const handles = vertexHandles.current.get(secId);
      if (handles) {
        const dot = handles[vi * 2];
        const ring = handles[vi * 2 + 1];
        if (dot) dot.position.set(wx, wy, 3);
        if (ring) ring.position.set(wx, wy, 2.5);
      }
      rebuildPolyMesh(secId);
      return;
    }

    if (isDragging.current && selectedId.current && toolRef.current === 'select') {
      const mesh = seatMeshes.current.get(selectedId.current);
      if (mesh) mesh.position.set(wx - dragOffset.current.x, wy - dragOffset.current.y, 1);
    }
  }, [worldPos, updatePreview, rebuildPolyMesh]);

  const onMouseUp = useCallback(() => { isPanning.current = false; isDragging.current = false; dragVertex.current = null; }, []);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 'd' || e.key === 'D') setTool('draw');
      if (e.key === 'e' || e.key === 'E') setTool('vertex');
      if (e.key === 's' || e.key === 'S') setTool('seat');
      if (e.key === 'p' || e.key === 'P') setTool('pan');
      if (e.key === 'Escape') { clearDraw(); clearVertexHandles(); }
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearDraw, clearVertexHandles, deleteSelected]);

  useEffect(() => {
    const el = mountRef.current!;
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('contextmenu', e => e.preventDefault());
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseup', onMouseUp);
    };
  }, [onWheel, onMouseDown, onMouseMove, onMouseUp]);

  const inputStyle: React.CSSProperties = {
    background: '#ffffff', border: '1px solid #e5e7eb',
    borderRadius: 6, color: '#111827', padding: '6px 10px', fontSize: 12, width: '100%',
    outline: 'none', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: '#9ca3af', marginBottom: 4, display: 'block',
    textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 600,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 10, color: '#9ca3af', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#f0f2f5', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif' }}>

      {/* Left toolbar */}
      <div style={{ width: 48, background: '#ffffff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 2 }}>
        {([
          ['select', '↖', 'Select / Move  [V]'],
          ['draw',   '⬡', 'Draw Polygon  [D]'],
          ['vertex', '◈', 'Edit Vertices  [E]'],
          ['seat',   '+', 'Place Seat  [S]'],
          ['pan',    '✋', 'Pan Canvas  [P]'],
        ] as [AdminTool, string, string][]).map(([t, icon, title]) => (
          <button key={t} title={title} onClick={() => setTool(t)} style={{
            width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: t === 'select' ? 16 : 13, fontWeight: 700,
            background: tool === t ? '#eff2ff' : 'transparent',
            color: tool === t ? '#4f6ef7' : '#9ca3af',
            outline: tool === t ? '1px solid #c7d2fe' : 'none',
          }}>{icon}</button>
        ))}
        <div style={{ width: 24, height: 1, background: '#f3f4f6', margin: '6px 0' }} />
        {/* Snap toggle */}
        <button title={`Snap to grid: ${snap ? 'ON' : 'OFF'}`} onClick={toggleSnap} style={{
          width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: snap ? '#f0fdf4' : 'transparent',
          color: snap ? '#16a34a' : '#9ca3af',
          fontSize: 14, fontWeight: 700,
          outline: snap ? '1px solid #bbf7d0' : 'none',
        }}>⊞</button>
        <div style={{ width: 24, height: 1, background: '#f3f4f6', margin: '6px 0' }} />
        <button title="Delete selected  [Del]" onClick={deleteSelected} style={{
          width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'transparent', color: selInfo ? '#ef4444' : '#e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M3 4l.7 7.1A1 1 0 004.7 12h4.6a1 1 0 001-.9L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Canvas */}
      <div ref={mountRef} style={{ flex: 1, position: 'relative', cursor: tool === 'pan' ? 'grab' : (tool === 'seat' || tool === 'draw') ? 'crosshair' : tool === 'vertex' ? 'cell' : 'default' }}>
        {/* CAD coordinate readout */}
        {cursorPos && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb',
            borderRadius: 6, padding: '3px 10px', fontSize: 11,
            color: '#374151', fontFamily: 'monospace', pointerEvents: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            x: {cursorPos[0].toString().padStart(5, '\u00a0')}  y: {cursorPos[1].toString().padStart(5, '\u00a0')}
            {snap && <span style={{ marginLeft: 8, color: '#16a34a', fontSize: 10 }}>SNAP</span>}
          </div>
        )}
        {/* Hint bar */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)',
          border: '1px solid #e5e7eb', borderRadius: 100,
          padding: '6px 18px', fontSize: 11, color: '#6b7280',
          pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {tool === 'select' && 'Click to select  ·  Drag to move  ·  Del to delete'}
          {tool === 'draw'   && `${drawPtsCount} pts  ·  Click to add vertex  ·  Double-click to close  ·  Esc to cancel`}
          {tool === 'vertex' && 'Click a polygon to edit  ·  Drag handles to reshape'}
          {tool === 'seat'   && 'Click anywhere to place a seat'}
          {tool === 'pan'    && 'Click and drag to pan  ·  Scroll to zoom'}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ width: 240, background: '#ffffff', borderLeft: '1px solid #e5e7eb', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', boxShadow: '-2px 0 8px rgba(0,0,0,0.04)' }}>

        <div>
          <div style={sectionTitle}>Add Geometry</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => { setShowRing(!showRing); setShowArc(false); }} style={{
              padding: '9px 12px', borderRadius: 8,
              border: `1px solid ${showRing ? '#c7d2fe' : '#e5e7eb'}`,
              background: showRing ? '#eff2ff' : '#f9fafb',
              color: showRing ? '#4f6ef7' : '#374151',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/><circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4"/></svg>
              Add Ring
            </button>
            {showRing && (
              <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([['Inner Radius', 'innerR'], ['Outer Radius', 'outerR'], ['Divisions', 'divisions'], ['Base Price ($)', 'basePrice']] as [string, keyof RingConfig][]).map(([lbl, key]) => (
                  <div key={key}>
                    <label style={labelStyle}>{lbl}</label>
                    <input type="number" style={inputStyle} value={(ringCfg as any)[key]}
                      onChange={e => setRingCfg(p => ({ ...p, [key]: +e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label style={labelStyle}>Category</label>
                  <select style={inputStyle} value={ringCfg.category} onChange={e => setRingCfg(p => ({ ...p, category: e.target.value as Category }))}>
                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={addRing} style={{ padding: '8px 0', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#4f6ef7,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Generate Ring
                </button>
              </div>
            )}

            <button onClick={() => { setShowArc(!showArc); setShowRing(false); }} style={{
              padding: '9px 12px', borderRadius: 8,
              border: `1px solid ${showArc ? '#c7d2fe' : '#e5e7eb'}`,
              background: showArc ? '#eff2ff' : '#f9fafb',
              color: showArc ? '#4f6ef7' : '#374151',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12C2 7 5 2 12 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M2 12C2 9 4 6 8 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              Add Arc Section
            </button>
            {showArc && (
              <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([['Inner Radius', 'innerR'], ['Outer Radius', 'outerR'], ['Start Angle (deg)', 'aStart'], ['End Angle (deg)', 'aEnd'], ['Base Price ($)', 'basePrice']] as [string, keyof ArcConfig][]).map(([lbl, key]) => (
                  <div key={key}>
                    <label style={labelStyle}>{lbl}</label>
                    <input type="number" style={inputStyle} value={(arcCfg as any)[key]}
                      onChange={e => setArcCfg(p => ({ ...p, [key]: +e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label style={labelStyle}>Category</label>
                  <select style={inputStyle} value={arcCfg.category} onChange={e => setArcCfg(p => ({ ...p, category: e.target.value as Category }))}>
                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={addArc} style={{ padding: '8px 0', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#4f6ef7,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Add Arc
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
          <div style={sectionTitle}>Seat Category</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {CATS.map(c => (
              <button key={c} onClick={() => setCat(c)} style={{
                padding: '6px 10px', borderRadius: 7,
                border: `1px solid ${cat === c ? CAT_COLOR[c] + '60' : '#f3f4f6'}`,
                background: cat === c ? CAT_COLOR[c] + '12' : 'transparent',
                color: cat === c ? CAT_COLOR[c] : '#6b7280',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLOR[c], display: 'inline-block', flexShrink: 0 }} />
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
          <div style={sectionTitle}>Layout Stats</div>
          {[['Sections', secCount, '#7c3aed'], ['Seats', seatCount, '#16a34a']].map(([l, v, c]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: '#9ca3af' }}>{l}</span>
              <span style={{ color: c as string, fontWeight: 700 }}>{v as number}</span>
            </div>
          ))}
        </div>

        {selInfo && (
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, fontSize: 11, color: '#16a34a' }}>
            Selected: {selInfo}
          </div>
        )}

        <button onClick={handleExport} style={{
          marginTop: 'auto', padding: '10px 0', borderRadius: 8, border: 'none',
          background: 'linear-gradient(135deg,#4f6ef7,#7c3aed)',
          color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
        }}>
          Export JSON
        </button>
      </div>
    </div>
  );
}

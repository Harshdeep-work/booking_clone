'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { SECTIONS, ALL_SEATS, arcPolygon, CAT_HEX } from '@/data/stadiumEngine';
import { useViewerStore } from '@/store/viewerStore';
import type { StadiumSeat, StadiumSection } from '@/data/stadiumEngine';
import { unpackLayout } from '../../utils/stadiumOptimizer';
import { loadPreviewLayout } from '../../utils/previewStorage';

const C_HOVER    = new THREE.Color(0xffffff);
const C_SELECTED = new THREE.Color(0x10B981);
const C_SOLD     = new THREE.Color(0x1e293b);
const C_LOCKED   = new THREE.Color(0x374151);

function seatColor(seat: StadiumSeat, hovered: boolean, selected: boolean): THREE.Color {
  if (selected) return C_SELECTED;
  if (hovered)  return C_HOVER;
  if (seat.status === 'sold')   return C_SOLD;
  if (seat.status === 'locked') return C_LOCKED;
  return new THREE.Color(CAT_HEX[seat.category]);
}

function makeLabelSprite(sec: StadiumSection): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 56;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 160, 56);
  ctx.fillStyle = 'rgba(8,12,24,0.88)';
  ctx.roundRect(2, 2, 156, 52, 10);
  ctx.fill();
  ctx.strokeStyle = sec.color + '99';
  ctx.lineWidth = 1.5;
  ctx.roundRect(2, 2, 156, 52, 10);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Inter,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(sec.shortLabel, 80, 24);
  ctx.fillStyle = sec.color;
  ctx.font = '13px Inter,sans-serif';
  ctx.fillText(`from $${sec.minPrice}`, 80, 44);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(22, 8, 1);
  return sp;
}

export default function StadiumViewer({ className }: { className?: string }) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const rendRef   = useRef<THREE.WebGLRenderer | undefined>(undefined);
  const camRef    = useRef<THREE.OrthographicCamera | undefined>(undefined);
  const sceneRef  = useRef<THREE.Scene | undefined>(undefined);
  const rafRef    = useRef<number | undefined>(undefined);
  const instRef   = useRef<THREE.InstancedMesh | undefined>(undefined);
  const seatData  = useRef<StadiumSeat[]>([]);
  const lblGrp    = useRef<THREE.Group | undefined>(undefined);
  const secMeshes = useRef<Map<string, THREE.Mesh>>(new Map());

  const isDragging = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });
  const zoomLevel  = useRef(1);

  // ── Seat hover tooltip ─────────────────────────────────────────────────────
  const [seatTooltip, setSeatTooltip] = useState<{
    screenX: number; screenY: number;
    seat: StadiumSeat;
  } | null>(null);

  // ── Load custom venue from localStorage ───────────────────────────────────
  const customSeatsRef = useRef<StadiumSeat[] | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const compact = await loadPreviewLayout();
        if (!compact || !active) return;
        const layout = unpackLayout(compact);
        const customSeats: StadiumSeat[] = layout.seats.map(s => ({
          id: s.id,
          sectionId: s.sectionId,
          row: s.label.replace(/\d+$/, ''),
          number: s.number,
          x: s.x,
          y: s.y,
          status: (s.status === 'available' ? 'available' : s.status === 'sold' ? 'sold' : 'locked') as StadiumSeat['status'],
          price: s.price,
          category: s.category as StadiumSeat['category'],
        }));
        if (customSeats.length > 0) customSeatsRef.current = customSeats;
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []);
  const hoveredIdx = useRef(-1);
  const selSet     = useRef<Set<string>>(new Set());

  const { setHovered, toggleSelect, selectedSeatIds, setZoom, setHoveredSection } = useViewerStore();

  useEffect(() => { selSet.current = selectedSeatIds; }, [selectedSeatIds]);

  const refreshColor = useCallback((idx: number) => {
    const mesh = instRef.current; if (!mesh) return;
    const seat = seatData.current[idx];
    mesh.setColorAt(idx, seatColor(seat, idx === hoveredIdx.current, selSet.current.has(seat.id)));
    mesh.instanceColor!.needsUpdate = true;
  }, []);

  useEffect(() => {
    const el = mountRef.current!;
    const W = el.clientWidth, H = el.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0xf0f2f5);
    el.appendChild(renderer.domElement);
    rendRef.current = renderer;

    const fH = 320;
    const cam = new THREE.OrthographicCamera(-fH * W / H, fH * W / H, fH, -fH, 0.1, 2000);
    cam.position.set(0, 0, 500);
    cam.lookAt(0, 0, 0);
    camRef.current = cam;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // ── Section meshes ──────────────────────────────────────────────────────
    SECTIONS.forEach(sec => {
      const pts = arcPolygon(0, 0, sec.innerRadius, sec.outerRadius, sec.angleStart, sec.angleEnd, 48);
      const shape = new THREE.Shape();
      pts.forEach(([x, y], i) => i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
      shape.closePath();

      const geo = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(sec.color),
        transparent: true, opacity: 0.22,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { sectionId: sec.id };
      mesh.position.z = 0;
      scene.add(mesh);
      secMeshes.current.set(sec.id, mesh);

      // Outline
      const outPts = [...pts, pts[0]].map(([x, y]) => new THREE.Vector3(x, y, 0.5));
      const outGeo = new THREE.BufferGeometry().setFromPoints(outPts);
      const outMat = new THREE.LineBasicMaterial({ color: new THREE.Color(sec.color), transparent: true, opacity: 0.5 });
      scene.add(new THREE.Line(outGeo, outMat));
    });

    // ── Labels ──────────────────────────────────────────────────────────────
    const lg = new THREE.Group();
    lblGrp.current = lg;
    scene.add(lg);
    SECTIONS.forEach(sec => {
      const sp = makeLabelSprite(sec);
      sp.position.set(sec.centerX, sec.centerY, 2);
      lg.add(sp);
    });

    // ── InstancedMesh seats ─────────────────────────────────────────────────
    const seats = customSeatsRef.current ?? ALL_SEATS;
    seatData.current = seats;
    const geo = new THREE.CircleGeometry(1.8, 6);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const inst = new THREE.InstancedMesh(geo, mat, seats.length);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instRef.current = inst;
    const dummy = new THREE.Object3D();
    seats.forEach((s, i) => {
      dummy.position.set(s.x, s.y, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, seatColor(s, false, false));
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.instanceColor!.needsUpdate = true;
    inst.visible = false;
    scene.add(inst);

    // ── Render loop ─────────────────────────────────────────────────────────
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const z = zoomLevel.current;
      if (inst) inst.visible = z >= 3;
      if (lg)   lg.visible   = z >= 1.2 && z < 3;
      renderer.render(scene, cam);
    };
    animate();

    const onResize = () => {
      const W2 = el.clientWidth, H2 = el.clientHeight;
      renderer.setSize(W2, H2);
      const fH2 = 320 / zoomLevel.current;
      cam.left = -fH2 * W2 / H2; cam.right = fH2 * W2 / H2;
      cam.top = fH2; cam.bottom = -fH2;
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(rafRef.current!);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCam = useCallback(() => {
    const cam = camRef.current!; const el = mountRef.current!;
    const fH = 320 / zoomLevel.current;
    cam.left = -fH * el.clientWidth / el.clientHeight; cam.right = fH * el.clientWidth / el.clientHeight;
    cam.top = fH; cam.bottom = -fH;
    cam.updateProjectionMatrix();
  }, []);

  const getNDC = useCallback((clientX: number, clientY: number) => {
    const el = mountRef.current!;
    const r = el.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1
    );
  }, []);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    zoomLevel.current = Math.max(0.4, Math.min(15, zoomLevel.current * (e.deltaY < 0 ? 1.12 : 0.89)));
    updateCam(); setZoom(zoomLevel.current);
  }, [updateCam, setZoom]);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const cam = camRef.current!; const el = mountRef.current!;
    if (isDragging.current) {
      const dx = e.clientX - lastMouse.current.x, dy = e.clientY - lastMouse.current.y;
      const scale = (cam.right - cam.left) / el.clientWidth;
      cam.position.x -= dx * scale; cam.position.y += dy * scale;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const ndc = getNDC(e.clientX, e.clientY);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, cam);

    // Seat hover
    if (zoomLevel.current >= 3 && instRef.current) {
      const hits = ray.intersectObject(instRef.current);
      const newIdx = hits.length > 0 ? hits[0].instanceId! : -1;
      if (newIdx !== hoveredIdx.current) {
        if (hoveredIdx.current !== -1) refreshColor(hoveredIdx.current);
        hoveredIdx.current = newIdx;
        if (newIdx !== -1) {
          refreshColor(newIdx);
          setHovered(seatData.current[newIdx].id);
          // Compute 2D screen position from 3D world position
          const seat = seatData.current[newIdx];
          const worldPos = new THREE.Vector3(seat.x, seat.y, 1);
          worldPos.project(cam);
          const el2 = mountRef.current!;
          const r2 = el2.getBoundingClientRect();
          const sx = ((worldPos.x + 1) / 2) * r2.width;
          const sy = ((-worldPos.y + 1) / 2) * r2.height;
          setSeatTooltip({ screenX: sx, screenY: sy, seat });
        } else {
          setHovered(null);
          setSeatTooltip(null);
        }
      }
      return;
    }

    // Section hover
    const secHits = ray.intersectObjects([...secMeshes.current.values()]);
    if (secHits.length > 0) {
      const id = secHits[0].object.userData.sectionId as string;
      setHoveredSection(id);
      // highlight
      secMeshes.current.forEach((m, sid) => {
        (m.material as THREE.MeshBasicMaterial).opacity = sid === id ? 0.55 : 0.22;
      });
    } else {
      setHoveredSection(null);
      secMeshes.current.forEach(m => { (m.material as THREE.MeshBasicMaterial).opacity = 0.22; });
    }
  }, [getNDC, refreshColor, setHovered, setHoveredSection]);

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const onClick = useCallback((e: MouseEvent) => {
    const cam = camRef.current!;
    const ndc = getNDC(e.clientX, e.clientY);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, cam);

    if (zoomLevel.current >= 3 && instRef.current) {
      const hits = ray.intersectObject(instRef.current);
      if (hits.length > 0) {
        const idx = hits[0].instanceId!;
        const seat = seatData.current[idx];
        toggleSelect(seat);
        setTimeout(() => refreshColor(idx), 0);
      }
      return;
    }
    // Click section → zoom in
    const secHits = ray.intersectObjects([...secMeshes.current.values()]);
    if (secHits.length > 0) {
      const sec = SECTIONS.find(s => s.id === secHits[0].object.userData.sectionId)!;
      if (sec) {
        cam.position.x = sec.centerX; cam.position.y = sec.centerY;
        zoomLevel.current = 4; updateCam(); setZoom(4);
      }
    }
  }, [getNDC, toggleSelect, refreshColor, updateCam, setZoom]);

  useEffect(() => {
    const el = mountRef.current!;
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('click', onClick);
    el.addEventListener('contextmenu', e => e.preventDefault());
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('click', onClick);
    };
  }, [onWheel, onMouseDown, onMouseMove, onMouseUp, onClick]);

  return <div ref={mountRef} className={className} style={{ width: '100%', height: '100%', position: 'relative' }}>
    <AnimatePresence>
      {seatTooltip && (
        <motion.div
          key="3d-seat-tooltip"
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.12 }}
          style={{
            position: 'absolute',
            left: seatTooltip.screenX + 14,
            top: seatTooltip.screenY - 10,
            pointerEvents: 'none',
            zIndex: 100,
            background: 'rgba(8,12,24,0.97)',
            backdropFilter: 'blur(20px)',
            border: `1px solid #${(CAT_HEX[seatTooltip.seat.category] ?? 0x3b82f6).toString(16).padStart(6, '0')}44`,
            borderRadius: 10,
            padding: '10px 14px',
            minWidth: 160,
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
            fontFamily: 'Inter,Outfit,sans-serif',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
            {seatTooltip.seat.category}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11 }}>
            <span style={{ color: '#64748b' }}>Row</span>
            <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{seatTooltip.seat.row}</span>
            <span style={{ color: '#64748b' }}>Seat</span>
            <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{seatTooltip.seat.number}</span>
            <span style={{ color: '#64748b' }}>Tier</span>
            <span style={{ color: `#${(CAT_HEX[seatTooltip.seat.category] ?? 0x3b82f6).toString(16).padStart(6, '0')}`, fontWeight: 700 }}>{seatTooltip.seat.category}</span>
            <span style={{ color: '#64748b' }}>Price</span>
            <span style={{ color: '#10b981', fontWeight: 800 }}>${seatTooltip.seat.price}</span>
            <span style={{ color: '#64748b' }}>Status</span>
            <span style={{ color: seatTooltip.seat.status === 'sold' ? '#ef4444' : '#10b981', fontWeight: 700, textTransform: 'capitalize' }}>
              {seatTooltip.seat.status}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>;
}

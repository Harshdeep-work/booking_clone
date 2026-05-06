'use client';
/**
 * ThreeViewer — GPU-accelerated seat map viewer
 * - OrthographicCamera (top-down 2D)
 * - InstancedMesh for 50k+ seats (single draw call)
 * - LOD: sections → labels → seats based on zoom
 * - Raycasting for hover/select
 * - Frustum culling automatic via Three.js
 */
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { SECTIONS, ALL_SEATS } from '@/data/mockLayout';
import { useViewerStore } from '@/store/viewerStore';
import type { MockSeat } from '@/data/mockLayout';

// ── Colour palette ────────────────────────────────────────────────────────────
const CAT_HEX: Record<string, number> = {
  FIELD:    0xFF6B35,
  PLATINUM: 0xA855F7,
  GOLD:     0xF59E0B,
  SILVER:   0x94A3B8,
  BRONZE:   0xD97706,
  GENERAL:  0x3B82F6,
};
const C_HOVER    = new THREE.Color(0x10B981);
const C_SELECTED = new THREE.Color(0xFFFFFF);
const C_SOLD     = new THREE.Color(0x374151);
const C_LOCKED   = new THREE.Color(0xF97316);

// ── LOD thresholds (orthographic zoom) ───────────────────────────────────────
const LOD_SEATS  = 2.5;   // show seats above this zoom
const LOD_LABELS = 1.2;   // show labels above this zoom

function hexToColor(hex: number) { return new THREE.Color(hex); }

function makeLabelSprite(text: string, price: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 80);
  ctx.fillStyle = 'rgba(10,14,26,0.82)';
  ctx.roundRect(4, 4, 248, 72, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Inter,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 34);
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 18px Inter,sans-serif';
  ctx.fillText(`from $${price}`, 128, 62);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(28, 9, 1);
  return sprite;
}

export default function ThreeViewer({ className }: { className?: string }) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const sceneRef   = useRef<THREE.Scene | undefined>(undefined);
  const rendRef    = useRef<THREE.WebGLRenderer | undefined>(undefined);
  const camRef     = useRef<THREE.OrthographicCamera | undefined>(undefined);
  const rafRef     = useRef<number | undefined>(undefined);
  const instRef    = useRef<THREE.InstancedMesh | undefined>(undefined);   // seats
  const seatData   = useRef<MockSeat[]>([]);          // parallel array to instance indices
  const labelGroup = useRef<THREE.Group | undefined>(undefined);
  const sectionGrp = useRef<THREE.Group | undefined>(undefined);

  // pan/zoom state
  const isDragging = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });
  const zoomLevel  = useRef(1);

  const { setHovered, toggleSelect, hoveredSeatId, selectedSeatIds, setZoom } = useViewerStore();
  const hoveredIdx  = useRef<number>(-1);
  const selectedSet = useRef<Set<string>>(new Set());

  // keep ref in sync with store
  useEffect(() => { selectedSet.current = selectedSeatIds; }, [selectedSeatIds]);

  // ── colour helper ──────────────────────────────────────────────────────────
  const refreshInstanceColor = useCallback((idx: number, seat: MockSeat) => {
    const mesh = instRef.current;
    if (!mesh) return;
    let col: THREE.Color;
    if (selectedSet.current.has(seat.id))  col = C_SELECTED;
    else if (idx === hoveredIdx.current)   col = C_HOVER;
    else if (seat.status === 'sold')       col = C_SOLD;
    else if (seat.status === 'locked')     col = C_LOCKED;
    else col = hexToColor(CAT_HEX[seat.category] ?? 0x3B82F6);
    mesh.setColorAt(idx, col);
    mesh.instanceColor!.needsUpdate = true;
  }, []);

  // ── build scene ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x0A0E1A);
    el.appendChild(renderer.domElement);
    rendRef.current = renderer;

    // Camera
    const aspect = W / H;
    const frustH = 250;
    const cam = new THREE.OrthographicCamera(
      -frustH * aspect, frustH * aspect, frustH, -frustH, 0.1, 1000
    );
    cam.position.set(0, 0, 100);
    cam.lookAt(0, 0, 0);
    camRef.current = cam;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // ── Section polygons ──────────────────────────────────────────────────────
    const secGrp = new THREE.Group();
    sectionGrp.current = secGrp;
    scene.add(secGrp);

    SECTIONS.forEach((sec) => {
      const shape = new THREE.Shape();
      sec.vertices.forEach(([x, y], i) => {
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      });
      shape.closePath();

      // Fill
      const geo = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(sec.color),
        transparent: true, opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { sectionId: sec.id };
      secGrp.add(mesh);

      // Outline
      const pts = sec.vertices.map(([x, y]) => new THREE.Vector3(x, y, 0.1));
      pts.push(pts[0].clone());
      const linGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const linMat = new THREE.LineBasicMaterial({ color: new THREE.Color(sec.color), linewidth: 1 });
      secGrp.add(new THREE.Line(linGeo, linMat));
    });

    // ── Section labels (sprites) ──────────────────────────────────────────────
    const lblGrp = new THREE.Group();
    labelGroup.current = lblGrp;
    scene.add(lblGrp);

    SECTIONS.forEach((sec) => {
      const xs = sec.vertices.map(v => v[0]);
      const ys = sec.vertices.map(v => v[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const sprite = makeLabelSprite(sec.label, sec.basePrice);
      sprite.position.set(cx, cy, 1);
      lblGrp.add(sprite);
    });

    // ── InstancedMesh for seats ───────────────────────────────────────────────
    const seats = ALL_SEATS;
    seatData.current = seats;
    const geo = new THREE.CircleGeometry(2, 8); // octagon-ish circle
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const inst = new THREE.InstancedMesh(geo, mat, seats.length);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instRef.current = inst;

    const dummy = new THREE.Object3D();
    seats.forEach((seat, i) => {
      dummy.position.set(seat.x, seat.y, 0.5);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      let col: THREE.Color;
      if (seat.status === 'sold')   col = C_SOLD;
      else if (seat.status === 'locked') col = C_LOCKED;
      else col = hexToColor(CAT_HEX[seat.category] ?? 0x3B82F6);
      inst.setColorAt(i, col);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.instanceColor!.needsUpdate = true;
    inst.visible = false; // hidden until zoomed in
    scene.add(inst);

    // ── Render loop ───────────────────────────────────────────────────────────
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const z = zoomLevel.current;
      // LOD visibility
      if (inst) inst.visible = z >= LOD_SEATS;
      if (lblGrp) lblGrp.visible = z >= LOD_LABELS && z < LOD_SEATS;
      renderer.render(scene, cam);
    };
    animate();

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      const W2 = el.clientWidth, H2 = el.clientHeight;
      renderer.setSize(W2, H2);
      const a = W2 / H2;
      const fH = frustH / zoomLevel.current;
      cam.left = -fH * a; cam.right = fH * a;
      cam.top = fH; cam.bottom = -fH;
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current!);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Zoom (wheel) ──────────────────────────────────────────────────────────
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const cam = camRef.current;
    const el  = mountRef.current;
    if (!cam || !el) return;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    zoomLevel.current = Math.max(0.3, Math.min(12, zoomLevel.current * factor));
    const z = zoomLevel.current;
    const aspect = el.clientWidth / el.clientHeight;
    const fH = 250 / z;
    cam.left = -fH * aspect; cam.right = fH * aspect;
    cam.top = fH; cam.bottom = -fH;
    cam.updateProjectionMatrix();
    setZoom(z);
  }, [setZoom]);

  // ── Pan (drag) ────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 1 || e.button === 2) { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; }
  }, []);
  const onMouseMove = useCallback((e: MouseEvent) => {
    const cam = camRef.current;
    const el  = mountRef.current;
    if (!cam || !el) return;

    // Pan
    if (isDragging.current) {
      const dx = (e.clientX - lastMouse.current.x);
      const dy = (e.clientY - lastMouse.current.y);
      const scale = (cam.right - cam.left) / el.clientWidth;
      cam.position.x -= dx * scale;
      cam.position.y += dy * scale;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Hover raycasting (only when seats visible)
    if (zoomLevel.current < LOD_SEATS) { if (hoveredIdx.current !== -1) { refreshInstanceColor(hoveredIdx.current, seatData.current[hoveredIdx.current]); hoveredIdx.current = -1; setHovered(null); } return; }

    const rect = el.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
    const hits = raycaster.intersectObject(instRef.current!);
    const newIdx = hits.length > 0 ? hits[0].instanceId! : -1;

    if (newIdx !== hoveredIdx.current) {
      if (hoveredIdx.current !== -1) refreshInstanceColor(hoveredIdx.current, seatData.current[hoveredIdx.current]);
      hoveredIdx.current = newIdx;
      if (newIdx !== -1) { refreshInstanceColor(newIdx, seatData.current[newIdx]); setHovered(seatData.current[newIdx].id); }
      else setHovered(null);
    }
  }, [refreshInstanceColor, setHovered]);

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const onClick = useCallback((e: MouseEvent) => {
    const cam = camRef.current;
    const el  = mountRef.current;
    if (!cam || !el || zoomLevel.current < LOD_SEATS) return;
    const rect = el.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
    const hits = raycaster.intersectObject(instRef.current!);
    if (hits.length > 0) {
      const seat = seatData.current[hits[0].instanceId!];
      toggleSelect(seat);
      setTimeout(() => refreshInstanceColor(hits[0].instanceId!, seat), 0);
    }
  }, [toggleSelect, refreshInstanceColor]);

  // attach events
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('click', onClick);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('click', onClick);
    };
  }, [onWheel, onMouseDown, onMouseMove, onMouseUp, onClick]);

  return <div ref={mountRef} className={className} style={{ width: '100%', height: '100%', cursor: 'crosshair' }} />;
}

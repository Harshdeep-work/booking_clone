'use client';
import { useEffect, useRef, useCallback } from 'react';
import type { LayoutState, BShape, BSeat, BText, BRow, ToolId, LayerState } from './builderTypes2';
import { CAT_COLOR, pointInPoly } from './builderTypes2';

export interface Camera { x: number; y: number; zoom: number }
export interface DrawPreview {
  tool: ToolId;
  pts: [number, number][];
  mouse: [number, number];
  rectStart: [number, number] | null;
  arcRowCenter?: [number, number] | null;
  arcRowRadius?: number | null;
}

interface Props {
  layout: LayoutState;
  camera: Camera;
  preview: DrawPreview;
  selectedIds: Set<string>;
  sectionMode: string | null;
  bgImage: HTMLImageElement | null;
  bgOpacity: number;
  onCamera: (c: Camera) => void;
  onPointerDown: (wx: number, wy: number, sx: number, sy: number, e: PointerEvent) => void;
  onPointerMove: (wx: number, wy: number, sx: number, sy: number, e: PointerEvent) => void;
  onPointerUp: (wx: number, wy: number, e: PointerEvent) => void;
  onDblClick: (wx: number, wy: number) => void;
  onWheel: (e: WheelEvent) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  cursor: string;
  seatView?: 'seats' | 'rows';
  orphanDisplayModes?: Record<string, 'rows' | 'seats' | 'both'>;
  orphanRenderStyles?: Record<string, 'dots' | 'bar' | 'line'>;
  layers?: LayerState[];
}

const FONT = "'Inter',system-ui,sans-serif";
const GRID = 20;

function hexToRgb(hex: string): [number, number, number] | null {
  const raw = hex.replace('#', '').trim();
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    if ([r, g, b].some(n => Number.isNaN(n))) return null;
    return [r, g, b];
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some(n => Number.isNaN(n))) return null;
    return [r, g, b];
  }
  return null;
}

function darken(hex: string, amount = 0.2): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 - amount;
  const [r, g, b] = rgb;
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  return `rgba(${r},${g},${b},${alpha})`;
}

function isCustomShapeColor(shape: BShape): boolean {
  const catCol = CAT_COLOR[shape.category];
  return !!shape.color && !!catCol && shape.color.toLowerCase() !== catCol.toLowerCase();
}

export function w2s(wx: number, wy: number, cam: Camera, W: number, H: number): [number, number] {
  return [(wx - cam.x) * cam.zoom + W / 2, (wy - cam.y) * cam.zoom + H / 2];
}
export function s2w(sx: number, sy: number, cam: Camera, W: number, H: number): [number, number] {
  return [(sx - W / 2) / cam.zoom + cam.x, (sy - H / 2) / cam.zoom + cam.y];
}

export default function BuilderCanvas(props: Props) {
  const { layout, camera, preview, selectedIds, sectionMode, bgImage, bgOpacity,
    onPointerDown, onPointerMove, onPointerUp, onDblClick, onWheel,
    canvasRef, containerRef, cursor, seatView = 'seats', orphanDisplayModes = {}, orphanRenderStyles = {}, layers = [] } = props;

  const rafRef = useRef<number | null>(null);
  const layoutRef = useRef(layout);
  const camRef = useRef(camera);
  const previewRef = useRef(preview);
  const selRef = useRef(selectedIds);
  const secModeRef = useRef(sectionMode);
  const bgRef = useRef(bgImage);
  const bgOpRef = useRef(bgOpacity);
  const seatViewRef = useRef(seatView);
  const orphanDMRef = useRef(orphanDisplayModes);
  const orphanRSRef = useRef(orphanRenderStyles);

  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => { camRef.current = camera; }, [camera]);
  useEffect(() => { previewRef.current = preview; }, [preview]);
  useEffect(() => { selRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { secModeRef.current = sectionMode; }, [sectionMode]);
  useEffect(() => { bgRef.current = bgImage; }, [bgImage]);
  useEffect(() => { bgOpRef.current = bgOpacity; }, [bgOpacity]);
  useEffect(() => { seatViewRef.current = seatView; }, [seatView]);
  useEffect(() => { orphanDMRef.current = orphanDisplayModes; }, [orphanDisplayModes]);
  useEffect(() => { orphanRSRef.current = orphanRenderStyles; }, [orphanRenderStyles]);
  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const cam = camRef.current;
    const { shapes, seats, texts, rows: layoutRows } = layoutRef.current;
    const sel = selRef.current;
    const secMode = secModeRef.current;
    const pv = previewRef.current;

    const layers = layersRef.current;
    const showSections = layers ? layers.find(l => l.id === 'sections')?.visible !== false : true;
    const showSeats = layers ? layers.find(l => l.id === 'seats')?.visible !== false : true;
    const showLabels = layers ? layers.find(l => l.id === 'labels')?.visible !== false : true;
    const showPricing = layers ? layers.find(l => l.id === 'pricing')?.visible !== false : true;
    const showEntrances = layers ? layers.find(l => l.id === 'entrances')?.visible !== false : true;
    const showOverlays = layers ? layers.find(l => l.id === 'overlays')?.visible !== false : true;

    ctx.clearRect(0, 0, W, H);

    // ── White background (TickPick style) ─────────────────────────────────────
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, W, H);

    // ── Reference image ───────────────────────────────────────────────────────
    if (bgRef.current && showOverlays) {
      const img = bgRef.current;
      const fitScale = Math.min(W / img.width, H / img.height) * 0.9;
      const sw = img.width * fitScale * cam.zoom, sh = img.height * fitScale * cam.zoom;
      const [sx, sy] = w2s(-(img.width * fitScale) / 2, -(img.height * fitScale) / 2, cam, W, H);
      ctx.save(); ctx.globalAlpha = bgOpRef.current;
      ctx.drawImage(img, sx, sy, sw, sh);
      ctx.restore();
    }

    // ── Section-mode dim overlay ──────────────────────────────────────────────
    if (secMode) {
      ctx.fillStyle = 'rgba(240,242,245,0.82)';
      ctx.fillRect(0, 0, W, H);
      const sec = shapes.find(s => s.id === secMode);
      if (sec && sec.vertices && sec.vertices.length >= 2) {
        ctx.save();
        ctx.beginPath();
        const [fx, fy] = w2s(sec.vertices[0][0], sec.vertices[0][1], cam, W, H);
        ctx.moveTo(fx, fy);
        for (let i = 1; i < sec.vertices.length; i++) {
          const [px, py] = w2s(sec.vertices[i][0], sec.vertices[i][1], cam, W, H);
          ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(219,234,254,0.6)'; ctx.fill();
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
    }

    // ── Tier colours (TickPick palette) ───────────────────────────────────────
    // VIP/courtside = gold (#f5d78e), Premium = blue (#bfdbfe), Standard = grey (#e2e8f0), Budget = light grey
    const TIER_FILL: Record<string, string> = {
      VIP: '#f5d78e', PREMIUM: '#bfdbfe', STANDARD: '#e2e8f0', BUDGET: '#e8eaed', GA: '#d1fae5',
    };
    const TIER_STROKE: Record<string, string> = {
      VIP: '#d4a017', PREMIUM: '#3b82f6', STANDARD: '#94a3b8', BUDGET: '#94a3b8', GA: '#10b981',
    };
    const TIER_ROW: Record<string, string> = {
      VIP: '#f0c040', PREMIUM: '#93c5fd', STANDARD: '#cbd5e1', BUDGET: '#d1d5db', GA: '#6ee7b7',
    };

    // ── Shapes ────────────────────────────────────────────────────────────────
    shapes.forEach(shape => {
      if (secMode && shape.id !== secMode) return;
      const isEntranceType = ['court', 'stage', 'tunnel', 'concourse', 'ada', 'scoreboard', 'pressbox'].includes(shape.type);
      if (isEntranceType) {
        if (!showEntrances) return;
      } else {
        if (!showSections && !secMode) return;
      }
      const vs = shape.vertices;
      if (vs.length < 2) return;
      const isSel = sel.has(shape.id);

      // Build screen-space path
      ctx.save();
      ctx.beginPath();
      const [fx, fy] = w2s(vs[0][0], vs[0][1], cam, W, H);
      ctx.moveTo(fx, fy);
      for (let i = 1; i < vs.length; i++) {
        const [px, py] = w2s(vs[i][0], vs[i][1], cam, W, H);
        ctx.lineTo(px, py);
      }
      ctx.closePath();

      // ── Court ──────────────────────────────────────────────────────────────
      if (shape.type === 'court') {
        const isIce = shape.label === 'ICE', isPitch = shape.label === 'PITCH';
        const [lx, ly] = w2s(vs[0][0], vs[0][1], cam, W, H);
        const [rx] = w2s(vs[1][0], vs[1][1], cam, W, H);
        const [, bry] = w2s(vs[2][0], vs[2][1], cam, W, H);
        const cW2 = rx - lx, cH2 = bry - ly, cx2 = lx + cW2/2, cy2 = ly + cH2/2;

        if (!isIce && !isPitch) {
          const border = cW2 * 0.06;
          ctx.fillStyle = '#1a3fa0'; ctx.fill();
          ctx.fillStyle = '#e8a84a';
          ctx.fillRect(lx+border, ly+border, cW2-border*2, cH2-border*2);
          // wood grain
          ctx.strokeStyle = 'rgba(180,120,40,0.2)'; ctx.lineWidth = 0.5;
          for (let gy = ly+border+cH2*0.06; gy < ly+cH2-border; gy += cH2*0.06) {
            ctx.beginPath(); ctx.moveTo(lx+border, gy); ctx.lineTo(lx+cW2-border, gy); ctx.stroke();
          }
          const mk = '#1a3fa0', lw = Math.max(0.8, 1.5*cam.zoom);
          ctx.strokeStyle = mk; ctx.lineWidth = lw;
          const fl=lx+border, fr=lx+cW2-border, ft=ly+border, fb=ly+cH2-border;
          const fw=fr-fl, fh=fb-ft, fcx=fl+fw/2, fcy=ft+fh/2;
          ctx.strokeRect(fl,ft,fw,fh);
          ctx.beginPath(); ctx.moveTo(fcx,ft); ctx.lineTo(fcx,fb); ctx.stroke();
          ctx.beginPath(); ctx.arc(fcx,fcy,fh*0.18,0,Math.PI*2); ctx.stroke();
          ctx.beginPath(); ctx.arc(fcx,fcy,fh*0.06,0,Math.PI*2); ctx.stroke();
          ctx.beginPath(); ctx.arc(fl+fw*0.085,fcy,fh*0.44,-Math.PI*0.5,Math.PI*0.5); ctx.stroke();
          ctx.beginPath(); ctx.arc(fr-fw*0.085,fcy,fh*0.44,Math.PI*0.5,Math.PI*1.5); ctx.stroke();
          ctx.strokeRect(fl,fcy-fh*0.25,fw*0.155,fh*0.5);
          ctx.strokeRect(fr-fw*0.155,fcy-fh*0.25,fw*0.155,fh*0.5);
          ctx.beginPath(); ctx.arc(fl+fw*0.155,fcy,fh*0.18,-Math.PI/2,Math.PI/2); ctx.stroke();
          ctx.beginPath(); ctx.arc(fr-fw*0.155,fcy,fh*0.18,Math.PI/2,Math.PI*1.5); ctx.stroke();
          ctx.beginPath(); ctx.arc(fl+fw*0.055,fcy,fh*0.1,-Math.PI/2,Math.PI/2); ctx.stroke();
          ctx.beginPath(); ctx.arc(fr-fw*0.055,fcy,fh*0.1,Math.PI/2,Math.PI*1.5); ctx.stroke();
          if (cam.zoom > 0.4) {
            ctx.fillStyle='#fff'; ctx.font=`bold ${Math.max(6,9*cam.zoom)}px ${FONT}`;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.save(); ctx.translate(lx+border/2,fcy); ctx.rotate(-Math.PI/2); ctx.fillText('VISITORS',0,0); ctx.restore();
            ctx.save(); ctx.translate(rx-border/2,fcy); ctx.rotate(Math.PI/2); ctx.fillText('PISTONS',0,0); ctx.restore();
          }
        } else if (isPitch) {
          ctx.fillStyle='#16a34a'; ctx.fill();
          ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=Math.max(0.8,1.2*cam.zoom);
          ctx.strokeRect(lx+cW2*0.04,ly+cH2*0.04,cW2*0.92,cH2*0.92);
          ctx.beginPath(); ctx.moveTo(cx2,ly+cH2*0.04); ctx.lineTo(cx2,ly+cH2*0.96); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx2,cy2,Math.min(cW2,cH2)*0.14,0,Math.PI*2); ctx.stroke();
          ctx.strokeRect(lx+cW2*0.04,ly+cH2*0.22,cW2*0.12,cH2*0.56);
          ctx.strokeRect(lx+cW2*0.84,ly+cH2*0.22,cW2*0.12,cH2*0.56);
        } else {
          ctx.fillStyle='#dbeafe'; ctx.fill();
          ctx.strokeStyle='#1d4ed8'; ctx.lineWidth=2; ctx.stroke();
          ctx.strokeStyle='rgba(239,68,68,0.5)'; ctx.lineWidth=Math.max(0.8,1.2*cam.zoom);
          ctx.beginPath(); ctx.moveTo(cx2,ly); ctx.lineTo(cx2,ly+cH2); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx2-cW2*0.25,cy2,cH2*0.28,0,Math.PI*2); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx2+cW2*0.25,cy2,cH2*0.28,0,Math.PI*2); ctx.stroke();
        }
        ctx.restore(); return;
      }

      // ── Special shapes ────────────────────────────────────────────────────
      if (shape.type === 'stage') {
        const fill = shape.color || '#e2e8f0';
        ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=isSel ? '#2563eb' : darken(fill, 0.25); ctx.lineWidth=1.5; ctx.stroke();
        const [lxS,lyS]=w2s(shape.cx,shape.cy,cam,W,H);
        ctx.fillStyle='#64748b'; ctx.font=`bold ${Math.max(7,9*cam.zoom)}px ${FONT}`;
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('STAGE',lxS,lyS);
        ctx.restore(); return;
      }
      if (shape.type === 'suite') {
        const fill = shape.color || '#fef3c7';
        ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=isSel ? '#2563eb' : darken(fill, 0.25); ctx.lineWidth=isSel?2:1; ctx.stroke();
        const [lxS,lyS]=w2s(shape.cx,shape.cy,cam,W,H);
        ctx.fillStyle='#92400e'; ctx.font=`bold ${Math.max(6,7*cam.zoom)}px ${FONT}`;
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(shape.label,lxS,lyS);
        ctx.restore(); return;
      }
      if (shape.type === 'pressbox') {
        const fill = shape.color || '#f0f9ff';
        ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=isSel ? '#2563eb' : darken(fill, 0.25); ctx.lineWidth=1.5; ctx.stroke();
        const [lxS,lyS]=w2s(shape.cx,shape.cy,cam,W,H);
        ctx.fillStyle='#0369a1'; ctx.font=`bold ${Math.max(6,7*cam.zoom)}px ${FONT}`;
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('PRESS',lxS,lyS);
        ctx.restore(); return;
      }
      if (shape.type === 'scoreboard') {
        const fill = shape.color || '#1e293b';
        ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=isSel ? '#2563eb' : darken(fill, 0.25); ctx.lineWidth=1.5; ctx.stroke();
        const [lxS,lyS]=w2s(shape.cx,shape.cy,cam,W,H);
        ctx.font=`${Math.max(8,10*cam.zoom)}px ${FONT}`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('📺',lxS,lyS);
        ctx.restore(); return;
      }
      if (shape.type === 'tunnel') {
        const fill = shape.color || '#f1f5f9';
        ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=isSel ? '#2563eb' : darken(fill, 0.2); ctx.lineWidth=1; ctx.setLineDash([3,2]); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore(); return;
      }
      if (shape.type === 'concourse') {
        const fill = shape.color || '#f1f5f9';
        ctx.fillStyle=withAlpha(fill, 0.5); ctx.fill(); ctx.strokeStyle=darken(fill, 0.2); ctx.lineWidth=1; ctx.setLineDash([5,3]); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore(); return;
      }
      if (shape.type === 'ada') {
        const fill = shape.color || '#eff6ff';
        ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=isSel ? '#2563eb' : darken(fill, 0.2); ctx.lineWidth=1; ctx.setLineDash([2,2]); ctx.stroke(); ctx.setLineDash([]);
        const [lxS,lyS]=w2s(shape.cx,shape.cy,cam,W,H);
        ctx.font=`${Math.max(8,9*cam.zoom)}px ${FONT}`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('♿',lxS,lyS);
        ctx.restore(); return;
      }

      // ── Seating section — TickPick style ──────────────────────────────────
      const cat = shape.category as string;
      const customFill = isCustomShapeColor(shape) ? shape.color : null;
      const secSeats = seats.filter(s => s.sectionId === shape.id);
      const secRows  = layoutRows.filter(r => r.sectionId === shape.id);
      const fillCol = customFill || TIER_FILL[cat] || '#e2e8f0';
      const strokeCol = isSel ? '#2563eb' : (customFill ? darken(customFill, 0.25) : (TIER_STROKE[cat] || '#94a3b8'));
      const rowCol    = TIER_ROW[cat] || '#cbd5e1';

      // Section fill
      ctx.fillStyle = fillCol;
      ctx.fill();

      // ── ARC SECTION: draw filled arc-band rows (TickPick style) ───────────
      const hasArc = !!(shape.arcCenter && shape.arcInnerR != null && shape.arcOuterR != null && shape.arcA0 != null && shape.arcA1 != null);
      const dm = shape.displayMode || 'both';
      if (hasArc && dm !== 'seats') {
        const [acx, acy] = shape.arcCenter!;
        const innerR = shape.arcInnerR!, outerR = shape.arcOuterR!;
        const a0deg = shape.arcA0!, a1deg = shape.arcA1!;
        const a0r = a0deg * Math.PI / 180, a1r = a1deg * Math.PI / 180;
        const [sccx, sccy] = w2s(acx, acy, cam, W, H);
        const sInner = innerR * cam.zoom, sOuter = outerR * cam.zoom;

        ctx.save();
        // Clip to section polygon
        ctx.beginPath();
        const [cfx, cfy] = w2s(vs[0][0], vs[0][1], cam, W, H);
        ctx.moveTo(cfx, cfy);
        for (let i = 1; i < vs.length; i++) {
          const [px, py] = w2s(vs[i][0], vs[i][1], cam, W, H);
          ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.clip();

        // Determine rows to draw
        const rowsToDraw = secRows.filter(r => r.curveCenter && r.curveRadius != null);
        const totalR = outerR - innerR;

        if (rowsToDraw.length === 0) {
          // No explicit rows — draw auto bands (8 equal bands)
          const bandCount = 8;
          for (let i = 0; i < bandCount; i++) {
            const r0 = sInner + (i / bandCount) * (sOuter - sInner);
            const r1 = sInner + ((i + 1) / bandCount) * (sOuter - sInner);
            const rMid = (r0 + r1) / 2;
            ctx.beginPath();
            ctx.arc(sccx, sccy, rMid, a0r, a1r);
            ctx.strokeStyle = rowCol;
            ctx.lineWidth = r1 - r0 - 1;
            ctx.lineCap = 'butt';
            ctx.stroke();
            // white divider
            ctx.beginPath();
            ctx.arc(sccx, sccy, r1, a0r, a1r);
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = Math.max(1, cam.zoom);
            ctx.stroke();
          }
        } else {
          // Draw explicit rows as filled arc bands
          rowsToDraw.forEach((row, ri) => {
            const isRowSel = sel.has(row.id);
            const effectiveCol = row.color || rowCol;
            const rWorld = row.curveRadius!;
            const ra0 = (row.curveA0 ?? a0deg) * Math.PI / 180;
            const ra1 = (row.curveA1 ?? a1deg) * Math.PI / 180;

            // Band thickness: half-gap to prev + half-gap to next
            const prevRow = rowsToDraw[ri - 1];
            const nextRow = rowsToDraw[ri + 1];
            const halfPrev = prevRow?.curveRadius != null ? (rWorld - prevRow.curveRadius!) / 2 : (totalR / rowsToDraw.length) / 2;
            const halfNext = nextRow?.curveRadius != null ? (nextRow.curveRadius! - rWorld) / 2 : (totalR / rowsToDraw.length) / 2;
            const rInner = (rWorld - halfPrev) * cam.zoom;
            const rOuter = (rWorld + halfNext) * cam.zoom;
            const rMid = (rInner + rOuter) / 2;
            const bandW = rOuter - rInner - 1;

            ctx.beginPath();
            ctx.arc(sccx, sccy, rMid, ra0, ra1);
            ctx.strokeStyle = effectiveCol;
            ctx.lineWidth = isRowSel ? bandW + 3 : bandW;
            ctx.lineCap = 'butt';
            ctx.stroke();

            // White divider line
            ctx.beginPath();
            ctx.arc(sccx, sccy, rOuter, ra0, ra1);
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.lineWidth = Math.max(1, cam.zoom * 0.8);
            ctx.stroke();

            // Row number label on right edge
            if (cam.zoom >= 0.35) {
              const labelA = ra1 + 0.04;
              const lx2 = sccx + Math.cos(labelA) * rMid;
              const ly2 = sccy + Math.sin(labelA) * rMid;
              ctx.font = `500 ${Math.max(6, Math.min(10, 7 * cam.zoom))}px ${FONT}`;
              ctx.fillStyle = isRowSel ? effectiveCol : '#94a3b8';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(row.label, lx2, ly2);
            }

            // Selection glow + handles
            if (isRowSel) {
              ctx.beginPath();
              ctx.arc(sccx, sccy, rMid, ra0, ra1);
              ctx.strokeStyle = effectiveCol;
              ctx.lineWidth = bandW + 10;
              ctx.globalAlpha = 0.18;
              ctx.stroke();
              ctx.globalAlpha = 1;

              // Handles: left end, right end, outer radius
              const ep0x = sccx + Math.cos(ra0) * rMid, ep0y = sccy + Math.sin(ra0) * rMid;
              const ep1x = sccx + Math.cos(ra1) * rMid, ep1y = sccy + Math.sin(ra1) * rMid;
              const amid = (ra0 + ra1) / 2;
              const rhx = sccx + Math.cos(amid) * (rOuter + 14), rhy = sccy + Math.sin(amid) * (rOuter + 14);
              [[ep0x, ep0y, '◂'], [ep1x, ep1y, '▸'], [rhx, rhy, '↕']].forEach(([hx, hy, icon]) => {
                ctx.beginPath();
                ctx.arc(hx as number, hy as number, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 4;
                ctx.fill(); ctx.shadowBlur = 0;
                ctx.strokeStyle = effectiveCol; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = effectiveCol;
                ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(icon as string, hx as number, hy as number);
              });
            }
          });
        }
        ctx.restore();
      } else {
        // ── Non-arc section: draw curved rows from layoutRows ─────────────
        if (secRows.length > 0) {
          ctx.save();
          ctx.beginPath();
          const [fx0, fy0] = w2s(vs[0][0], vs[0][1], cam, W, H);
          ctx.moveTo(fx0, fy0);
          for (let i = 1; i < vs.length; i++) {
            const [px, py] = w2s(vs[i][0], vs[i][1], cam, W, H);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.clip();

          secRows.forEach((row, ri) => {
            if (!row.curveCenter || row.curveRadius == null || row.curveA0 == null || row.curveA1 == null) return;
            const isRowSel = sel.has(row.id);
            const effectiveRowCol = row.color || rowCol;
            let thickness = Math.max(6, 8 * cam.zoom);
            const nextRow = secRows[ri + 1];
            if (nextRow?.curveRadius != null) {
              thickness = Math.max(6, Math.min(28, (nextRow.curveRadius - row.curveRadius) * cam.zoom * 0.85));
            }
            const [ccx, ccy] = w2s(row.curveCenter[0], row.curveCenter[1], cam, W, H);
            const rPx = row.curveRadius * cam.zoom;
            const a0r = (row.curveA0 * Math.PI) / 180;
            const a1r = (row.curveA1 * Math.PI) / 180;
            ctx.beginPath();
            ctx.arc(ccx, ccy, rPx, a0r, a1r, a1r < a0r);
            ctx.strokeStyle = effectiveRowCol;
            ctx.lineWidth = isRowSel ? thickness + 3 : thickness;
            ctx.lineCap = 'butt';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(ccx, ccy, rPx, a0r, a1r, a1r < a0r);
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
            ctx.stroke();
            if (cam.zoom >= 0.4) {
              const lx2 = ccx + Math.cos(a1r) * rPx + Math.cos(a1r) * 8;
              const ly2 = ccy + Math.sin(a1r) * rPx + Math.sin(a1r) * 8;
              ctx.font = `500 ${Math.max(6, Math.min(10, 7 * cam.zoom))}px ${FONT}`;
              ctx.fillStyle = isRowSel ? effectiveRowCol : '#94a3b8';
              ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
              ctx.fillText(row.label, lx2, ly2);
            }
            if (isRowSel) {
              ctx.beginPath();
              ctx.arc(ccx, ccy, rPx, a0r, a1r, a1r < a0r);
              ctx.strokeStyle = effectiveRowCol; ctx.lineWidth = thickness + 8;
              ctx.globalAlpha = 0.2; ctx.stroke(); ctx.globalAlpha = 1;
              const ep0x = ccx + Math.cos(a0r) * rPx, ep0y = ccy + Math.sin(a0r) * rPx;
              const ep1x = ccx + Math.cos(a1r) * rPx, ep1y = ccy + Math.sin(a1r) * rPx;
              const amid = (a0r + a1r) / 2;
              const rhx = ccx + Math.cos(amid) * (rPx + 16), rhy = ccy + Math.sin(amid) * (rPx + 16);
              [[ep0x, ep0y, '◂'], [ep1x, ep1y, '▸'], [rhx, rhy, '↕']].forEach(([hx, hy, icon]) => {
                ctx.beginPath(); ctx.arc(hx as number, hy as number, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 4;
                ctx.fill(); ctx.shadowBlur = 0;
                ctx.strokeStyle = effectiveRowCol; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = effectiveRowCol; ctx.font = `bold 9px ${FONT}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(icon as string, hx as number, hy as number);
              });
            }
          });
          ctx.restore();
        }

        // ── Seat-based straight rows ──────────────────────────────────────
        if (secSeats.length > 0 && (dm !== 'seats') && (cam.zoom > 0.2 || dm === 'rows' || dm === 'both')) {
          const curvedRowIds = new Set(secRows.map(r => r.id));
          const rowMap = new Map<string, typeof secSeats>();
          secSeats.forEach(s => {
            const key = s.rowId || `__norow__${s.sectionId}`;
            if (curvedRowIds.has(key)) return;
            if (!rowMap.has(key)) rowMap.set(key, []);
            rowMap.get(key)!.push(s);
          });
          const rowIds = [...rowMap.keys()];
          if (rowIds.length >= 1) {
            ctx.save();
            if (seatViewRef.current !== 'rows') {
              ctx.beginPath();
              const [fx2, fy2] = w2s(vs[0][0], vs[0][1], cam, W, H);
              ctx.moveTo(fx2, fy2);
              for (let i = 1; i < vs.length; i++) {
                const [px, py] = w2s(vs[i][0], vs[i][1], cam, W, H);
                ctx.lineTo(px, py);
              }
              ctx.closePath(); ctx.clip();
            }
            const seatRSec = Math.max(4, Math.min(10, 6 * cam.zoom));
            rowIds.forEach((rowId) => {
              const rowSeats = rowMap.get(rowId)!;
              if (rowSeats.length < 1) return;
              rowSeats.sort((a, b) => a.number - b.number);
              const rowMeta = layoutRows.find(r => r.id === rowId);
              const isRowSel = sel.has(rowId);
              const effectiveRowCol = rowMeta?.color || rowCol;

              const first = rowSeats[0], last = rowSeats[rowSeats.length - 1];
              const [x0, y0] = w2s(first.x, first.y, cam, W, H);
              const [x1, y1] = w2s(last.x, last.y, cam, W, H);
              const angle = Math.atan2(y1 - y0, x1 - x0);
              const seatSpacingPx = rowSeats.length > 1
                ? Math.hypot(x1 - x0, y1 - y0) / (rowSeats.length - 1)
                : seatRSec * 2.5;
              const ext = seatSpacingPx * 0.5;
              const dx2 = Math.cos(angle), dy2 = Math.sin(angle);

              // Thin guide line — only show when row is selected
              if (isRowSel) {
              ctx.beginPath();
              ctx.moveTo(x0 - dx2 * ext, y0 - dy2 * ext);
              ctx.lineTo(x1 + dx2 * ext, y1 + dy2 * ext);
              ctx.strokeStyle = effectiveRowCol + 'cc';
              ctx.lineWidth = Math.max(2, 2 * cam.zoom);
              ctx.stroke();
              }

              // Row labels at both ends
              if (cam.zoom >= 0.2) {
                const rowLetter = rowSeats[0].label.replace(/\d+$/, '');
                if (rowLetter) {
                  const labelSize = Math.max(8, Math.min(13, 9 * cam.zoom));
                  ctx.font = `700 ${labelSize}px ${FONT}`;
                  ctx.fillStyle = isRowSel ? effectiveRowCol : '#1e293b';
                  ctx.textBaseline = 'middle';
                  const pad = seatRSec + 8;
                  ctx.textAlign = 'right';
                  ctx.fillText(rowLetter, x0 - dx2 * pad, y0 - dy2 * pad);
                  ctx.textAlign = 'left';
                  ctx.fillText(rowLetter, x1 + dx2 * pad, y1 + dy2 * pad);
                }
              }
            });
            ctx.restore();
          }
        }
      }

      // Section border
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = isSel ? 2.5 : (cam.zoom > 3 ? 1 : 0.8);
      ctx.setLineDash(shape.type === 'ga' ? [5,3] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      // Selection glow
      if (isSel) {
        ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 8;
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      // ── Section label (TickPick style: large grey number + price badge) ────
      if (!secMode || shape.id === secMode) {
        const [lx, ly] = w2s(shape.cx, shape.cy, cam, W, H);

        // Section number — large, grey, like TickPick
        ctx.save();
        const numSize = Math.max(8, Math.min(22, 16 * cam.zoom));
        ctx.font = `600 ${numSize}px ${FONT}`;
        ctx.fillStyle = isSel ? '#1d4ed8' : '#94a3b8';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(shape.label, lx, ly);

        // Price badge (white pill, always visible like TickPick)
        const minP = seats.filter(s => s.sectionId === shape.id).reduce((a, s) => Math.min(a, s.price), Infinity);
        if (showPricing && minP !== Infinity && minP > 0 && cam.zoom > 0.35) {
          const priceStr = `$${minP.toLocaleString()}`;
          const badgeFont = Math.max(7, Math.min(11, 9 * cam.zoom));
          ctx.font = `700 ${badgeFont}px ${FONT}`;
          const tw = ctx.measureText(priceStr).width;
          const bw = tw + 12, bh = badgeFont + 8;
          const bx = lx - bw/2, by = ly + numSize/2 + 4;

          // White pill
          ctx.fillStyle = '#fff';
          ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 4;
          roundRect(ctx, bx, by, bw, bh, bh/2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Price text
          ctx.fillStyle = '#0f172a';
          ctx.textBaseline = 'middle';
          ctx.fillText(priceStr, lx, by + bh/2);
        }
        ctx.restore();
      }

      // Vertex handles when selected
      if (isSel && !secMode) {
        vs.forEach(v => {
          const [px, py] = w2s(v[0], v[1], cam, W, H);
          ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI*2);
          ctx.fillStyle = '#fff'; ctx.fill();
          ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2.5;
          ctx.stroke();
        });
      }
    });

    // ── Bounding box resize handles (Figma-style) ─────────────────────────────
    if (!secMode && sel.size > 0) {
      const selShapes = shapes.filter(s => sel.has(s.id));
      if (selShapes.length > 0) {
        const allVerts = selShapes.flatMap(s => s.vertices);
        const bx0 = Math.min(...allVerts.map(v => v[0]));
        const by0 = Math.min(...allVerts.map(v => v[1]));
        const bx1 = Math.max(...allVerts.map(v => v[0]));
        const by1 = Math.max(...allVerts.map(v => v[1]));
        const bmx = (bx0 + bx1) / 2, bmy = (by0 + by1) / 2;

        const [sx0, sy0] = w2s(bx0, by0, cam, W, H);
        const [sx1, sy1] = w2s(bx1, by1, cam, W, H);
        const [smx, smy] = w2s(bmx, bmy, cam, W, H);

        // Dashed bounding box
        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
        ctx.setLineDash([]);

        // 8 handles: TL,TC,TR,ML,MR,BL,BC,BR
        const handles: [number, number][] = [
          [sx0, sy0], [smx, sy0], [sx1, sy0],
          [sx0, smy],             [sx1, smy],
          [sx0, sy1], [smx, sy1], [sx1, sy1],
        ];
        handles.forEach(([hx, hy]) => {
          ctx.beginPath();
          ctx.rect(hx - 5, hy - 5, 10, 10);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2;
          ctx.stroke();
        });

        // Rotate handle: circle above top-center with a short stem only
        const rotHY = sy0 - 24;
        ctx.beginPath();
        ctx.moveTo(smx, sy0 - 2);
        ctx.lineTo(smx, rotHY + 7);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(smx, rotHY, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.stroke();
        // rotation arrow icon inside
        ctx.save();
        ctx.translate(smx, rotHY);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, -Math.PI * 0.8, Math.PI * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(2.5, -3.5); ctx.lineTo(4, -1.5); ctx.lineTo(0.5, -1.5);
        ctx.fillStyle = '#2563eb'; ctx.fill();
        ctx.restore();

        ctx.restore();
      }
    }

    // ── Fallback row stripes for seats with no matching section shape ──────────
    if (showSeats) {
      const shapeIds = new Set(shapes.map(s => s.id));
      const orphanSeats = seats.filter(s => !shapeIds.has(s.sectionId));
      if (orphanSeats.length > 0) {
        // Group by section first, then by row
        const bySec = new Map<string, typeof orphanSeats>();
        orphanSeats.forEach(s => {
          if (!bySec.has(s.sectionId)) bySec.set(s.sectionId, []);
          bySec.get(s.sectionId)!.push(s);
        });

        bySec.forEach((secSeats, sectionId) => {
          const dm = orphanDMRef.current[sectionId] || 'both';
          // 'seats' mode: skip row stripes (handled in seat circles block below)
          if (dm === 'seats') return;
          // 'both' mode: only show stripes, seat circles appear on zoom (handled below)

          const rowMap = new Map<string, typeof secSeats>();
          secSeats.forEach(s => {
            const key = s.rowId || `__norow__${s.sectionId}`;
            if (!rowMap.has(key)) rowMap.set(key, []);
            rowMap.get(key)!.push(s);
          });
          const rowIds = [...rowMap.keys()];
          // Pre-compute seat radius to size the stripe correctly
          const seatR = Math.max(4, Math.min(10, 6 * cam.zoom));
          ctx.save();
          rowIds.forEach((rowId) => {
            const rowSeats = rowMap.get(rowId)!;
            rowSeats.sort((a, b) => a.number - b.number);
            const col = rowSeats[0]?.color || CAT_COLOR[rowSeats[0]?.category] || '#94a3b8';
            const rowMeta = layoutRows.find(r => r.id === rowId);
            const rs = orphanRSRef.current[sectionId] || 'line'; // default: thin line
            const isCurved = !!(rowMeta?.curveCenter && rowMeta.curveRadius != null && rowMeta.curveA0 != null && rowMeta.curveA1 != null);

            if (isCurved) {
              const [ccx, ccy] = w2s(rowMeta!.curveCenter![0], rowMeta!.curveCenter![1], cam, W, H);
              const rPx = rowMeta!.curveRadius! * cam.zoom;
              const a0r = (rowMeta!.curveA0! * Math.PI) / 180;
              const a1r = (rowMeta!.curveA1! * Math.PI) / 180;
              if (rs === 'bar') {
                ctx.beginPath();
                ctx.arc(ccx, ccy, rPx, a0r, a1r, a1r < a0r);
                ctx.strokeStyle = col + 'bb';
                ctx.lineWidth = seatR * 2 + 4;
                ctx.lineCap = 'butt';
                ctx.stroke();
              } else {
                ctx.beginPath();
                ctx.arc(ccx, ccy, rPx, a0r, a1r, a1r < a0r);
                ctx.strokeStyle = col + '55';
                ctx.lineWidth = Math.max(1, 1.5 * cam.zoom);
                ctx.stroke();
              }
            } else {
              const first = rowSeats[0], last = rowSeats[rowSeats.length - 1];
              const [x0, y0] = w2s(first.x, first.y, cam, W, H);
              const [x1, y1] = w2s(last.x, last.y, cam, W, H);
              const angle = Math.atan2(y1 - y0, x1 - x0);
              const seatSpacingPx = rowSeats.length > 1
                ? Math.hypot(x1 - x0, y1 - y0) / (rowSeats.length - 1)
                : seatR * 2.5;
              const ext = seatSpacingPx * 0.5;
              const dx2 = Math.cos(angle), dy2 = Math.sin(angle);

              // Check if row is curved (seats have varying Y relative to first-last line)
              const isCurvedRow = rowSeats.some(s => {
                const [sx, sy] = w2s(s.x, s.y, cam, W, H);
                const t = rowSeats.length > 1 ? rowSeats.indexOf(s) / (rowSeats.length - 1) : 0.5;
                const lineY = y0 + t * (y1 - y0);
                return Math.abs(sy - lineY) > 2;
              });

              const halfT = seatR + 3;
              const lineLen = Math.hypot(x1 - x0, y1 - y0) + ext * 2;

              if (rs === 'bar') {
                if (isCurvedRow) {
                  // Draw polyline bar through all seats
                  ctx.beginPath();
                  rowSeats.forEach((s, i) => {
                    const [sx, sy] = w2s(s.x, s.y, cam, W, H);
                    i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
                  });
                  ctx.strokeStyle = col + 'bb';
                  ctx.lineWidth = halfT * 2;
                  ctx.lineCap = 'round';
                  ctx.lineJoin = 'round';
                  ctx.stroke();
                } else {
                  ctx.save();
                  ctx.translate((x0 + x1) / 2, (y0 + y1) / 2);
                  ctx.rotate(angle);
                  ctx.beginPath();
                  (ctx as any).roundRect(-lineLen / 2, -halfT, lineLen, halfT * 2, halfT);
                  ctx.fillStyle = col + 'bb';
                  ctx.fill();
                  ctx.restore();
                }
              } else {
                // Thin guide line — polyline if curved, straight if not
                ctx.beginPath();
                if (isCurvedRow) {
                  rowSeats.forEach((s, i) => {
                    const [sx, sy] = w2s(s.x, s.y, cam, W, H);
                    i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
                  });
                } else {
                  ctx.moveTo(x0 - dx2 * ext, y0 - dy2 * ext);
                  ctx.lineTo(x1 + dx2 * ext, y1 + dy2 * ext);
                }
                ctx.strokeStyle = col + '44';
                ctx.lineWidth = Math.max(1, 1.5 * cam.zoom);
                ctx.stroke();
              }

              // Row labels — always outside the bar/line, always visible
              if (cam.zoom >= 0.2) {
                const rowLetter = rowSeats[0].label.replace(/\d+$/, '');
                if (rowLetter) {
                  const labelSize = Math.max(8, Math.min(13, 9 * cam.zoom));
                  ctx.font = `700 ${labelSize}px ${FONT}`;
                  ctx.fillStyle = '#1e293b';
                  ctx.textBaseline = 'middle';
                  // Pad = bar half-thickness + spacing so label is always outside
                  const labelPad = (rs === 'bar' ? halfT : seatR) + 8;
                  ctx.textAlign = 'right';
                  ctx.fillText(rowLetter, x0 - dx2 * labelPad, y0 - dy2 * labelPad);
                  ctx.textAlign = 'left';
                  ctx.fillText(rowLetter, x1 + dx2 * labelPad, y1 + dy2 * labelPad);
                }
              }
            }
          });
          ctx.restore();
        });
      }
    }

    // ── TOP-LEVEL: draw ALL curved rows from layout.rows (always visible) ────
    {
      const curvedRows = layoutRows.filter(r => r.curveCenter && r.curveRadius != null && r.curveA0 != null && r.curveA1 != null);
      if (curvedRows.length > 0) {
        // Group by sectionId to clip each group to its section
        const bySec = new Map<string, typeof curvedRows>();
        curvedRows.forEach(r => {
          if (!bySec.has(r.sectionId)) bySec.set(r.sectionId, []);
          bySec.get(r.sectionId)!.push(r);
        });

        bySec.forEach((rows, sectionId) => {
          const secShape = shapes.find(s => s.id === sectionId);
          // Skip if already drawn inside the arc-section block above
          if (secShape?.arcCenter) return;
          // Skip if section is seats-only mode
          if (secShape?.displayMode === 'seats') return;

          const cat = secShape?.category as string || 'STANDARD';
          const rowCol = TIER_ROW[cat] || '#cbd5e1';

          ctx.save();
          if (secShape && secShape.vertices.length >= 3) {
            ctx.beginPath();
            const [fx, fy] = w2s(secShape.vertices[0][0], secShape.vertices[0][1], cam, W, H);
            ctx.moveTo(fx, fy);
            for (let i = 1; i < secShape.vertices.length; i++) {
              const [px, py] = w2s(secShape.vertices[i][0], secShape.vertices[i][1], cam, W, H);
              ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.clip();
          }

          rows.forEach((row, ri) => {
            const isRowSel = sel.has(row.id);
            const effectiveCol = row.color || rowCol;
            const [ccx, ccy] = w2s(row.curveCenter![0], row.curveCenter![1], cam, W, H);
            const rPx = row.curveRadius! * cam.zoom;
            const a0r = (row.curveA0! * Math.PI) / 180;
            const a1r = (row.curveA1! * Math.PI) / 180;

            // Band thickness from spacing to next row
            let thickness = Math.max(6, 10 * cam.zoom);
            const nextRow = rows[ri + 1];
            if (nextRow?.curveRadius != null) {
              thickness = Math.max(5, Math.min(32, (nextRow.curveRadius - row.curveRadius!) * cam.zoom * 0.9));
            }

            // Filled arc band
            ctx.beginPath();
            ctx.arc(ccx, ccy, rPx, a0r, a1r, a1r < a0r);
            ctx.strokeStyle = effectiveCol;
            ctx.lineWidth = isRowSel ? thickness + 3 : thickness;
            ctx.lineCap = 'butt';
            ctx.stroke();

            // White divider
            ctx.beginPath();
            ctx.arc(ccx, ccy, rPx + thickness / 2, a0r, a1r, a1r < a0r);
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.lineWidth = Math.max(1, cam.zoom * 0.8);
            ctx.stroke();

            // Row label on right side
            if (cam.zoom >= 0.3) {
              const lx2 = ccx + Math.cos(a1r) * rPx + Math.cos(a1r) * (thickness * 0.5 + 6);
              const ly2 = ccy + Math.sin(a1r) * rPx + Math.sin(a1r) * (thickness * 0.5 + 6);
              ctx.font = `500 ${Math.max(6, Math.min(10, 7 * cam.zoom))}px ${FONT}`;
              ctx.fillStyle = isRowSel ? effectiveCol : '#94a3b8';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(row.label, lx2, ly2);
            }

            // Selection glow + handles
            if (isRowSel) {
              ctx.beginPath();
              ctx.arc(ccx, ccy, rPx, a0r, a1r, a1r < a0r);
              ctx.strokeStyle = effectiveCol;
              ctx.lineWidth = thickness + 10;
              ctx.globalAlpha = 0.18;
              ctx.stroke();
              ctx.globalAlpha = 1;

              const ep0x = ccx + Math.cos(a0r) * rPx, ep0y = ccy + Math.sin(a0r) * rPx;
              const ep1x = ccx + Math.cos(a1r) * rPx, ep1y = ccy + Math.sin(a1r) * rPx;
              const amid = (a0r + a1r) / 2;
              const rhx = ccx + Math.cos(amid) * (rPx + 16), rhy = ccy + Math.sin(amid) * (rPx + 16);
              [[ep0x, ep0y, '◂'], [ep1x, ep1y, '▸'], [rhx, rhy, '↕']].forEach(([hx, hy, icon]) => {
                ctx.beginPath();
                ctx.arc(hx as number, hy as number, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 4;
                ctx.fill(); ctx.shadowBlur = 0;
                ctx.strokeStyle = effectiveCol; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = effectiveCol;
                ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(icon as string, hx as number, hy as number);
              });
            }
          });
          ctx.restore();
        });
      }
    }

    // ── Individual seat circles ───────────────────────────────────────────────
    {
      const secDisplayMode = new Map(shapes.map(s => [s.id, s.displayMode || 'both']));
      const shapeIds = new Set(shapes.map(s => s.id));

      const LOD_ROWS_ONLY  = 0.6;
      const LOD_SEATS_ONLY = 1.0;

      const showSeats = secMode
        || cam.zoom >= LOD_ROWS_ONLY
        || seats.some(s => {
          const dm = shapeIds.has(s.sectionId)
            ? (secDisplayMode.get(s.sectionId) || 'both')
            : (orphanDMRef.current[s.sectionId] || 'both');
          return dm === 'seats';
        });

      if (showSeats) {
        // Pre-compute per-row world spacing so radius never causes overlap
        const rowSpacingMap = new Map<string, number>();
        const rowGroups = new Map<string, typeof seats>();
        seats.forEach(s => {
          const key = s.rowId || s.sectionId;
          if (!rowGroups.has(key)) rowGroups.set(key, []);
          rowGroups.get(key)!.push(s);
        });
        rowGroups.forEach((rs, key) => {
          if (rs.length < 2) { rowSpacingMap.set(key, 14); return; }
          const sorted = [...rs].sort((a, b) => a.number - b.number);
          const dx = sorted[1].x - sorted[0].x, dy = sorted[1].y - sorted[0].y;
          rowSpacingMap.set(key, Math.hypot(dx, dy));
        });

        const showNumber = cam.zoom >= LOD_SEATS_ONLY;
        const margin = 12;

        seats.forEach(s => {
          if (secMode && s.sectionId !== secMode) return;
          const isOrphan = !shapeIds.has(s.sectionId);
          const dm = isOrphan
            ? (orphanDMRef.current[s.sectionId] || 'both')
            : (secDisplayMode.get(s.sectionId) || 'both');

          if (dm === 'rows' && !secMode) return;
          if (dm === 'both' && !secMode && cam.zoom < LOD_ROWS_ONLY) return;

          const [px, py] = w2s(s.x, s.y, cam, W, H);
          if (px < -margin || px > W + margin || py < -margin || py > H + margin) return;

          const worldSpacing = rowSpacingMap.get(s.rowId || s.sectionId) ?? 14;
          const r = Math.max(3, Math.min(10, worldSpacing * cam.zoom * 0.42));

          const isSel = sel.has(s.id);
          const col = s.color || CAT_COLOR[s.category] || '#64748b';
          const isSold = s.status === 'sold' || s.status === 'locked';
          // In bar mode, render seats as white circles so they're visible against the bar
          const isBarMode = isOrphan && (orphanRSRef.current[s.sectionId] || 'line') === 'bar';

          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = isSel ? '#2563eb' : isSold ? '#94a3b8' : isBarMode ? 'rgba(255,255,255,0.25)' : col + '33';
          ctx.fill();
          ctx.strokeStyle = isSel ? '#1d4ed8' : isSold ? '#64748b' : isBarMode ? 'rgba(255,255,255,0.8)' : col;
          ctx.lineWidth = isSel ? 2 : 1.5;
          ctx.stroke();

          if (showNumber && r >= 5) {
            const fontSize = Math.max(6, Math.min(9, r * 0.85));
            ctx.font = `700 ${fontSize}px ${FONT}`;
            ctx.fillStyle = isSel ? '#fff' : isSold ? '#fff' : isBarMode ? 'rgba(255,255,255,0.9)' : col;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(s.number), px, py);
          }
        });
      }
    }


    if (showLabels && texts) {
      texts.forEach(t => {
      const [px, py] = w2s(t.x, t.y, cam, W, H);
      const isSel = sel.has(t.id);
      ctx.save();
      ctx.font = `bold ${t.fontSize * cam.zoom}px ${FONT}`;
      ctx.fillStyle = isSel ? '#2563eb' : t.color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.text, px, py);
      if (isSel) {
        const m = ctx.measureText(t.text);
        const tw = m.width + 12, th = t.fontSize * cam.zoom + 8;
        ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.5;
        ctx.setLineDash([4,3]); ctx.strokeRect(px-tw/2, py-th/2, tw, th); ctx.setLineDash([]);
      }
      ctx.restore();
      });
    }

    // ── Draw preview ─────────────────────────────────────────────────────────
    const { tool, pts, mouse, rectStart, arcRowCenter: arcC, arcRowRadius: arcR } = pv;

    if ((tool === 'section') && pts.length > 0) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const [fx, fy] = w2s(pts[0][0], pts[0][1], cam, W, H);
      ctx.moveTo(fx, fy);
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = w2s(pts[i][0], pts[i][1], cam, W, H);
        ctx.lineTo(px, py);
      }
      const [mx, my] = w2s(mouse[0], mouse[1], cam, W, H);
      ctx.lineTo(mx, my);
      ctx.stroke();
      const [cx2, cy2] = w2s(pts[0][0], pts[0][1], cam, W, H);
      ctx.beginPath(); ctx.arc(cx2, cy2, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6'; ctx.fill();
      ctx.restore();
    }

    if ((tool === 'rect' || tool === 'block' || tool === 'multirow' || tool === 'seatselect' || tool === 'circle' || tool === 'ellipse' || tool === 'triangle' || tool === 'diamond' || tool === 'pentagon' || tool === 'hexagon' || tool === 'star') && rectStart) {
      const [sx2, sy2] = w2s(rectStart[0], rectStart[1], cam, W, H);
      const [mx, my] = w2s(mouse[0], mouse[1], cam, W, H);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(37,99,235,0.07)';

      if (tool === 'seatselect') {
        ctx.fillStyle = 'rgba(37,99,235,0.08)';
        ctx.fillRect(sx2, sy2, mx - sx2, my - sy2);
        ctx.strokeRect(sx2, sy2, mx - sx2, my - sy2);
      } else if (tool === 'rect' || tool === 'block' || tool === 'multirow') {
        ctx.fillRect(sx2, sy2, mx - sx2, my - sy2);
        ctx.strokeRect(sx2, sy2, mx - sx2, my - sy2);

        // Multirow: draw row lines + count badge
        if (tool === 'multirow') {
          const h = my - sy2;
          const rowSpacing = 14 * cam.zoom;
          const numRows = Math.max(1, Math.floor(Math.abs(h) / rowSpacing));
          ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1;
          for (let r = 0; r < numRows; r++) {
            const ry2 = sy2 + (h > 0 ? r : -r) * rowSpacing + rowSpacing / 2;
            ctx.beginPath(); ctx.moveTo(sx2, ry2); ctx.lineTo(mx, ry2); ctx.stroke();
          }
          // Count badge
          const badgeX = (sx2 + mx) / 2, badgeY = (sy2 + my) / 2;
          ctx.fillStyle = '#fff';
          ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 8;
          roundRect(ctx, badgeX - 36, badgeY - 14, 72, 28, 8);
          ctx.fill(); ctx.shadowBlur = 0;
          ctx.fillStyle = '#1d4ed8';
          ctx.font = `bold ${14}px ${FONT}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(`${numRows} row${numRows !== 1 ? 's' : ''}`, badgeX, badgeY);
        }
      } else {
        // Draw shape preview
        const cx2 = (sx2 + mx) / 2, cy2 = (sy2 + my) / 2;
        const rx2 = Math.abs(mx - sx2) / 2, ry2 = Math.abs(my - sy2) / 2;
        const r2 = Math.max(rx2, ry2);
        let sides = 36;
        if (tool === 'triangle') sides = 3;
        else if (tool === 'diamond') sides = 4;
        else if (tool === 'pentagon') sides = 5;
        else if (tool === 'hexagon') sides = 6;

        if (tool === 'star') {
          const inner = r2 * 0.45;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r3 = i % 2 === 0 ? r2 : inner;
            const a = ((i * 36 - 90) * Math.PI) / 180;
            i === 0 ? ctx.moveTo(cx2 + Math.cos(a)*r3, cy2 + Math.sin(a)*r3) : ctx.lineTo(cx2 + Math.cos(a)*r3, cy2 + Math.sin(a)*r3);
          }
          ctx.closePath();
        } else if (tool === 'ellipse') {
          ctx.beginPath(); ctx.ellipse(cx2, cy2, rx2, ry2, 0, 0, Math.PI * 2);
        } else if (tool === 'circle') {
          ctx.beginPath(); ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
        } else {
          ctx.beginPath();
          for (let i = 0; i < sides; i++) {
            const a = ((i * 360 / sides - 90) * Math.PI) / 180;
            i === 0 ? ctx.moveTo(cx2 + Math.cos(a)*r2, cy2 + Math.sin(a)*r2) : ctx.lineTo(cx2 + Math.cos(a)*r2, cy2 + Math.sin(a)*r2);
          }
          ctx.closePath();
        }
        ctx.fill(); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (tool === 'row' && pts.length > 0) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2;
      ctx.beginPath();
      const [fx, fy] = w2s(pts[0][0], pts[0][1], cam, W, H);
      ctx.moveTo(fx, fy);
      const [mx, my] = w2s(mouse[0], mouse[1], cam, W, H);
      ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.setLineDash([]);
      const dist = Math.hypot(mouse[0] - pts[0][0], mouse[1] - pts[0][1]);
      const count = Math.max(2, Math.floor(dist / 14));
      for (let i = 0; i < count; i++) {
        const t2 = count === 1 ? 0.5 : i / (count - 1);
        const [dx, dy] = w2s(pts[0][0] + t2*(mouse[0]-pts[0][0]), pts[0][1] + t2*(mouse[1]-pts[0][1]), cam, W, H);
        ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981'; ctx.fill();
      }
      ctx.restore();
    }

    // ── Arc row preview ───────────────────────────────────────────────────────
    if (tool === 'arcrow' && arcC) {
      const [ccx, ccy] = w2s(arcC[0], arcC[1], cam, W, H);
      ctx.save();
      // centre dot
      ctx.beginPath(); ctx.arc(ccx, ccy, 5, 0, Math.PI*2);
      ctx.fillStyle = '#f59e0b'; ctx.fill();
      if (arcR) {
        const rPx = arcR * cam.zoom;
        // radius circle guide
        ctx.beginPath(); ctx.arc(ccx, ccy, rPx, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(245,158,11,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([4,3]); ctx.stroke(); ctx.setLineDash([]);
        // arc from a0 to mouse
        const [mx2, my2] = w2s(mouse[0], mouse[1], cam, W, H);
        const a0 = Math.atan2(ccy - ccx, ccy - ccy); // placeholder
        const a1 = Math.atan2(my2 - ccy, mx2 - ccx);
        const a0r = Math.atan2((arcC[1] - arcC[1]), 0); // will be set from arcRowA0
        ctx.beginPath(); ctx.arc(ccx, ccy, rPx, 0, a1);
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
        // preview dots along arc
        const arcLen = Math.abs(a1) * arcR;
        const cnt = Math.max(2, Math.floor(arcLen / 13));
        for (let i = 0; i < cnt; i++) {
          const ang = (i / (cnt-1)) * a1;
          const [dx, dy] = w2s(arcC[0] + Math.cos(ang)*arcR, arcC[1] + Math.sin(ang)*arcR, cam, W, H);
          ctx.beginPath(); ctx.arc(dx, dy, 3.5, 0, Math.PI*2);
          ctx.fillStyle = '#f59e0b'; ctx.fill();
        }
      } else {
        // show radius line to mouse
        const [mx2, my2] = w2s(mouse[0], mouse[1], cam, W, H);
        ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(mx2, my2);
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5; ctx.setLineDash([4,3]); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // ── Crosshair cursor ─────────────────────────────────────────────────────
    if (tool !== 'select' && tool !== 'pan') {
      const [mx, my] = w2s(mouse[0], mouse[1], cam, W, H);
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx - 10, my); ctx.lineTo(mx + 10, my); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my - 10); ctx.lineTo(mx, my + 10); ctx.stroke();
      ctx.restore();
    }

    // ── Hover Tooltip ────────────────────────────────────────────────────────
    if (tool === 'select' && showSeats) {
      const { seats } = layoutRef.current;
      const hoverSeat = seats.find(s => {
        if (secMode && s.sectionId !== secMode) return false;
        return Math.hypot(s.x - mouse[0], s.y - mouse[1]) <= 10;
      });

      if (hoverSeat) {
        const [mx, my] = w2s(hoverSeat.x, hoverSeat.y, cam, W, H);
        const tooltipStr = `Row ${hoverSeat.label.replace(/\d+$/, '')}, Seat ${hoverSeat.number} ($${hoverSeat.price})`;
        
        ctx.save();
        ctx.font = `600 11px ${FONT}`;
        const tw = ctx.measureText(tooltipStr).width;
        const bw = tw + 16, bh = 24;
        const bx = mx - bw / 2, by = my - bh - 12;

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 10;
        ctx.fillStyle = '#1e293b'; // dark tooltip
        roundRect(ctx, bx, by, bw, bh, 6);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Pointer
        ctx.beginPath();
        ctx.moveTo(mx - 5, by + bh);
        ctx.lineTo(mx + 5, by + bh);
        ctx.lineTo(mx, by + bh + 5);
        ctx.closePath();
        ctx.fill();

        // Text
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tooltipStr, mx, by + bh / 2);
        ctx.restore();
      }
    }
  }, [canvasRef]);

  // Render loop
  useEffect(() => {
    const loop = () => { draw(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!canvasRef.current) return;
      canvasRef.current.width = e.contentRect.width;
      canvasRef.current.height = e.contentRect.height;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasRef, containerRef]);

  // Event wiring
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const getWXY = (e: PointerEvent | MouseEvent): [number, number, number, number] => {
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const cam = camRef.current;
      const [wx, wy] = s2w(sx, sy, cam, canvas.width, canvas.height);
      return [wx, wy, sx, sy];
    };
    const pd = (e: PointerEvent) => { const [wx, wy, sx, sy] = getWXY(e); onPointerDown(wx, wy, sx, sy, e); };
    const pm = (e: PointerEvent) => { const [wx, wy, sx, sy] = getWXY(e); onPointerMove(wx, wy, sx, sy, e); };
    const pu = (e: PointerEvent) => { const [wx, wy] = getWXY(e); onPointerUp(wx, wy, e); };
    const dc = (e: MouseEvent) => { const [wx, wy] = getWXY(e); onDblClick(wx, wy); };
    canvas.addEventListener('pointerdown', pd);
    canvas.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    canvas.addEventListener('dblclick', dc);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    return () => {
      canvas.removeEventListener('pointerdown', pd);
      canvas.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
      canvas.removeEventListener('dblclick', dc);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [canvasRef, onPointerDown, onPointerMove, onPointerUp, onDblClick, onWheel]);

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor, touchAction: 'none' }}
      />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

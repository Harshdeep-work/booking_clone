'use client';
import { useEffect, useRef, useCallback } from 'react';
import type { LayoutState, BShape, BSeat, BText, ToolId } from './builderTypes2';
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
  sectionMode: string | null;   // id of section being edited inside
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
    canvasRef, containerRef, cursor } = props;

  const rafRef = useRef<number | null>(null);
  const layoutRef = useRef(layout);
  const camRef = useRef(camera);
  const previewRef = useRef(preview);
  const selRef = useRef(selectedIds);
  const secModeRef = useRef(sectionMode);
  const bgRef = useRef(bgImage);
  const bgOpRef = useRef(bgOpacity);

  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => { camRef.current = camera; }, [camera]);
  useEffect(() => { previewRef.current = preview; }, [preview]);
  useEffect(() => { selRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { secModeRef.current = sectionMode; }, [sectionMode]);
  useEffect(() => { bgRef.current = bgImage; }, [bgImage]);
  useEffect(() => { bgOpRef.current = bgOpacity; }, [bgOpacity]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const cam = camRef.current;
    const { shapes, seats, texts } = layoutRef.current;
    const sel = selRef.current;
    const secMode = secModeRef.current;
    const pv = previewRef.current;

    ctx.clearRect(0, 0, W, H);

    // ── White background (TickPick style) ─────────────────────────────────────
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, W, H);

    // ── Reference image ───────────────────────────────────────────────────────
    if (bgRef.current) {
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
      const fillCol = customFill || TIER_FILL[cat] || '#e2e8f0';
      const strokeCol = isSel ? '#2563eb' : (customFill ? darken(customFill, 0.25) : (TIER_STROKE[cat] || '#94a3b8'));
      const rowCol    = TIER_ROW[cat] || '#cbd5e1';

      // Section fill
      ctx.fillStyle = fillCol;
      ctx.fill();

      // ── Row stripes inside section (TickPick's key visual) ────────────────
      // Get rows for this section, draw as horizontal-ish stripes clipped to shape
      if (secSeats.length > 0 && cam.zoom > 0.4) {
        // Group by rowId
        const rowMap = new Map<string, typeof secSeats>();
        secSeats.forEach(s => {
          if (!rowMap.has(s.rowId)) rowMap.set(s.rowId, []);
          rowMap.get(s.rowId)!.push(s);
        });
        const rowIds = [...rowMap.keys()];
        const totalRows = rowIds.length;

        if (totalRows > 1) {
          ctx.save();
          // Clip to section shape
          ctx.beginPath();
          const [fx2, fy2] = w2s(vs[0][0], vs[0][1], cam, W, H);
          ctx.moveTo(fx2, fy2);
          for (let i = 1; i < vs.length; i++) {
            const [px, py] = w2s(vs[i][0], vs[i][1], cam, W, H);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.clip();

          // Draw alternating row stripes
          rowIds.forEach((rowId, ri) => {
            const rowSeats = rowMap.get(rowId)!;
            if (rowSeats.length < 2) return;
            // Sort seats by angle/position
            rowSeats.sort((a, b) => a.number - b.number);
            const screenPts = rowSeats.map(s => w2s(s.x, s.y, cam, W, H));

            // Compute row thickness from adjacent rows
            const nextRowId = rowIds[ri + 1];
            const prevRowId = rowIds[ri - 1];
            let thickness = 6 * cam.zoom;
            if (nextRowId) {
              const nextSeats = rowMap.get(nextRowId)!;
              if (nextSeats.length > 0) {
                const [nx, ny] = w2s(nextSeats[0].x, nextSeats[0].y, cam, W, H);
                const [cx3, cy3] = w2s(rowSeats[0].x, rowSeats[0].y, cam, W, H);
                thickness = Math.max(3, Math.min(20, Math.hypot(nx-cx3, ny-cy3) * 0.85));
              }
            }

            // Draw row as a thick polyline (stroke)
            ctx.beginPath();
            ctx.moveTo(screenPts[0][0], screenPts[0][1]);
            for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i][0], screenPts[i][1]);
            ctx.strokeStyle = rowCol;
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';
            ctx.stroke();

            // White separator line between rows
            if (cam.zoom > 0.6) {
              ctx.strokeStyle = 'rgba(255,255,255,0.6)';
              ctx.lineWidth = Math.max(0.5, 0.8 * cam.zoom);
              ctx.stroke();
            }
          });
          ctx.restore();
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
        if (minP !== Infinity && minP > 0 && cam.zoom > 0.35) {
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
          ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI*2);
          ctx.fillStyle = '#fff'; ctx.fill();
          ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2;
          ctx.stroke();
        });
      }
    });

    // ── Row labels at edge of each row (BookMyShow style) ─────────────────────
    if (cam.zoom >= 0.8) {
      const rowMap = new Map<string, { x: number; y: number; rowLabel: string; number: number }[]>();
      seats.forEach(s => {
        if (!s.rowId) return;
        if (!rowMap.has(s.rowId)) rowMap.set(s.rowId, []);
        rowMap.get(s.rowId)!.push({
          x: s.x, y: s.y,
          rowLabel: s.label.replace(/\d+$/, ''),
          number: s.number,
        });
      });

      const fontSize = Math.max(7, Math.min(13, 9 * cam.zoom));
      ctx.save();
      rowMap.forEach((pts) => {
        if (pts.length === 0) return;
        pts.sort((a, b) => a.x - b.x);
        const leftSeat  = pts[0];
        const rightSeat = pts[pts.length - 1];
        const rowLetter = leftSeat.rowLabel;
        if (!rowLetter) return;

        const [lx, ly] = w2s(leftSeat.x,  leftSeat.y,  cam, W, H);
        const [rx]     = w2s(rightSeat.x, rightSeat.y, cam, W, H);
        const pad = Math.max(10, 14 * cam.zoom);

        ctx.font = `700 ${fontSize}px ${FONT}`;
        ctx.fillStyle = '#64748b';
        ctx.textBaseline = 'middle';

        // Left label
        ctx.textAlign = 'right';
        ctx.fillText(rowLetter, lx - pad * 0.35, ly);

        // Right label
        ctx.textAlign = 'left';
        ctx.fillText(rowLetter, rx + pad * 0.35, ly);
      });
      ctx.restore();
    }

    // ── Individual seat circles (shown in section-edit mode or at zoom ≥ 1.5) ───
    {
      const showSeats = secMode || cam.zoom >= 1.5;
      if (showSeats) {
        const r = Math.max(3.5, Math.min(12, 7 * cam.zoom));
        const fontSize = Math.max(5, Math.min(10, 6.5 * cam.zoom));
        seats.forEach(s => {
          if (secMode && s.sectionId !== secMode) return;
          const [px, py] = w2s(s.x, s.y, cam, W, H);
          const isSel = sel.has(s.id);
          const col = CAT_COLOR[s.category] || '#64748b';
          const isSold = s.status === 'sold' || s.status === 'locked';
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          // Fill
          if (isSel) {
            ctx.fillStyle = '#2563eb';
          } else if (isSold) {
            ctx.fillStyle = '#94a3b8';
          } else {
            ctx.fillStyle = col + '40';
          }
          ctx.fill();
          // Stroke
          ctx.strokeStyle = isSel ? '#1d4ed8' : (isSold ? '#64748b' : col);
          ctx.lineWidth = isSel ? 2 : 1.2;
          ctx.stroke();
          // Seat number label
          if (r >= 6) {
            ctx.font = `600 ${fontSize}px Inter,sans-serif`;
            ctx.fillStyle = isSel ? '#fff' : (isSold ? '#fff' : col);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(s.number), px, py);
          }
          ctx.restore();
        });
      }
    }


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

    if ((tool === 'rect' || tool === 'block' || tool === 'multirow' || tool === 'circle' || tool === 'ellipse' || tool === 'triangle' || tool === 'diamond' || tool === 'pentagon' || tool === 'hexagon' || tool === 'star') && rectStart) {
      const [sx2, sy2] = w2s(rectStart[0], rectStart[1], cam, W, H);
      const [mx, my] = w2s(mouse[0], mouse[1], cam, W, H);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(37,99,235,0.07)';

      if (tool === 'rect' || tool === 'block' || tool === 'multirow') {
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
    if (tool === 'select') {
      const { seats } = layoutRef.current;
      const hoverSeat = seats.find(s => {
        if (secMode && s.sectionId !== secMode) return false;
        return Math.hypot(s.x - mouse[0], s.y - mouse[1]) <= 8 / cam.zoom;
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

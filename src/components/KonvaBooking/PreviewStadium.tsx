'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { unpackLayout } from '../../utils/stadiumOptimizer';
import { loadPreviewLayout } from '../../utils/previewStorage';
import type { LayoutState, BShape, BSeat } from '../Admin/builderTypes2';
import { CAT_COLOR } from '../Admin/builderTypes2';

interface Cam { x: number; y: number; zoom: number }
interface Tooltip { px: number; py: number; seat: BSeat; shape: BShape | null }
interface Props { selectedIds: Set<string>; onSeatToggle: (s: BSeat) => void; onShapeClick?: (s: BShape) => void }

const TIER_GLOW: Record<string, string> = {
  VIP: '#a855f7', PREMIUM: '#f59e0b', STANDARD: '#3b82f6',
  BUDGET: '#06b6d4', GA: '#10b981',
};

export default function PreviewStadium({ selectedIds, onSeatToggle, onShapeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [size, setSize]     = useState({ w: 0, h: 0 });
  const [layout, setLayout] = useState<LayoutState | null>(null);
  const [cam, setCam]       = useState<Cam>({ x: 0, y: 0, zoom: 1 });
  const [tooltip, setTooltip]   = useState<Tooltip | null>(null);
  const [hovSeat, setHovSeat]   = useState<string | null>(null);
  const [hovShape, setHovShape] = useState<string | null>(null);
  const [focusedShape, setFocusedShape] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const isPanning = useRef(false);
  const panStart  = useRef({ mx: 0, my: 0, cx: 0, cy: 0 });
  const layoutRef = useRef<LayoutState | null>(null);

  // ── Resize ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Load localStorage ─────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await loadPreviewLayout();
        if (!raw || !active) return;
        const l = unpackLayout(raw);
        layoutRef.current = l;
        setLayout(l);
      } catch (e) { console.error('PreviewStadium load error', e); }
    })();
    return () => { active = false; };
  }, []);

  // ── Auto-fit (runs when BOTH layout AND real size are known) ──────────────
  const fitLayout = useCallback((l: LayoutState, w: number, h: number) => {
    if (!l || w === 0 || h === 0) return;
    const xs: number[] = [], ys: number[] = [];
    // Primary: use polygon vertices
    l.shapes.forEach(s => {
      if (s.vertices && s.vertices.length > 0) {
        s.vertices.forEach(([x, y]) => { xs.push(x); ys.push(y); });
      } else if (s.cx != null && s.cy != null) {
        xs.push(s.cx - 50); xs.push(s.cx + 50);
        ys.push(s.cy - 50); ys.push(s.cy + 50);
      }
    });
    l.seats.forEach(s => {
      if (s.x != null && s.y != null) { xs.push(s.x); ys.push(s.y); }
    });
    if (!xs.length) {
      setCam({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = Math.max(maxX - minX, 1);
    const rangeY = Math.max(maxY - minY, 1);
    // Use 85% of canvas so venue fills the view — NO max cap
    const zoomX = (w * 0.85) / rangeX;
    const zoomY = (h * 0.85) / rangeY;
    const finalZoom = Math.min(zoomX, zoomY);
    setCam({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom: Math.max(finalZoom, 0.01) });
  }, []);

  useEffect(() => {
    if (layout && size.w > 0) {
      // Small delay to ensure DOM is fully settled
      const t = setTimeout(() => fitLayout(layout, size.w, size.h), 100);
      return () => clearTimeout(t);
    }
  }, [layout, size.w, size.h, fitLayout]);

  // ── World → SVG ───────────────────────────────────────────────────────────
  const w2s = (wx: number, wy: number, c: Cam, sw: number, sh: number) => ({
    x: sw / 2 + (wx - c.x) * c.zoom,
    y: sh / 2 + (wy - c.y) * c.zoom,
  });

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setCam(c => {
      const newZoom = Math.max(0.03, Math.min(50, c.zoom * factor));
      const wx = c.x + (mx - size.w / 2) / c.zoom;
      const wy = c.y + (my - size.h / 2) / c.zoom;
      return { x: wx - (mx - size.w / 2) / newZoom, y: wy - (my - size.h / 2) / newZoom, zoom: newZoom };
    });
  }, [size.w, size.h]);

  // ── Pan ───────────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    setPanning(true);
    setCam(c => { panStart.current = { mx: e.clientX, my: e.clientY, cx: c.x, cy: c.y }; return c; });
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.mx, dy = e.clientY - panStart.current.my;
    setCam(c => ({ ...c, x: panStart.current.cx - dx / c.zoom, y: panStart.current.cy - dy / c.zoom }));
  }, []);
  const onMouseUp = useCallback(() => {
    isPanning.current = false;
    setPanning(false);
  }, []);

  if (!layout || size.w === 0) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: 13, fontFamily: 'Inter,sans-serif', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏟️</div>
          <div style={{ fontWeight: 700, color: '#4b5563', marginBottom: 6 }}>No venue saved yet</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Go to Admin → design your venue → click &quot;Save for Preview&quot;</div>
        </div>
      </div>
    );
  }

  const shapeMap = new Map(layout.shapes.map(s => [s.id, s]));
  const seatR = Math.max(4, Math.min(12, cam.zoom * 5));
  const showSeats = true;
  const showRowLabels = cam.zoom > 2;

  // Group seats by row for row labels
  const rowFirstSeat = new Map<string, BSeat>();
  if (showRowLabels) {
    layout.seats.forEach(s => {
      const key = `${s.sectionId}__${s.label.replace(/\d+$/, '')}`;
      const cur = rowFirstSeat.get(key);
      if (!cur || s.x < cur.x) rowFirstSeat.set(key, s);
    });
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: '#e8ecf2', overflow: 'hidden' }}>
      <svg
        ref={svgRef}
        width={size.w} height={size.h}
        style={{ display: 'block', userSelect: 'none', cursor: panning ? 'grabbing' : 'grab' }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <defs>
          {layout.shapes.map(sh => {
            const col = sh.color || (CAT_COLOR as any)[sh.category] || '#3b82f6';
            return (
              <radialGradient key={`grad-${sh.id}`} id={`grad-${sh.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={col} stopOpacity="0.5" />
                <stop offset="100%" stopColor={col} stopOpacity="0.15" />
              </radialGradient>
            );
          })}
          <filter id="glow-seat" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-shape" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Sections ── */}
        {layout.shapes.filter(sh => sh.visible !== false).map(sh => {
          const col = sh.color || (CAT_COLOR as any)[sh.category] || '#3b82f6';
          const isHov = hovShape === sh.id;
          const isFocused = focusedShape === sh.id;
          const pts = sh.vertices.map(([wx, wy]) => {
            const p = w2s(wx, wy, cam, size.w, size.h);
            return `${p.x},${p.y}`;
          }).join(' ');
          const lp = w2s(sh.cx, sh.cy, cam, size.w, size.h);
          const sectionSeats = layout.seats.filter(s => s.sectionId === sh.id);
          const available = sectionSeats.filter(s => !s.status || s.status === 'available').length;
          const minPrice = sectionSeats.length ? Math.min(...sectionSeats.map(s => s.price || 0).filter(p => p > 0)) : 0;

          return (
            <g key={sh.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => { setHovShape(sh.id); }}
              onMouseLeave={() => setHovShape(null)}
              onClick={() => { 
                setFocusedShape(isFocused ? null : sh.id); 
                onShapeClick?.(sh);
                if (!isFocused) {
                  setCam(c => ({ ...c, x: sh.cx, y: sh.cy, zoom: Math.max(c.zoom, 2.5) }));
                }
              }}
            >
              {/* Glow halo on hover */}
              {isHov && (
                <polygon points={pts} fill={col} fillOpacity={0.2}
                  filter="url(#glow-shape)" style={{ pointerEvents: 'none' }} />
              )}
              <polygon
                points={pts}
                fill={col}
                fillOpacity={isHov ? 0.55 : isFocused ? 0.5 : 0.25}
                stroke={col}
                strokeWidth={isHov || isFocused ? 3 : 2}
                strokeOpacity={1}
                style={{ transition: 'fill-opacity 0.2s, stroke-width 0.15s' }}
              />
              {/* Section label */}
              <text x={lp.x} y={lp.y - (isHov ? 8 : 0)}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.max(9, Math.min(15, 12 * cam.zoom))}
                fontWeight="800" fill={isHov || isFocused ? '#111827' : col}
                opacity={isHov || isFocused ? 1 : 0.85}
                style={{ fontFamily: 'Inter,sans-serif', pointerEvents: 'none', transition: 'all 0.15s' }}
              >{sh.label}</text>
              {/* Price hint on hover */}
              {isHov && sectionSeats.length > 0 && (
                <text x={lp.x} y={lp.y + Math.max(10, 12 * cam.zoom)}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.max(7, Math.min(11, 9 * cam.zoom))}
                  fontWeight="700" fill="#4b5563"
                  style={{ fontFamily: 'Inter,sans-serif', pointerEvents: 'none' }}
                >{minPrice > 0 ? `from $${minPrice} · ` : ''}{sectionSeats.length} seats</text>
              )}
            </g>
          );
        })}

        {/* ── Seats ── */}
        {showSeats && layout.seats.filter(s => {
          const shape = shapeMap.get(s.sectionId);
          return !shape || shape.visible !== false;
        }).map(seat => {
          const sp = w2s(seat.x, seat.y, cam, size.w, size.h);
          if (sp.x < -20 || sp.x > size.w + 20 || sp.y < -20 || sp.y > size.h + 20) return null;
          const isSelected = selectedIds.has(seat.id);
          const isHov = hovSeat === seat.id;
          const isSold = seat.status === 'sold';
          const isLocked = seat.status === 'locked';
          const isAvailable = !seat.status || seat.status === 'available';
          const col = isSelected ? '#15803d'
            : isSold ? '#d1d5db'
            : isLocked ? '#fbbf24'
            : ((CAT_COLOR as any)[seat.category] || '#3b82f6');
          const r = isHov ? seatR * 1.6 : isSelected ? seatR * 1.3 : seatR;
          return (
            <circle key={seat.id}
              cx={sp.x} cy={sp.y} r={r}
              fill={col}
              fillOpacity={isSold ? 0.45 : 1}
              stroke={isSelected ? '#22c55e' : '#ffffff'}
              strokeWidth={isSelected ? 2.5 : isHov ? 2 : Math.max(1, cam.zoom * 0.5)}
              filter={isSelected || isHov ? 'url(#glow-seat)' : undefined}
              style={{ cursor: (isSold || isLocked) ? 'not-allowed' : 'pointer', transition: 'r 0.1s' }}
              onMouseEnter={e => {
                setHovSeat(seat.id);
                const rect = svgRef.current!.getBoundingClientRect();
                setTooltip({ px: e.clientX - rect.left, py: e.clientY - rect.top, seat, shape: shapeMap.get(seat.sectionId) ?? null });
              }}
              onMouseLeave={() => { setHovSeat(null); setTooltip(null); }}
              onClick={e => { e.stopPropagation(); if (isAvailable) onSeatToggle(seat); }}
            />
          );
        })}

        {/* ── Row labels ── */}
        {showRowLabels && Array.from(rowFirstSeat.entries()).map(([key, seat]) => {
          const shape = shapeMap.get(seat.sectionId);
          if (shape && shape.visible === false) return null;
          const p = w2s(seat.x - 14 / cam.zoom, seat.y, cam, size.w, size.h);
          return (
            <text key={key} x={p.x} y={p.y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.max(6, Math.min(10, 8 * cam.zoom))}
              fontWeight="700" fill="rgba(0,0,0,0.35)"
              style={{ fontFamily: 'Inter,sans-serif', pointerEvents: 'none' }}
            >{seat.label.replace(/\d+$/, '')}</text>
          );
        })}
      </svg>

      {/* ── Seat tooltip ── */}
      <AnimatePresence>
        {tooltip && (
          <motion.div key="tt"
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute',
              left: Math.min(tooltip.px + 16, size.w - 200),
              top: Math.max(tooltip.py - 90, 8),
              pointerEvents: 'none', zIndex: 200,
              background: '#ffffff',
              border: `1px solid ${(CAT_COLOR as any)[tooltip.seat.category] || '#3b82f6'}55`,
              borderRadius: 14, padding: '14px 18px', minWidth: 180,
              boxShadow: `0 10px 30px rgba(0,0,0,0.1), 0 0 0 1px ${(CAT_COLOR as any)[tooltip.seat.category] || '#3b82f6'}22`,
              fontFamily: 'Inter,sans-serif',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              {tooltip.shape?.label ?? 'Section'}
            </div>
            {[
              ['Row',    tooltip.seat.label.replace(/\d+$/, ''), '#111827'],
              ['Seat',   String(tooltip.seat.number), '#111827'],
              ['Tier',   tooltip.seat.category, (CAT_COLOR as any)[tooltip.seat.category] || '#3b82f6'],
              ['Price',  `$${tooltip.seat.price}`, '#15803d'],
              ['Status', tooltip.seat.status, tooltip.seat.status === 'available' ? '#15803d' : tooltip.seat.status === 'locked' ? '#d97706' : '#dc2626'],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: c, textTransform: 'capitalize' }}>{v}</span>
              </div>
            ))}
            {tooltip.seat.status === 'available' && (
              <div style={{ marginTop: 10, padding: '6px 0', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#10b981' }}>
                Click to select
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Seat count badge — top left ── */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        background: '#ffffff', border: '1px solid #e5e7eb',
        borderRadius: 99, padding: '6px 16px', fontSize: 12, fontWeight: 700,
        color: '#111827', fontFamily: 'Inter,sans-serif', pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
        {layout.seats.filter(s => !s.status || s.status === 'available').length.toLocaleString()} seats available
      </div>

      {/* ── Zoom controls — top right (TickPick style) ── */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        display: 'flex', flexDirection: 'column', gap: 2,
        background: '#ffffff', border: '1px solid #d1d5db',
        borderRadius: 10, overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        {[
          { label: '+', action: () => setCam(c => ({ ...c, zoom: Math.min(50, c.zoom * 1.3) })) },
          { label: '−', action: () => setCam(c => ({ ...c, zoom: Math.max(0.03, c.zoom * 0.77) })) },
          { label: '⊙', action: () => layout && fitLayout(layout, size.w, size.h) },
        ].map(({ label, action }, i) => (
          <button key={label} onClick={action} style={{
            width: 38, height: 38,
            border: 'none',
            borderTop: i > 0 ? '1px solid #e5e7eb' : 'none',
            background: '#ffffff',
            color: '#374151', fontSize: label === '⊙' ? 15 : 20, fontWeight: 400,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Inter,sans-serif',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Compact legend — bottom left ── */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: 'rgba(255,255,255,0.95)',
        border: '1px solid #e5e7eb', borderRadius: 10,
        padding: '10px 14px', fontFamily: 'Inter,sans-serif',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: '#9ca3af', marginBottom: 8 }}>Legend</div>
        {[
          { col: '#15803d', label: 'Selected' },
          { col: '#3b82f6', label: 'Available' },
          { col: '#fbbf24', label: 'Locked' },
          { col: '#d1d5db', label: 'Unavailable' },
        ].map(({ col, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
        <div style={{ fontSize: 10, color: '#c4c9d4', marginTop: 6, borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
          Scroll · Drag · Click section
        </div>
      </div>

      {/* ── Zoom hint ── */}
      {!showSeats && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#ffffff',
          border: '1px solid #e5e7eb', borderRadius: 99,
          padding: '8px 20px', fontSize: 12, fontWeight: 600, color: '#4b5563',
          fontFamily: 'Inter,sans-serif', pointerEvents: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          Scroll to zoom in and see individual seats
        </div>
      )}
    </div>
  );
}

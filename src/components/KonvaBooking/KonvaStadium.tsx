'use client';
import { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SECTIONS, TIER_COLOR, TIER_GLOW, generateSeats,
  type Section, type Seat, type Tier,
} from './stadiumData';
import { unpackLayout } from '../../utils/stadiumOptimizer';
import { loadPreviewLayout } from '../../utils/previewStorage';

// ── Constants ─────────────────────────────────────────────────────────────────
const WORLD = 300;          // half-size of world in world units
const SEAT_R = 3.5;         // seat circle radius (world units)
const SEAT_R_HOVER = 5;

const TIER_GRADIENT: Record<Tier, [string, string]> = {
  VIP:      ['#c084fc', '#7e22ce'],
  Premium:  ['#fcd34d', '#b45309'],
  Standard: ['#cbd5e1', '#475569'],
  Budget:   ['#93c5fd', '#1d4ed8'],
};

function deg(d: number) { return (d * Math.PI) / 180; }

function arcPath(
  cx: number, cy: number,
  innerR: number, outerR: number,
  aStart: number, aEnd: number,
  segs = 40,
): string {
  const step = (aEnd - aStart) / segs;
  const pts: string[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = deg(aStart + i * step);
    pts.push(`${cx + Math.cos(a) * outerR},${cy + Math.sin(a) * outerR}`);
  }
  for (let i = segs; i >= 0; i--) {
    const a = deg(aStart + i * step);
    pts.push(`${cx + Math.cos(a) * innerR},${cy + Math.sin(a) * innerR}`);
  }
  return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
}

function labelPos(sec: Section) {
  const r = (sec.innerR + sec.outerR) / 2;
  const a = deg((sec.angleStart + sec.angleEnd) / 2);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Tooltip {
  x: number; y: number;
  section: Section;
}

interface ZoomState {
  level: 1 | 2 | 3;
  sectionId: string | null;
  // viewport transform
  tx: number; ty: number; scale: number;
}

interface Props {
  selectedIds: Set<string>;
  onSeatToggle: (seat: Seat) => void;
  onSectionHover: (sec: Section | null) => void;
}

// ── Seat cache ────────────────────────────────────────────────────────────────
const SEAT_CACHE = new Map<string, Seat[]>();
function getSeats(sec: Section): Seat[] {
  if (!SEAT_CACHE.has(sec.id)) SEAT_CACHE.set(sec.id, generateSeats(sec));
  return SEAT_CACHE.get(sec.id)!;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function KonvaStadium({ selectedIds, onSeatToggle, onSectionHover }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [hoveredSecId, setHoveredSecId] = useState<string | null>(null);
  const [hoveredSeatId, setHoveredSeatId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomState>({ level: 1, sectionId: null, tx: 0, ty: 0, scale: 1 });

  // ── Seat hover tooltip state ───────────────────────────────────────────────
  const [seatTooltip, setSeatTooltip] = useState<{
    x: number; y: number;
    seat: Seat; section: Section;
  } | null>(null);

  // ── Load custom venue from localStorage ───────────────────────────────────
  const [customSections, setCustomSections] = useState<Section[] | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const compact = await loadPreviewLayout();
        if (!compact || !active) return;
        const layout = unpackLayout(compact);
        // Convert builder shapes → Section format for the 2D viewer
        const sections: Section[] = layout.shapes
          .filter(sh => sh.type === 'section' || sh.type === 'ga')
          .map((sh, i) => {
            const shSeats = layout.seats.filter(s => s.sectionId === sh.id);
            const prices = shSeats.map(s => s.price);
            const minPrice = prices.length ? Math.min(...prices) : 0;
            const angleStep = (360 / Math.max(layout.shapes.length, 1));
            return {
              id: sh.id,
              label: sh.label,
              tier: (sh.category as any) || 'Standard',
              innerR: 80 + i * 10,
              outerR: 120 + i * 10,
              angleStart: i * angleStep - 180,
              angleEnd: (i + 1) * angleStep - 180,
              price: minPrice,
              priceMax: minPrice,
              available: shSeats.filter(s => s.status === 'available').length,
              total: shSeats.length,
            } as Section;
          });
        if (sections.length > 0) setCustomSections(sections);
      } catch { /* ignore parse errors */ }
    })();
    return () => { active = false; };
  }, []);

  const activeSections = customSections ?? SECTIONS;

  // pan state
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // resize observer
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // base transform: world → SVG (centre world at SVG centre)
  const baseScale = Math.min(size.w, size.h) / (WORLD * 2 + 40);
  const baseTx = size.w / 2;
  const baseTy = size.h / 2;

  // combined transform
  const tx = baseTx + zoom.tx;
  const ty = baseTy + zoom.ty;
  const sc = baseScale * zoom.scale;

  // world → SVG
  const w2s = useCallback((wx: number, wy: number) => ({
    x: tx + wx * sc,
    y: ty + wy * sc,
  }), [tx, ty, sc]);

  // SVG → world
  const s2w = useCallback((sx: number, sy: number) => ({
    x: (sx - tx) / sc,
    y: (sy - ty) / sc,
  }), [tx, ty, sc]);

  // ── Zoom into section ──────────────────────────────────────────────────────
  const zoomToSection = useCallback((sec: Section) => {
    const r = (sec.innerR + sec.outerR) / 2;
    const a = deg((sec.angleStart + sec.angleEnd) / 2);
    const wx = Math.cos(a) * r;
    const wy = Math.sin(a) * r;
    const targetScale = 5;
    // we want world point (wx,wy) to map to SVG centre
    // tx + wx*sc = size.w/2  →  tx = size.w/2 - wx*sc
    const newTx = size.w / 2 - wx * baseScale * targetScale - baseTx;
    const newTy = size.h / 2 - wy * baseScale * targetScale - baseTy;
    setZoom({ level: 2, sectionId: sec.id, tx: newTx, ty: newTy, scale: targetScale });
  }, [baseScale, baseTx, baseTy, size]);

  const zoomOut = useCallback(() => {
    setZoom({ level: 1, sectionId: null, tx: 0, ty: 0, scale: 1 });
    setHoveredSecId(null);
    setTooltip(null);
  }, []);

  // ── Wheel zoom ─────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom(z => {
      const newScale = Math.max(0.5, Math.min(20, z.scale * factor));
      // zoom toward mouse
      const rect = svgRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      // SVG point relative to current transform
      const wx = (mx - (baseTx + z.tx)) / (baseScale * z.scale);
      const wy = (my - (baseTy + z.ty)) / (baseScale * z.scale);
      const newTx = mx - baseTx - wx * baseScale * newScale;
      const newTy = my - baseTy - wy * baseScale * newScale;
      const level: 1 | 2 | 3 = newScale < 2 ? 1 : newScale < 6 ? 2 : 3;
      return { ...z, scale: newScale, tx: newTx, ty: newTy, level };
    });
  }, [baseScale, baseTx, baseTy]);

  // ── Pan ────────────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, tx: zoomRef.current.tx, ty: zoomRef.current.ty };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setZoom(z => ({ ...z, tx: panStart.current.tx + dx, ty: panStart.current.ty + dy }));
    }
  }, []);

  const onMouseUp = useCallback(() => { isPanning.current = false; }, []);

  // ── Section hover ──────────────────────────────────────────────────────────
  const onSecEnter = useCallback((e: React.MouseEvent, sec: Section) => {
    if (zoom.level >= 3) return;
    setHoveredSecId(sec.id);
    onSectionHover(sec);
    const rect = svgRef.current!.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, section: sec });
  }, [zoom.level, onSectionHover]);

  const onSecLeave = useCallback(() => {
    setHoveredSecId(null);
    onSectionHover(null);
    setTooltip(null);
  }, [onSectionHover]);

  const onSecMouseMove = useCallback((e: React.MouseEvent) => {
    if (!tooltip) return;
    const rect = svgRef.current!.getBoundingClientRect();
    setTooltip(t => t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
  }, [tooltip]);

  const onSecClick = useCallback((sec: Section) => {
    if (zoom.level === 1) zoomToSection(sec);
  }, [zoom.level, zoomToSection]);

  // ── Seat click ─────────────────────────────────────────────────────────────
  const onSeatClick = useCallback((e: React.MouseEvent, seat: Seat) => {
    e.stopPropagation();
    if (seat.status === 'booked') return;
    onSeatToggle(seat);
  }, [onSeatToggle]);

  // ── Visible seats (only when zoomed in) ───────────────────────────────────
  const visibleSeats: Seat[] = [];
  if (zoom.level >= 2 && zoom.sectionId) {
    const sec = activeSections.find(s => s.id === zoom.sectionId);
    if (sec) visibleSeats.push(...getSeats(sec));
  } else if (zoom.level >= 3) {
    activeSections.forEach(sec => visibleSeats.push(...getSeats(sec)));
  }

  const showLabels = zoom.scale < 4;
  const showSections = zoom.level <= 2;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0d1321', cursor: isPanning.current ? 'grabbing' : 'grab' }}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        style={{ display: 'block', userSelect: 'none' }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <defs>
          {/* Radial grid */}
          <radialGradient id="bg-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a2540" />
            <stop offset="100%" stopColor="#0d1321" />
          </radialGradient>
          {/* Tier gradients */}
          {(Object.entries(TIER_GRADIENT) as [Tier, [string, string]][]).map(([tier, [c1, c2]]) => (
            <radialGradient key={tier} id={`grad-${tier}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c1} stopOpacity="0.9" />
              <stop offset="100%" stopColor={c2} stopOpacity="0.7" />
            </radialGradient>
          ))}
          {/* Glow filters */}
          {(Object.keys(TIER_GLOW) as Tier[]).map(tier => (
            <filter key={tier} id={`glow-${tier}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
          <filter id="seat-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width={size.w} height={size.h} fill="url(#bg-grad)" />

        {/* Grid rings */}
        {[80, 130, 180, 230, 280].map(r => (
          <circle key={r} cx={tx} cy={ty} r={r * sc}
            fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
        ))}

        {/* ── Sections ── */}
        <g style={{ transition: 'opacity 0.3s' }} opacity={showSections ? 1 : 0.15}>
          {activeSections.map(sec => {
            const isHov = hoveredSecId === sec.id;
            const isFocused = zoom.sectionId === sec.id;
            const path = arcPath(0, 0, sec.innerR, sec.outerR, sec.angleStart, sec.angleEnd);
            const lp = labelPos(sec);
            const svgLp = w2s(lp.x, lp.y);
            const color = TIER_COLOR[sec.tier];
            const urgency = sec.available <= 5;

            return (
              <g key={sec.id}
                style={{ cursor: zoom.level === 1 ? 'pointer' : 'default' }}
                onMouseEnter={e => onSecEnter(e, sec)}
                onMouseLeave={onSecLeave}
                onMouseMove={onSecMouseMove}
                onClick={() => onSecClick(sec)}
              >
                {/* Glow halo on hover */}
                {isHov && (
                  <path
                    d={path}
                    transform={`translate(${tx},${ty}) scale(${sc})`}
                    fill={TIER_GLOW[sec.tier]}
                    filter={`url(#glow-${sec.tier})`}
                    style={{ transform: `translate(${tx}px,${ty}px) scale(${sc})` }}
                  />
                )}
                <path
                  d={path}
                  transform={`translate(${tx},${ty}) scale(${sc})`}
                  fill={isFocused ? color : `url(#grad-${sec.tier})`}
                  fillOpacity={isHov ? 0.75 : isFocused ? 0.6 : 0.35}
                  stroke={color}
                  strokeWidth={isHov ? 1.5 / sc : 0.8 / sc}
                  strokeOpacity={isHov ? 0.9 : 0.5}
                  style={{
                    transition: 'fill-opacity 0.2s, stroke-width 0.2s',
                    transform: `translate(${tx}px,${ty}px) scale(${isHov ? sc * 1.01 : sc})`,
                  }}
                />
                {/* Section label */}
                {showLabels && (
                  <g style={{ pointerEvents: 'none' }}>
                    <text
                      x={svgLp.x} y={svgLp.y - 4}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.max(8, Math.min(13, 11 * sc))}
                      fontWeight="700"
                      fill={isHov ? '#fff' : color}
                      opacity={isHov ? 1 : 0.85}
                      style={{ fontFamily: 'Inter,sans-serif', transition: 'opacity 0.2s' }}
                    >
                      {sec.label}
                    </text>
                    <text
                      x={svgLp.x} y={svgLp.y + 10}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.max(6, Math.min(10, 9 * sc))}
                      fill={isHov ? '#fff' : 'rgba(255,255,255,0.5)'}
                      style={{ fontFamily: 'Inter,sans-serif' }}
                    >
                      ${sec.price}
                      {urgency ? ' 🔥' : ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* ── Pitch centre ── */}
        <g style={{ pointerEvents: 'none' }}>
          <ellipse cx={tx} cy={ty} rx={45 * sc} ry={30 * sc}
            fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.3)" strokeWidth={1} />
          <ellipse cx={tx} cy={ty} rx={20 * sc} ry={13 * sc}
            fill="none" stroke="rgba(34,197,94,0.2)" strokeWidth={0.8} />
          <line x1={tx} y1={ty - 30 * sc} x2={tx} y2={ty + 30 * sc}
            stroke="rgba(34,197,94,0.15)" strokeWidth={0.8} />
          {zoom.scale < 3 && (
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.max(9, 12 * sc)} fontWeight="700"
              fill="rgba(34,197,94,0.7)"
              style={{ fontFamily: 'Inter,sans-serif', pointerEvents: 'none' }}>
              PITCH
            </text>
          )}
        </g>

        {/* ── Seats (visible when zoomed) ── */}
        {visibleSeats.map(seat => {
          const sp = w2s(seat.x, seat.y);
          const isSelected = selectedIds.has(seat.id);
          const isHov = hoveredSeatId === seat.id;
          const isBooked = seat.status === 'booked';
          const sec = activeSections.find(s => s.id === seat.sectionId)!;
          const r = (isHov ? SEAT_R_HOVER : SEAT_R) * sc;

          let fill = TIER_COLOR[sec.tier];
          if (isSelected) fill = '#10B981';
          else if (isBooked) fill = '#1e293b';

          return (
            <circle
              key={seat.id}
              cx={sp.x} cy={sp.y} r={r}
              fill={fill}
              fillOpacity={isBooked ? 0.4 : isSelected ? 1 : 0.85}
              stroke={isSelected ? '#6ee7b7' : isHov ? '#fff' : 'transparent'}
              strokeWidth={isSelected || isHov ? 1.5 : 0}
              filter={isSelected || isHov ? 'url(#seat-glow)' : undefined}
              style={{
                cursor: isBooked ? 'not-allowed' : 'pointer',
                transition: 'r 0.15s, fill 0.15s',
              }}
              onMouseEnter={(e) => {
                setHoveredSeatId(seat.id);
                const rect = svgRef.current!.getBoundingClientRect();
                setSeatTooltip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  seat,
                  section: sec!,
                });
              }}
              onMouseLeave={() => { setHoveredSeatId(null); setSeatTooltip(null); }}
              onClick={e => onSeatClick(e, seat)}
            />
          );
        })}
      </svg>

      {/* ── Tooltip ── */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              left: tooltip.x + 14,
              top: tooltip.y - 10,
              pointerEvents: 'none',
              zIndex: 30,
            }}
          >
            <TooltipCard section={tooltip.section} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Back button ── */}
      <AnimatePresence>
        {zoom.level >= 2 && (
          <motion.button
            key="back"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={zoomOut}
            style={{
              position: 'absolute', top: 16, left: 16,
              background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
              color: '#e2e8f0', fontSize: 12, fontWeight: 600,
              padding: '7px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 1L3 6l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            All Sections
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Zoom hint ── */}
      <AnimatePresence>
        {zoom.level === 1 && (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100,
              padding: '6px 16px', fontSize: 11, color: '#94a3b8',
              pointerEvents: 'none', whiteSpace: 'nowrap',
            }}
          >
            Click a section to zoom in · Scroll to zoom · Drag to pan
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tier legend ── */}
      <div style={{
        position: 'absolute', bottom: 20, right: 16,
        background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
        padding: '10px 14px',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#4b5563', marginBottom: 8 }}>
          Price Tiers
        </div>
        {(['VIP', 'Premium', 'Standard', 'Budget'] as Tier[]).map(tier => (
          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: TIER_COLOR[tier] }} />
            <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{tier}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8, paddingTop: 8 }}>
          {[
            { color: '#10B981', label: 'Selected' },
            { color: '#1e293b', label: 'Booked', border: '1px solid #334155' },
          ].map(({ color, label, border }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border }} />
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Seat hover tooltip ── */}
      <AnimatePresence>
        {seatTooltip && (
          <motion.div
            key="seat-tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute',
              left: seatTooltip.x + 14,
              top: seatTooltip.y - 10,
              pointerEvents: 'none',
              zIndex: 100,
              background: 'rgba(8,12,24,0.97)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${TIER_COLOR[seatTooltip.section.tier]}44`,
              borderRadius: 10,
              padding: '10px 14px',
              minWidth: 160,
              boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
              fontFamily: 'Inter,Outfit,sans-serif',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
              {seatTooltip.section.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11 }}>
              <span style={{ color: '#64748b' }}>Row</span>
              <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{seatTooltip.seat.row}</span>
              <span style={{ color: '#64748b' }}>Seat</span>
              <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{seatTooltip.seat.number}</span>
              <span style={{ color: '#64748b' }}>Tier</span>
              <span style={{ color: TIER_COLOR[seatTooltip.section.tier], fontWeight: 700 }}>{seatTooltip.section.tier}</span>
              <span style={{ color: '#64748b' }}>Price</span>
              <span style={{ color: '#10b981', fontWeight: 800 }}>${seatTooltip.seat.price}</span>
              <span style={{ color: '#64748b' }}>Status</span>
              <span style={{ color: seatTooltip.seat.status === 'booked' ? '#ef4444' : '#10b981', fontWeight: 700, textTransform: 'capitalize' }}>
                {seatTooltip.seat.status}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tooltip card ──────────────────────────────────────────────────────────────
function TooltipCard({ section: sec }: { section: Section }) {
  const urgency = sec.available <= 5;
  const selling = sec.available <= 15 && sec.available > 5;
  const color = TIER_COLOR[sec.tier];

  return (
    <div style={{
      background: 'rgba(10,14,26,0.97)', backdropFilter: 'blur(20px)',
      border: `1px solid ${color}44`,
      borderRadius: 12, padding: '12px 16px', minWidth: 200,
      boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px ${color}22`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
            {sec.tier}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
            Section {sec.label}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color }}>
            ${sec.price}
          </div>
          <div style={{ fontSize: 10, color: '#4b5563' }}>from</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: urgency ? '#ef4444' : selling ? '#f59e0b' : '#10b981',
          background: urgency ? 'rgba(239,68,68,0.1)' : selling ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${urgency ? 'rgba(239,68,68,0.3)' : selling ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
          borderRadius: 99, padding: '2px 8px',
        }}>
          {urgency ? `🔥 Only ${sec.available} left!` : selling ? `⚡ Selling fast` : `✓ ${sec.available} available`}
        </div>
        <div style={{ fontSize: 11, color: '#4b5563' }}>
          of {sec.total}
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: '#4b5563' }}>
        Click to zoom in and select seats
      </div>
    </div>
  );
}

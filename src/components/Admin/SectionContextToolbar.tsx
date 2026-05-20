'use client';
/**
 * SectionContextToolbar — Floating action bar that appears above a selected
 * section on the canvas, offering quick insert / edit operations.
 * Inspired by Figma's context toolbar on selection.
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CAT_COLOR, type Category, type BShape } from './builderTypes2';

interface Props {
  shape: BShape;
  camera: { x: number; y: number; zoom: number };
  containerRect: DOMRect | null;
  /* actions */
  onFillSection: () => void;
  onAddRow: (sectionId: string, rowLabel: string, seatCount: number, price: number, category: Category) => void;
  onSplitSection: (shapeId: string, axis: 'h' | 'v') => void;
  onDblClickSection: () => void;                    // enters section-edit mode
  onDelete: () => void;
  onSetDisplayMode: (sectionId: string, mode: 'rows' | 'seats' | 'both') => void;
  onAutoBalance: (sectionId: string) => void;
  seatCount: number;     // seats already inside this section
  rowCount: number;      // rows inside
}

/* World → screen for the toolbar position */
function w2s(wx: number, wy: number, cam: { x: number; y: number; zoom: number }, W: number, H: number): [number, number] {
  return [(wx - cam.x) * cam.zoom + W / 2, (wy - cam.y) * cam.zoom + H / 2];
}

/* ── Action definitions ─────────────────────────────────────────────────── */
interface Action {
  id: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  dividerAfter?: boolean;
}

/* ── Quick-add row mini-form ────────────────────────────────────────────── */
function QuickAddRowForm({ sectionId, onAdd, onClose }: {
  sectionId: string;
  onAdd: (sectionId: string, label: string, seats: number, price: number, cat: Category) => void;
  onClose: () => void;
}) {
  const [seats, setSeats] = useState(12);
  const [price, setPrice] = useState(100);
  const [label, setLabel] = useState('A');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
        marginTop: 10, background: '#fff', border: '1px solid #e2e8f0',
        borderRadius: 14, padding: '16px 18px', width: 260,
        boxShadow: '0 12px 40px rgba(0,0,0,0.16)', zIndex: 1000,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
        Quick Add Row
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div>
          <label style={qLBL}>Row</label>
          <input style={qINP} value={label} onChange={e => setLabel(e.target.value)} maxLength={3} />
        </div>
        <div>
          <label style={qLBL}>Seats</label>
          <input style={qINP} type="number" min={1} max={100} value={seats} onChange={e => setSeats(+e.target.value)} />
        </div>
        <div>
          <label style={qLBL}>Price</label>
          <input style={qINP} type="number" min={0} value={price} onChange={e => setPrice(+e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => { onAdd(sectionId, label, seats, price, 'STANDARD'); onClose(); }}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
            background: '#0f172a', color: '#fff',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >Add Row</button>
        <button
          onClick={onClose}
          style={{
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid #e2e8f0', background: '#fff',
            color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >✕</button>
      </div>
    </motion.div>
  );
}

const qLBL: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 };
const qINP: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 7,
  border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a',
  fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

/* ── Main component ─────────────────────────────────────────────────────── */
export default function SectionContextToolbar({
  shape, camera, containerRect,
  onFillSection, onAddRow, onSplitSection, onDblClickSection,
  onDelete, onSetDisplayMode, onAutoBalance,
  seatCount, rowCount,
}: Props) {
  const [showAddRow, setShowAddRow] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!containerRect) return null;

  // Compute screen position — center-top of section bounding box
  const vs = shape.vertices;
  const minX = Math.min(...vs.map(v => v[0]));
  const maxX = Math.max(...vs.map(v => v[0]));
  const minY = Math.min(...vs.map(v => v[1]));
  const cx = (minX + maxX) / 2;
  const [sx, sy] = w2s(cx, minY, camera, containerRect.width, containerRect.height);

  // Clamp to viewport
  const toolbarW = 420;
  const clampedX = Math.max(toolbarW / 2 + 10, Math.min(containerRect.width - toolbarW / 2 - 10, sx));
  const clampedY = Math.max(60, sy - 52);

  const catColor = CAT_COLOR[shape.category] || '#94a3b8';

  const actions: Action[] = [
    {
      id: 'addRow',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
      label: 'Add Row',
      color: '#0f172a',
      onClick: () => setShowAddRow(true),
    },
    {
      id: 'fillSeats',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
          <circle cx="4.5" cy="4.5" r="1" fill="currentColor"/>
          <circle cx="7" cy="4.5" r="1" fill="currentColor"/>
          <circle cx="9.5" cy="4.5" r="1" fill="currentColor"/>
          <circle cx="4.5" cy="7" r="1" fill="currentColor"/>
          <circle cx="7" cy="7" r="1" fill="currentColor"/>
          <circle cx="9.5" cy="7" r="1" fill="currentColor"/>
          <circle cx="4.5" cy="9.5" r="1" fill="currentColor"/>
          <circle cx="7" cy="9.5" r="1" fill="currentColor"/>
          <circle cx="9.5" cy="9.5" r="1" fill="currentColor"/>
        </svg>
      ),
      label: 'Auto-fill',
      color: '#059669',
      onClick: onFillSection,
    },
    {
      id: 'editSection',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        </svg>
      ),
      label: 'Edit Inside',
      color: '#3b82f6',
      onClick: onDblClickSection,
      dividerAfter: true,
    },
    {
      id: 'splitH',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M1 7h12" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
      ),
      label: 'Split H',
      color: '#8b5cf6',
      onClick: () => onSplitSection(shape.id, 'h'),
    },
    {
      id: 'splitV',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M7 1v12" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
      ),
      label: 'Split V',
      color: '#8b5cf6',
      onClick: () => onSplitSection(shape.id, 'v'),
      dividerAfter: true,
    },
    {
      id: 'balance',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7h10M4 4l-2 3 2 3M10 4l2 3-2 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      label: 'Balance',
      color: '#d97706',
      onClick: () => onAutoBalance(shape.id),
    },
    {
      id: 'delete',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M4 4l.5 7a1 1 0 001 1h3a1 1 0 001-1L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      label: 'Delete',
      color: '#ef4444',
      onClick: onDelete,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      style={{
        position: 'absolute',
        left: clampedX,
        top: clampedY,
        transform: 'translate(-50%, -100%)',
        zIndex: 50,
        pointerEvents: 'auto',
      }}
    >
      {/* Info badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        justifyContent: 'center', marginBottom: 6,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
          border: '1px solid #e2e8f0', borderRadius: 99,
          padding: '4px 12px', fontSize: 10, fontWeight: 700,
          color: '#475569', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
          <span style={{ color: '#0f172a' }}>{shape.label || 'Section'}</span>
          <span style={{ color: '#94a3b8' }}>·</span>
          <span>{shape.category}</span>
          {seatCount > 0 && <>
            <span style={{ color: '#94a3b8' }}>·</span>
            <span style={{ color: '#059669' }}>{seatCount} seats</span>
          </>}
          {rowCount > 0 && <>
            <span style={{ color: '#94a3b8' }}>·</span>
            <span style={{ color: '#3b82f6' }}>{rowCount} rows</span>
          </>}
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)',
        border: '1px solid #e2e8f0',
        borderRadius: 14, padding: '4px 6px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
        position: 'relative',
      }}>
        {actions.map(a => (
          <span key={a.id} style={{ display: 'contents' }}>
            <button
              title={a.label}
              onClick={a.onClick}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '6px 10px', borderRadius: 10, border: 'none',
                background: 'transparent', cursor: 'pointer',
                color: a.color, transition: 'all 0.12s',
                minWidth: 44,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = a.color + '10';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {a.icon}
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.2, whiteSpace: 'nowrap' }}>
                {a.label}
              </span>
            </button>
            {a.dividerAfter && (
              <div style={{ width: 1, height: 28, background: '#e2e8f0', flexShrink: 0, margin: '0 2px' }} />
            )}
          </span>
        ))}

        {/* Display mode quick buttons */}
        {seatCount > 0 && (
          <>
            <div style={{ width: 1, height: 28, background: '#e2e8f0', flexShrink: 0, margin: '0 2px' }} />
            <div ref={moreRef} style={{ position: 'relative' }}>
              <button
                title="Display mode"
                onClick={() => setShowMore(!showMore)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '6px 10px', borderRadius: 10, border: 'none',
                  background: showMore ? '#f1f5f9' : 'transparent', cursor: 'pointer',
                  color: '#475569', transition: 'all 0.12s',
                  minWidth: 44,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => { if (!showMore) e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="3" cy="7" r="1.3" fill="currentColor"/>
                  <circle cx="7" cy="7" r="1.3" fill="currentColor"/>
                  <circle cx="11" cy="7" r="1.3" fill="currentColor"/>
                </svg>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.2 }}>View</span>
              </button>

              <AnimatePresence>
                {showMore && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    style={{
                      position: 'absolute', top: '100%', right: 0,
                      marginTop: 6, background: '#fff', border: '1px solid #e2e8f0',
                      borderRadius: 10, padding: 6, width: 140,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1001,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    {([
                      { mode: 'seats' as const, label: '● Seats', desc: 'Show individual seats' },
                      { mode: 'rows' as const, label: '≡ Rows', desc: 'Rows only' },
                      { mode: 'both' as const, label: '⊞ Both', desc: 'Rows + seats on zoom' },
                    ]).map(m => (
                      <button
                        key={m.mode}
                        onClick={() => { onSetDisplayMode(shape.id, m.mode); setShowMore(false); }}
                        style={{
                          width: '100%', padding: '7px 10px', borderRadius: 7,
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          textAlign: 'left', fontSize: 11, fontWeight: 600,
                          color: '#0f172a', transition: 'background 0.1s',
                          display: 'flex', flexDirection: 'column', gap: 1,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span>{m.label}</span>
                        <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500 }}>{m.desc}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* Quick Add Row popup */}
        <AnimatePresence>
          {showAddRow && (
            <QuickAddRowForm
              sectionId={shape.id}
              onAdd={onAddRow}
              onClose={() => setShowAddRow(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Arrow pointer */}
      <div style={{
        width: 0, height: 0,
        borderLeft: '7px solid transparent',
        borderRight: '7px solid transparent',
        borderTop: '7px solid #fff',
        margin: '0 auto',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))',
      }} />
    </motion.div>
  );
}

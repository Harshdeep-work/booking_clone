'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import type { BSeat, BShape } from '../Admin/builderTypes2';
import { CAT_COLOR } from '../Admin/builderTypes2';
import { unpackLayout } from '../../utils/stadiumOptimizer';
import type { LayoutState } from '../Admin/builderTypes2';

const PreviewStadium = dynamic(() => import('./PreviewStadium'), { ssr: false });

interface SelectedSeat extends BSeat { _selected: true }

// ─── Sort types ───────────────────────────────────────────────────────────────
type SortMode = 'deal' | 'price_asc' | 'price_desc' | 'section';

// ─── Right Panel ─────────────────────────────────────────────────────────────
function RightPanel({
  layout, selectedSeats, focusedShape, onRemove, qty, setQty, onSectionClick,
}: {
  layout: LayoutState | null;
  selectedSeats: SelectedSeat[];
  focusedShape: BShape | null;
  onRemove: (id: string) => void;
  qty: number;
  setQty: (n: number) => void;
  onSectionClick: (shape: BShape | null) => void;
}) {
  const [sortMode, setSortMode] = useState<SortMode>('deal');
  const total = selectedSeats.reduce((s, x) => s + x.price, 0);
  const fees  = Math.round(total * 0.12);

  const sectionSeats = layout && focusedShape
    ? layout.seats.filter(s => s.sectionId === focusedShape.id)
    : [];
  const available = sectionSeats.filter(s => !s.status || s.status === 'available');
  const minPrice  = available.length ? Math.min(...available.map(s => s.price || 0).filter(p => p > 0)) : 0;
  const maxPrice  = available.length ? Math.max(...available.map(s => s.price || 0)) : 0;

  const byRow = new Map<string, BSeat[]>();
  available.forEach(s => {
    const row = s.label?.replace(/\d+$/, '') || 'GA';
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row)!.push(s);
  });

  let rows = Array.from(byRow.entries());
  if (sortMode === 'deal')       rows.sort(([, a], [, b]) => Math.min(...a.map(s => s.price)) - Math.min(...b.map(s => s.price)));
  if (sortMode === 'price_asc')  rows.sort(([, a], [, b]) => Math.min(...a.map(s => s.price)) - Math.min(...b.map(s => s.price)));
  if (sortMode === 'price_desc') rows.sort(([, a], [, b]) => Math.min(...b.map(s => s.price)) - Math.min(...a.map(s => s.price)));
  if (sortMode === 'section')    rows.sort(([a], [b]) => a.localeCompare(b));

  // All sections listing (when no section is focused)
  const allSections = layout ? layout.shapes.map(sh => {
    const seats = layout.seats.filter(s => s.sectionId === sh.id && (!s.status || s.status === 'available'));
    const min = seats.length ? Math.min(...seats.map(s => s.price || 0).filter(p => p > 0)) : null;
    return { shape: sh, available: seats.length, minPrice: min };
  }).sort((a, b) => (a.minPrice ?? 9999) - (b.minPrice ?? 9999)) : [];

  return (
    <div style={{
      width: 390, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column',
      background: '#ffffff', borderRight: '1px solid #e5e7eb',
      fontFamily: '"Inter", -apple-system, sans-serif',
      boxShadow: '4px 0 24px rgba(0,0,0,0.05)',
    }}>

      {/* ── Event header ─────────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0', background: '#fff', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#111827', letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 4 }}>
          {layout?.venueName || 'My Venue'} — Booking
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, marginBottom: 16 }}>
          Select seats on the map to view availability
        </div>

        {/* Quantity + sort row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 16 }}>
          {/* Ticket quantity */}
          <div style={{
            display: 'flex', alignItems: 'center', border: '1.5px solid #e5e7eb',
            borderRadius: 10, overflow: 'hidden', background: '#f9fafb',
          }}>
            <button onClick={() => setQty(Math.max(1, qty - 1))} style={{
              width: 36, height: 36, border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: 20, color: '#374151',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300,
            }}>−</button>
            <div style={{ width: 32, textAlign: 'center', fontSize: 15, fontWeight: 800, color: '#111827' }}>{qty}</div>
            <button onClick={() => setQty(Math.min(8, qty + 1))} style={{
              width: 36, height: 36, border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: 20, color: '#374151',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300,
            }}>+</button>
          </div>

          {/* Sort chips */}
          {([
            { key: 'deal',       label: '⭐ Best Deal' },
            { key: 'price_asc',  label: 'Price ↑' },
            { key: 'price_desc', label: 'Price ↓' },
            { key: 'section',    label: 'Section' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setSortMode(key)} style={{
              padding: '6px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: sortMode === key ? '1.5px solid #1d4ed8' : '1.5px solid #e5e7eb',
              background: sortMode === key ? '#eff6ff' : '#ffffff',
              color: sortMode === key ? '#1d4ed8' : '#6b7280',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
        <AnimatePresence mode="wait">
          {!focusedShape ? (
            /* All sections listing */
            <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {allSections.length === 0 ? (
                <div style={{ padding: '48px 32px', textAlign: 'center' }}>
                  <div style={{ fontSize: 56, marginBottom: 20 }}>🏟️</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#111827', marginBottom: 10 }}>No venue saved yet</div>
                  <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 24 }}>
                    Go to the <strong>Builder</strong>, design your venue, then click <strong>"Save for Preview"</strong>
                  </div>
                  <a href="/admin" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '12px 24px', borderRadius: 12,
                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                    color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none',
                    boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
                  }}>Open Builder →</a>
                </div>
              ) : (
                <div style={{ padding: '12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, padding: '8px 4px 10px' }}>
                    {allSections.length} section{allSections.length !== 1 ? 's' : ''} · click to explore
                  </div>
                  {allSections.map(({ shape, available: cnt, minPrice: mp }, i) => {
                    const col = (CAT_COLOR as any)[shape.category] || '#3b82f6';
                    const totalSeats = layout ? layout.seats.filter(s => s.sectionId === shape.id).length : 0;
                    return (
                      <motion.div key={shape.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        onClick={() => onSectionClick(shape)}
                        style={{
                          display: 'flex', alignItems: 'center', padding: '16px 18px',
                          background: '#fff', borderRadius: 14, marginBottom: 8,
                          border: '1.5px solid #f3f4f6', cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        }}
                        whileHover={{ scale: 1.01, boxShadow: '0 6px 20px rgba(0,0,0,0.09)' }}
                      >
                        <div style={{
                          width: 40, height: 40, borderRadius: 10, background: col + '18',
                          border: `2px solid ${col}44`, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', marginRight: 14, flexShrink: 0,
                        }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: col }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>{shape.label}</div>
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                            {cnt > 0 ? cnt : totalSeats} seats · <span style={{ color: col, fontWeight: 700 }}>{shape.category}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: '#111827', letterSpacing: -0.5 }}>
                            {mp !== null && mp > 0 ? `$${mp}` : '—'}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>from/ea</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            /* Section detail — row listings */
            <motion.div key={focusedShape.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

              {/* Section header with back button */}
              <div style={{
                padding: '12px 16px 12px', background: '#fff', borderBottom: '1px solid #f3f4f6',
                position: 'sticky', top: 0, zIndex: 10,
              }}>
                {/* Back button */}
                <button
                  onClick={() => onSectionClick(null as any)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                    cursor: 'pointer', color: '#2563eb', fontSize: 12, fontWeight: 700,
                    padding: '0 0 8px', marginBottom: 4,
                  }}
                >
                  ← All Sections
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#111827', letterSpacing: -0.5 }}>{focusedShape.label}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>
                      {available.length} tickets available
                      {focusedShape.category && (
                        <span style={{
                          marginLeft: 8, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: `${(CAT_COLOR as any)[focusedShape.category] || '#3b82f6'}18`,
                          color: (CAT_COLOR as any)[focusedShape.category] || '#3b82f6',
                        }}>{focusedShape.category}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#15803d', letterSpacing: -1 }}>
                      {minPrice > 0 ? `$${minPrice}` : '—'}
                    </div>
                    {maxPrice > minPrice && (
                      <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>up to ${maxPrice}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row cards */}
              <div style={{ padding: '12px' }}>
                {rows.length === 0 ? (
                  <div style={{
                    padding: 40, textAlign: 'center', background: '#fff',
                    borderRadius: 12, border: '1.5px dashed #e5e7eb', margin: 8,
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🪑</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>No seats available</div>
                    <div style={{ fontSize: 13, color: '#9ca3af' }}>Try another section on the map</div>
                  </div>
                ) : rows.map(([rowLabel, seats], i) => {
                  const rowMin = Math.min(...seats.map(s => s.price));
                  const rowMax = Math.max(...seats.map(s => s.price));
                  const isTopDeal = i === 0 && sortMode === 'deal';
                  return (
                    <motion.div key={rowLabel}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      whileHover={{ scale: 1.01, boxShadow: '0 8px 24px rgba(0,0,0,0.09)' }}
                      style={{
                        display: 'flex', borderRadius: 14, overflow: 'hidden',
                        border: isTopDeal ? '2px solid #16a34a' : '1.5px solid #e5e7eb',
                        background: '#fff', marginBottom: 10, cursor: 'pointer',
                        boxShadow: isTopDeal ? '0 4px 16px rgba(22,163,74,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                      }}
                    >
                      {/* Left color bar */}
                      <div style={{
                        width: 6, flexShrink: 0,
                        background: isTopDeal ? '#16a34a' : i === 1 ? '#3b82f6' : i === 2 ? '#f59e0b' : '#d1d5db',
                      }} />

                      {/* Row info */}
                      <div style={{ flex: 1, padding: '16px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 17, fontWeight: 900, color: '#111827' }}>Row {rowLabel}</span>
                          {isTopDeal && (
                            <span style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                              background: '#dcfce7', color: '#15803d', letterSpacing: 0.3,
                            }}>⭐ BEST DEAL</span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>
                          {seats.length} ticket{seats.length !== 1 ? 's' : ''} ·{' '}
                          Seats {Math.min(...seats.map(s => s.number))}–{Math.max(...seats.map(s => s.number))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                          Instant Download
                        </div>
                      </div>

                      {/* Price */}
                      <div style={{
                        padding: '16px', display: 'flex', flexDirection: 'column',
                        alignItems: 'flex-end', justifyContent: 'center',
                        borderLeft: '1px dashed #f3f4f6', background: '#fafafa', minWidth: 96,
                      }}>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#111827', letterSpacing: -1, lineHeight: 1 }}>
                          ${rowMin}
                        </div>
                        {rowMax > rowMin && (
                          <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>–${rowMax}</div>
                        )}
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>each</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Cart / Checkout ───────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedSeats.length > 0 && (
          <motion.div
            initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            style={{
              padding: '20px', background: '#fff',
              borderTop: '1px solid #e5e7eb',
              boxShadow: '0 -12px 40px rgba(0,0,0,0.08)',
            }}
          >
            {/* Selected seat rows */}
            <div style={{ maxHeight: 140, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedSeats.map(seat => (
                <div key={seat.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
                      Row {seat.label.replace(/\d+$/, '')} · Seat {seat.number}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontWeight: 500 }}>{seat.category}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>${seat.price}</span>
                    <button onClick={() => onRemove(seat.id)} style={{
                      width: 24, height: 24, borderRadius: '50%', border: 'none',
                      background: '#f3f4f6', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', color: '#6b7280',
                      fontSize: 14, lineHeight: 1,
                    }}>×</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px', marginBottom: 14, border: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Subtotal ({selectedSeats.length} tickets)</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>${total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Service Fees</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>${fees}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#111827', letterSpacing: -0.5 }}>${total + fees}</span>
              </div>
            </div>

            {/* Checkout button */}
            <button
              style={{
                width: '100%', padding: '17px 0', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff', fontWeight: 900, fontSize: 17, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(22,163,74,0.3)',
                letterSpacing: 0.2, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(22,163,74,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(22,163,74,0.3)'; }}
            >
              Checkout · {selectedSeats.length} Ticket{selectedSeats.length !== 1 ? 's' : ''}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              100% Buyer Guarantee · Secure Checkout
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function StadiumBooking() {
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);
  const [focusedShape, setFocusedShape]   = useState<BShape | null>(null);
  const [layout, setLayout]               = useState<LayoutState | null>(null);
  const [qty, setQty]                     = useState(2);
  const selectedIds = new Set(selectedSeats.map(s => s.id));

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ticketflow_live_preview');
      if (raw) setLayout(unpackLayout(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);

  const onSeatToggle = useCallback((bseat: BSeat) => {
    setSelectedSeats(prev =>
      prev.some(s => s.id === bseat.id)
        ? prev.filter(s => s.id !== bseat.id)
        : [...prev, { ...bseat, _selected: true as const }]
    );
    if (layout) {
      const shape = layout.shapes.find(s => s.id === bseat.sectionId);
      if (shape) setFocusedShape(shape);
    }
  }, [layout]);

  const onRemove = useCallback((id: string) => {
    setSelectedSeats(prev => prev.filter(s => s.id !== id));
  }, []);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', background: '#f0f2f5' }}>
      {/* ── LEFT: Ticket panel (TickPick-style) ── */}
      <RightPanel
        layout={layout}
        selectedSeats={selectedSeats}
        focusedShape={focusedShape}
        onRemove={onRemove}
        qty={qty}
        setQty={setQty}
        onSectionClick={shape => {
          setFocusedShape(shape);
        }}
      />
      {/* ── RIGHT: Big interactive map ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
        <PreviewStadium
          selectedIds={selectedIds}
          onSeatToggle={onSeatToggle}
          onShapeClick={setFocusedShape}
        />
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TIER_COLOR, type Section, type Seat, type Tier } from './stadiumData';

interface Props {
  hoveredSection: Section | null;
  selectedSeats: Seat[];
  onRemove: (id: string) => void;
}

// Mock ticket listings per section
function getListings(sec: Section) {
  const rows = ['A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R'];
  return Array.from({ length: Math.min(8, Math.max(3, sec.available)) }, (_, i) => ({
    id: `listing-${sec.id}-${i}`,
    row: rows[i % rows.length],
    qty: [1,2,4,6,8][i % 5],
    price: sec.price + Math.round((Math.random() - 0.3) * sec.price * 0.3),
    deal: i === 0 ? 'Budget Deal' : i === 1 ? 'Best Deal' : null,
    img: null, // would be seat view photo
  }));
}

const DEAL_COLOR: Record<string, { bg: string; color: string }> = {
  'Budget Deal': { bg: '#fff0f0', color: '#e11d48' },
  'Best Deal':   { bg: '#f0fdf4', color: '#16a34a' },
};

export default function BookingPanel({ hoveredSection: sec, selectedSeats, onRemove }: Props) {
  const [qty, setQty] = useState(2);
  const [sortBy, setSortBy] = useState<'deal' | 'price' | 'row'>('deal');
  const total = selectedSeats.reduce((s, seat) => s + seat.price, 0);
  const listings = sec ? getListings(sec) : [];

  return (
    <div style={{
      width: 360, height: '100%', display: 'flex', flexDirection: 'column',
      background: '#fff', borderLeft: '1px solid #e5e7eb',
      fontFamily: 'Inter,-apple-system,sans-serif', flexShrink: 0,
    }}>

      {/* ── Event header ── */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="#fff" strokeWidth="1.5"/><path d="M9 5v4l2.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
              Finals: Pistons vs. TBD – Home Game 1
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              Jun 3 @ TBD · Little Caesars Arena, Detroit, MI
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter pills ── */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Qty selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid #e5e7eb', borderRadius: 99, overflow: 'hidden', background: '#fff' }}>
          <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', minWidth: 16, textAlign: 'center' }}>{qty}</span>
          <button onClick={() => setQty(q => Math.min(8, q + 1))} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>

        {/* Sort pills */}
        {(['deal', 'price', 'row'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)} style={{
            padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid',
            borderColor: sortBy === s ? '#2563eb' : '#e5e7eb',
            background: sortBy === s ? '#eff6ff' : '#fff',
            color: sortBy === s ? '#2563eb' : '#6b7280',
            transition: 'all 0.12s',
          }}>
            {s === 'deal' ? 'Best Deals' : s === 'price' ? 'Price ↑' : 'Row'}
          </button>
        ))}

        {sec && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700 }}>
            Section {sec.label}
            <span style={{ cursor: 'pointer', opacity: 0.8, fontSize: 13, lineHeight: 1 }}>×</span>
          </div>
        )}
      </div>

      {/* ── Listings or empty state ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AnimatePresence mode="wait">
          {!sec ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 10, padding: 24 }}>
              <div style={{ fontSize: 36 }}>🏟️</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Select a section</div>
              <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
                Click any section on the map to see available tickets and pricing
              </div>
            </motion.div>
          ) : (
            <motion.div key={sec.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Section summary */}
              <div style={{ padding: '10px 16px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{listings.length}</span> listings in Section {sec.label}
                </span>
                <span style={{ fontSize: 11, color: sec.available <= 5 ? '#ef4444' : '#6b7280', fontWeight: sec.available <= 5 ? 700 : 400 }}>
                  {sec.available <= 5 ? `🔥 Only ${sec.available} left` : `${sec.available} available`}
                </span>
              </div>

              {/* Ticket cards */}
              {listings.map((l, i) => (
                <motion.div key={l.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  style={{
                    margin: '0 12px 8px', borderRadius: 12, border: '1px solid #f3f4f6',
                    background: '#fff', overflow: 'hidden', cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                  }}
                  whileHover={{ boxShadow: '0 4px 16px rgba(0,0,0,0.1)', borderColor: '#d1d5db' }}
                >
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    {/* Seat view thumbnail */}
                    <div style={{
                      width: 100, flexShrink: 0, background: 'linear-gradient(135deg,#1e3a8a,#7c3aed)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 80,
                    }}>
                      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity="0.4">
                        <ellipse cx="20" cy="28" rx="16" ry="8" fill="#fff"/>
                        <rect x="8" y="12" width="24" height="14" rx="2" fill="#fff"/>
                        <rect x="12" y="8" width="16" height="6" rx="1" fill="#fff" opacity="0.6"/>
                      </svg>
                      <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', fontSize: 9, color: '#fff', fontWeight: 700 }}>
                        360°
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                          Section {sec.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          Row {l.row} · {l.qty === 1 ? '1 Ticket' : `1-${l.qty} Tickets`}
                        </div>
                        {l.deal && (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                              background: DEAL_COLOR[l.deal].bg, color: DEAL_COLOR[l.deal].color,
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}>
                              <span style={{ fontSize: 10 }}>{l.deal === 'Best Deal' ? '✓' : '💰'}</span>
                              {l.deal}
                            </span>
                            <span style={{ fontSize: 10, color: '#9ca3af' }}>♿</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price */}
                    <div style={{ padding: '10px 14px 10px 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>
                        ${l.price.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>ea</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Cart / checkout ── */}
      {selectedSeats.length > 0 && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{selectedSeats.length} seat{selectedSeats.length !== 1 ? 's' : ''} selected</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>${total.toLocaleString()}</span>
          </div>
          {/* Selected seats mini list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, maxHeight: 100, overflowY: 'auto' }}>
            {selectedSeats.map(seat => (
              <div key={seat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: '#f9fafb', borderRadius: 7 }}>
                <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>Row {seat.row} · Seat {seat.number}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>${seat.price}</span>
                  <button onClick={() => onRemove(seat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              </div>
            ))}
          </div>
          <button style={{
            width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
            background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1d4ed8')}
            onMouseLeave={e => (e.currentTarget.style.background = '#2563eb')}
          >
            Checkout · ${total.toLocaleString()}
          </button>
          <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>
            No hidden fees · 100% Buyer Guarantee
          </div>
        </div>
      )}
    </div>
  );
}

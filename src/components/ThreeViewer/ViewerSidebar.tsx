'use client';
import { useViewerStore } from '@/store/viewerStore';
import { SECTIONS, CAT_COLOR } from '@/data/stadiumEngine';
import type { Category } from '@/data/stadiumEngine';

const TIER_ORDER: Category[] = ['FIELD', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'GENERAL'];

export default function ViewerSidebar() {
  const { cart, removeFromCart, zoom, hoveredSectionId } = useViewerStore();
  const total = cart.reduce((s, c) => s + c.price, 0);
  const hovSec = SECTIONS.find(s => s.id === hoveredSectionId);

  return (
    <div style={{
      width: 340, background: '#ffffff',
      borderLeft: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif',
      boxShadow: '-2px 0 8px rgba(0,0,0,0.04)',
    }}>

      {/* Section hover panel */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f3f4f6', minHeight: 110 }}>
        {hovSec ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Section</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: -0.5 }}>{hovSec.label}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>from</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: hovSec.color, letterSpacing: -1 }}>${hovSec.minPrice}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'Available', value: hovSec.available, color: '#16a34a' },
                { label: 'Total', value: hovSec.total, color: '#374151' },
                { label: 'Tier', value: hovSec.category.charAt(0) + hovSec.category.slice(1).toLowerCase(), color: hovSec.color },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ flex: 1, background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                </div>
              ))}
            </div>
            {zoom < 3 && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#d1d5db', textAlign: 'center' }}>
                Click section to zoom in and see individual seats
              </div>
            )}
          </>
        ) : (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>MetLife Stadium</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Hover over a section to see pricing and availability</div>
          </div>
        )}
      </div>

      {/* Price tier legend */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Price Tiers</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {TIER_ORDER.map(cat => {
            const secs = SECTIONS.filter(s => s.category === cat);
            const minP = Math.min(...secs.map(s => s.minPrice));
            const maxP = Math.max(...secs.map(s => s.basePrice));
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: CAT_COLOR[cat], flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{cat.charAt(0) + cat.slice(1).toLowerCase()}</span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>${minP} – ${maxP}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart header */}
      <div style={{ padding: '14px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Selected Seats</span>
        {cart.length > 0 && (
          <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 100 }}>{cart.length}</span>
        )}
      </div>

      {/* Cart list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {cart.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="5" width="12" height="9" rx="2" stroke="#d1d5db" strokeWidth="1.4"/><path d="M5 5V4a3 3 0 016 0v1" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </div>
            <span style={{ fontSize: 12, color: '#d1d5db', textAlign: 'center', lineHeight: 1.5 }}>Zoom in and click seats<br/>to add them here</span>
          </div>
        ) : cart.map(seat => (
          <div key={seat.id} style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Row {seat.row} · Seat {seat.number}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                {seat.sectionId.replace('sec-', 'Section ')} · {seat.category.charAt(0) + seat.category.slice(1).toLowerCase()}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>${seat.price}</span>
              <button onClick={() => removeFromCart(seat.id)} style={{ width: 24, height: 24, borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Checkout footer */}
      {cart.length > 0 && (
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Subtotal ({cart.length} seat{cart.length !== 1 ? 's' : ''})</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: -0.5 }}>${total.toLocaleString()}</span>
          </div>
          <button style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4f6ef7,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: 0.2 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            Continue to Checkout
          </button>
          <div style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', marginTop: 8 }}>
            Secure checkout · No hidden fees
          </div>
        </div>
      )}
    </div>
  );
}

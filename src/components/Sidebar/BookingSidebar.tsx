'use client';
import React, { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useSocket } from '@/context/SocketContext';

const CATEGORIES = [
  { id: 'FIELD',    label: 'Field',    color: '#FF6B35' },
  { id: 'PLATINUM', label: 'Platinum', color: '#A855F7' },
  { id: 'GOLD',     label: 'Gold',     color: '#F59E0B' },
  { id: 'SILVER',   label: 'Silver',   color: '#94A3B8' },
  { id: 'BRONZE',   label: 'Bronze',   color: '#D97706' },
  { id: 'GENERAL',  label: 'General',  color: '#3B82F6' },
];

interface BookingSidebarProps {
  eventName: string;
  eventDate: string;
  venue: string;
  userId: string;
  onCategoryFilter?: (category: string | null) => void;
}

export default function BookingSidebar({
  eventName, eventDate, venue, userId, onCategoryFilter,
}: BookingSidebarProps) {
  const { cart, removeSeat, clearCart } = useCart();
  const { status } = useSocket();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const filteredCart = cart.seats.filter((s) => Number(s.price) <= maxPrice);

  const handleCategoryToggle = (id: string) => {
    const next = activeCategory === id ? null : id;
    setActiveCategory(next);
    onCategoryFilter?.(next);
  };

  const handleCheckout = async () => {
    if (!cart.seats.length) return;
    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seat_ids: cart.seats.map((s) => s.seat_id),
          user_id: userId,
          payment_token: 'demo_token_' + Date.now(),
        }),
      });
      if (res.ok) {
        setCheckoutSuccess(true);
        clearCart();
        setTimeout(() => setCheckoutSuccess(false), 4000);
      }
    } catch (e) {
      console.error('Checkout failed:', e);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="sidebar">
      {/* Event info */}
      <div className="sidebar-section" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>{eventName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              📅 {eventDate}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              📍 {venue}
            </div>
          </div>
          <div className={`realtime-badge`} style={{
            color: status === 'connected' ? 'var(--success)' : status === 'connecting' ? 'var(--warning)' : 'var(--danger)',
            background: status === 'connected' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${status === 'connected' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <div className="realtime-dot" style={{
              background: status === 'connected' ? 'var(--success)' : 'var(--danger)',
            }} />
            {status === 'connected' ? 'Live' : status}
          </div>
        </div>
      </div>

      {/* Category filters */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Filter by Category</div>
        <div className="filter-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`pill ${activeCategory === cat.id ? 'active' : ''}`}
              style={{ '--pill-color': cat.color, color: activeCategory === cat.id ? cat.color : undefined } as any}
              onClick={() => handleCategoryToggle(cat.id)}
            >
              <span className="pill-dot" style={{ background: cat.color }} />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Price range slider */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>MAX PRICE</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>${maxPrice}</span>
          </div>
          <input
            type="range"
            min={50}
            max={1000}
            step={25}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Checkout success */}
      {checkoutSuccess && (
        <div className="animate-slide-up" style={{
          margin: '12px',
          padding: '14px',
          background: 'rgba(16,185,129,0.15)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          color: 'var(--success)',
          fontSize: 14,
          fontWeight: 700,
        }}>
          🎉 Tickets confirmed! Check your email.
        </div>
      )}

      {/* Cart */}
      <div className="sidebar-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="sidebar-section-title">Your Seats ({cart.seats.length})</div>
          {cart.seats.length > 0 && (
            <button
              onClick={clearCart}
              style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-scroll">
        {cart.seats.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-icon">🎟️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
              No seats selected
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Click on any section in the map to get started
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 12px' }}>
            {cart.seats.map((seat) => (
              <div key={seat.seat_id} className="cart-seat-row animate-slide-up">
                <div>
                  <div className="cart-seat-label">
                    <span style={{
                      display: 'inline-block',
                      width: 8, height: 8,
                      borderRadius: '50%',
                      background: seat.color,
                      marginRight: 6,
                    }} />
                    {seat.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {seat.seat_id}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="cart-seat-price">${seat.price}</span>
                  <button
                    className="cart-remove-btn"
                    onClick={() => removeSeat(seat.seat_id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Total + Checkout */}
      {cart.seats.length > 0 && (
        <div style={{ padding: '0 12px 16px', flexShrink: 0 }}>
          <div className="cart-total-row">
            <div>
              <div className="cart-total-label">Total ({cart.seats.length} seat{cart.seats.length !== 1 ? 's' : ''})</div>
              <div className="cart-total-amount">${cart.total.toLocaleString()}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
              + taxes & fees
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-checkout"
              onClick={handleCheckout}
              disabled={isCheckingOut}
            >
              {isCheckingOut ? (
                <span className="loading-spinner">⟳</span>
              ) : (
                `Checkout →`
              )}
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            🔒 Seats held for 10 minutes · Secure checkout
          </div>
        </div>
      )}
    </div>
  );
}

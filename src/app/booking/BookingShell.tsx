'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const StadiumBooking = dynamic(() => import('@/components/KonvaBooking'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 52 }}>🏟️</div>
        <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: 14, color: '#6b7280', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>Loading venue…</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  ),
});

export default function BookingShell() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', width: '100vw',
      background: '#f0f2f5',
      fontFamily: '"Inter",-apple-system,sans-serif',
      overflow: 'hidden',
    }}>
      {/* ── Thin top bar (TickPick style) ── */}
      <header style={{
        height: 46, flexShrink: 0, zIndex: 30,
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {/* Left: logo + event */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ fontWeight: 900, fontSize: 14, color: '#111827', letterSpacing: -0.3 }}>TicketFlow</span>
          </Link>
          <div style={{ width: 1, height: 18, background: '#e5e7eb' }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Live Venue Preview</div>
          <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>· Click any section on the map to see tickets</div>
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 700, color: '#15803d',
            padding: '4px 12px', borderRadius: 99, background: '#dcfce7', border: '1px solid #bbf7d0',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
            Live
          </div>
          <Link href="/" style={{
            padding: '5px 13px', borderRadius: 8, background: '#f9fafb',
            border: '1px solid #e5e7eb', color: '#374151',
            fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>← 3D View</Link>
          <Link href="/admin" style={{
            padding: '5px 13px', borderRadius: 8, background: '#eff6ff',
            border: '1px solid #bfdbfe', color: '#1d4ed8',
            fontSize: 12, fontWeight: 700, textDecoration: 'none',
          }}>Builder</Link>
        </div>
      </header>

      {/* ── Full remaining space: ticket panel LEFT + map RIGHT ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, width: '100%', minWidth: 0 }}>
        <StadiumBooking />
      </div>
    </div>
  );
}

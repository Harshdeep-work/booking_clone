'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const StadiumBooking = dynamic(
  () => import('@/components/KonvaBooking'),
  {
    ssr: false,
    loading: () => (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1321' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, border: '2px solid #1e293b', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <span style={{ fontSize: 13, color: '#4b5563', fontFamily: 'Inter,sans-serif' }}>Loading stadium…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ),
  }
);

export default function BookingShell() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1321', fontFamily: 'Inter,-apple-system,sans-serif' }}>
      <header style={{
        height: 56, background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', flexShrink: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, background: 'linear-gradient(135deg,#3b82f6,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: -0.3 }}>
              TicketFlow
            </span>
          </div>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>FIFA World Cup 2026 — Group Stage</div>
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 1 }}>Jun 12, 2026 · MetLife Stadium, East Rutherford NJ</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#10b981', padding: '4px 10px', borderRadius: 99, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
            Live
          </div>
          <Link href="/" style={{ padding: '6px 14px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            3D View
          </Link>
          <Link href="/admin" style={{ padding: '6px 14px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            Admin
          </Link>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <StadiumBooking />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.8); } }
      `}</style>
    </div>
  );
}

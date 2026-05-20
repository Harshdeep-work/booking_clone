'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import ViewerSidebar from '@/components/ThreeViewer/ViewerSidebar';
import { useViewerStore } from '@/store/viewerStore';

const StadiumViewer = dynamic(() => import('@/components/ThreeViewer/StadiumViewer'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 28, height: 28, border: '2px solid #e5e7eb', borderTopColor: '#4f6ef7', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Loading 3D view…</span>
      </div>
    </div>
  ),
});

function ZoomHint() {
  const zoom = useViewerStore(s => s.zoom);
  const msg = zoom < 1.2 ? 'Scroll to zoom in'
    : zoom < 3 ? 'Click a section or keep scrolling to see seats'
    : 'Click seats to select them';
  return (
    <div style={{
      position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)',
      border: '1px solid #e5e7eb', borderRadius: 100,
      padding: '6px 18px', fontSize: 12, color: '#6b7280',
      pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      {msg}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8f9fb; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8f9fb', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif' }}>

        {/* Header */}
        <header style={{ height: 56, background: '#ffffff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0, zIndex: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#4f6ef7,#7c3aed)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#111827', letterSpacing: -0.3 }}>TicketFlow</span>
            </div>
            <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>FIFA World Cup 2026 — Group Stage</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Jun 12, 2026 · MetLife Stadium, East Rutherford NJ</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/admin" style={{ padding: '6px 14px', borderRadius: 7, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              Stadium Builder
            </Link>
          </div>
        </header>

        {/* Body — always 3D viewer */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, position: 'relative', background: '#f0f2f5' }}>
            <StadiumViewer />
            <ZoomHint />
          </div>
          <ViewerSidebar />
        </div>
      </div>
    </>
  );
}

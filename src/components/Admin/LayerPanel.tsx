'use client';
import { type LayerState, type LayerId } from './builderTypes2';

interface Props {
  layers: LayerState[];
  onToggle: (id: LayerId, key: 'visible' | 'locked') => void;
  onClose: () => void;
}

export default function LayerPanel({ layers, onToggle, onClose }: Props) {

  return (
    <div style={{
      width: 220,
      background: 'var(--panel)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)' }}>Layers</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', lineHeight: 1, padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {layers.map(layer => (
          <div key={layer.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 8, marginBottom: 2,
            background: layer.visible ? 'transparent' : 'var(--bg)',
            opacity: layer.visible ? 1 : 0.5,
            transition: 'all 0.12s',
          }}>
            {/* Layer icon */}
            <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', flexShrink: 0 }}>
              {LAYER_ICONS[layer.id]}
            </div>

            {/* Label */}
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>{layer.label}</span>

            {/* Lock */}
            <button
              onClick={() => onToggle(layer.id, 'locked')}
              title={layer.locked ? 'Unlock' : 'Lock'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: layer.locked ? 'var(--accent)' : 'var(--text-3)', padding: 2, lineHeight: 1 }}
            >
              {layer.locked
                ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2" y="6" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 6V4a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                : <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2" y="6" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 6V4a2.5 2.5 0 015 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              }
            </button>

            {/* Visibility */}
            <button
              onClick={() => onToggle(layer.id, 'visible')}
              title={layer.visible ? 'Hide' : 'Show'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: layer.visible ? 'var(--text-2)' : 'var(--text-3)', padding: 2, lineHeight: 1 }}
            >
              {layer.visible
                ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 6.5s2.5-4 5.5-4 5.5 4 5.5 4-2.5 4-5.5 4-5.5-4-5.5-4z" stroke="currentColor" strokeWidth="1.3"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
                : <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M5 3.5A5 5 0 0112 6.5m-2.5 2.5A5 5 0 011 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              }
            </button>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>
        {layers.filter(l => l.visible).length} of {layers.length} layers visible
      </div>
    </div>
  );
}

const LAYER_ICONS: Record<LayerId, React.ReactNode> = {
  sections: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5l5 3v5l-5 3-5-3v-5l5-3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  seats:    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="4" cy="7" r="1.5" fill="currentColor"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/><circle cx="10" cy="7" r="1.5" fill="currentColor"/></svg>,
  labels:   <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M7 4v6M4 10h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  pricing:  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3"/><path d="M7 4v1.5M7 8.5V10M5.5 5.5h2a1 1 0 010 2H6a1 1 0 000 2h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  entrances:<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 7h4M7 5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  overlays: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="4.5" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.5"/></svg>,
};

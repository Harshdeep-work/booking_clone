'use client';
import { motion } from 'framer-motion';

interface Props {
  onDismiss: () => void;
}

const TIPS = [
  { key: 'S', label: 'Draw polygon section', color: '#a855f7' },
  { key: 'R', label: 'Draw rectangle section', color: '#f59e0b' },
  { key: 'W', label: 'Row of seats (click→click)', color: '#10b981' },
  { key: 'A', label: 'Curved arc row', color: '#3b82f6' },
  { key: 'B', label: 'Seat block (drag)', color: '#64748b' },
  { key: 'T', label: 'Text label', color: '#94a3b8' },
];

export default function EmptyState({ onDismiss }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', border: '1px solid #e2e8f0', borderRadius: 20, padding: '32px 36px', maxWidth: 480, width: '90%', boxShadow: '0 24px 48px rgba(0,0,0,0.08)', pointerEvents: 'all', textAlign: 'center' }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏟️</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 6, letterSpacing: -0.5 }}>
          Start building your venue
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          Pick a template from the left panel to start instantly,<br/>or use the tools to draw from scratch.
        </div>

        {/* Keyboard shortcuts grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
          {TIPS.map(t => (
            <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 9, border: '1px solid #f1f5f9', textAlign: 'left' }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: t.color + '18', border: `1.5px solid ${t.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: t.color, flexShrink: 0 }}>{t.key}</span>
              <span style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{t.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { label: 'Scroll', desc: 'Zoom' },
            { label: 'Alt+drag', desc: 'Pan' },
            { label: 'Dbl-click', desc: 'Edit section' },
            { label: 'Del', desc: 'Delete' },
            { label: 'Ctrl+Z', desc: 'Undo' },
          ].map(k => (
            <div key={k.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, padding: '2px 6px', color: '#475569' }}>{k.label}</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{k.desc}</span>
            </div>
          ))}
        </div>

        <button onClick={onDismiss} style={{ padding: '9px 24px', borderRadius: 9, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
          Start Drawing
        </button>
      </motion.div>
    </motion.div>
  );
}

'use client';
import { motion } from 'framer-motion';
import type { ToolId, Category } from './builderTypes2';
import { CAT_COLOR, centroid, ellipseArcPoly, buildNBAArena, type LayoutState, type BShape, type BText } from './builderTypes2';
import { TOOL_GROUPS, icons } from './BuilderIcons';

// ── Shape grid picker (Figma-style) ───────────────────────────────────────────
const SHAPE_TOOLS: { id: ToolId; label: string; key: string; svg: React.ReactNode }[] = [
  { id: 'rect',     label: 'Rectangle', key: 'R',
    svg: <svg viewBox="0 0 40 40" fill="none"><rect x="4" y="10" width="32" height="20" rx="2" stroke="currentColor" strokeWidth="2.5"/></svg> },
  { id: 'circle',   label: 'Circle',    key: 'C',
    svg: <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2.5"/></svg> },
  { id: 'ellipse',  label: 'Ellipse',   key: 'E',
    svg: <svg viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="20" rx="17" ry="10" stroke="currentColor" strokeWidth="2.5"/></svg> },
  { id: 'triangle', label: 'Triangle',  key: '3',
    svg: <svg viewBox="0 0 40 40" fill="none"><path d="M20 5l16 28H4L20 5z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></svg> },
  { id: 'diamond',  label: 'Diamond',   key: 'D',
    svg: <svg viewBox="0 0 40 40" fill="none"><path d="M20 4l16 16-16 16L4 20 20 4z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></svg> },
  { id: 'pentagon', label: 'Pentagon',  key: '5',
    svg: <svg viewBox="0 0 40 40" fill="none"><path d="M20 4l15 11-6 16H11L5 15 20 4z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></svg> },
  { id: 'hexagon',  label: 'Hexagon',   key: '6',
    svg: <svg viewBox="0 0 40 40" fill="none"><path d="M20 4l14 8v16l-14 8-14-8V12L20 4z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></svg> },
  { id: 'star',     label: 'Star',      key: '*',
    svg: <svg viewBox="0 0 40 40" fill="none"><path d="M20 4l4 10 11 1-8 7 2 11-9-5-9 5 2-11-8-7 11-1 4-10z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></svg> },
];

function ShapeGrid({ activeTool, onTool }: { activeTool: ToolId; onTool: (t: ToolId) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '4px 0 12px' }}>
      {SHAPE_TOOLS.map(s => {
        const active = activeTool === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onTool(s.id)}
            title={`${s.label} (${s.key})`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '10px 4px', borderRadius: 12, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              background: active ? 'var(--accent-soft)' : '#fff',
              color: active ? 'var(--accent)' : 'var(--text-2)',
              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', fontFamily: 'inherit',
              boxShadow: active ? '0 4px 12px rgba(99, 102, 241, 0.15)' : 'var(--shadow-sm)',
            }}
            onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; } }}
            onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; } }}
          >
            <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {s.svg}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Shape presets ─────────────────────────────────────────────────────────────
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2,6)}`; }

export interface ShapePreset {
  id: string;
  label: string;
  icon: string;
  description: string;
  build: () => Partial<LayoutState>;
}

// ── Individual insertable shapes ─────────────────────────────────────────────
interface ShapeInsert { id: string; label: string; icon: string; bg: string; border: string; color: string; build: () => Partial<LayoutState> }

const SHAPE_INSERTS: ShapeInsert[] = [
  { id: 'stage',      label: 'Stage',      icon: '🎤', bg: '#f1f5f9', border: '#cbd5e1', color: '#475569',
    build: () => { const v: [number,number][] = [[-80,-25],[80,-25],[80,25],[-80,25]]; return { shapes: [{ id: `stage-${uid()}`, type: 'stage', label: 'STAGE', category: 'GA', color: '#94a3b8', vertices: v, cx: 0, cy: 0 }] }; } },
  { id: 'ga',         label: 'GA Floor',   icon: '🎵', bg: '#f0fdf4', border: '#bbf7d0', color: '#059669',
    build: () => { const v: [number,number][] = [[-60,-40],[60,-40],[60,40],[-60,40]]; return { shapes: [{ id: `ga-${uid()}`, type: 'ga', label: 'GA PIT', category: 'GA', color: '#10b981', vertices: v, cx: 0, cy: 0 }] }; } },
  { id: 'suite',      label: 'Suite',      icon: '🏆', bg: '#fffbeb', border: '#fde68a', color: '#92400e',
    build: () => { const v: [number,number][] = [[-30,-12],[30,-12],[30,12],[-30,12]]; return { shapes: [{ id: `suite-${uid()}`, type: 'suite', label: 'SUITE', category: 'VIP', color: '#d97706', vertices: v, cx: 0, cy: 0 }] }; } },
];

const PRESETS: ShapePreset[] = [
  {
    id: 'nba-arena', label: 'NBA Arena', icon: '🏀',
    description: 'NBA Style Arena — courtside, 100s, 200s',
    build: () => buildNBAArena(),
  },
  {
    id: 'oval-stadium', label: 'Oval Stadium', icon: '⚽',
    description: '4-ring oval stadium, 104 sections',
    build: () => {
      const shapes: BShape[] = [];
      const rings = [
        { innerRx: 55, innerRy: 38, outerRx: 95, outerRy: 68, divs: 20, cat: 'VIP' as Category },
        { innerRx: 98, innerRy: 71, outerRx: 140, outerRy: 103, divs: 24, cat: 'PREMIUM' as Category },
        { innerRx: 143, innerRy: 106, outerRx: 183, outerRy: 138, divs: 28, cat: 'STANDARD' as Category },
        { innerRx: 186, innerRy: 141, outerRx: 224, outerRy: 170, divs: 32, cat: 'BUDGET' as Category },
      ];
      rings.forEach((ring, ri) => {
        const step = 360 / ring.divs;
        for (let i = 0; i < ring.divs; i++) {
          const a0 = i * step - 90, a1 = (i + 1) * step - 90;
          const verts = ellipseArcPoly(0, 0, ring.innerRx, ring.innerRy, ring.outerRx, ring.outerRy, a0, a1, 14);
          const [cx, cy] = [verts.reduce((s, v) => s + v[0], 0) / verts.length, verts.reduce((s, v) => s + v[1], 0) / verts.length];
          const num = (ri + 1) * 100 + i + 1;
          shapes.push({ id: `oval-${num}`, type: 'section', label: `${num}`, category: ring.cat, color: CAT_COLOR[ring.cat], vertices: verts, cx, cy });
        }
      });
      return { shapes };
    },
  },
];

interface Props {
  activeTool: ToolId;
  onTool: (t: ToolId) => void;
  snapOn: boolean;
  onSnap: () => void;
  onInsertPreset: (patch: Partial<LayoutState>) => void;
  onDialog: (d: 'ring' | 'arc' | 'block') => void;
  onOpenAdvanced: (tab: 'tools' | 'spacing' | 'import' | 'validate') => void;
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase',
  letterSpacing: 1, padding: '20px 4px 8px', display: 'block',
};

export default function LeftPanel({ activeTool, onTool, snapOn, onSnap, onInsertPreset, onDialog, onOpenAdvanced }: Props) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: '0 16px 32px' }}>

      {/* ── Tools ── */}
      <div>
        {TOOL_GROUPS.map((group, gi) => (
          <div key={gi}>
            <span style={SECTION_LABEL}>{group.label}</span>

            {/* Shapes group → visual grid picker */}
            {group.label === 'Shapes' ? (
              <ShapeGrid activeTool={activeTool} onTool={onTool} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
                {group.tools.map(t => (
                  <button key={t.id} onClick={() => onTool(t.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 12, border: '1px solid transparent',
                      background: activeTool === t.id ? 'var(--accent-soft)' : 'transparent',
                      color: activeTool === t.id ? 'var(--accent)' : 'var(--text-2)',
                      cursor: 'pointer', fontSize: 13, fontWeight: activeTool === t.id ? 700 : 500,
                      transition: 'all 0.15s', textAlign: 'left', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { if (activeTool !== t.id) { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-sm)'; } }}
                    onMouseLeave={e => { if (activeTool !== t.id) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; } }}
                  >
                    <span style={{ opacity: activeTool === t.id ? 1 : 0.6, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons[t.id]}</span>
                    <span style={{ flex: 1 }}>{t.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: activeTool === t.id ? 'var(--accent)' : 'var(--text-3)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 6 }}>{t.key}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Snap */}
        <button onClick={onSnap}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, border: '1px solid transparent', marginTop: 12, background: snapOn ? 'var(--accent-soft)' : 'transparent', color: snapOn ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', fontSize: 13, fontWeight: snapOn ? 700 : 500, transition: 'all 0.15s', textAlign: 'left', fontFamily: 'inherit' }}
          onMouseEnter={e => { if (!snapOn) { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-sm)'; } }}
          onMouseLeave={e => { if (!snapOn) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; } }}
        >
          <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons.snap}</span>
          <span style={{ flex: 1 }}>Snap to Grid</span>
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'var(--bg)', color: snapOn ? 'var(--accent)' : 'var(--text-3)' }}>{snapOn ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* ── Generate ── */}
      <div style={{ marginTop: 12 }}>
        <span style={SECTION_LABEL}>Generate</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
          <button onClick={() => onOpenAdvanced('tools')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, border: '1px solid transparent', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s', textAlign: 'left', fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-sm)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
          >
            <span style={{ opacity: 0.6, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons.row}</span>
            Rows & Seats
          </button>
          {([
            { icon: 'ring' as const, label: 'Ring Sections', d: 'ring' as const },
            { icon: 'arc' as const,  label: 'Arc Section',   d: 'arc' as const },
            { icon: 'fill' as const, label: 'Seat Block',    d: 'block' as const },
          ]).map(g => (
            <button key={g.d} onClick={() => onDialog(g.d)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, border: '1px solid transparent', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s', textAlign: 'left', fontFamily: 'inherit' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-sm)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
            >
              <span style={{ opacity: 0.6, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons[g.icon]}</span>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Quick Inserts ── */}
      <div style={{ marginTop: 12 }}>
        <span style={SECTION_LABEL}>Quick Inserts</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SHAPE_INSERTS.map(s => (
            <button key={s.id} onClick={() => onInsertPreset(s.build())}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-sm)'; }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 10, background: s.bg, border: `1px solid ${s.border}`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                {s.icon}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Shape Library ── */}
      <div style={{ marginTop: 12, flex: 1 }}>
        <span style={SECTION_LABEL}>Venue Templates</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PRESETS.map(p => (
            <motion.button
              key={p.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onInsertPreset(p.build())}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'}
            >
              <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>{p.icon}</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>{p.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginTop: 1 }}>{p.description}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

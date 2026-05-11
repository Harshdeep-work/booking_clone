'use client';
import { motion } from 'framer-motion';
import type { ToolId, Category } from './builderTypes2';
import { CAT_COLOR, arcPoly, centroid, ellipseArcPoly, buildNBAArena, type LayoutState, type BShape, type BText } from './builderTypes2';

import { TOOL_GROUPS, icons } from './BuilderIcons';

// ── Shape grid picker (Figma-style) ───────────────────────────────────────────
const SHAPE_TOOLS: { id: ToolId; label: string; key: string; svg: React.ReactNode }[] = [
  { id: 'rect',     label: 'Rectangle', key: 'R',
    svg: <svg viewBox="0 0 40 40" fill="none"><rect x="4" y="10" width="32" height="20" rx="2" stroke="currentColor" strokeWidth="2"/></svg> },
  { id: 'circle',   label: 'Circle',    key: 'C',
    svg: <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2"/></svg> },
  { id: 'ellipse',  label: 'Ellipse',   key: 'E',
    svg: <svg viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="20" rx="17" ry="10" stroke="currentColor" strokeWidth="2"/></svg> },
  { id: 'triangle', label: 'Triangle',  key: '3',
    svg: <svg viewBox="0 0 40 40" fill="none"><path d="M20 5l16 28H4L20 5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg> },
  { id: 'diamond',  label: 'Diamond',   key: 'D',
    svg: <svg viewBox="0 0 40 40" fill="none"><path d="M20 4l16 16-16 16L4 20 20 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg> },
  { id: 'pentagon', label: 'Pentagon',  key: '5',
    svg: <svg viewBox="0 0 40 40" fill="none"><path d="M20 4l15 11-6 16H11L5 15 20 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg> },
  { id: 'hexagon',  label: 'Hexagon',   key: '6',
    svg: <svg viewBox="0 0 40 40" fill="none"><path d="M20 4l14 8v16l-14 8-14-8V12L20 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg> },
  { id: 'star',     label: 'Star',      key: '*',
    svg: <svg viewBox="0 0 40 40" fill="none"><path d="M20 4l4 10 11 1-8 7 2 11-9-5-9 5 2-11-8-7 11-1 4-10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg> },
];

function ShapeGrid({ activeTool, onTool }: { activeTool: ToolId; onTool: (t: ToolId) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, padding: '4px 0 8px' }}>
      {SHAPE_TOOLS.map(s => {
        const active = activeTool === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onTool(s.id)}
            title={`${s.label} (${s.key})`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              background: active ? 'var(--accent-soft)' : 'var(--panel)',
              color: active ? 'var(--accent)' : 'var(--text-2)',
              cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
              boxShadow: active ? '0 0 0 3px rgba(201,123,54,0.1)' : 'none',
            }}
            onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--text-3)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'; } }}
            onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--panel)'; } }}
          >
            <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {s.svg}
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.2 }}>{s.label}</span>
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
    build: () => { const v: [number,number][] = [[-60,-40],[60,-40],[60,40],[-60,40]]; return { shapes: [{ id: `ga-${uid()}`, type: 'ga', label: 'GA PIT', category: 'GA', color: CAT_COLOR.GA, vertices: v, cx: 0, cy: 0 }] }; } },
  { id: 'suite',      label: 'Suite',      icon: '🏆', bg: '#fffbeb', border: '#fde68a', color: '#92400e',
    build: () => { const v: [number,number][] = [[-30,-12],[30,-12],[30,12],[-30,12]]; return { shapes: [{ id: `suite-${uid()}`, type: 'suite', label: 'SUITE', category: 'VIP', color: '#d97706', vertices: v, cx: 0, cy: 0 }] }; } },
  { id: 'pressbox',   label: 'Press Box',  icon: '📡', bg: '#f0f9ff', border: '#bae6fd', color: '#0369a1',
    build: () => { const v: [number,number][] = [[-40,-15],[40,-15],[40,15],[-40,15]]; return { shapes: [{ id: `press-${uid()}`, type: 'pressbox', label: 'PRESS', category: 'GA', color: '#0284c7', vertices: v, cx: 0, cy: 0 }] }; } },
  { id: 'scoreboard', label: 'Scoreboard', icon: '📺', bg: '#1e293b', border: '#f59e0b', color: '#fbbf24',
    build: () => { const v: [number,number][] = [[-25,-15],[25,-15],[25,15],[-25,15]]; return { shapes: [{ id: `score-${uid()}`, type: 'scoreboard', label: 'SCORE', category: 'GA', color: '#f59e0b', vertices: v, cx: 0, cy: 0 }] }; } },
  { id: 'tunnel',     label: 'Tunnel',     icon: '🚪', bg: '#f8fafc', border: '#e2e8f0', color: '#64748b',
    build: () => { const v: [number,number][] = [[-15,-20],[15,-20],[15,20],[-15,20]]; return { shapes: [{ id: `tunnel-${uid()}`, type: 'tunnel', label: 'TUNNEL', category: 'GA', color: '#94a3b8', vertices: v, cx: 0, cy: 0 }] }; } },
  { id: 'concourse',  label: 'Concourse',  icon: '🔄', bg: '#f8fafc', border: '#e2e8f0', color: '#94a3b8',
    build: () => { const v: [number,number][] = [[-120,-20],[120,-20],[120,20],[-120,20]]; return { shapes: [{ id: `conc-${uid()}`, type: 'concourse', label: 'CONCOURSE', category: 'GA', color: '#cbd5e1', vertices: v, cx: 0, cy: 0 }] }; } },
  { id: 'ada',        label: 'ADA',        icon: '♿', bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb',
    build: () => { const v: [number,number][] = [[-20,-12],[20,-12],[20,12],[-20,12]]; return { shapes: [{ id: `ada-${uid()}`, type: 'ada', label: 'ADA', category: 'GA', color: '#3b82f6', vertices: v, cx: 0, cy: 0 }] }; } },
  { id: 'vip-box',    label: 'VIP Box',    icon: '⭐', bg: '#faf5ff', border: '#e9d5ff', color: '#7c3aed',
    build: () => { const v: [number,number][] = [[-25,-15],[25,-15],[25,15],[-25,15]]; return { shapes: [{ id: `vip-${uid()}`, type: 'suite', label: 'VIP', category: 'VIP', color: '#a855f7', vertices: v, cx: 0, cy: 0 }] }; } },
  { id: 'section',    label: 'Section',    icon: '⬡', bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb',
    build: () => { const v: [number,number][] = [[-50,-35],[50,-35],[50,35],[-50,35]]; return { shapes: [{ id: `sec-${uid()}`, type: 'section', label: 'SEC', category: 'STANDARD', color: CAT_COLOR.STANDARD, vertices: v, cx: 0, cy: 0 }] }; } },
];

const PRESETS: ShapePreset[] = [
  {
    id: 'nba-arena', label: 'NBA Arena', icon: '🏀',
    description: 'Little Caesars Arena — courtside, 100s, 200s',
    build: () => buildNBAArena(),
  },
  {
    id: 'oval-stadium', label: 'Soccer / Football', icon: '⚽',
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
          const [cx, cy] = centroid(verts);
          const num = (ri + 1) * 100 + i + 1;
          shapes.push({ id: `oval-${num}`, type: 'section', label: `${num}`, category: ring.cat, color: CAT_COLOR[ring.cat], vertices: verts, cx, cy });
        }
      });
      const texts: BText[] = [{ id: 'oval-lbl', x: 0, y: 0, text: 'PITCH', fontSize: 14, color: '#16a34a' }];
      // Pitch
      const pitchV: [number,number][] = [[-50,-32],[50,-32],[50,32],[-50,32]];
      shapes.unshift({ id: 'pitch', type: 'court', label: 'PITCH', category: 'GA', color: '#16a34a', vertices: pitchV, cx: 0, cy: 0 });
      // Stage / dugouts
      [[-55,-5],[-55,5]].forEach(([x,y],i) => { const v: [number,number][] = [[x-8,y-4],[x+8,y-4],[x+8,y+4],[x-8,y+4]]; shapes.push({ id: `dug-${i}`, type: 'stage', label: 'DUG', category: 'GA', color: '#94a3b8', vertices: v, cx: x, cy: y }); });
      // Tunnels
      [[0,-175],[0,175],[-175,0],[175,0]].forEach(([x,y],i) => { const isH=i>=2; const v: [number,number][] = isH?[[x-8,y-16],[x+8,y-16],[x+8,y+16],[x-8,y+16]]:[[x-16,y-8],[x+16,y-8],[x+16,y+8],[x-16,y+8]]; shapes.push({ id: `tun-${i}`, type: 'tunnel', label: 'TUNNEL', category: 'GA', color: '#94a3b8', vertices: v, cx: x, cy: y }); });
      // Press box
      shapes.push({ id: 'press', type: 'pressbox', label: 'PRESS', category: 'GA', color: '#0284c7', vertices: [[-35,-178],[-35,-168],[35,-168],[35,-178]], cx: 0, cy: -173 });
      // Scoreboards
      [[0,-185],[0,185]].forEach(([x,y],i) => { const v: [number,number][] = [[x-15,y-8],[x+15,y-8],[x+15,y+8],[x-15,y+8]]; shapes.push({ id: `sc-${i}`, type: 'scoreboard', label: 'SCORE', category: 'GA', color: '#f59e0b', vertices: v, cx: x, cy: y }); });
      // ADA
      [[-90,-100],[90,-100],[-90,100],[90,100]].forEach(([x,y],i) => { const v: [number,number][] = [[x-12,y-7],[x+12,y-7],[x+12,y+7],[x-12,y+7]]; shapes.push({ id: `ada-${i}`, type: 'ada', label: 'ADA', category: 'GA', color: '#3b82f6', vertices: v, cx: x, cy: y }); });
      return { shapes, texts };
    },
  },
  {
    id: 'theatre', label: 'Theatre / Concert', icon: '🎭',
    description: 'Fan-shaped seating with stage',
    build: () => {
      const shapes: BShape[] = [];
      const rings = [
        { innerRx: 35, innerRy: 25, outerRx: 80, outerRy: 60, a0: -55, a1: 55, divs: 5, cat: 'VIP' as Category },
        { innerRx: 83, innerRy: 63, outerRx: 130, outerRy: 100, a0: -65, a1: 65, divs: 7, cat: 'PREMIUM' as Category },
        { innerRx: 133, innerRy: 103, outerRx: 178, outerRy: 140, a0: -75, a1: 75, divs: 9, cat: 'STANDARD' as Category },
        { innerRx: 181, innerRy: 143, outerRx: 222, outerRy: 175, a0: -80, a1: 80, divs: 11, cat: 'BUDGET' as Category },
      ];
      rings.forEach((ring, ri) => {
        const step = (ring.a1 - ring.a0) / ring.divs;
        for (let i = 0; i < ring.divs; i++) {
          const a0 = ring.a0 + i * step, a1 = ring.a0 + (i + 1) * step;
          const verts = ellipseArcPoly(0, 0, ring.innerRx, ring.innerRy, ring.outerRx, ring.outerRy, a0, a1, 12);
          const [cx, cy] = centroid(verts);
          shapes.push({ id: `th-${ri}-${i}`, type: 'section', label: `${(ri+1)*100+i+1}`, category: ring.cat, color: CAT_COLOR[ring.cat], vertices: verts, cx, cy });
        }
      });
      const sv: [number,number][] = [[-90,-28],[90,-28],[90,22],[-90,22]];
      shapes.push({ id: 'stage', type: 'stage', label: 'STAGE', category: 'GA', color: '#94a3b8', vertices: sv, cx: 0, cy: -3 });
      // Press box + scoreboards + tunnels + ADA
      shapes.push({ id: 'press', type: 'pressbox', label: 'PRESS', category: 'GA', color: '#0284c7', vertices: [[-30,-228],[-30,-218],[30,-218],[30,-228]], cx: 0, cy: -223 });
      [[0,-235],[0,235]].forEach(([x,y],i) => { const v: [number,number][] = [[x-14,y-8],[x+14,y-8],[x+14,y+8],[x-14,y+8]]; shapes.push({ id: `sc-${i}`, type: 'scoreboard', label: 'SCORE', category: 'GA', color: '#f59e0b', vertices: v, cx: x, cy: y }); });
      [[0,-245],[0,245],[-245,0],[245,0]].forEach(([x,y],i) => { const isH=i>=2; const v: [number,number][] = isH?[[x-8,y-16],[x+8,y-16],[x+8,y+16],[x-8,y+16]]:[[x-16,y-8],[x+16,y-8],[x+16,y+8],[x-16,y+8]]; shapes.push({ id: `tun-${i}`, type: 'tunnel', label: 'TUNNEL', category: 'GA', color: '#94a3b8', vertices: v, cx: x, cy: y }); });
      [[-80,-180],[80,-180],[-80,180],[80,180]].forEach(([x,y],i) => { const v: [number,number][] = [[x-12,y-7],[x+12,y-7],[x+12,y+7],[x-12,y+7]]; shapes.push({ id: `ada-${i}`, type: 'ada', label: 'ADA', category: 'GA', color: '#3b82f6', vertices: v, cx: x, cy: y }); });
      return { shapes };
    },
  },
  {
    id: 'hockey', label: 'Hockey / Ice Rink', icon: '🏒',
    description: 'NHL arena with ice rink',
    build: () => {
      const shapes: BShape[] = [];
      // Ice rink (rounded rectangle)
      const rinkV: [number,number][] = [[-130,-55],[130,-55],[130,55],[-130,55]];
      shapes.push({ id: 'rink', type: 'court', label: 'ICE', category: 'GA', color: '#bfdbfe', vertices: rinkV, cx: 0, cy: 0 });
      // Lower bowl
      const step = 360 / 26;
      for (let i = 0; i < 26; i++) {
        const a0 = i * step - 90, a1 = (i + 1) * step - 90;
        const verts = ellipseArcPoly(0, 0, 95, 75, 145, 118, a0, a1, 14);
        const [cx, cy] = centroid(verts);
        shapes.push({ id: `hl-${101+i}`, type: 'section', label: `${101+i}`, category: 'PREMIUM', color: CAT_COLOR.PREMIUM, vertices: verts, cx, cy });
      }
      // Upper bowl
      for (let i = 0; i < 26; i++) {
        const a0 = i * step - 90, a1 = (i + 1) * step - 90;
        const verts = ellipseArcPoly(0, 0, 148, 121, 188, 155, a0, a1, 14);
        const [cx, cy] = centroid(verts);
        shapes.push({ id: `hu-${201+i}`, type: 'section', label: `${201+i}`, category: 'BUDGET', color: CAT_COLOR.BUDGET, vertices: verts, cx, cy });
      }
      // Press box, scoreboards, tunnels, ADA
      shapes.push({ id: 'press', type: 'pressbox', label: 'PRESS', category: 'GA', color: '#0284c7', vertices: [[-35,-158],[-35,-148],[35,-148],[35,-158]], cx: 0, cy: -153 });
      [[0,-165],[0,165]].forEach(([x,y],i) => { const v: [number,number][] = [[x-14,y-8],[x+14,y-8],[x+14,y+8],[x-14,y+8]]; shapes.push({ id: `sc-${i}`, type: 'scoreboard', label: 'SCORE', category: 'GA', color: '#f59e0b', vertices: v, cx: x, cy: y }); });
      [[0,-170],[0,170],[-170,0],[170,0]].forEach(([x,y],i) => { const isH=i>=2; const v: [number,number][] = isH?[[x-8,y-14],[x+8,y-14],[x+8,y+14],[x-8,y+14]]:[[x-14,y-8],[x+14,y-8],[x+14,y+8],[x-14,y+8]]; shapes.push({ id: `tun-${i}`, type: 'tunnel', label: 'TUNNEL', category: 'GA', color: '#94a3b8', vertices: v, cx: x, cy: y }); });
      [[-80,-130],[80,-130],[-80,130],[80,130]].forEach(([x,y],i) => { const v: [number,number][] = [[x-12,y-7],[x+12,y-7],[x+12,y+7],[x-12,y+7]]; shapes.push({ id: `ada-${i}`, type: 'ada', label: 'ADA', category: 'GA', color: '#3b82f6', vertices: v, cx: x, cy: y }); });
      return { shapes };
    },
  },
  {
    id: 'stage-shape', label: 'Stage Only', icon: '🎤',
    description: 'Insert a stage shape',
    build: () => {
      const v: [number,number][] = [[-80,-25],[80,-25],[80,25],[-80,25]];
      return { shapes: [{ id: `stage-${uid()}`, type: 'stage' as const, label: 'STAGE', category: 'GA' as Category, color: '#94a3b8', vertices: v, cx: 0, cy: 0 }] };
    },
  },
  {
    id: 'ga-pit', label: 'GA Floor Pit', icon: '🎵',
    description: 'General admission floor area',
    build: () => {
      const v: [number,number][] = [[-60,-40],[60,-40],[60,40],[-60,40]];
      return { shapes: [{ id: `ga-${uid()}`, type: 'ga' as const, label: 'GA PIT', category: 'GA' as Category, color: CAT_COLOR.GA, vertices: v, cx: 0, cy: 0 }] };
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
  onOpenAdvanced: (tab: 'grid' | 'tools' | 'import' | 'validate') => void;
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase',
  letterSpacing: 1, padding: '10px 12px 4px', display: 'block',
};

export default function LeftPanel({ activeTool, onTool, snapOn, onSnap, onInsertPreset, onDialog, onOpenAdvanced }: Props) {
  return (
    <div style={{ width: 200, background: 'var(--panel)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>

      {/* ── Tools ── */}
      <div style={{ padding: '0 8px 8px' }}>
        {TOOL_GROUPS.map((group, gi) => (
          <div key={gi}>
            <span style={{ ...SECTION_LABEL, padding: gi === 0 ? '10px 4px 4px' : '8px 4px 4px' }}>{group.label}</span>

            {/* Shapes group → visual grid picker */}
            {group.label === 'Shapes' ? (
              <ShapeGrid activeTool={activeTool} onTool={onTool} />
            ) : (
              group.tools.map(t => (
                <button key={t.id} onClick={() => onTool(t.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 10px', borderRadius: 8, border: 'none', marginBottom: 2,
                    background: activeTool === t.id ? 'var(--accent-soft)' : 'transparent',
                    color: activeTool === t.id ? 'var(--accent)' : 'var(--text-2)',
                    cursor: 'pointer', fontSize: 12, fontWeight: activeTool === t.id ? 700 : 500,
                    transition: 'all 0.1s', textAlign: 'left', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { if (activeTool !== t.id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'; }}
                  onMouseLeave={e => { if (activeTool !== t.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <span style={{ opacity: activeTool === t.id ? 1 : 0.6 }}>{icons[t.id]}</span>
                  <span style={{ flex: 1 }}>{t.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: activeTool === t.id ? 'var(--accent)' : 'var(--text-3)', background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>{t.key}</span>
                </button>
              ))
            )}
          </div>
        ))}

        {/* Snap */}
        <button onClick={onSnap}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8, border: 'none', marginTop: 4, background: snapOn ? 'var(--accent-soft)' : 'transparent', color: snapOn ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', fontSize: 12, fontWeight: snapOn ? 700 : 500, transition: 'all 0.1s', textAlign: 'left', fontFamily: 'inherit' }}>
          {icons.snap}
          <span style={{ flex: 1 }}>Snap to Grid</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--bg)', color: snapOn ? 'var(--accent)' : 'var(--text-3)' }}>{snapOn ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* ── Generate ── */}
      <div style={{ borderTop: '1px solid var(--border-soft)' }}>
        <span style={SECTION_LABEL}>Generate</span>
        <div style={{ padding: '0 8px 8px' }}>
          <button onClick={() => onOpenAdvanced('grid')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8, border: 'none', marginBottom: 2, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.1s', textAlign: 'left', fontFamily: 'inherit' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
          >
            <span style={{ opacity: 0.6 }}>{icons.row}</span>
            Rows & Seats
          </button>
          {([
            { icon: 'ring' as const, label: 'Ring Sections', d: 'ring' as const },
            { icon: 'arc' as const,  label: 'Arc Section',   d: 'arc' as const },
            { icon: 'fill' as const, label: 'Seat Block',    d: 'block' as const },
          ]).map(g => (
            <button key={g.d} onClick={() => onDialog(g.d)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8, border: 'none', marginBottom: 2, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.1s', textAlign: 'left', fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
            >
              <span style={{ opacity: 0.6 }}>{icons[g.icon]}</span>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Quick Inserts ── */}
      <div style={{ borderTop: '1px solid var(--border-soft)' }}>
        <span style={SECTION_LABEL}>Quick Inserts</span>
        <div style={{ padding: '0 8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SHAPE_INSERTS.map(s => (
            <button key={s.id} onClick={() => onInsertPreset(s.build())}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--panel)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-soft)'}
            >
              <span style={{ width: 22, height: 22, borderRadius: 6, background: s.bg, border: `1px solid ${s.border}`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                {s.icon}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)' }}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Shape Library ── */}
      <div style={{ borderTop: '1px solid var(--border-soft)', flex: 1 }}>
        <span style={SECTION_LABEL}>Venue Templates</span>
        <div style={{ padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {PRESETS.map(p => (
            <motion.button
              key={p.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onInsertPreset(p.build())}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-soft)', background: 'var(--panel)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.12s', fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-soft)'}
            >
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{color:'var(--text-2)'}}>
                  <path d="M7 1l1.5 3 3.5.5-2.5 2.5.5 3.5L7 9 4 10.5l.5-3.5L2 4.5 5.5 4 7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)' }}>{p.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{p.description}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';
import type { ReactElement } from 'react';
import type { ToolId } from './builderTypes2';

// SVG icons matching MapMyVenue style
const icons: Record<string, ReactElement> = {
  select: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2l10 6-5 1-2 5L3 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  seatselect: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 2"/><circle cx="5.5" cy="5.5" r="1.2" fill="currentColor"/><circle cx="8" cy="5.5" r="1.2" fill="currentColor"/><circle cx="10.5" cy="5.5" r="1.2" fill="currentColor"/><circle cx="5.5" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="10.5" cy="8" r="1.2" fill="currentColor"/></svg>,
  section: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l5 3v6l-5 3-5-3V5l5-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  rect: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="4.5" width="11" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>,
  circle: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/></svg>,
  ellipse: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="8" rx="6.5" ry="4" stroke="currentColor" strokeWidth="1.5"/></svg>,
  triangle: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l6 12H2L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  diamond: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l7 7-7 7-7-7 7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  pentagon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l6 4.5-2.3 6.5H4.3L2 6l6-4.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  hexagon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l5.5 3.25v6.5L8 14.5l-5.5-3.25V4.75L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  star: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.8 4.5H15l-4.2 3 1.6 4.8L8 10.5l-4.4 2.8 1.6-4.8L1 5.5h5.2L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  row: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="13" cy="8" r="1.5" fill="currentColor"/><path d="M3 8h10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/></svg>,
  multirow: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="5" r="1.2" fill="currentColor"/><circle cx="8" cy="5" r="1.2" fill="currentColor"/><circle cx="13" cy="5" r="1.2" fill="currentColor"/><circle cx="3" cy="9" r="1.2" fill="currentColor"/><circle cx="8" cy="9" r="1.2" fill="currentColor"/><circle cx="13" cy="9" r="1.2" fill="currentColor"/><circle cx="3" cy="13" r="1.2" fill="currentColor"/><circle cx="8" cy="13" r="1.2" fill="currentColor"/><circle cx="13" cy="13" r="1.2" fill="currentColor"/></svg>,
  block: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg>,
  text: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M8 4v8M5 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  pan: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v2M8 12v2M2 8h2M12 8h2M4.5 4.5l1.5 1.5M10 10l1.5 1.5M10 4.5L8.5 6M4.5 11.5L6 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/></svg>,
  snap: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="10" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="10" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="10" y="10" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>,
  ring: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/></svg>,
  arcrow: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13a7 7 0 0 1 10 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="5" cy="11.2" r="1.2" fill="currentColor"/><circle cx="8" cy="10" r="1.2" fill="currentColor"/><circle cx="11" cy="11.2" r="1.2" fill="currentColor"/></svg>,
  template: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="8" rx="6" ry="4" stroke="currentColor" strokeWidth="1.4"/><ellipse cx="8" cy="8" rx="3" ry="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="5.5" y="6.5" width="5" height="3" rx="0.5" fill="currentColor" fillOpacity="0.2"/></svg>,
  fill: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/><circle cx="8" cy="5.5" r="1" fill="currentColor"/><circle cx="10.5" cy="5.5" r="1" fill="currentColor"/><circle cx="5.5" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="10.5" cy="8" r="1" fill="currentColor"/><circle cx="5.5" cy="10.5" r="1" fill="currentColor"/><circle cx="8" cy="10.5" r="1" fill="currentColor"/><circle cx="10.5" cy="10.5" r="1" fill="currentColor"/></svg>,
  undo: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 0 1.5-3.5L2 2v3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  redo: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7a5 5 0 1 1-1.5-3.5L12 2v3H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3h4v1M6 7v3M8 7v3M3 4l1 8h6l1-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  image: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="5" cy="6" r="1.2" fill="currentColor"/><path d="M1.5 10l3-3 2 2 2-2.5 3 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  eye: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.4"/><circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.4"/></svg>,
  export: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M2 10v2h10v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  history: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 0 .5-2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M2 3v2h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 5v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
};

export const TOOL_GROUPS: { label: string; tools: { id: ToolId; label: string; key: string }[] }[] = [
  {
    label: 'Select',
    tools: [
      { id: 'select',      label: 'Select',           key: 'V' },
      { id: 'seatselect',  label: 'Select Seats Only', key: 'Q' },
      { id: 'pan',         label: 'Pan',              key: 'H' },
    ],
  },
  {
    label: 'Shapes',
    tools: [
      { id: 'rect',     label: 'Rectangle', key: 'R' },
      { id: 'circle',   label: 'Circle',    key: 'C' },
      { id: 'ellipse',  label: 'Ellipse',   key: 'E' },
      { id: 'triangle', label: 'Triangle',  key: '3' },
      { id: 'diamond',  label: 'Diamond',   key: 'D' },
      { id: 'pentagon', label: 'Pentagon',  key: '5' },
      { id: 'hexagon',  label: 'Hexagon',   key: '6' },
      { id: 'star',     label: 'Star',      key: '*' },
    ],
  },
  {
    label: 'Sections',
    tools: [
      { id: 'section',  label: 'Polygon Section',  key: 'S' },
      { id: 'row',      label: 'Standard Row',      key: 'W' },
      { id: 'multirow', label: 'Multiple Rows',     key: 'M' },
      { id: 'arcrow',   label: 'Curved Arc Row',    key: 'A' },
    ],
  },
  {
    label: 'Other',
    tools: [
      { id: 'text', label: 'Text Label', key: 'T' },
    ],
  },
];

interface ToolBtnProps {
  id: ToolId;
  label: string;
  shortcut: string;
  active: boolean;
  onClick: () => void;
}

export function ToolBtn({ id, label, shortcut, active, onClick }: ToolBtnProps) {
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <button
        onClick={onClick}
        title={`${label}  (${shortcut})`}
        style={{
          width: 40, height: 40, borderRadius: 10, border: active ? '1.5px solid #2563eb' : '1.5px solid transparent',
          background: active ? '#eff6ff' : 'transparent',
          color: active ? '#2563eb' : '#64748b',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.12s', flexShrink: 0,
        }}
        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.color = '#1e293b'; } }}
        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; } }}
      >
        {icons[id]}
      </button>
    </div>
  );
}

export function IconBtn({ icon, title, onClick, active }: { icon: keyof typeof icons; title: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: 7, border: '1px solid #e2e8f0',
        background: active ? '#eff6ff' : '#fff',
        color: active ? '#2563eb' : '#64748b',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s', flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.color = '#1e293b'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLButtonElement).style.color = active ? '#2563eb' : '#64748b'; }}
    >
      {icons[icon]}
    </button>
  );
}

export function Divider() {
  return <div style={{ width: 28, height: 1, background: '#e2e8f0', margin: '4px auto' }} />;
}

export { icons };

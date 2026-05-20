'use client';
import type { BShape, Category, VenueLevel } from './builderTypes2';
import { CAT_COLOR, CATS } from './builderTypes2';

interface Props {
  shape: BShape;
  onUpdate: (u: Partial<BShape>) => void;
}

const LEVELS: VenueLevel[] = ['100', '200', '300', 'SUITE', 'CLUB'];

// ── tiny helpers ─────────────────────────────────────────────────────────────
const grp: React.CSSProperties = { marginBottom: 16 };
const grpLbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
  color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8,
};
const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
};
const lbl: React.CSSProperties = { fontSize: 11, color: 'var(--text-2)', fontWeight: 500 };
const inp: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 12, fontWeight: 600,
  border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--bg)', color: 'var(--text-1)', outline: 'none',
  marginBottom: 8, boxSizing: 'border-box',
};
const numInp: React.CSSProperties = {
  width: 60, padding: '5px 8px', fontSize: 12, fontWeight: 600,
  border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--bg)', color: 'var(--text-1)', outline: 'none', textAlign: 'right',
};
const unit: React.CSSProperties = { fontSize: 11, color: 'var(--text-3)', marginLeft: 4 };

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: on ? 'var(--accent,#2563eb)' : 'var(--border)',
        position: 'relative', transition: 'background 0.15s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        display: 'block',
      }} />
    </button>
  );
}

export default function SectionPropertiesPanel({ shape, onUpdate }: Props) {
  const scale = shape.scale ?? 1;
  const rotation = shape.rotation ?? 0;
  const labelVisible = shape.labelVisible ?? true;
  const fontSize = shape.labelFontSize ?? 14;
  const seatingLayout = shape.seatingLayout ?? 'rectangular';

  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto', flex: 1 }}>

      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={grpLbl}>Section</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{shape.label || 'New Section'}</div>
      </div>

      {/* Category */}
      <div style={grp}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={grpLbl}>Category</span>
          <button style={{ fontSize: 10, color: 'var(--accent,#2563eb)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            ⚙ Manage
          </button>
        </div>
        <select
          value={shape.category}
          onChange={e => onUpdate({ category: e.target.value as Category })}
          style={{ ...inp, marginBottom: 0 }}
        >
          <option value="">None</option>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Transform */}
      <div style={grp}>
        <div style={grpLbl}>Transform</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
          <span>Scale</span>
          <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{Math.round(scale * 100)}%</span>
        </div>
        <input
          type="range" min={0.1} max={3} step={0.05} value={scale}
          onChange={e => onUpdate({ scale: +e.target.value })}
          style={{ width: '100%', accentColor: 'var(--accent,#2563eb)', marginBottom: 2 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)' }}>
          <span>0.1</span><span>3.0</span>
        </div>
      </div>

      {/* Label */}
      <div style={grp}>
        <div style={grpLbl}>Label</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Label</div>
        <input
          style={inp}
          value={shape.label}
          onChange={e => onUpdate({ label: e.target.value })}
          placeholder="Section"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Displayed label</span>
          <button style={{ fontSize: 10, color: 'var(--accent,#2563eb)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            ✏ Set
          </button>
        </div>
        <div style={{ ...row, marginBottom: 8 }}>
          <span style={lbl}>Visible</span>
          <Toggle on={labelVisible} onChange={v => onUpdate({ labelVisible: v })} />
        </div>
        <div style={{ ...row, marginBottom: 0 }}>
          <span style={lbl}>Font size</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="number" value={fontSize} min={6} max={72}
              onChange={e => onUpdate({ labelFontSize: +e.target.value })}
              style={numInp}
            />
            <span style={unit}>pt</span>
          </div>
        </div>
      </div>

      {/* Rotation & Position */}
      <div style={grp}>
        <div style={{ ...row, marginBottom: 8 }}>
          <span style={lbl}>Rotation</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="number" value={rotation}
              onChange={e => onUpdate({ rotation: +e.target.value })}
              style={numInp}
            />
            <span style={unit}>°</span>
          </div>
        </div>
        <div style={{ ...row, marginBottom: 8 }}>
          <span style={lbl}>Position X</span>
          <input
            type="number" value={Math.round(shape.cx)}
            onChange={e => {
              const dx = +e.target.value - shape.cx;
              onUpdate({
                cx: +e.target.value,
                vertices: shape.vertices.map(([x, y]) => [x + dx, y] as [number, number]),
              });
            }}
            style={numInp}
          />
        </div>
        <div style={{ ...row, marginBottom: 0 }}>
          <span style={lbl}>Position Y</span>
          <input
            type="number" value={Math.round(shape.cy)}
            onChange={e => {
              const dy = +e.target.value - shape.cy;
              onUpdate({
                cy: +e.target.value,
                vertices: shape.vertices.map(([x, y]) => [x, y + dy] as [number, number]),
              });
            }}
            style={numInp}
          />
        </div>
      </div>

      {/* Miscellaneous */}
      <div style={grp}>
        <div style={grpLbl}>Miscellaneous</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Capacity</div>
        <input
          style={inp}
          type="number" min={0}
          value={shape.capacity ?? ''}
          onChange={e => onUpdate({ capacity: e.target.value ? +e.target.value : undefined })}
          placeholder="Max capacity"
        />
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Seating Layout</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['circular', 'rectangular'] as const).map(v => (
            <button
              key={v}
              onClick={() => onUpdate({ seatingLayout: v })}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: '1px solid var(--border)',
                background: seatingLayout === v ? 'var(--bg-2,#f1f5f9)' : 'var(--bg)',
                color: seatingLayout === v ? 'var(--text-1)' : 'var(--text-3)',
              }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Notes</div>
        <textarea
          value={shape.notes ?? ''}
          onChange={e => onUpdate({ notes: e.target.value })}
          placeholder="Add notes..."
          style={{
            width: '100%', padding: '6px 8px', fontSize: 12,
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--bg)', color: 'var(--text-1)', outline: 'none',
            resize: 'vertical', minHeight: 64, fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Level */}
      <div style={grp}>
        <div style={grpLbl}>Level</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {LEVELS.map(lv => {
            const active = shape.level === lv;
            return (
              <button
                key={lv}
                onClick={() => onUpdate({ level: active ? undefined : lv })}
                style={{
                  padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                  cursor: 'pointer',
                  border: `1.5px solid ${active ? 'var(--accent,#2563eb)' : 'var(--border)'}`,
                  background: active ? 'rgba(37,99,235,0.1)' : 'var(--bg)',
                  color: active ? 'var(--accent,#2563eb)' : 'var(--text-3)',
                }}
              >
                {lv}
              </button>
            );
          })}
        </div>
      </div>

      {/* Flags */}
      <div style={grp}>
        <div style={grpLbl}>Flags</div>
        {([['isAccessible', 'Accessible'], ['isObstructed', 'Obstructed View']] as const).map(([key, label]) => (
          <div key={key} style={{ ...row, marginBottom: 8 }}>
            <span style={lbl}>{label}</span>
            <Toggle on={!!shape[key]} onChange={v => onUpdate({ [key]: v })} />
          </div>
        ))}
      </div>

    </div>
  );
}

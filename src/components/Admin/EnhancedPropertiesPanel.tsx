/**
 * Unified Properties Panel — Section / Row / Seat editing with 360° photo viewer
 */
'use client';
import { useState } from 'react';
import type { BShape, BSeat, BRow, Category, VenueLevel, SeatStatus } from './builderTypes2';
import { CAT_COLOR, CATS } from './builderTypes2';

interface Props {
  selectedEntity: BShape | BSeat | BRow | null;
  onUpdate: (updates: any) => void;
  onUploadPhoto: (file: File) => Promise<string>;
}

// ── Stepper control ──────────────────────────────────────────────────────────
function Stepper({ label, value, unit, min, max, step = 1, onChange }: {
  label: string; value: number; unit?: string;
  min?: number; max?: number; step?: number;
  onChange: (v: number) => void;
}) {
  const dec = () => onChange(min !== undefined ? Math.max(min, value - step) : value - step);
  const inc = () => onChange(max !== undefined ? Math.min(max, value + step) : value + step);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={LBL}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button style={STEP_BTN} onClick={dec}>−</button>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', minWidth: 32, textAlign: 'center' }}>
          {value}{unit}
        </span>
        <button style={STEP_BTN} onClick={inc}>+</button>
      </div>
    </div>
  );
}

// ── Category pills ───────────────────────────────────────────────────────────
function CatPills({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
      {CATS.map(c => {
        const active = value === c;
        return (
          <button key={c} onClick={() => onChange(c)} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${active ? CAT_COLOR[c] : 'var(--border)'}`,
            background: active ? CAT_COLOR[c] + '18' : 'var(--bg)',
            color: active ? CAT_COLOR[c] : 'var(--text-3)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_COLOR[c], opacity: active ? 1 : 0.4 }} />
            {c}
          </button>
        );
      })}
    </div>
  );
}

// ── 360° viewer overlay ──────────────────────────────────────────────────────
function Photo360Viewer({ url, onClose }: { url: string; onClose: () => void }) {
  const [yaw, setYaw] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const onMouseDown = (e: React.MouseEvent) => { setDragging(true); setStartX(e.clientX); };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const delta = (e.clientX - startX) / 3;
    setYaw(y => y + delta);
    setStartX(e.clientX);
  };
  const onMouseUp = () => setDragging(false);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'relative', width: '90vw', maxWidth: 800, borderRadius: 16, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        {/* Simulated 360° pan via CSS transform on the image */}
        <div style={{ overflow: 'hidden', borderRadius: 16, height: 400, position: 'relative' }}>
          <img
            src={url}
            alt="360° seat view"
            draggable={false}
            style={{
              width: '200%',
              height: '100%',
              objectFit: 'cover',
              transform: `translateX(${(yaw % 100) - 50}%)`,
              transition: dragging ? 'none' : 'transform 0.1s',
              userSelect: 'none',
            }}
          />
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 600,
            padding: '4px 12px', borderRadius: 99,
          }}>
            ← Drag to pan 360° →
          </div>
        </div>
      </div>
      <button onClick={onClose} style={{
        marginTop: 16, padding: '8px 24px', borderRadius: 8, border: 'none',
        background: '#fff', color: '#0f172a', fontWeight: 700, fontSize: 13, cursor: 'pointer',
      }}>
        Close
      </button>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
export default function EnhancedPropertiesPanel({ selectedEntity, onUpdate, onUploadPhoto }: Props) {
  const [photoUploading, setPhotoUploading] = useState(false);
  const [show360, setShow360] = useState(false);

  if (!selectedEntity) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
        Select a section, row, or seat to edit properties
      </div>
    );
  }

  const isShape = 'vertices' in selectedEntity;
  const isSeat = 'x' in selectedEntity && 'y' in selectedEntity && !('seats' in selectedEntity);
  const isRow = 'seats' in selectedEntity;

  const photoUrl = (selectedEntity as any).photoUrl as string | undefined;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await onUploadPhoto(file);
      onUpdate({ photoUrl: url });
    } catch {
      alert('Photo upload failed');
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 16, gap: 0, fontFamily: 'inherit' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: CAT_COLOR[(selectedEntity as any).category as Category] || '#94a3b8',
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
            {isShape ? 'Section' : isRow ? 'Row' : 'Seat'} Properties
          </span>
        </div>
        <button onClick={() => onUpdate({ _delete: true })} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6,
          color: '#ef4444', fontSize: 11, fontWeight: 600, padding: '4px 9px', cursor: 'pointer',
        }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 3h8M4 3V2h3v1M3 3l.7 6.5h3.6L8 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Delete
        </button>
      </div>

      {/* ── Label ── */}
      <div style={FIELD}>
        <label style={LBL}>Label</label>
        <input style={INP} value={selectedEntity.label} onChange={e => onUpdate({ label: e.target.value })} />
      </div>

      {/* ── Category ── */}
      <div style={FIELD}>
        <label style={LBL}>Category</label>
        <CatPills value={(selectedEntity as any).category} onChange={c => onUpdate({ category: c })} />
      </div>

      {/* ══════════ SECTION ══════════ */}
      {isShape && (
        <>
          <div style={DIVIDER}>Section</div>

          <div style={FIELD}>
            <label style={LBL}>Type</label>
            <select style={INP} value={(selectedEntity as BShape).type} onChange={e => onUpdate({ type: e.target.value })}>
              <option value="section">Seating Section</option>
              <option value="stage">Stage / Pitch</option>
              <option value="ga">General Admission</option>
            </select>
          </div>

          <div style={FIELD}>
            <label style={LBL}>Venue Level</label>
            <select style={INP} value={(selectedEntity as BShape).level || '100'} onChange={e => onUpdate({ level: e.target.value as VenueLevel })}>
              <option value="100">100 Level (Lower Bowl)</option>
              <option value="200">200 Level (Mezzanine)</option>
              <option value="300">300 Level (Upper Bowl)</option>
              <option value="SUITE">Suite Level</option>
              <option value="CLUB">Club Level</option>
            </select>
          </div>

          <div style={FIELD}>
            <label style={LBL}>Base Price ($)</label>
            <input style={INP} type="number" min={0} placeholder="e.g. 150"
              onChange={e => onUpdate({ basePrice: +e.target.value })} />
          </div>

          <div style={FIELD}>
            <label style={LBL}>Custom Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={(selectedEntity as BShape).color}
                onChange={e => onUpdate({ color: e.target.value })}
                style={{ width: 34, height: 34, border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', padding: 2 }} />
              <input style={{ ...INP, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
                value={(selectedEntity as BShape).color} onChange={e => onUpdate({ color: e.target.value })} />
            </div>
          </div>

          <div style={DIVIDER}>Flags</div>
          <Flag label="♿ Accessible Section" checked={(selectedEntity as BShape).isAccessible || false} onChange={v => onUpdate({ isAccessible: v })} />
          <Flag label="⚠️ Obstructed View" checked={(selectedEntity as BShape).isObstructed || false} onChange={v => onUpdate({ isObstructed: v })} />

          <div style={DIVIDER}>Seat View Photo</div>
          <PhotoUploader photoUrl={photoUrl} uploading={photoUploading} onUpload={handlePhotoUpload} onView360={() => setShow360(true)} />
        </>
      )}

      {/* ══════════ ROW ══════════ */}
      {isRow && (() => {
        const row = selectedEntity as BRow;
        const seats = row.seats || [];
        const avgPrice = seats.length ? (seats.reduce((s, x) => s + x.price, 0) / seats.length).toFixed(0) : '—';
        return (
          <>
            <div style={DIVIDER}>Row</div>

            <Stepper label="Number of seats" value={seats.length} min={1} max={200}
              onChange={v => onUpdate({ seatCount: v })} />

            <Stepper label="Curve radius" value={row.curveRadius || 0} unit="°" min={0} max={500} step={10}
              onChange={v => onUpdate({ curveRadius: v || undefined })} />

            <div style={FIELD}>
              <label style={LBL}>Price Override ($)</label>
              <input style={INP} type="number" min={0}
                value={row.priceOverride || ''}
                placeholder="Leave empty → use section price"
                onChange={e => onUpdate({ priceOverride: +e.target.value || undefined })} />
            </div>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 11, color: 'var(--text-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Seats</span><strong style={{ color: 'var(--text-1)' }}>{seats.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span>Avg Price</span><strong style={{ color: 'var(--text-1)' }}>${avgPrice}</strong>
              </div>
            </div>

            <div style={DIVIDER}>Seat View Photo</div>
            <PhotoUploader photoUrl={photoUrl} uploading={photoUploading} onUpload={handlePhotoUpload} onView360={() => setShow360(true)} />
          </>
        );
      })()}

      {/* ══════════ SEAT ══════════ */}
      {isSeat && (() => {
        const seat = selectedEntity as BSeat;
        return (
          <>
            <div style={DIVIDER}>Seat</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label style={LBL}>Row</label>
                <input style={INP} value={seat.label.replace(/\d+$/, '')}
                  onChange={e => onUpdate({ label: e.target.value + seat.number })} />
              </div>
              <div>
                <label style={LBL}>Number</label>
                <input style={INP} type="number" value={seat.number}
                  onChange={e => onUpdate({ number: +e.target.value })} />
              </div>
            </div>

            <div style={FIELD}>
              <label style={LBL}>Price ($)</label>
              <input style={INP} type="number" min={0} value={seat.price}
                onChange={e => onUpdate({ price: +e.target.value })} />
            </div>

            <div style={FIELD}>
              <label style={LBL}>Status</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                {(['available', 'sold', 'locked'] as SeatStatus[]).map(s => {
                  const col = s === 'available' ? '#059669' : s === 'sold' ? '#64748b' : '#d97706';
                  return (
                    <button key={s} onClick={() => onUpdate({ status: s })} style={{
                      flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      border: `1.5px solid ${seat.status === s ? col : 'var(--border)'}`,
                      background: seat.status === s ? col + '12' : 'var(--bg)',
                      color: seat.status === s ? col : 'var(--text-3)',
                      textTransform: 'capitalize',
                    }}>{s}</button>
                  );
                })}
              </div>
            </div>

            <div style={FIELD}>
              <label style={LBL}>Position</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input style={INP} type="number" value={seat.x.toFixed(1)} placeholder="X" onChange={e => onUpdate({ x: +e.target.value })} />
                <input style={INP} type="number" value={seat.y.toFixed(1)} placeholder="Y" onChange={e => onUpdate({ y: +e.target.value })} />
              </div>
            </div>

            <div style={DIVIDER}>Flags</div>
            <Flag label="♿ Wheelchair Accessible" checked={seat.isAccessible || false} onChange={v => onUpdate({ isAccessible: v })} />
            <Flag label="👥 Companion Seat" checked={seat.isCompanion || false} onChange={v => onUpdate({ isCompanion: v })} />
            <Flag label="⚠️ Obstructed View" checked={seat.isObstructed || false} onChange={v => onUpdate({ isObstructed: v })} />
            <Flag label="⭐ VIP / Premium" checked={seat.isVIP || false} onChange={v => onUpdate({ isVIP: v })} />
            <Flag label="🚪 Aisle Seat" checked={seat.aisleGap || false} onChange={v => onUpdate({ aisleGap: v })} />

            <div style={DIVIDER}>Seat View Photo</div>
            <PhotoUploader photoUrl={photoUrl} uploading={photoUploading} onUpload={handlePhotoUpload} onView360={() => setShow360(true)} />
          </>
        );
      })()}

      {/* 360° viewer */}
      {show360 && photoUrl && <Photo360Viewer url={photoUrl} onClose={() => setShow360(false)} />}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────
function Flag({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer', marginBottom: 8 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
    </label>
  );
}

function PhotoUploader({ photoUrl, uploading, onUpload, onView360 }: {
  photoUrl?: string; uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onView360: () => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ ...LBL, marginBottom: 6, display: 'block' }}>
        {photoUrl ? 'Replace Photo' : 'Upload Photo (Seat View)'}
      </label>
      <input type="file" accept="image/*" onChange={onUpload} disabled={uploading}
        style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }} />
      {uploading && <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6 }}>Uploading…</div>}
      {photoUrl && (
        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', marginTop: 4 }}>
          <img src={photoUrl} alt="Seat view" style={{ width: '100%', display: 'block', borderRadius: 8 }} />
          <button onClick={onView360} style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
            borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
              <ellipse cx="6.5" cy="6.5" rx="2.5" ry="5.5" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M1 6.5h11" stroke="currentColor" strokeWidth="1.1"/>
            </svg>
            360° View
          </button>
        </div>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const FIELD: React.CSSProperties = { marginBottom: 12 };
const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 };
const INP: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--bg)', color: 'var(--text-1)',
  fontFamily: 'inherit', boxSizing: 'border-box' as const,
};
const DIVIDER: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: 0.8,
  borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 10, marginTop: 4,
};
const STEP_BTN: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text-2)', cursor: 'pointer',
  fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, lineHeight: 1, fontFamily: 'inherit',
};

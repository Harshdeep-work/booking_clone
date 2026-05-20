'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CATS, CAT_COLOR, type BShape, type BSeat, type BText, type Category, type SeatStatus } from './builderTypes2';

interface SelectedRow {
  id: string;
  sectionId: string;
  label: string;
  category: Category;
  seatCount: number;
  seats: BSeat[];
}

interface Props {
  shape: BShape | null;
  seat: BSeat | null;
  text: BText | null;
  row: SelectedRow | null;
  multiCount: number;
  onShape: (u: Partial<BShape>) => void;
  onSeat: (u: Partial<BSeat>) => void;
  onText: (u: Partial<BText>) => void;
  onRow: (rowId: string, u: { label?: string; category?: Category; seatCount?: number; curveRadius?: number; seatSpacing?: number }) => void;
  onMultiCategory: (c: Category) => void;
  onMultiPrice: (p: number) => void;
  onMultiStatus: (s: SeatStatus) => void;
  onDelete: () => void;
  onFillSection: () => void;
  sectionMode: string | null;
  totalElements: number;
  totalSeats: number;
  totalSections: number;
  selectedCount: number;
}

const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 5 };
const INP: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid #e2e8f0', background: '#fff',
  color: '#0f172a', fontSize: 12, outline: 'none', marginBottom: 12,
  fontFamily: 'Inter,sans-serif', transition: 'border-color 0.15s',
};
const SEL: React.CSSProperties = { ...INP, cursor: 'pointer', appearance: 'none' as const };
const GRP: React.CSSProperties = { padding: '14px 16px', borderBottom: '1px solid #f1f5f9' };
const SEC_HDR: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '10px 16px 6px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' };

function CatPills({ value, onChange, categories = ['VIP', 'PREMIUM', 'STANDARD', 'BUDGET', 'GA'] }: { value: Category; onChange: (c: Category) => void; categories?: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
      {categories.map(c => {
        const active = value === c;
        const col = CAT_COLOR[c as Category] || '#3b82f6';
        return (
          <button key={c} onClick={() => onChange(c as Category)} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${active ? col : '#e2e8f0'}`,
            background: active ? col + '18' : '#f8fafc',
            color: active ? col : '#475569',
            transition: 'all 0.12s',
            boxShadow: active ? `0 0 0 3px ${col}22` : 'none',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0, opacity: active ? 1 : 0.5 }} />
            {c}
          </button>
        );
      })}
    </div>
  );
}

export default function PropertiesPanel(props: Props) {
  const { shape, seat, text, row, multiCount, onShape, onSeat, onText, onRow,
    onMultiCategory, onMultiPrice, onMultiStatus, onDelete, onFillSection, sectionMode,
    totalElements, totalSeats, totalSections, selectedCount } = props;

  const [rowCurve, setRowCurve]   = useState(0);
  const [rowSpacing, setRowSpacing] = useState(5);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');
  const [catsList, setCatsList]     = useState<string[]>(['VIP', 'PREMIUM', 'STANDARD', 'BUDGET', 'GA']);

  // ── Local input state to prevent re-render lag ──────────────────────────
  const [shapeLabel, setShapeLabel] = useState(shape?.label ?? '');
  const [seatRow, setSeatRow]       = useState(seat ? seat.label.replace(/\d+$/, '') : '');
  const [seatNum, setSeatNum]       = useState(seat?.number ?? 0);
  const [seatPrice, setSeatPrice]   = useState(seat?.price ?? 0);
  const [seatX, setSeatX]           = useState(seat ? Math.round(seat.x) : 0);
  const [seatY, setSeatY]           = useState(seat ? Math.round(seat.y) : 0);
  const [textContent, setTextContent] = useState(text?.text ?? '');

  // Sync local state when selected entity changes
  useEffect(() => { setShapeLabel(shape?.label ?? ''); }, [shape?.id]); // eslint-disable-line
  useEffect(() => {
    setSeatRow(seat ? seat.label.replace(/\d+$/, '') : '');
    setSeatNum(seat?.number ?? 0);
    setSeatPrice(seat?.price ?? 0);
    setSeatX(seat ? Math.round(seat.x) : 0);
    setSeatY(seat ? Math.round(seat.y) : 0);
  }, [seat?.id]);
  useEffect(() => { setTextContent(text?.text ?? ''); }, [text?.id]);

  const hasSelection = shape || seat || text || multiCount > 0;

  return (
    <AnimatePresence>
      {hasSelection && (
        <motion.div
          key="panel"
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          style={{
            width: 272, height: '100%', display: 'flex', flexDirection: 'column',
            background: '#fff', borderLeft: '1px solid #e2e8f0',
            fontFamily: 'Inter,sans-serif', flexShrink: 0, overflowY: 'auto',
            boxShadow: '-4px 0 16px rgba(0,0,0,0.04)',
            position: 'relative'
          }}
        >
          {/* Category Manager Modal */}
          {showCatMgr && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.96)',
              zIndex: 50, display: 'flex', flexDirection: 'column', padding: 16,
              fontFamily: 'Inter,sans-serif'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Manage Pricing Tiers</span>
                <button
                  onClick={() => setShowCatMgr(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Add New Category */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: '#f8fafc', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Create Custom Category</div>
                <label style={LBL}>Category Name</label>
                <input
                  style={INP}
                  placeholder="e.g. ULTRA_VIP"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                />
                <label style={LBL}>Category Color</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={e => setNewCatColor(e.target.value)}
                    style={{ width: 34, height: 34, border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', padding: 2 }}
                  />
                  <input
                    style={{ ...INP, flex: 1, marginBottom: 0, fontFamily: 'monospace', fontSize: 11 }}
                    value={newCatColor}
                    onChange={e => setNewCatColor(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => {
                    if (newCatName.trim() && !catsList.includes(newCatName)) {
                      CAT_COLOR[newCatName as Category] = newCatColor;
                      setCatsList([...catsList, newCatName]);
                      setNewCatName('');
                    }
                  }}
                  style={{
                    width: '100%', padding: '7px 0', borderRadius: 7,
                    border: 'none', background: '#3b82f6', color: '#fff',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  + Add Category
                </button>
              </div>

              {/* Categories List */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Active Categories</div>
                {catsList.map(cat => {
                  const col = CAT_COLOR[cat as Category] || '#3b82f6';
                  return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', border: '1px solid #f1f5f9', borderRadius: 6, marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: col }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>{cat}</span>
                      </div>
                      <input
                        type="color"
                        value={col}
                        onChange={e => {
                          CAT_COLOR[cat as Category] = e.target.value;
                          setCatsList([...catsList]); // trigger redraw
                        }}
                        style={{ width: 22, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: shape ? CAT_COLOR[shape.category] : seat ? CAT_COLOR[seat.category] : '#94a3b8' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                {multiCount > 1 ? `${multiCount} objects selected` : shape ? 'Section' : (seat && row) ? 'Row / Seat' : seat ? 'Seat' : 'Text Label'}
              </span>
            </div>
            <button onClick={onDelete} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6, color: '#ef4444', fontSize: 11, fontWeight: 600, padding: '4px 9px', cursor: 'pointer' }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 3h8M4 3V2h3v1M3 3l.7 6.5h3.6L8 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Delete
            </button>
          </div>

          {/* Multi-select */}
          {multiCount > 1 && (
            <div style={GRP}>
              <div style={SEC_HDR}>Bulk Edit</div>
              <div style={{ padding: '12px 0 0' }}>
                <label style={LBL}>Category</label>
                <select style={SEL} defaultValue="" onChange={e => e.target.value && onMultiCategory(e.target.value as Category)}>
                  <option value="">— apply to all —</option>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label style={LBL}>Price ($)</label>
                <input style={INP} type="number" placeholder="Set price for all" onBlur={e => e.target.value && onMultiPrice(+e.target.value)} />
                <label style={LBL}>Status</label>
                <select style={SEL} defaultValue="" onChange={e => e.target.value && onMultiStatus(e.target.value as SeatStatus)}>
                  <option value="">— apply to all —</option>
                  <option value="available">Available</option>
                  <option value="sold">Sold</option>
                  <option value="locked">Locked</option>
                </select>
              </div>
            </div>
          )}

          {/* Shape */}
          {shape && multiCount <= 1 && (
            <>
              <div style={SEC_HDR}>Section Properties</div>
              <div style={{ padding: '12px 16px' }}>
                <label style={LBL}>Label</label>
                <input style={INP}
                  value={shapeLabel}
                  onChange={e => setShapeLabel(e.target.value)}
                  onBlur={() => onShape({ label: shapeLabel })}
                  onKeyDown={e => e.key === 'Enter' && onShape({ label: shapeLabel })}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3b82f6'} />

                <label style={LBL}>Type</label>
                <select style={SEL} value={shape.type} onChange={e => onShape({ type: e.target.value as any })}>
                  <option value="section">Seating Section</option>
                  <option value="stage">Stage / Pitch</option>
                  <option value="ga">General Admission</option>
                </select>

                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <label style={{ ...LBL, marginBottom: 0 }}>Pricing Tier</label>
                  <button
                    onClick={() => setShowCatMgr(true)}
                    style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    Manage
                  </button>
                </div>
                <CatPills value={shape.category} onChange={c => onShape({ category: c, color: CAT_COLOR[c] || '#3b82f6' })} categories={catsList} />

                <label style={LBL}>Custom Color</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <input type="color" value={shape.color} onChange={e => onShape({ color: e.target.value })}
                    style={{ width: 34, height: 34, border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', padding: 2 }} />
                  <input style={{ ...INP, flex: 1, marginBottom: 0, fontFamily: 'monospace', fontSize: 11 }} value={shape.color} onChange={e => onShape({ color: e.target.value })} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                  <label style={LBL}>Scale</label>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{Math.round((shape.scale ?? 1) * 100)}%</span>
                </div>
                <input
                  type="range" min={0.1} max={3} step={0.05} value={shape.scale ?? 1}
                  onChange={e => onShape({ scale: +e.target.value })}
                  style={{ width: '100%', accentColor: '#3b82f6', marginBottom: 12 }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                  <label style={LBL}>Rotation</label>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{Math.round(shape.rotation ?? 0)}°</span>
                </div>
                <input
                  type="range" min={-180} max={180} step={5} value={shape.rotation ?? 0}
                  onChange={e => onShape({ rotation: +e.target.value })}
                  style={{ width: '100%', accentColor: '#3b82f6', marginBottom: 12 }}
                />

                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...LBL, marginBottom: 3 }}>Position X</label>
                    <input
                      style={{ ...INP, marginBottom: 0 }}
                      type="number"
                      value={Math.round(shape.cx)}
                      onChange={e => {
                        const dx = +e.target.value - shape.cx;
                        onShape({
                          cx: +e.target.value,
                          vertices: shape.vertices.map(([x, y]) => [x + dx, y] as [number, number]),
                        });
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...LBL, marginBottom: 3 }}>Position Y</label>
                    <input
                      style={{ ...INP, marginBottom: 0 }}
                      type="number"
                      value={Math.round(shape.cy)}
                      onChange={e => {
                        const dy = +e.target.value - shape.cy;
                        onShape({
                          cy: +e.target.value,
                          vertices: shape.vertices.map(([x, y]) => [x, y + dy] as [number, number]),
                        });
                      }}
                    />
                  </div>
                </div>
              </div>

              {!sectionMode && (
                <div style={{ padding: '0 16px 16px' }}>
                  <button onClick={onFillSection} style={{
                    width: '100%', padding: '9px 0', borderRadius: 8,
                    border: '1.5px solid #d1fae5', background: '#f0fdf4',
                    color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="4" cy="4" r="1" fill="currentColor"/><circle cx="7" cy="4" r="1" fill="currentColor"/><circle cx="10" cy="4" r="1" fill="currentColor"/><circle cx="4" cy="7" r="1" fill="currentColor"/><circle cx="7" cy="7" r="1" fill="currentColor"/><circle cx="10" cy="7" r="1" fill="currentColor"/><circle cx="4" cy="10" r="1" fill="currentColor"/><circle cx="7" cy="10" r="1" fill="currentColor"/><circle cx="10" cy="10" r="1" fill="currentColor"/></svg>
                    Auto-fill with Seats
                  </button>
                  <p style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 6, marginBottom: 0 }}>
                    Or double-click section to draw rows inside
                  </p>
                </div>
              )}

              {/* SeatGeek-style section stats */}
              <div style={{ margin: '0 16px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9', padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Section Info</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Tier', value: shape.category },
                    { label: 'Type', value: shape.type },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Seat */}
          {seat && multiCount <= 1 && (
            <>
              <div style={SEC_HDR}>Seat Properties</div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: CAT_COLOR[seat.category], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Row {seat.label.replace(/\d+/, '')} · Seat {seat.number}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 0 }}>
                  <div>
                    <label style={LBL}>Row</label>
                    <input style={INP} value={seatRow}
                      onChange={e => setSeatRow(e.target.value)}
                      onBlur={() => onSeat({ label: seatRow + seat!.number })}
                      onKeyDown={e => e.key === 'Enter' && onSeat({ label: seatRow + seat!.number })}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3b82f6'} />
                  </div>
                  <div>
                    <label style={LBL}>Number</label>
                    <input style={INP} type="number" value={seatNum}
                      onChange={e => setSeatNum(+e.target.value)}
                      onBlur={() => onSeat({ number: seatNum })}
                      onKeyDown={e => e.key === 'Enter' && onSeat({ number: seatNum })}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3b82f6'} />
                  </div>
                </div>

                <label style={LBL}>Price ($)</label>
                <input style={INP} type="number" value={seatPrice}
                  onChange={e => setSeatPrice(+e.target.value)}
                  onBlur={() => onSeat({ price: seatPrice })}
                  onKeyDown={e => e.key === 'Enter' && onSeat({ price: seatPrice })}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3b82f6'} />

                <label style={LBL}>Pricing Tier</label>
                <CatPills value={seat.category} onChange={c => onSeat({ category: c })} categories={catsList} />

                <label style={LBL}>Status</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {(['available', 'sold', 'locked'] as SeatStatus[]).map(s => {
                    const col = s === 'available' ? '#059669' : s === 'sold' ? '#64748b' : '#d97706';
                    return (
                      <button key={s} onClick={() => onSeat({ status: s })} style={{
                        flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                        border: `1.5px solid ${seat.status === s ? col : '#e2e8f0'}`,
                        background: seat.status === s ? col + '12' : '#fff',
                        color: seat.status === s ? col : '#94a3b8',
                        textTransform: 'capitalize',
                      }}>{s}</button>
                    );
                  })}
                </div>

                <label style={LBL}>Position</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ ...LBL, marginBottom: 3 }}>X</label>
                    <input style={{ ...INP, marginBottom: 0 }} type="number" value={seatX}
                      onChange={e => setSeatX(+e.target.value)}
                      onBlur={() => onSeat({ x: seatX })}
                      onKeyDown={e => e.key === 'Enter' && onSeat({ x: seatX })} />
                  </div>
                  <div>
                    <label style={{ ...LBL, marginBottom: 3 }}>Y</label>
                    <input style={{ ...INP, marginBottom: 0 }} type="number" value={seatY}
                      onChange={e => setSeatY(+e.target.value)}
                      onBlur={() => onSeat({ y: seatY })}
                      onKeyDown={e => e.key === 'Enter' && onSeat({ y: seatY })} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Text */}
          {text && multiCount <= 1 && (
            <>
              <div style={SEC_HDR}>Text Label</div>
              <div style={{ padding: '12px 16px' }}>
                <label style={LBL}>Content</label>
                <input style={INP} value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  onBlur={() => onText({ text: textContent })}
                  onKeyDown={e => e.key === 'Enter' && onText({ text: textContent })}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3b82f6'} />
                <label style={LBL}>Font Size</label>
                <input style={INP} type="number" value={text.fontSize} onChange={e => onText({ fontSize: +e.target.value })} />
                <label style={LBL}>Color</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={text.color} onChange={e => onText({ color: e.target.value })}
                    style={{ width: 34, height: 34, border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', padding: 2 }} />
                  <input style={{ ...INP, flex: 1, marginBottom: 0, fontFamily: 'monospace', fontSize: 11 }} value={text.color} onChange={e => onText({ color: e.target.value })} />
                </div>
              </div>
            </>
          )}

          {/* Row Properties — shown when a seat with a rowId is selected */}
          {row && seat && multiCount <= 1 && (
            <>
              <div style={{ ...SEC_HDR, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px 6px' }}>
                <span>ROW</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ cursor: 'pointer', color: '#94a3b8' }}><path d="M7 2.5C4 2.5 1.5 7 1.5 7S4 11.5 7 11.5 12.5 7 12.5 7 10 2.5 7 2.5z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2"/></svg>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ cursor: 'pointer', color: '#94a3b8' }}><rect x="2" y="4" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 4V3a2 2 0 014 0v1" stroke="currentColor" strokeWidth="1.2"/></svg>
                </div>
              </div>
              <div style={{ padding: '4px 16px 2px', fontSize: 12, color: '#475569', fontWeight: 500 }}>Row {row.label || '—'}</div>

              <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={LBL}>Category</label>
                  <span style={{ fontSize: 10, color: '#3b82f6', cursor: 'pointer', fontWeight: 600 }}>Manage</span>
                </div>
                <select style={SEL} value={row.category} onChange={e => onRow(row.id, { category: e.target.value as Category })}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Row</div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Number of seats</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button style={stepBtn} onClick={() => onRow(row.id, { seatCount: Math.max(1, row.seatCount - 1) })}>−</button>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', minWidth: 24, textAlign: 'center' }}>{row.seatCount}</span>
                    <button style={stepBtn} onClick={() => onRow(row.id, { seatCount: row.seatCount + 1 })}>+</button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Curve</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button style={stepBtn} onClick={() => { const v = Math.max(-180, rowCurve - 15); setRowCurve(v); onRow(row.id, { curveRadius: v }); }}>−</button>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', minWidth: 28, textAlign: 'center' }}>{rowCurve}°</span>
                    <button style={stepBtn} onClick={() => { const v = Math.min(180, rowCurve + 15); setRowCurve(v); onRow(row.id, { curveRadius: v }); }}>+</button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Seat spacing</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button style={stepBtn} onClick={() => { const v = Math.max(1, rowSpacing - 1); setRowSpacing(v); onRow(row.id, { seatSpacing: v }); }}>−</button>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', minWidth: 24, textAlign: 'center' }}>{rowSpacing}</span>
                    <button style={stepBtn} onClick={() => { const v = rowSpacing + 1; setRowSpacing(v); onRow(row.id, { seatSpacing: v }); }}>+</button>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>pt</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Section labeling</div>
                <label style={LBL}>Section label</label>
                <input style={INP} placeholder="Section name" />
              </div>

              <div style={{ padding: '10px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Row labeling</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <input type="checkbox" id="rowLabelEnabled" defaultChecked style={{ accentColor: '#3b82f6', width: 14, height: 14 }} />
                  <label htmlFor="rowLabelEnabled" style={{ fontSize: 12, color: '#475569', cursor: 'pointer' }}>Enabled</label>
                </div>
                <label style={LBL}>Label</label>
                <input style={INP} value={row.label || 'R'} onChange={e => onRow(row.id, { label: e.target.value })} />
              </div>
            </>
          )}

          {/* Bottom stats */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid #f1f5f9', padding: '10px 16px', background: '#f8fafc', fontSize: 11, color: '#64748b' }}>
            {[
              ['Elements', totalElements],
              ['Seats', totalSeats],
              ['Sections', totalSections],
              ['Selected', selectedCount],
            ].map(([label, val]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span>{label}:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{val}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const stepBtn: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 5, border: '1px solid #e2e8f0',
  background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  lineHeight: 1,
};

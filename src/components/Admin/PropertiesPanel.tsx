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

const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 };
const INP: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 12,
  border: '1px solid var(--border)', background: '#fff',
  color: 'var(--text-1)', fontSize: 13, outline: 'none', marginBottom: 16,
  fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
};
const SEL: React.CSSProperties = { ...INP, cursor: 'pointer', appearance: 'none' as const };
const GRP: React.CSSProperties = { padding: '20px 20px', borderBottom: '1px solid var(--border)' };
const SEC_HDR: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 1, padding: '16px 20px 10px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' };

function CatPills({ value, onChange, categories = ['VIP', 'PREMIUM', 'STANDARD', 'BUDGET', 'GA'] }: { value: Category; onChange: (c: Category) => void; categories?: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      {categories.map(c => {
        const active = value === c;
        const col = CAT_COLOR[c as Category] || '#6366f1';
        return (
          <button key={c} onClick={() => onChange(c as Category)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 100, fontSize: 11, fontWeight: 800, cursor: 'pointer',
            border: `2px solid ${active ? col : 'var(--border)'}`,
            background: active ? col + '15' : '#fff',
            color: active ? col : 'var(--text-2)',
            transition: 'all 0.2s',
            boxShadow: active ? `0 4px 12px ${col}25` : 'var(--shadow-sm)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0, opacity: active ? 1 : 0.6 }} />
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
  const [newCatColor, setNewCatColor] = useState('#6366f1');
  const [catsList, setCatsList]     = useState<string[]>(['VIP', 'PREMIUM', 'STANDARD', 'BUDGET', 'GA']);

  // ── Local input state to prevent re-render lag ──────────────────────────
  const [shapeLabel, setShapeLabel] = useState(shape?.label ?? '');
  const [seatRow, setSeatRow]       = useState(seat ? seat.label.replace(/\d+$/, '') : '');
  const [seatNum, setSeatNum]       = useState(seat?.number ?? 0);
  const [seatPrice, setSeatPrice]   = useState(seat?.price ?? 0);
  const [seatX, setSeatX]           = useState(seat ? Math.round(seat.x) : 0);
  const [seatY, setSeatY]           = useState(seat ? Math.round(seat.y) : 0);
  const [textContent, setTextContent] = useState(text?.text ?? '');
  const [blockPriceVal, setBlockPriceVal] = useState(shape?.blockPrice ?? 0);

  const hasSelection = shape || seat || text || multiCount > 0;
  const selectionId = shape?.id || seat?.id || text?.id || (multiCount > 0 ? 'multi' : 'none');

  return (
    <AnimatePresence>
      {hasSelection && (
        <motion.div
          key={selectionId}
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            background: 'var(--panel)', backdropFilter: 'blur(20px)',
            fontFamily: 'Inter,sans-serif', flexShrink: 0, overflowY: 'auto',
            overflowX: 'hidden', boxSizing: 'border-box',
            position: 'relative'
          }}
        >
          {/* Category Manager Modal */}
          {showCatMgr && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.98)',
              zIndex: 50, display: 'flex', flexDirection: 'column', padding: 24,
              fontFamily: 'Inter,sans-serif'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>Manage Pricing Tiers</span>
                <button
                  onClick={() => setShowCatMgr(false)}
                  style={{ background: 'var(--bg)', border: 'none', color: 'var(--text-3)', width: 32, height: 32, borderRadius: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>

              {/* Add New Category */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 16, background: 'var(--bg)', marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-2)', marginBottom: 12 }}>Create Custom Category</div>
                <label style={LBL}>Category Name</label>
                <input
                  style={INP}
                  placeholder="e.g. ULTRA_VIP"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                />
                <label style={LBL}>Category Color</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={e => setNewCatColor(e.target.value)}
                    style={{ width: 44, height: 44, border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', padding: 2, background: '#fff' }}
                  />
                  <input
                    style={{ ...INP, flex: 1, marginBottom: 0, fontFamily: 'monospace', fontSize: 12 }}
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
                    width: '100%', padding: '12px 0', borderRadius: 12,
                    border: 'none', background: 'var(--accent-grad)', color: '#fff',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                  }}
                >
                  + Add Category
                </button>
              </div>

              {/* Categories List */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-2)', marginBottom: 12 }}>Active Categories</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {catsList.map(cat => {
                    const col = CAT_COLOR[cat as Category] || '#6366f1';
                    return (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: col, boxShadow: `0 0 0 4px ${col}20` }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{cat}</span>
                        </div>
                        <input
                          type="color"
                          value={col}
                          onChange={e => {
                            CAT_COLOR[cat as Category] = e.target.value;
                            setCatsList([...catsList]); // trigger redraw
                          }}
                          style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0, background: 'transparent' }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div style={{ padding: '20px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: shape ? CAT_COLOR[shape.category] : seat ? CAT_COLOR[seat.category] : '#94a3b8', boxShadow: `0 0 0 4px ${shape ? CAT_COLOR[shape.category] : seat ? CAT_COLOR[seat.category] : '#94a3b8'}20` }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.2px' }}>
                {multiCount > 1 ? `${multiCount} Objects` : shape ? 'Section' : (seat && row) ? 'Row / Seat' : seat ? 'Seat' : 'Text Label'}
              </span>
            </div>
            <button onClick={onDelete} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 100, color: '#ef4444', fontSize: 12, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', transition: 'all 0.2s' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              Delete
            </button>
          </div>

          {/* Multi-select */}
          {multiCount > 1 && (
            <div style={GRP}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Bulk Edit</div>
              <label style={LBL}>Category</label>
              <select style={SEL} defaultValue="" onChange={e => e.target.value && onMultiCategory(e.target.value as Category)}>
                <option value="">— Apply to all —</option>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label style={LBL}>Price ($)</label>
              <input style={INP} type="number" placeholder="Set price for all" onBlur={e => e.target.value && onMultiPrice(+e.target.value)} />
              <label style={LBL}>Status</label>
              <select style={SEL} defaultValue="" onChange={e => e.target.value && onMultiStatus(e.target.value as SeatStatus)}>
                <option value="">— Apply to all —</option>
                <option value="available">Available</option>
                <option value="sold">Sold</option>
                <option value="locked">Locked</option>
              </select>
            </div>
          )}

          {/* Shape */}
          {shape && multiCount <= 1 && (
            <>
              <div style={SEC_HDR}>Section Properties</div>
              <div style={{ padding: '20px' }}>
                <label style={LBL}>Label</label>
                <input style={INP}
                  value={shapeLabel}
                  onChange={e => setShapeLabel(e.target.value)}
                  onBlur={() => onShape({ label: shapeLabel })}
                  onKeyDown={e => e.key === 'Enter' && onShape({ label: shapeLabel })}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'} />

                <label style={LBL}>Type</label>
                <select style={SEL} value={shape.type} onChange={e => onShape({ type: e.target.value as any })}>
                  <option value="section">Seating Section</option>
                  <option value="stage">Stage / Pitch</option>
                  <option value="ga">General Admission</option>
                </select>

                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...LBL, marginBottom: 0 }}>Pricing Tier</label>
                  <button
                    onClick={() => setShowCatMgr(true)}
                    style={{ background: 'var(--accent-soft)', border: 'none', color: 'var(--accent)', fontSize: 10, fontWeight: 800, cursor: 'pointer', padding: '4px 10px', borderRadius: 100 }}
                  >
                    Manage
                  </button>
                </div>
                <CatPills value={shape.category} onChange={c => onShape({ category: c, color: CAT_COLOR[c] || '#6366f1' })} categories={catsList} />

                <label style={LBL}>Custom Color</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
                  <input type="color" value={shape.color} onChange={e => onShape({ color: e.target.value })}
                    style={{ width: 44, height: 44, border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', padding: 2, background: '#fff' }} />
                  <input style={{ ...INP, flex: 1, marginBottom: 0, fontFamily: 'monospace', fontSize: 12 }} value={shape.color} onChange={e => onShape({ color: e.target.value })} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...LBL, marginBottom: 0 }}>Scale</label>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>{Math.round((shape.scale ?? 1) * 100)}%</span>
                </div>
                <input
                  type="range" min={0.1} max={3} step={0.05} value={shape.scale ?? 1}
                  onChange={e => onShape({ scale: +e.target.value })}
                  style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: 20, cursor: 'pointer' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...LBL, marginBottom: 0 }}>Rotation</label>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>{Math.round(shape.rotation ?? 0)}°</span>
                </div>
                <input
                  type="range" min={-180} max={180} step={5} value={shape.rotation ?? 0}
                  onChange={e => onShape({ rotation: +e.target.value })}
                  style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: 20, cursor: 'pointer' }}
                />

                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...LBL, marginBottom: 6 }}>Pos X</label>
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
                    <label style={{ ...LBL, marginBottom: 6 }}>Pos Y</label>
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

              {/* Seat Block Controls */}
              {(shape.type === 'section' || shape.type === 'ga') && (
                <div style={{ margin: '0 0 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Block Controls</div>
                  {/* Show/Hide in Preview */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Show in Preview</span>
                    <button
                      onClick={() => onShape({ visible: shape.visible === false ? true : false })}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: shape.visible !== false ? '#10b981' : '#94a3b8',
                        position: 'relative', transition: 'background 0.2s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3, left: shape.visible !== false ? 22 : 3,
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                  {/* Block Default Price */}
                  <label style={LBL}>Default Seat Price ($)</label>
                  <input
                    style={{ ...INP, marginBottom: 0 }}
                    type="number"
                    min={0}
                    value={shape.blockPrice ?? ''}
                    placeholder="e.g. 100"
                    onChange={e => onShape({ blockPrice: +e.target.value || undefined })}
                  />
                </div>
              )}

              {!sectionMode && (
                <div style={{ padding: '0 0 24px' }}>
                  <button onClick={onFillSection} style={{
                    width: '100%', padding: '12px 0', borderRadius: 16,
                    border: 'none', background: 'var(--accent-grad)',
                    color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)', transition: 'all 0.2s'
                  }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 3h16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2zM9 9h.01M15 9h.01M9 15h.01M15 15h.01"/></svg>
                    Auto-fill Seats
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 10, fontWeight: 500 }}>
                    Or dbl-click section to draw rows
                  </p>
                </div>
              )}

              {/* Stats Card */}
              <div style={{ margin: '0 20px 24px', background: '#fff', borderRadius: 16, border: '1px solid var(--border)', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Section Info</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Tier', value: shape.category },
                    { label: 'Type', value: shape.type },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>{value}</div>
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
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 16px', background: '#fff', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: CAT_COLOR[seat.category], flexShrink: 0, boxShadow: `0 0 0 4px ${CAT_COLOR[seat.category]}20` }} />
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>Row {seat.label.replace(/\d+/, '')} · Seat {seat.number}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 }}>
                  <div>
                    <label style={LBL}>Row</label>
                    <input style={INP} value={seatRow}
                      onChange={e => setSeatRow(e.target.value)}
                      onBlur={() => onSeat({ label: seatRow + seat!.number })}
                      onKeyDown={e => e.key === 'Enter' && onSeat({ label: seatRow + seat!.number })} />
                  </div>
                  <div>
                    <label style={LBL}>Number</label>
                    <input style={INP} type="number" value={seatNum}
                      onChange={e => setSeatNum(+e.target.value)}
                      onBlur={() => onSeat({ number: seatNum })}
                      onKeyDown={e => e.key === 'Enter' && onSeat({ number: seatNum })} />
                  </div>
                </div>

                <label style={LBL}>Price ($)</label>
                <input style={INP} type="number" value={seatPrice}
                  onChange={e => setSeatPrice(+e.target.value)}
                  onBlur={() => onSeat({ price: seatPrice })}
                  onKeyDown={e => e.key === 'Enter' && onSeat({ price: seatPrice })} />

                <label style={LBL}>Pricing Tier</label>
                <CatPills value={seat.category} onChange={c => onSeat({ category: c })} categories={catsList} />

                <label style={LBL}>Status</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {(['available', 'sold', 'locked'] as SeatStatus[]).map(s => {
                    const col = s === 'available' ? '#10b981' : s === 'sold' ? 'var(--text-3)' : '#f59e0b';
                    const active = seat.status === s;
                    return (
                      <button key={s} onClick={() => onSeat({ status: s })} style={{
                        flex: 1, padding: '8px 0', borderRadius: 12, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                        border: `2px solid ${active ? col : 'var(--border)'}`,
                        background: active ? col + '15' : '#fff',
                        color: active ? col : 'var(--text-3)',
                        textTransform: 'capitalize', transition: 'all 0.2s'
                      }}>{s}</button>
                    );
                  })}
                </div>

                <label style={LBL}>Position</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...LBL, marginBottom: 6 }}>X</label>
                    <input style={{ ...INP, marginBottom: 0 }} type="number" value={seatX}
                      onChange={e => setSeatX(+e.target.value)}
                      onBlur={() => onSeat({ x: seatX })}
                      onKeyDown={e => e.key === 'Enter' && onSeat({ x: seatX })} />
                  </div>
                  <div>
                    <label style={{ ...LBL, marginBottom: 6 }}>Y</label>
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
              <div style={{ padding: '20px' }}>
                <label style={LBL}>Content</label>
                <input style={INP} value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  onBlur={() => onText({ text: textContent })}
                  onKeyDown={e => e.key === 'Enter' && onText({ text: textContent })} />

                {/* Font Family */}
                <label style={LBL}>Font</label>
                <select style={SEL} value={text.fontFamily || 'Inter'} onChange={e => onText({ fontFamily: e.target.value })}>
                  {['Inter', 'Roboto', 'Arial', 'Georgia', 'Courier New', 'Impact', 'Trebuchet MS', 'Verdana', 'Palatino'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>

                {/* Font Size + Bold/Italic row */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={LBL}>Size (px)</label>
                    <input style={{ ...INP, marginBottom: 0 }} type="number" min={6} max={120} value={text.fontSize}
                      onChange={e => onText({ fontSize: +e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => onText({ bold: !text.bold })}
                      style={{
                        width: 40, height: 40, borderRadius: 10, border: `2px solid ${text.bold ? 'var(--accent)' : 'var(--border)'}`,
                        background: text.bold ? 'var(--accent-soft)' : '#fff',
                        color: text.bold ? 'var(--accent)' : 'var(--text-2)',
                        cursor: 'pointer', fontWeight: 900, fontSize: 16, fontFamily: 'Georgia,serif',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      title="Bold"
                    >B</button>
                    <button
                      onClick={() => onText({ italic: !text.italic })}
                      style={{
                        width: 40, height: 40, borderRadius: 10, border: `2px solid ${text.italic ? 'var(--accent)' : 'var(--border)'}`,
                        background: text.italic ? 'var(--accent-soft)' : '#fff',
                        color: text.italic ? 'var(--accent)' : 'var(--text-2)',
                        cursor: 'pointer', fontWeight: 700, fontSize: 16, fontStyle: 'italic', fontFamily: 'Georgia,serif',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      title="Italic"
                    >I</button>
                  </div>
                </div>

                {/* Alignment */}
                <label style={LBL}>Alignment</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  {(['left', 'center', 'right'] as const).map(align => (
                    <button
                      key={align}
                      onClick={() => onText({ align })}
                      title={align.charAt(0).toUpperCase() + align.slice(1)}
                      style={{
                        flex: 1, height: 36, borderRadius: 10, border: `2px solid ${(text.align ?? 'center') === align ? 'var(--accent)' : 'var(--border)'}`,
                        background: (text.align ?? 'center') === align ? 'var(--accent-soft)' : '#fff',
                        color: (text.align ?? 'center') === align ? 'var(--accent)' : 'var(--text-2)',
                        cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                    >
                      {align === 'left' ? '⬅' : align === 'center' ? '⬛' : '➡'}
                    </button>
                  ))}
                </div>

                <label style={LBL}>Color</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                  <input type="color" value={text.color} onChange={e => onText({ color: e.target.value })}
                    style={{ width: 44, height: 44, border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', padding: 2, background: '#fff' }} />
                  <input style={{ ...INP, flex: 1, marginBottom: 0, fontFamily: 'monospace', fontSize: 12 }} value={text.color} onChange={e => onText({ color: e.target.value })} />
                </div>

                {/* Background / highlight */}
                <label style={LBL}>Background (optional)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="color" value={text.background || '#ffffff'} onChange={e => onText({ background: e.target.value === '#ffffff' ? undefined : e.target.value })}
                    style={{ width: 44, height: 44, border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', padding: 2, background: '#fff' }} />
                  <input style={{ ...INP, flex: 1, marginBottom: 0, fontFamily: 'monospace', fontSize: 12 }} value={text.background || ''} placeholder="none" onChange={e => onText({ background: e.target.value || undefined })} />
                  {text.background && (
                    <button onClick={() => onText({ background: undefined })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, padding: '0 4px' }} title="Remove background">✕</button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Row Properties */}
          {row && (
            <>
              <div style={SEC_HDR}>Row Properties</div>
              <div style={{ padding: '12px 20px 8px', fontSize: 14, color: 'var(--text-1)', fontWeight: 800 }}>Row {row.label || '—'}</div>

              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <label style={LBL}>Category</label>
                <select style={SEL} value={row.category} onChange={e => onRow(row.id, { category: e.target.value as Category })}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Seats in Row</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button style={stepBtn} onClick={() => onRow(row.id, { seatCount: Math.max(1, row.seatCount - 1) })}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', minWidth: 32, textAlign: 'center' }}>{row.seatCount}</span>
                    <button style={stepBtn} onClick={() => onRow(row.id, { seatCount: row.seatCount + 1 })}>+</button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Curve Radius</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button style={stepBtn} onClick={() => { const v = Math.max(-180, rowCurve - 15); setRowCurve(v); onRow(row.id, { curveRadius: v }); }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', minWidth: 36, textAlign: 'center' }}>{rowCurve}°</span>
                    <button style={stepBtn} onClick={() => { const v = Math.min(180, rowCurve + 15); setRowCurve(v); onRow(row.id, { curveRadius: v }); }}>+</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Bottom Stats */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', padding: '20px', background: 'var(--bg)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['Elements', totalElements],
              ['Seats', totalSeats],
              ['Sections', totalSections],
              ['Selected', selectedCount],
            ].map(([label, val]) => (
              <div key={label as string}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const stepBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 10, border: '1px solid var(--border)',
  background: '#fff', color: 'var(--text-1)', cursor: 'pointer', fontSize: 18, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s'
};

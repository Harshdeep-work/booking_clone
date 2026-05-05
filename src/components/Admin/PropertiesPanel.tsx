'use client';
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
  onRow: (rowId: string, u: { label?: string; category?: Category }) => void;
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

function CatPills({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
      {CATS.map(c => {
        const active = value === c;
        return (
          <button key={c} onClick={() => onChange(c)} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${active ? CAT_COLOR[c] : '#e2e8f0'}`,
            background: active ? CAT_COLOR[c] + '18' : '#f8fafc',
            color: active ? CAT_COLOR[c] : '#475569',
            transition: 'all 0.12s',
            boxShadow: active ? `0 0 0 3px ${CAT_COLOR[c]}22` : 'none',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: CAT_COLOR[c], flexShrink: 0, opacity: active ? 1 : 0.5 }} />
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
          }}
        >
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
                <input style={INP} value={shape.label} onChange={e => onShape({ label: e.target.value })}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3b82f6'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#e2e8f0'} />

                <label style={LBL}>Type</label>
                <select style={SEL} value={shape.type} onChange={e => onShape({ type: e.target.value as any })}>
                  <option value="section">Seating Section</option>
                  <option value="stage">Stage / Pitch</option>
                  <option value="ga">General Admission</option>
                </select>

                <label style={LBL}>Pricing Tier</label>
                <CatPills value={shape.category} onChange={c => onShape({ category: c, color: CAT_COLOR[c] })} />

                <label style={LBL}>Base Price ($)</label>
                <input style={INP} type="number" placeholder="e.g. 150"
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3b82f6'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#e2e8f0'} />

                <label style={LBL}>Custom Color</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <input type="color" value={shape.color} onChange={e => onShape({ color: e.target.value })}
                    style={{ width: 34, height: 34, border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', padding: 2 }} />
                  <input style={{ ...INP, flex: 1, marginBottom: 0, fontFamily: 'monospace', fontSize: 11 }} value={shape.color} onChange={e => onShape({ color: e.target.value })} />
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
                    <input style={INP} value={seat.label.replace(/\d+/, '')} onChange={e => onSeat({ label: e.target.value + seat.number })}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3b82f6'}
                      onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#e2e8f0'} />
                  </div>
                  <div>
                    <label style={LBL}>Number</label>
                    <input style={INP} type="number" value={seat.number} onChange={e => onSeat({ number: +e.target.value })}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3b82f6'}
                      onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#e2e8f0'} />
                  </div>
                </div>

                <label style={LBL}>Price ($)</label>
                <input style={INP} type="number" value={seat.price} onChange={e => onSeat({ price: +e.target.value })}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3b82f6'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#e2e8f0'} />

                <label style={LBL}>Pricing Tier</label>
                <CatPills value={seat.category} onChange={c => onSeat({ category: c })} />

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
                    <input style={{ ...INP, marginBottom: 0 }} type="number" value={Math.round(seat.x)} onChange={e => onSeat({ x: +e.target.value })} />
                  </div>
                  <div>
                    <label style={{ ...LBL, marginBottom: 3 }}>Y</label>
                    <input style={{ ...INP, marginBottom: 0 }} type="number" value={Math.round(seat.y)} onChange={e => onSeat({ y: +e.target.value })} />
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
                <input style={INP} value={text.text} onChange={e => onText({ text: e.target.value })}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#3b82f6'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#e2e8f0'} />
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
                  <span style={{ fontSize: 12, color: '#475569' }}>Number of seats</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button style={stepBtn}>−</button>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', minWidth: 24, textAlign: 'center' }}>{row.seatCount}</span>
                    <button style={stepBtn}>+</button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>Curve</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button style={stepBtn}>−</button>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', minWidth: 24, textAlign: 'center' }}>0°</span>
                    <button style={stepBtn}>+</button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>Seat spacing</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button style={stepBtn}>−</button>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', minWidth: 24, textAlign: 'center' }}>5</span>
                    <button style={stepBtn}>+</button>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>pt</span>
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

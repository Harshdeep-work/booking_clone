'use client';
/**
 * RowManagerPanel — BookMyShow-style row & seat management
 * Lists all rows grouped by section, allows adding/editing/deleting with a
 * simple form UI. No canvas drawing required.
 */
import { useState, useMemo } from 'react';
import type { LayoutState, BSeat, Category } from './builderTypes2';
import { CAT_COLOR, CATS } from './builderTypes2';

interface Props {
  layout: LayoutState;
  selectedSectionId: string | null;
  onAddRow: (sectionId: string, rowLabel: string, seatCount: number, price: number, category: Category) => void;
  onDeleteRow: (rowId: string) => void;
  onDuplicateRow: (rowId: string) => void;
  onUpdateRow: (rowId: string, updates: { label?: string; seatCount?: number; price?: number; category?: Category }) => void;
  onSelectSeat: (seatId: string) => void;
  selectedSeatId: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function nextRowLabel(existingLabels: string[]): string {
  if (existingLabels.length === 0) return 'A';

  // Find the highest label by sorting by length then alphabetically
  const sorted = [...existingLabels].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });
  const last = sorted[sorted.length - 1];

  const increment = (s: string): string => {
    const chars = s.split('');
    for (let i = chars.length - 1; i >= 0; i--) {
      if (chars[i] < 'Z') {
        chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
        return chars.join('');
      }
      chars[i] = 'A';
    }
    return 'A' + chars.join('');
  };

  return increment(last);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SeatStrip({ seats, selectedSeatId, onSelect }: {
  seats: BSeat[];
  selectedSeatId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = [...seats].sort((a, b) => a.number - b.number);
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 3,
      padding: '8px 10px', background: 'var(--bg)',
      borderRadius: 8, border: '1px solid var(--border)',
      maxHeight: 80, overflowY: 'auto',
      marginTop: 6, marginBottom: 8,
    }}>
      {sorted.map(seat => {
        const col = CAT_COLOR[seat.category] || '#94a3b8';
        const isSel = seat.id === selectedSeatId;
        const isSold = seat.status !== 'available';
        return (
          <button
            key={seat.id}
            title={`${seat.label} · $${seat.price} · ${seat.status}`}
            onClick={() => onSelect(seat.id)}
            style={{
              width: 18, height: 18,
              borderRadius: '50%',
              border: `1.5px solid ${isSel ? '#2563eb' : col}`,
              background: isSold ? '#94a3b8' : (isSel ? '#2563eb' : col + '33'),
              cursor: 'pointer',
              fontSize: 7,
              fontWeight: 700,
              color: isSel ? '#fff' : col,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
              lineHeight: 1,
              transition: 'all 0.1s',
              flexShrink: 0,
            }}
          >
            {seat.number}
          </button>
        );
      })}
    </div>
  );
}

interface RowItemProps {
  rowId: string;
  rowLabel: string;
  seats: BSeat[];
  expanded: boolean;
  selectedSeatId: string | null;
  onToggle: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (updates: { label?: string; seatCount?: number; price?: number; category?: Category }) => void;
  onSelectSeat: (id: string) => void;
}

function RowItem({ rowId, rowLabel, seats, expanded, selectedSeatId, onToggle, onDelete, onDuplicate, onUpdate, onSelectSeat }: RowItemProps) {
  const sorted = [...seats].sort((a, b) => a.number - b.number);
  const avgPrice = seats.length ? Math.round(seats.reduce((s, x) => s + x.price, 0) / seats.length) : 0;
  const category = seats[0]?.category || 'STANDARD';
  const col = CAT_COLOR[category] || '#64748b';
  const [editLabel, setEditLabel] = useState(rowLabel);
  const [editSeats, setEditSeats] = useState(seats.length);
  const [editPrice, setEditPrice] = useState(avgPrice);
  const [editCat, setEditCat] = useState<Category>(category);

  const availableCount = seats.filter(s => s.status === 'available').length;
  const soldCount = seats.filter(s => s.status === 'sold').length;

  return (
    <div style={{
      border: `1.5px solid ${expanded ? col : 'var(--border)'}`,
      borderRadius: 10,
      marginBottom: 6,
      background: 'var(--panel)',
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* ── Row Header ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', cursor: 'pointer',
          background: expanded ? col + '10' : 'transparent',
          transition: 'background 0.15s',
        }}
        onClick={onToggle}
      >
        {/* Row letter badge */}
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: col + '22',
          border: `1.5px solid ${col}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: col, flexShrink: 0,
        }}>
          {rowLabel}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>Row {rowLabel}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
              background: col + '18', color: col,
            }}>{category}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
            {seats.length} seats
            {soldCount > 0 && ` · ${soldCount} sold`}
            {avgPrice > 0 && ` · $${avgPrice}`}
          </div>
        </div>

        {/* Seat mini-preview (5 dots) */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {sorted.slice(0, 5).map((s, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: s.status === 'available' ? col : '#94a3b8',
              opacity: 0.8,
            }} />
          ))}
          {seats.length > 5 && (
            <span style={{ fontSize: 8, color: 'var(--text-3)', marginLeft: 2 }}>+{seats.length - 5}</span>
          )}
        </div>

        {/* Chevron */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-3)' }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* ── Expanded Edit Area ── */}
      {expanded && (
        <div style={{ padding: '0 10px 10px', borderTop: `1px solid ${col}22` }}>
          {/* Seat strip */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 }}>
              Seats — click to select
            </div>
            <SeatStrip seats={seats} selectedSeatId={selectedSeatId} onSelect={onSelectSeat} />
          </div>

          {/* Edit fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={LBL}>Row Label</label>
              <input
                style={INP}
                value={editLabel}
                maxLength={3}
                onChange={e => setEditLabel(e.target.value.toUpperCase())}
                onBlur={() => onUpdate({ label: editLabel })}
              />
            </div>
            <div>
              <label style={LBL}>Seat Count</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button style={STEP_BTN} onClick={() => { const v = Math.max(1, editSeats - 1); setEditSeats(v); onUpdate({ seatCount: v }); }}>−</button>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', minWidth: 28, textAlign: 'center' }}>{editSeats}</span>
                <button style={STEP_BTN} onClick={() => { const v = editSeats + 1; setEditSeats(v); onUpdate({ seatCount: v }); }}>+</button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={LBL}>Price ($)</label>
            <input
              style={INP}
              type="number"
              min={0}
              value={editPrice}
              onChange={e => setEditPrice(+e.target.value)}
              onBlur={() => onUpdate({ price: editPrice })}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={LBL}>Category</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {CATS.map(c => {
                const active = editCat === c;
                const cc = CAT_COLOR[c];
                return (
                  <button key={c} onClick={() => { setEditCat(c); onUpdate({ category: c }); }} style={{
                    padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${active ? cc : 'var(--border)'}`,
                    background: active ? cc + '18' : 'var(--bg)',
                    color: active ? cc : 'var(--text-3)',
                  }}>{c}</button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button
              onClick={onDuplicate}
              style={{
                padding: '6px 0', borderRadius: 7,
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text-1)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="3.5" y="3.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M2.5 8.5V3.5C2.5 2.94772 2.94772 2.5 3.5 2.5H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Duplicate
            </button>
            <button
              onClick={onDelete}
              style={{
                padding: '6px 0', borderRadius: 7,
                border: '1px solid #fecaca', background: '#fff5f5',
                color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 3h8M4 3V2h3v1M3 3l.7 6.5h3.6L8 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Delete Row
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RowManagerPanel({
  layout, selectedSectionId, onAddRow, onDeleteRow, onUpdateRow, onSelectSeat, selectedSeatId,
}: Props) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLabel, setAddLabel] = useState('A');
  const [addSeats, setAddSeats] = useState(20);
  const [addPrice, setAddPrice] = useState(100);
  const [addCat, setAddCat] = useState<Category>('STANDARD');
  const [filterSection, setFilterSection] = useState<string>(selectedSectionId || '__all__');

  // Sections with seats only
  const sectionsWithSeats = useMemo(() => {
    const map = new Map<string, { label: string; rowCount: number; seatCount: number }>();
    layout.seats.forEach(s => {
      if (!map.has(s.sectionId)) {
        const shape = layout.shapes.find(sh => sh.id === s.sectionId);
        map.set(s.sectionId, { label: shape?.label || s.sectionId, rowCount: 0, seatCount: 0 });
      }
      map.get(s.sectionId)!.seatCount++;
    });
    layout.seats.forEach(s => {
      // count unique rows
    });
    // Count rows
    const rowIds = new Map<string, string>(); // rowId → sectionId
    layout.seats.forEach(s => { if (s.rowId) rowIds.set(s.rowId, s.sectionId); });
    rowIds.forEach((sid) => {
      if (map.has(sid)) map.get(sid)!.rowCount++;
    });
    return map;
  }, [layout]);

  // Build row map for display
  const rowMap = useMemo(() => {
    const map = new Map<string, BSeat[]>(); // rowId → seats
    const filtered = filterSection === '__all__'
      ? layout.seats
      : layout.seats.filter(s => s.sectionId === filterSection);
    filtered.forEach(s => {
      const rId = s.rowId || `__norow__${s.sectionId}`;
      if (!map.has(rId)) map.set(rId, []);
      map.get(rId)!.push(s);
    });
    return map;
  }, [layout, filterSection]);

  // Sorted row entries: group by section then sort by row label
  const rowEntries = useMemo(() => {
    const entries: { rowId: string; sectionId: string; rowLabel: string; seats: BSeat[] }[] = [];
    rowMap.forEach((seats, rowId) => {
      if (seats.length === 0) return;
      const sectionId = seats[0].sectionId;
      const rowLabel = seats[0].label.replace(/\d+$/, '') || rowId;
      entries.push({ rowId, sectionId, rowLabel, seats });
    });
    entries.sort((a, b) => {
      // sort by section first, then row label
      if (a.sectionId !== b.sectionId) return a.sectionId.localeCompare(b.sectionId);
      return a.rowLabel.localeCompare(b.rowLabel);
    });
    return entries;
  }, [rowMap]);

  // Sections that have real shapes (for adding rows)
  const sections = useMemo(() => layout.shapes.filter(s => s.type === 'section'), [layout]);

  const activeSectionId = filterSection !== '__all__' ? filterSection : (sections[0]?.id || null);

  // Auto-suggest next row label
  const existingLabels = useMemo(() => {
    const base = activeSectionId
      ? layout.seats.filter(s => s.sectionId === activeSectionId).map(s => s.label.replace(/\d+$/, ''))
      : [];
    return [...new Set(base)];
  }, [layout, activeSectionId]);

  const handleOpenAdd = () => {
    const next = nextRowLabel(existingLabels);
    setAddLabel(next);
    setShowAddForm(true);
  };

  const handleAdd = () => {
    if (!activeSectionId) return;
    onAddRow(activeSectionId, addLabel, addSeats, addPrice, addCat);
    const next = nextRowLabel([...existingLabels, addLabel]);
    setAddLabel(next);
    setShowAddForm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'inherit' }}>

      {/* ── Header ── */}
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
            Rows & Seats
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
            {rowEntries.length} rows · {layout.seats.length} seats
          </span>
        </div>

        {/* Section filter */}
        {sections.length > 1 && (
          <select
            style={{ ...INP, fontSize: 11 }}
            value={filterSection}
            onChange={e => setFilterSection(e.target.value)}
          >
            <option value="__all__">All sections</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>
                Section {s.label} ({sectionsWithSeats.get(s.id)?.rowCount || 0} rows)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Add Row Form ── */}
      {showAddForm && (
        <div style={{
          margin: '8px 10px',
          padding: '12px',
          background: 'var(--accent-soft, #fff8f3)',
          border: '1.5px solid var(--accent, #C97B36)',
          borderRadius: 10,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent, #C97B36)', marginBottom: 10 }}>
            ✦ Add New Row
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={LBL}>Row Label</label>
              <input
                style={INP}
                value={addLabel}
                maxLength={3}
                onChange={e => setAddLabel(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label style={LBL}>Seats</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button style={STEP_BTN} onClick={() => setAddSeats(v => Math.max(1, v - 1))}>−</button>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', minWidth: 28, textAlign: 'center' }}>{addSeats}</span>
                <button style={STEP_BTN} onClick={() => setAddSeats(v => v + 1)}>+</button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={LBL}>Price ($)</label>
            <input
              style={INP}
              type="number"
              min={0}
              value={addPrice}
              onChange={e => setAddPrice(+e.target.value)}
            />
          </div>

          {/* Section picker (if all sections shown) */}
          {filterSection === '__all__' && sections.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <label style={LBL}>Section</label>
              <select style={INP} value={activeSectionId || ''} onChange={() => {}}>
                {sections.map(s => <option key={s.id} value={s.id}>Section {s.label}</option>)}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label style={LBL}>Category</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {CATS.map(c => {
                const active = addCat === c;
                const cc = CAT_COLOR[c];
                return (
                  <button key={c} onClick={() => setAddCat(c)} style={{
                    padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${active ? cc : 'var(--border)'}`,
                    background: active ? cc + '18' : 'var(--bg)',
                    color: active ? cc : 'var(--text-3)',
                  }}>{c}</button>
                );
              })}
            </div>
          </div>

          {/* Preview strip */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...LBL, marginBottom: 4 }}>Preview</label>
            <div style={{ display: 'flex', gap: 2, padding: '6px 8px', background: 'var(--bg)', borderRadius: 7, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10, fontWeight: 800, color: CAT_COLOR[addCat],
                minWidth: 20, textAlign: 'center', marginRight: 3,
              }}>{addLabel}</span>
              {Array.from({ length: Math.min(addSeats, 30) }, (_, i) => (
                <div key={i} style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: CAT_COLOR[addCat] + '30',
                  border: `1px solid ${CAT_COLOR[addCat]}`,
                }} />
              ))}
              {addSeats > 30 && <span style={{ fontSize: 9, color: 'var(--text-3)', alignSelf: 'center' }}>+{addSeats - 30}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleAdd} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              background: 'var(--text-1)', color: 'var(--panel)',
              fontSize: 12, fontWeight: 700, cursor: activeSectionId ? 'pointer' : 'not-allowed',
              opacity: activeSectionId ? 1 : 0.5,
            }} disabled={!activeSectionId}>
              Add Row {addLabel}
            </button>
            <button onClick={() => setShowAddForm(false)} style={{
              padding: '8px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text-2)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>

          {!activeSectionId && (
            <div style={{ marginTop: 8, fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
              ⚠ Add a section first (use Quick Inserts → Section or a Venue Template)
            </div>
          )}
        </div>
      )}

      {/* ── Row List ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px 60px' }}>
        {rowEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>💺</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>No rows yet</div>
            <div style={{ fontSize: 11 }}>
              Click <strong>"+ Add Row"</strong> below to start building your seating layout.
            </div>
          </div>
        ) : (
          rowEntries.map(({ rowId, sectionId, rowLabel, seats }) => (
            <RowItem
              key={rowId}
              rowId={rowId}
              rowLabel={rowLabel}
              seats={seats}
              expanded={expandedRowId === rowId}
              selectedSeatId={selectedSeatId}
              onToggle={() => setExpandedRowId(expandedRowId === rowId ? null : rowId)}
              onDuplicate={() => onDuplicateRow(rowId)}
              onDelete={() => {
                onDeleteRow(rowId);
                if (expandedRowId === rowId) setExpandedRowId(null);
              }}
              onUpdate={updates => onUpdateRow(rowId, updates)}
              onSelectSeat={onSelectSeat}
            />
          ))
        )}
      </div>

      {/* ── Sticky Add Button ── */}
      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0,
        padding: '10px 10px 12px',
        background: 'var(--panel)',
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={handleOpenAdd}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 9,
            border: '2px dashed var(--accent, #C97B36)',
            background: 'var(--accent-soft, transparent)',
            color: 'var(--accent, #C97B36)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,123,54,0.08)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Row
        </button>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const LBL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-3)',
  display: 'block', marginBottom: 4,
};
const INP: React.CSSProperties = {
  width: '100%', padding: '6px 9px', fontSize: 12,
  border: '1px solid var(--border)', borderRadius: 7,
  background: 'var(--bg)', color: 'var(--text-1)',
  fontFamily: 'inherit', boxSizing: 'border-box',
  outline: 'none',
};
const STEP_BTN: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text-2)', cursor: 'pointer',
  fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, lineHeight: 1, fontFamily: 'inherit',
};

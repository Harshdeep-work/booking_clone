'use client';
/**
 * RowManagerPanel — BookMyShow-style row & seat management
 * Lists all rows grouped by section, allows adding/editing/deleting with a
 * simple form UI. No canvas drawing required.
 */
import { useState, useMemo, useEffect } from 'react';
import type { LayoutState, BSeat, Category } from './builderTypes2';
import { CAT_COLOR, CATS } from './builderTypes2';

// ── Custom category support ────────────────────────────────────────────────────
interface CustomCategory {
  name: string;
  color: string;
}

const DEFAULT_CATS: CustomCategory[] = CATS.map(c => ({ name: c, color: CAT_COLOR[c] }));

function getCatColor(cats: CustomCategory[], name: string): string {
  return cats.find(c => c.name === name)?.color ?? CAT_COLOR[name as Category] ?? '#94a3b8';
}

// ── Manage Categories Modal ────────────────────────────────────────────────────
function ManageCategoriesModal({
  cats,
  onClose,
  onChange,
}: {
  cats: CustomCategory[];
  onClose: () => void;
  onChange: (cats: CustomCategory[]) => void;
}) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');

  const add = () => {
    const name = newName.trim().toUpperCase();
    if (!name || cats.find(c => c.name === name)) return;
    onChange([...cats, { name, color: newColor }]);
    setNewName('');
    setNewColor('#6366f1');
  };

  const remove = (name: string) => {
    // Don't allow removing if it's the last one
    if (cats.length <= 1) return;
    onChange(cats.filter(c => c.name !== name));
  };

  const updateColor = (name: string, color: string) => {
    onChange(cats.map(c => c.name === name ? { ...c, color } : c));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--panel, #fff)', borderRadius: 14, padding: 20, width: 300,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Manage Categories</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-3)', lineHeight: 1 }}>×</button>
        </div>

        {/* Existing categories */}
        <div style={{ marginBottom: 14 }}>
          {cats.map(cat => (
            <div key={cat.name} style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg)',
            }}>
              <input
                type="color"
                value={cat.color}
                onChange={e => updateColor(cat.name, e.target.value)}
                style={{ width: 26, height: 26, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0, background: 'none' }}
              />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: cat.color }}>{cat.name}</span>
              <button
                onClick={() => remove(cat.name)}
                disabled={cats.length <= 1}
                style={{
                  background: 'none', border: 'none', cursor: cats.length <= 1 ? 'not-allowed' : 'pointer',
                  color: '#ef4444', fontSize: 16, lineHeight: 1, opacity: cats.length <= 1 ? 0.3 : 1,
                }}
              >×</button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Add Category</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="color"
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
              style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', padding: 2, flexShrink: 0 }}
            />
            <input
              style={{ ...INP, flex: 1, marginBottom: 0 }}
              placeholder="Name (e.g. GOLD)"
              value={newName}
              maxLength={12}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
            <button onClick={add} style={{
              padding: '6px 12px', borderRadius: 7, border: 'none',
              background: 'var(--text-1, #0f172a)', color: 'var(--panel, #fff)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            }}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Props {
  layout: LayoutState;
  selectedSectionId: string | null;
  onAddRow: (sectionId: string, rowLabel: string, seatCount: number, price: number, category: Category, color?: string) => void;
  onDeleteRow: (rowId: string) => void;
  onDuplicateRow: (rowId: string) => void;
  onUpdateRow: (rowId: string, updates: { label?: string; seatCount?: number; price?: number; category?: Category; color?: string; seatSpacing?: number; numberScheme?: string }) => void;
  onClearRowSeats: (rowId: string) => void;
  onRestoreRowSeats: (rowId: string) => void;
  onSplitRow: (rowId: string, seatIds: string[]) => void;
  onSelectSeat: (seatId: string) => void;
  selectedSeatId: string | null;
  onAddCurvedRows: (sectionId: string, cx: number, cy: number, innerRadius: number, rowCount: number, rowSpacing: number, a0deg: number, a1deg: number, category: Category, price: number) => void;
  onCreateArcSection: (label: string, cx: number, cy: number, innerRadius: number, rowCount: number, rowSpacing: number, a0deg: number, a1deg: number, category: Category, price: number) => void;
  onSetDisplayMode: (sectionId: string, mode: 'rows' | 'seats' | 'both') => void;
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

function SeatStrip({ seats, selectedSeatId, onSelect, customCats, selectedIds, onToggle }: {
  seats: BSeat[];
  selectedSeatId: string | null;
  onSelect: (id: string) => void;
  customCats: CustomCategory[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const sorted = [...seats].sort((a, b) => a.number - b.number);
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 5,
      padding: '10px', background: 'var(--bg)',
      borderRadius: 8, border: '1px solid var(--border)',
      maxHeight: 120, overflowY: 'auto',
      marginTop: 6, marginBottom: 8,
    }}>
      {sorted.map(seat => {
        const col = getCatColor(customCats, seat.category);
        const isSel = seat.id === selectedSeatId;
        const isMultiSel = selectedIds.has(seat.id);
        const isSold = seat.status !== 'available';
        return (
          <button
            key={seat.id}
            title={`Seat ${seat.label} · $${seat.price} · ${seat.status}`}
            onClick={() => onToggle(seat.id)}
            onDoubleClick={() => onSelect(seat.id)}
            style={{
              width: 28, height: 28,
              borderRadius: 6,
              border: `2px solid ${isMultiSel ? '#f59e0b' : isSel ? '#2563eb' : col}`,
              background: isSold ? '#94a3b8' : isMultiSel ? '#fef3c7' : (isSel ? '#2563eb22' : col + '22'),
              cursor: 'pointer',
              fontSize: 9, fontWeight: 700,
              color: isMultiSel ? '#b45309' : isSel ? '#2563eb' : col,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, lineHeight: 1,
              transition: 'all 0.1s', flexShrink: 0,
              boxShadow: isMultiSel ? '0 0 0 2px #fde68a' : 'none',
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
  customCats: CustomCategory[];
  expanded: boolean;
  selectedSeatId: string | null;
  onToggle: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (updates: { label?: string; seatCount?: number; price?: number; category?: Category; color?: string; seatSpacing?: number; numberScheme?: string }) => void;
  onClearSeats: () => void;
  onRestoreSeats: () => void;
  onSelectSeat: (id: string) => void;
  onManageCats: () => void;
  onSplitRow: (seatIds: string[]) => void;
}

function RowItem({ rowId, rowLabel, seats, customCats, expanded, selectedSeatId, onToggle, onDelete, onDuplicate, onUpdate, onClearSeats, onRestoreSeats, onSelectSeat, onManageCats, onSplitRow }: RowItemProps) {
  const sorted = [...seats].sort((a, b) => a.number - b.number);
  const avgPrice = seats.length ? Math.round(seats.reduce((s, x) => s + x.price, 0) / seats.length) : 0;
  const category = seats[0]?.category || 'STANDARD';
  const col = getCatColor(customCats, category);
  const [editLabel, setEditLabel] = useState(rowLabel);
  const [editSeats, setEditSeats] = useState(seats.length);
  const [editPrice, setEditPrice] = useState(avgPrice);
  const [editSpacing, setEditSpacing] = useState(5);
  const [editScheme, setEditScheme] = useState<string>('1,2,3');
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set());

  const toggleSeat = (id: string) => setMultiSel(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                {multiSel.size > 0 ? `${multiSel.size} seat${multiSel.size > 1 ? 's' : ''} selected` : 'Tap seats to select → Divide'}
              </div>
              {multiSel.size > 0 && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button onClick={() => { onSplitRow([...multiSel]); setMultiSel(new Set()); }} style={{
                    padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: 'none', background: '#f59e0b', color: '#fff',
                  }}>✂ Divide</button>
                  <button onClick={() => setMultiSel(new Set())} style={{
                    padding: '4px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-3)',
                  }}>✕</button>
                </div>
              )}
            </div>
            <SeatStrip seats={seats} selectedSeatId={selectedSeatId} onSelect={onSelectSeat} customCats={customCats} selectedIds={multiSel} onToggle={toggleSeat} />
          </div>

          {/* Seats on/off toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button
              onClick={seats.length > 0 ? onClearSeats : onRestoreSeats}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${seats.length > 0 ? '#ef4444' : '#10b981'}`,
                background: seats.length > 0 ? '#fff5f5' : '#f0fdf4',
                color: seats.length > 0 ? '#ef4444' : '#10b981',
              }}
            >
              {seats.length > 0 ? '🚫 Remove Seats' : '✚ Add Seats'}
            </button>
          </div>
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

          {/* Row color */}
          <div style={{ marginBottom: 8 }}>
            <label style={LBL}>Row Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                defaultValue={col}
                onChange={e => onUpdate({ color: e.target.value })}
                style={{ width: 36, height: 28, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2, background: 'none' }}
              />
              <button
                onClick={() => onUpdate({ color: undefined })}
                style={{ fontSize: 10, color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
              >Reset</button>
              {/* Quick color swatches */}
              {['#3b82f6','#f59e0b','#ef4444','#10b981','#a855f7','#f97316'].map(c => (
                <div key={c} onClick={() => onUpdate({ color: c })} style={{
                  width: 18, height: 18, borderRadius: 4, background: c, cursor: 'pointer',
                  border: col === c ? '2px solid #0f172a' : '1px solid transparent', flexShrink: 0,
                }} />
              ))}
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

          <div style={{ marginBottom: 8 }}>
            <label style={LBL}>Seat Spacing</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button style={STEP_BTN} onClick={() => { const v = Math.max(1, editSpacing - 1); setEditSpacing(v); onUpdate({ seatSpacing: v }); }}>−</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', minWidth: 28, textAlign: 'center' }}>{editSpacing}</span>
              <button style={STEP_BTN} onClick={() => { const v = editSpacing + 1; setEditSpacing(v); onUpdate({ seatSpacing: v }); }}>+</button>
              <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 2 }}>pt</span>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={LBL}>Seat Numbering</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['1,2,3', 'odd', 'even', 'rtl'] as const).map(s => (
                <button key={s} onClick={() => { setEditScheme(s); onUpdate({ numberScheme: s }); }} style={{
                  padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${editScheme === s ? 'var(--accent, #C97B36)' : 'var(--border)'}`,
                  background: editScheme === s ? 'rgba(201,123,54,0.1)' : 'var(--bg)',
                  color: editScheme === s ? 'var(--accent, #C97B36)' : 'var(--text-3)',
                }}>{s === '1,2,3' ? '1,2,3' : s === 'odd' ? 'Odd' : s === 'even' ? 'Even' : 'RTL'}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={LBL}>Category</label>
              <button onClick={onManageCats} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--accent, #C97B36)', fontWeight: 700, padding: 0 }}>
                + Manage
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {customCats.map(c => {
                const active = category === c.name;
                return (
                  <button key={c.name} onClick={() => { onUpdate({ category: c.name as Category, color: c.color }); }} style={{
                    padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${active ? c.color : 'var(--border)'}`,
                    background: active ? c.color + '18' : 'var(--bg)',
                    color: active ? c.color : 'var(--text-3)',
                  }}>{c.name}</button>
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
  layout, selectedSectionId, onAddRow, onDeleteRow, onDuplicateRow, onUpdateRow, onClearRowSeats, onRestoreRowSeats, onSplitRow, onSelectSeat, selectedSeatId, onAddCurvedRows, onCreateArcSection, onSetDisplayMode,
}: Props) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCurvedForm, setShowCurvedForm] = useState(false);
  const [addLabel, setAddLabel] = useState('A');
  const [addSeats, setAddSeats] = useState(20);
  const [addPrice, setAddPrice] = useState(100);
  const [addCat, setAddCat] = useState<string>('STANDARD');
  
  const [filterSection, setFilterSection] = useState<string>('__all__');
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(null);

  if (selectedSectionId !== prevSelectedId) {
    setPrevSelectedId(selectedSectionId);
    setFilterSection(selectedSectionId || '__all__');
  }

  const [customCats, setCustomCats] = useState<CustomCategory[]>(DEFAULT_CATS);
  const [showManageCats, setShowManageCats] = useState(false);
  // Curved rows state
  const [curveCx, setCurveCx] = useState(0);
  const [curveCy, setCurveCy] = useState(0);
  const [curveInnerR, setCurveInnerR] = useState(80);
  const [curveRowCount, setCurveRowCount] = useState(8);
  const [curveSpacing, setCurveSpacing] = useState(14);
  const [curveA0, setCurveA0] = useState(-150);
  const [curveA1, setCurveA1] = useState(-30);
  const [curveCat, setCurveCat] = useState<string>('STANDARD');
  const [curvePrice, setCurvePrice] = useState(100);
  const [curveSecLabel, setCurveSecLabel] = useState('101');

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

  const firstSeatSectionId = useMemo(() => layout.seats[0]?.sectionId || null, [layout.seats]);
  const activeSectionId = filterSection !== '__all__' ? filterSection : (sections[0]?.id || firstSeatSectionId);

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
    setShowCurvedForm(false);
  };

  const handleOpenCurved = () => {
    // Auto-set center from selected section centroid
    if (activeSectionId) {
      const shape = layout.shapes.find(s => s.id === activeSectionId);
      if (shape) {
        setCurveCx(Math.round(shape.cx));
        setCurveCy(Math.round(shape.cy));
      }
    }
    setShowCurvedForm(true);
    setShowAddForm(false);
  };

  const handleAddCurved = () => {
    if (!activeSectionId) return;
    onAddCurvedRows(activeSectionId, curveCx, curveCy, curveInnerR, curveRowCount, curveSpacing, curveA0, curveA1, curveCat as Category, curvePrice);
    setShowCurvedForm(false);
  };

  const handleAdd = () => {
    if (!activeSectionId) return;
    const catColor = getCatColor(customCats, addCat);
    onAddRow(activeSectionId, addLabel, addSeats, addPrice, addCat as Category, catColor);
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

        {/* Display mode toggle — shown when a section is active */}
        {activeSectionId && (() => {
          const sec = layout.shapes.find(s => s.id === activeSectionId);
          const dm = sec?.displayMode || 'both';
          const modes: { key: 'rows' | 'seats' | 'both'; label: string }[] = [
            { key: 'rows', label: '≡ Rows' },
            { key: 'both', label: '⊞ Both' },
            { key: 'seats', label: '● Seats' },
          ];
          return (
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {modes.map(m => (
                <button key={m.key} onClick={() => onSetDisplayMode(activeSectionId, m.key)} style={{
                  flex: 1, padding: '5px 0', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${dm === m.key ? '#3b82f6' : 'var(--border)'}`,
                  background: dm === m.key ? '#eff6ff' : 'var(--bg)',
                  color: dm === m.key ? '#3b82f6' : 'var(--text-3)',
                }}>{m.label}</button>
              ))}
            </div>
          );
        })()}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={LBL}>Category</label>
              <button onClick={() => setShowManageCats(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--accent, #C97B36)', fontWeight: 700, padding: 0 }}>
                + Manage
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {customCats.map(c => {
                const active = addCat === c.name;
                return (
                  <button key={c.name} onClick={() => setAddCat(c.name)} style={{
                    padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${active ? c.color : 'var(--border)'}`,
                    background: active ? c.color + '18' : 'var(--bg)',
                    color: active ? c.color : 'var(--text-3)',
                  }}>{c.name}</button>
                );
              })}
            </div>
          </div>

          {/* Preview strip */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...LBL, marginBottom: 4 }}>Preview</label>
            <div style={{ display: 'flex', gap: 2, padding: '6px 8px', background: 'var(--bg)', borderRadius: 7, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10, fontWeight: 800, color: getCatColor(customCats, addCat),
                minWidth: 20, textAlign: 'center', marginRight: 3,
              }}>{addLabel}</span>
              {Array.from({ length: Math.min(addSeats, 30) }, (_, i) => (
                <div key={i} style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: getCatColor(customCats, addCat) + '30',
                  border: `1px solid ${getCatColor(customCats, addCat)}`,
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

      {/* ── Curved Rows Form ── */}
      {showCurvedForm && (
        <div style={{
          margin: '8px 10px',
          padding: '12px',
          background: 'var(--accent-soft, #f0f9ff)',
          border: '1.5px solid #3b82f6',
          borderRadius: 10,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 10 }}>
            ⌒ Curved Rows Generator
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={LBL}>Arc Center X</label>
              <input style={INP} type="number" value={curveCx} onChange={e => setCurveCx(+e.target.value)} />
            </div>
            <div>
              <label style={LBL}>Arc Center Y</label>
              <input style={INP} type="number" value={curveCy} onChange={e => setCurveCy(+e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={LBL}>Inner Radius</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button style={STEP_BTN} onClick={() => setCurveInnerR(v => Math.max(10, v - 10))}>−</button>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', minWidth: 36, textAlign: 'center' }}>{curveInnerR}</span>
                <button style={STEP_BTN} onClick={() => setCurveInnerR(v => v + 10)}>+</button>
              </div>
            </div>
            <div>
              <label style={LBL}>Row Spacing</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button style={STEP_BTN} onClick={() => setCurveSpacing(v => Math.max(8, v - 1))}>−</button>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', minWidth: 28, textAlign: 'center' }}>{curveSpacing}</span>
                <button style={STEP_BTN} onClick={() => setCurveSpacing(v => v + 1)}>+</button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={LBL}>Number of Rows</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button style={STEP_BTN} onClick={() => setCurveRowCount(v => Math.max(1, v - 1))}>−</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', minWidth: 28, textAlign: 'center' }}>{curveRowCount}</span>
              <button style={STEP_BTN} onClick={() => setCurveRowCount(v => v + 1)}>+</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={LBL}>Start Angle °</label>
              <input style={INP} type="number" value={curveA0} onChange={e => setCurveA0(+e.target.value)} />
            </div>
            <div>
              <label style={LBL}>End Angle °</label>
              <input style={INP} type="number" value={curveA1} onChange={e => setCurveA1(+e.target.value)} />
            </div>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 8 }}>
            0° = right, 90° = down, −90° = up. Typical section: −150° to −30°
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={LBL}>Price ($)</label>
            <input style={INP} type="number" min={0} value={curvePrice} onChange={e => setCurvePrice(+e.target.value)} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={LBL}>Category</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {customCats.map(c => {
                const active = curveCat === c.name;
                return (
                  <button key={c.name} onClick={() => setCurveCat(c.name)} style={{
                    padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${active ? c.color : 'var(--border)'}`,
                    background: active ? c.color + '18' : 'var(--bg)',
                    color: active ? c.color : 'var(--text-3)',
                  }}>{c.name}</button>
                );
              })}
            </div>
          </div>

          {/* Arc preview */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...LBL, marginBottom: 4 }}>Preview ({curveRowCount} rows, ~{Math.round(Math.abs(curveA1 - curveA0) / 360 * 2 * Math.PI * curveInnerR / 13)} seats/row)</label>
            <svg width="100%" height="60" viewBox="-120 -70 240 80" style={{ display: 'block', background: 'var(--bg)', borderRadius: 7, border: '1px solid var(--border)' }}>
              {Array.from({ length: curveRowCount }, (_, i) => {
                const r = curveInnerR * 0.4 + i * curveSpacing * 0.4;
                const a0r = (curveA0 * Math.PI) / 180;
                const a1r = (curveA1 * Math.PI) / 180;
                const x0 = Math.cos(a0r) * r, y0 = Math.sin(a0r) * r;
                const x1 = Math.cos(a1r) * r, y1 = Math.sin(a1r) * r;
                const large = Math.abs(curveA1 - curveA0) > 180 ? 1 : 0;
                const sweep = curveA1 > curveA0 ? 1 : 0;
                const col = getCatColor(customCats, curveCat);
                return (
                  <path
                    key={i}
                    d={`M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`}
                    fill="none"
                    stroke={col}
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity={0.7}
                  />
                );
              })}
            </svg>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleAddCurved} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              background: '#3b82f6', color: '#fff',
              fontSize: 11, fontWeight: 700, cursor: activeSectionId ? 'pointer' : 'not-allowed',
              opacity: activeSectionId ? 1 : 0.5,
            }} disabled={!activeSectionId}>
              Add to Section
            </button>
            <button onClick={() => {
              onCreateArcSection(curveSecLabel, curveCx, curveCy, curveInnerR, curveRowCount, curveSpacing, curveA0, curveA1, curveCat as Category, curvePrice);
              setShowCurvedForm(false);
            }} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              background: '#0f172a', color: '#fff',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>
              + New Arc Section
            </button>
            <button onClick={() => setShowCurvedForm(false)} style={{
              padding: '8px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text-2)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>✕</button>
          </div>

          {/* Section label for new arc section */}
          <div style={{ marginTop: 8 }}>
            <label style={LBL}>New Section Label</label>
            <input style={INP} value={curveSecLabel} onChange={e => setCurveSecLabel(e.target.value)} placeholder="e.g. 101" />
          </div>
        </div>
      )}

      {/* ── Row List ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px 60px' }}>
        {rowEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>💺</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>No rows yet</div>
            <div style={{ fontSize: 11 }}>
              Click <strong>&quot;+ Add Row&quot;</strong> below to start building your seating layout.
            </div>
          </div>
        ) : (
          rowEntries.map(({ rowId, sectionId, rowLabel, seats }) => (
            <RowItem
              key={rowId}
              rowId={rowId}
              rowLabel={rowLabel}
              seats={seats}
              customCats={customCats}
              expanded={expandedRowId === rowId}
              selectedSeatId={selectedSeatId}
              onToggle={() => setExpandedRowId(expandedRowId === rowId ? null : rowId)}
              onDuplicate={() => onDuplicateRow(rowId)}
              onDelete={() => {
                onDeleteRow(rowId);
                if (expandedRowId === rowId) setExpandedRowId(null);
              }}
              onUpdate={updates => onUpdateRow(rowId, updates)}
              onClearSeats={() => onClearRowSeats(rowId)}
              onRestoreSeats={() => onRestoreRowSeats(rowId)}
              onSelectSeat={onSelectSeat}
              onManageCats={() => setShowManageCats(true)}
              onSplitRow={(seatIds) => onSplitRow(rowId, seatIds)}
            />
          ))
        )}
      </div>

      {/* ── Sticky Add Buttons ── */}
      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0,
        padding: '10px 10px 12px',
        background: 'var(--panel)',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 6,
      }}>
        <button
          onClick={handleOpenAdd}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 9,
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
        <button
          onClick={handleOpenCurved}
          title="Generate concentric curved rows (stadium-style)"
          style={{
            flex: 1, padding: '10px 0', borderRadius: 9,
            border: '2px dashed #3b82f6',
            background: 'transparent',
            color: '#3b82f6',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.08)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
        >
          ⌒ Curved
        </button>
      </div>

      {/* ── Manage Categories Modal ── */}
      {showManageCats && (
        <ManageCategoriesModal
          cats={customCats}
          onClose={() => setShowManageCats(false)}
          onChange={setCustomCats}
        />
      )}
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

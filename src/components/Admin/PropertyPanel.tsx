'use client';
import React from 'react';
import type { Section, Seat } from '@/app/admin/page';

const CATEGORIES = ['FIELD', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'GENERAL'];
const CATEGORY_COLORS: Record<string, string> = {
  FIELD:'#FF6B35', PLATINUM:'#A855F7', GOLD:'#F59E0B',
  SILVER:'#94A3B8', BRONZE:'#D97706', GENERAL:'#3B82F6',
};

interface PropertyPanelProps {
  selectedSeat?: Seat;
  selectedSection?: Section;
  onUpdateSeat: (updates: Partial<Seat>) => void;
  onUpdateSection: (updates: Partial<Section>) => void;
}

export default function PropertyPanel({
  selectedSeat, selectedSection, onUpdateSeat, onUpdateSection,
}: PropertyPanelProps) {
  if (!selectedSeat && !selectedSection) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🖱️</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Select an element</div>
        <div style={{ fontSize: 11, marginTop: 6 }}>
          Click a seat or section to edit its properties
        </div>
      </div>
    );
  }

  if (selectedSeat) {
    return (
      <div className="animate-slide-up">
        <div className="property-group">
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>
            🪑 Seat Properties
          </div>

          <label className="property-label">Seat ID</label>
          <input className="property-input" value={selectedSeat.seat_id}
            onChange={(e) => onUpdateSeat({ seat_id: e.target.value })} />
        </div>

        <div className="property-group">
          <label className="property-label">Row</label>
          <input className="property-input" value={selectedSeat.row}
            onChange={(e) => onUpdateSeat({ row: e.target.value })} />
        </div>

        <div className="property-group">
          <label className="property-label">Seat Number</label>
          <input className="property-input" type="number" value={selectedSeat.number}
            onChange={(e) => onUpdateSeat({ number: Number(e.target.value) })} />
        </div>

        <div className="property-group">
          <label className="property-label">Price (USD)</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', fontWeight: 700,
            }}>$</span>
            <input
              className="property-input"
              type="number"
              value={selectedSeat.price}
              style={{ paddingLeft: 22 }}
              onChange={(e) => onUpdateSeat({ price: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="property-group">
          <label className="property-label">Category</label>
          <select className="property-select" value={selectedSeat.category}
            onChange={(e) => onUpdateSeat({ category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="property-group">
          <label className="property-label">Status</label>
          <select className="property-select" value={selectedSeat.status}
            onChange={(e) => onUpdateSeat({ status: e.target.value as Seat['status'] })}>
            <option value="available">Available</option>
            <option value="locked">Locked</option>
            <option value="sold">Sold</option>
          </select>
        </div>

        <div className="property-group">
          <label className="property-label">Position</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>X</label>
              <input className="property-input" type="number" value={Math.round(selectedSeat.x)}
                onChange={(e) => onUpdateSeat({ x: Number(e.target.value) })} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Y</label>
              <input className="property-input" type="number" value={Math.round(selectedSeat.y)}
                onChange={(e) => onUpdateSeat({ y: Number(e.target.value) })} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedSection) {
    return (
      <div className="animate-slide-up">
        <div className="property-group">
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>
            ⬡ Section Properties
          </div>

          <label className="property-label">Section ID</label>
          <input className="property-input" value={selectedSection.section_id}
            onChange={(e) => onUpdateSection({ section_id: e.target.value })} />
        </div>

        <div className="property-group">
          <label className="property-label">Label</label>
          <input className="property-input" value={selectedSection.label}
            onChange={(e) => onUpdateSection({ label: e.target.value })} />
        </div>

        <div className="property-group">
          <label className="property-label">Category</label>
          <select className="property-select" value={selectedSection.category}
            onChange={(e) => {
              onUpdateSection({ category: e.target.value, color: CATEGORY_COLORS[e.target.value] });
            }}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="property-group">
          <label className="property-label">Color</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={selectedSection.color}
              onChange={(e) => onUpdateSection({ color: e.target.value })}
              style={{ width: 36, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'transparent' }} />
            <input className="property-input" value={selectedSection.color}
              onChange={(e) => onUpdateSection({ color: e.target.value })}
              style={{ flex: 1, fontFamily: 'monospace' }} />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

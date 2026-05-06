/**
 * Enhanced Properties Panel — Row-level pricing, accessibility, obstructed views, VIP flags, photo upload
 */
'use client';
import { useState } from 'react';
import type { BShape, BSeat, BRow, Category, VenueLevel } from './builderTypes2';

interface Props {
  selectedEntity: BShape | BSeat | BRow | null;
  onUpdate: (updates: any) => void;
  onUploadPhoto: (file: File) => Promise<string>;
}

export default function EnhancedPropertiesPanel({ selectedEntity, onUpdate, onUploadPhoto }: Props) {
  const [photoUploading, setPhotoUploading] = useState(false);

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setPhotoUploading(true);
    try {
      const url = await onUploadPhoto(file);
      onUpdate({ photoUrl: url });
    } catch (err) {
      alert('Photo upload failed');
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 16 }}>
      {/* Basic Info */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>
          {isShape && 'Section Properties'}
          {isSeat && 'Seat Properties'}
          {isRow && 'Row Properties'}
        </h3>

        <div style={fieldGroup}>
          <label style={label}>Label</label>
          <input
            type="text"
            value={selectedEntity.label}
            onChange={e => onUpdate({ label: e.target.value })}
            style={input}
          />
        </div>

        <div style={fieldGroup}>
          <label style={label}>Category</label>
          <select
            value={selectedEntity.category}
            onChange={e => onUpdate({ category: e.target.value as Category })}
            style={input}
          >
            <option value="VIP">VIP</option>
            <option value="PREMIUM">Premium</option>
            <option value="STANDARD">Standard</option>
            <option value="BUDGET">Budget</option>
            <option value="GA">General Admission</option>
          </select>
        </div>
      </div>

      {/* Section-specific */}
      {isShape && (
        <>
          <div style={fieldGroup}>
            <label style={label}>Venue Level</label>
            <select
              value={(selectedEntity as BShape).level || '100'}
              onChange={e => onUpdate({ level: e.target.value as VenueLevel })}
              style={input}
            >
              <option value="100">100 Level (Lower Bowl)</option>
              <option value="200">200 Level (Mezzanine)</option>
              <option value="300">300 Level (Upper Bowl)</option>
              <option value="SUITE">Suite Level</option>
              <option value="CLUB">Club Level</option>
            </select>
          </div>

          <div style={fieldGroup}>
            <label style={label}>Curve Radius (0 = straight)</label>
            <input
              type="number"
              value={(selectedEntity as BShape).curveRadius || 0}
              onChange={e => onUpdate({ curveRadius: +e.target.value || undefined })}
              style={input}
              min={0}
              max={1000}
            />
          </div>

          <div style={fieldGroup}>
            <label style={label}>Section Photo (Seat View)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ fontSize: 11 }}
                disabled={photoUploading}
              />
              {photoUploading && <span style={{ fontSize: 10, color: '#3b82f6' }}>Uploading...</span>}
            </div>
            {(selectedEntity as BShape).photoUrl && (
              <img
                src={(selectedEntity as BShape).photoUrl}
                alt="Seat view"
                style={{ width: '100%', borderRadius: 6, marginTop: 8 }}
              />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(selectedEntity as BShape).isAccessible || false}
                onChange={e => onUpdate({ isAccessible: e.target.checked })}
              />
              <span>♿ Accessible Section</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(selectedEntity as BShape).isObstructed || false}
                onChange={e => onUpdate({ isObstructed: e.target.checked })}
              />
              <span>⚠️ Obstructed View</span>
            </label>
          </div>
        </>
      )}

      {/* Row-specific */}
      {isRow && (
        <>
          <div style={fieldGroup}>
            <label style={label}>Row Price Override ($)</label>
            <input
              type="number"
              value={(selectedEntity as BRow).priceOverride || ''}
              onChange={e => onUpdate({ priceOverride: +e.target.value || undefined })}
              style={input}
              placeholder="Leave empty to use section price"
              min={0}
            />
          </div>

          <div style={fieldGroup}>
            <label style={label}>Curve Radius</label>
            <input
              type="number"
              value={(selectedEntity as BRow).curveRadius || 0}
              onChange={e => onUpdate({ curveRadius: +e.target.value || undefined })}
              style={input}
              min={0}
              max={500}
            />
          </div>

          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#475569' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Row Stats:</div>
            <div>Seats: {(selectedEntity as BRow).seats.length}</div>
            <div>Avg Price: ${((selectedEntity as BRow).seats.reduce((sum, s) => sum + s.price, 0) / (selectedEntity as BRow).seats.length).toFixed(2)}</div>
          </div>
        </>
      )}

      {/* Seat-specific */}
      {isSeat && (
        <>
          <div style={fieldGroup}>
            <label style={label}>Price ($)</label>
            <input
              type="number"
              value={(selectedEntity as BSeat).price}
              onChange={e => onUpdate({ price: +e.target.value })}
              style={input}
              min={0}
            />
          </div>

          <div style={fieldGroup}>
            <label style={label}>Status</label>
            <select
              value={(selectedEntity as BSeat).status}
              onChange={e => onUpdate({ status: e.target.value })}
              style={input}
            >
              <option value="available">Available</option>
              <option value="sold">Sold</option>
              <option value="locked">Locked</option>
              <option value="obstructed">Obstructed View</option>
            </select>
          </div>

          <div style={fieldGroup}>
            <label style={label}>Position</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                type="number"
                value={(selectedEntity as BSeat).x.toFixed(1)}
                onChange={e => onUpdate({ x: +e.target.value })}
                style={input}
                placeholder="X"
              />
              <input
                type="number"
                value={(selectedEntity as BSeat).y.toFixed(1)}
                onChange={e => onUpdate({ y: +e.target.value })}
                style={input}
                placeholder="Y"
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(selectedEntity as BSeat).isAccessible || false}
                onChange={e => onUpdate({ isAccessible: e.target.checked })}
              />
              <span>♿ Wheelchair Accessible</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(selectedEntity as BSeat).isCompanion || false}
                onChange={e => onUpdate({ isCompanion: e.target.checked })}
              />
              <span>👥 Companion Seat</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(selectedEntity as BSeat).isObstructed || false}
                onChange={e => onUpdate({ isObstructed: e.target.checked })}
              />
              <span>⚠️ Obstructed View</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(selectedEntity as BSeat).isVIP || false}
                onChange={e => onUpdate({ isVIP: e.target.checked })}
              />
              <span>⭐ VIP / Premium</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(selectedEntity as BSeat).aisleGap || false}
                onChange={e => onUpdate({ aisleGap: e.target.checked })}
              />
              <span>🚪 Aisle Seat</span>
            </label>
          </div>
        </>
      )}

      {/* Delete button */}
      <button
        onClick={() => onUpdate({ _delete: true })}
        style={{
          padding: '9px 16px',
          fontSize: 12,
          fontWeight: 600,
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg)',
          color: '#dc2626',
          cursor: 'pointer',
          marginTop: 8,
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M4 3l.5 8h4L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Delete {isShape ? 'Section' : isSeat ? 'Seat' : 'Row'}
      </button>
    </div>
  );
}

const fieldGroup: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 12,
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-2)',
};

const input: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 12,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg)',
  color: 'var(--text-1)',
  fontFamily: 'inherit',
};

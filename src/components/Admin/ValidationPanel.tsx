'use client';
import React from 'react';
import type { ValidationError } from '@/app/admin/page';

export default function ValidationPanel({ errors }: { errors: ValidationError[] }) {
  if (!errors.length) return null;

  const grouped = {
    duplicate_id: errors.filter((e) => e.type === 'duplicate_id'),
    overlap: errors.filter((e) => e.type === 'overlap'),
    spacing: errors.filter((e) => e.type === 'spacing'),
  };

  return (
    <div style={{
      background: 'rgba(10,14,26,0.92)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 'var(--radius-md)',
      padding: 14,
      maxHeight: 200,
      overflowY: 'auto',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: 1, color: 'var(--danger)', marginBottom: 10, display: 'flex',
        alignItems: 'center', gap: 6,
      }}>
        ⚠️ {errors.length} Validation Error{errors.length !== 1 ? 's' : ''}
      </div>

      {grouped.duplicate_id.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>DUPLICATE IDs</div>
          {grouped.duplicate_id.map((e, i) => (
            <div key={i} className="validation-error">
              <span className="validation-error-icon">⊗</span>
              <span>{e.message}</span>
            </div>
          ))}
        </div>
      )}

      {grouped.spacing.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>SPACING VIOLATIONS</div>
          {grouped.spacing.slice(0, 3).map((e, i) => (
            <div key={i} className="validation-error">
              <span className="validation-error-icon">↔</span>
              <span>{e.message}</span>
            </div>
          ))}
          {grouped.spacing.length > 3 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>
              +{grouped.spacing.length - 3} more spacing issues
            </div>
          )}
        </div>
      )}
    </div>
  );
}

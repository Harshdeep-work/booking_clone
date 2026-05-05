'use client';
import React from 'react';

interface SectionInfo {
  section_id: string;
  label: string;
  category: string;
  color: string;
  availableCount: number;
  price: number;
  badge?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  FIELD:    '🔥 Field Level',
  PLATINUM: '💜 Platinum',
  GOLD:     '⭐ Gold',
  SILVER:   '🪨 Silver',
  BRONZE:   '🟤 Bronze',
  GENERAL:  '🎫 General',
};

export default function SectionTooltip({ section }: { section: SectionInfo }) {
  const availability =
    section.availableCount === 0
      ? 'Sold Out'
      : section.availableCount < 10
      ? `${section.availableCount} left!`
      : `${section.availableCount} available`;

  const urgency = section.availableCount < 10 && section.availableCount > 0;

  return (
    <div className="tooltip-card animate-slide-up">
      <div className="tooltip-header">
        <div>
          <div className="tooltip-section-name">{section.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {CATEGORY_LABELS[section.category] || section.category}
          </div>
        </div>

        {section.badge && (
          <span
            className={`badge ${section.badge === 'Amazing Deal' ? 'badge-amazing' : 'badge-great'}`}
          >
            {section.badge === 'Amazing Deal' ? '🔥' : '✓'} {section.badge}
          </span>
        )}
      </div>

      <div className="tooltip-header" style={{ marginTop: 10 }}>
        <div className="tooltip-price">from ${section.price}</div>
        <div
          style={{
            fontSize: 11,
            color: urgency ? 'var(--danger)' : 'var(--text-secondary)',
            fontWeight: urgency ? 700 : 400,
          }}
        >
          {urgency && '⚡ '}{availability}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          height: 3,
          borderRadius: 99,
          background: `linear-gradient(90deg, ${section.color}, transparent)`,
          opacity: 0.6,
        }}
      />

      <div className="tooltip-meta" style={{ marginTop: 8 }}>
        <span>Click to select seats</span>
      </div>
    </div>
  );
}

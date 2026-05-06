'use client';
import React from 'react';
export type Tool = 'select' | 'section' | 'row' | 'seat' | 'pan';

interface AdminToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onDelete: () => void;
  hasSelection: boolean;
}

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'select',  icon: '↖',  label: 'Select / Move' },
  { id: 'section', icon: '⬡',  label: 'Draw Section (Polygon)' },
  { id: 'row',     icon: '—',  label: 'Draw Row (Line)' },
  { id: 'seat',    icon: '●',  label: 'Place Seat' },
  { id: 'pan',     icon: '✋', label: 'Pan Canvas' },
];

export default function AdminToolbar({ activeTool, onToolChange, onDelete, hasSelection }: AdminToolbarProps) {
  return (
    <div className="admin-toolbar">
      {TOOLS.map((tool, i) => (
        <React.Fragment key={tool.id}>
          {i === TOOLS.length - 1 && <div className="tool-btn-divider" />}
          <button
            className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
            style={{ fontSize: tool.id === 'pan' ? 18 : 16 }}
          >
            {tool.icon}
          </button>
        </React.Fragment>
      ))}

      <div className="tool-btn-divider" />

      {/* Undo placeholder */}
      <button className="tool-btn" title="Undo (Ctrl+Z)" style={{ opacity: 0.4 }}>
        ↩
      </button>
      <button className="tool-btn" title="Redo (Ctrl+Y)" style={{ opacity: 0.4 }}>
        ↪
      </button>

      <div className="tool-btn-divider" />

      {/* Delete */}
      <button
        className="tool-btn"
        onClick={onDelete}
        disabled={!hasSelection}
        title="Delete selected"
        style={{ color: hasSelection ? 'var(--danger)' : 'var(--text-muted)', opacity: hasSelection ? 1 : 0.3 }}
      >
        🗑
      </button>
    </div>
  );
}

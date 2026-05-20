/**
 * Advanced Tools Panel — Grid Generator, Templates, Import/Export, Validation, Split/Merge/Rotate
 */
'use client';
import { useState, useRef } from 'react';
import type { SectionTemplate } from './advancedTools';
import { SECTION_TEMPLATES, applyTemplate, validateLayout, importFromCSV, exportToCSV, exportToGeoJSON, importFromGeoJSON, fillArcSectionWithSeats } from './advancedTools';
import type { LayoutState, ValidationResult } from './builderTypes2';

interface Props {
  layout: LayoutState;
  selectedSectionId: string | null;
  onApplyGrid: (sectionId: string, rows: any[], seats: any[]) => void;
  onApplyTemplate: (shape: any) => void;
  onImport: (data: Partial<LayoutState>) => void;
  onExport: (format: 'csv' | 'geojson') => void;
  onValidate: () => void;
  onSplitSection?: (id: string, axis: 'h' | 'v') => void;
  onMergeSections?: (ids: string[]) => void;
  onRotate?: (deg: number) => void;
  onAddAisle?: (sectionId: string, afterSeat: number, width: number, axis: 'v' | 'h') => void;
  onSetDensity?: (sectionId: string, density: number) => void;
  onAutoBalance?: (sectionId: string) => void;
  selectedIds?: Set<string>;
  activeTab?: 'tools' | 'spacing' | 'import' | 'validate';
  onTabChange?: (tab: 'tools' | 'spacing' | 'import' | 'validate') => void;
}

export default function AdvancedToolsPanel({ layout, selectedSectionId, onApplyGrid, onApplyTemplate, onImport, onExport, onValidate, onSplitSection, onMergeSections, onRotate, onAddAisle, onSetDensity, onAutoBalance, selectedIds, activeTab, onTabChange }: Props) {
  const [localTab, setLocalTab] = useState<'tools' | 'spacing' | 'import' | 'validate'>(activeTab ?? 'tools');
  const tab = activeTab ?? localTab;
  const setTab = onTabChange ?? setLocalTab;
  const [rotateAngle, setRotateAngle] = useState(45);
  const [aisleAfterSeat, setAisleAfterSeat] = useState(6);
  const [aisleWidth, setAisleWidth] = useState(20);
  const [density, setDensity] = useState(100);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Arc fill state
  const [arcRows, setArcRows] = useState(10);
  const [arcSeats, setArcSeats] = useState(20);
  const [arcPrice, setArcPrice] = useState(100);

  const handleFillArc = () => {
    if (!selectedSectionId) return;
    const section = layout.shapes.find(s => s.id === selectedSectionId);
    if (!section) return;
    const { rows, seats } = fillArcSectionWithSeats(section, {
      numRows: arcRows, seatsPerRow: arcSeats, basePrice: arcPrice, category: section.category,
    });
    onApplyGrid(selectedSectionId, rows, seats);
  };


  const handleApplyTemplate = (template: SectionTemplate) => {
    const shape = applyTemplate(template, { x: 100, y: 100 }, 1.5);
    onApplyTemplate(shape);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const text = await file.text();
    
    if (file.name.endsWith('.csv')) {
      const { seats, errors } = importFromCSV(text);
      if (errors.length > 0) {
        console.warn('Import errors:', errors);
      }
      if (seats.length > 0) {
        onImport({ seats });
      }
    } else if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
      const geojson = JSON.parse(text);
      const { shapes, seats } = importFromGeoJSON(geojson);
      onImport({ shapes, seats });
    }
    
    e.target.value = '';
  };

  const handleExport = (format: 'csv' | 'geojson') => {
    let content: string;
    let filename: string;
    
    if (format === 'csv') {
      content = exportToCSV(layout, true);
      filename = 'venue-layout.csv';
    } else {
      content = JSON.stringify(exportToGeoJSON(layout), null, 2);
      filename = 'venue-layout.geojson';
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleValidate = () => {
    const result = validateLayout(layout);
    setValidation(result);
  };

  return (
    <div style={{ width: 320, background: 'var(--panel)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
        {(['tools', 'spacing', 'import', 'validate'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 4px', fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.5, border: 'none',
              background: tab === t ? 'var(--panel)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-3)',
              borderBottom: tab === t ? `2px solid var(--accent)` : '2px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t === 'tools' ? 'Tools' : t === 'spacing' ? 'Spacing' : t === 'import' ? 'I/O' : 'Validate'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {tab === 'spacing' && (() => {
          // Derive section from selected section shape OR from selected seats
          const activeSectionId: string | null = selectedSectionId
            || (selectedIds && selectedIds.size > 0
              ? (layout.seats.find(s => selectedIds!.has(s.id))?.sectionId ?? null)
              : null)
            || (layout.seats.length > 0 ? layout.seats[0].sectionId : null);

          // activeSectionId may be '' for unsectioned seats — treat '' as valid
          const hasSection = activeSectionId !== null && activeSectionId !== undefined;

          return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {!hasSection && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '12px', background: 'var(--bg)', borderRadius: 8, textAlign: 'center' }}>
                Select a section or seats to use spacing tools
              </div>
            )}

            {/* Vertical Aisle */}
            <div>
              <div style={sectionLabel}>Vertical Aisle</div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>Insert a gap after seat # in every row</p>
              <div style={fieldGroup}>
                <label style={label}>After seat #</label>
                <input type="number" value={aisleAfterSeat} min={1} max={100}
                  onChange={e => setAisleAfterSeat(+e.target.value)} style={input} />
              </div>
              <div style={{ ...fieldGroup, marginTop: 8 }}>
                <label style={label}>Aisle width (units)</label>
                <input type="number" value={aisleWidth} min={5} max={100}
                  onChange={e => setAisleWidth(+e.target.value)} style={input} />
              </div>
              <button disabled={!hasSection}
                onClick={() => hasSection && onAddAisle?.(activeSectionId!, aisleAfterSeat, aisleWidth, 'v')}
                style={{ ...primaryBtn, marginTop: 10, width: '100%', opacity: hasSection ? 1 : 0.5 }}>
                Add Vertical Aisle
              </button>
            </div>

            {/* Horizontal Gap */}
            <div>
              <div style={sectionLabel}>Horizontal Row Gap</div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>Insert extra spacing after row # (every N rows)</p>
              <div style={fieldGroup}>
                <label style={label}>After every N rows</label>
                <input type="number" value={aisleAfterSeat} min={1} max={50}
                  onChange={e => setAisleAfterSeat(+e.target.value)} style={input} />
              </div>
              <div style={{ ...fieldGroup, marginTop: 8 }}>
                <label style={label}>Gap height (units)</label>
                <input type="number" value={aisleWidth} min={5} max={100}
                  onChange={e => setAisleWidth(+e.target.value)} style={input} />
              </div>
              <button disabled={!hasSection}
                onClick={() => hasSection && onAddAisle?.(activeSectionId!, aisleAfterSeat, aisleWidth, 'h')}
                style={{ ...primaryBtn, marginTop: 10, width: '100%', opacity: hasSection ? 1 : 0.5 }}>
                Add Horizontal Gap
              </button>
            </div>

            {/* Seat Density */}
            <div>
              <div style={sectionLabel}>Seat Density</div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>Scale spacing between all seats in section</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <input type="range" min={50} max={200} value={density}
                  onChange={e => setDensity(+e.target.value)}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', minWidth: 36 }}>{density}%</span>
              </div>
              <button disabled={!hasSection}
                onClick={() => hasSection && onSetDensity?.(activeSectionId!, density / 100)}
                style={{ ...primaryBtn, width: '100%', opacity: hasSection ? 1 : 0.5 }}>
                Apply Density
              </button>
            </div>

            {/* Auto Balance */}
            <div>
              <div style={sectionLabel}>Auto Balance</div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>Redistribute seats symmetrically around section center</p>
              <button disabled={!hasSection}
                onClick={() => hasSection && onAutoBalance?.(activeSectionId!)}
                style={{ ...primaryBtn, width: '100%', opacity: hasSection ? 1 : 0.5 }}>
                Auto Balance Seats
              </button>
            </div>
          </div>
          );
        })()}

        {tab === 'tools' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Arc Section Fill */}
            <div>
              <div style={sectionLabel}>Fill Arc Section with Seats</div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
                Select a ring/arc section, then generate curved rows that follow its shape.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={label}>Rows</label>
                  <input type="number" min={1} max={50} value={arcRows} onChange={e => setArcRows(+e.target.value)} style={input} />
                </div>
                <div>
                  <label style={label}>Seats / row</label>
                  <input type="number" min={1} max={100} value={arcSeats} onChange={e => setArcSeats(+e.target.value)} style={input} />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={label}>Base Price ($)</label>
                <input type="number" min={0} value={arcPrice} onChange={e => setArcPrice(+e.target.value)} style={input} />
              </div>
              <button
                disabled={!selectedSectionId}
                onClick={handleFillArc}
                style={{ ...primaryBtn, width: '100%', opacity: selectedSectionId ? 1 : 0.5 }}
              >
                ⚡ Fill Arc with Seats
              </button>
              {!selectedSectionId && (
                <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 6, textAlign: 'center' }}>Select a section first</p>
              )}
            </div>
            <div>
              <div style={sectionLabel}>Section Templates</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {SECTION_TEMPLATES.map(template => (
                  <button key={template.id} onClick={() => { const shape = applyTemplate(template, { x: 100, y: 100 }, 1.5); onApplyTemplate(shape); }}
                    style={{ padding: '12px 8px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--panel)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.12s', fontFamily: 'inherit' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-soft)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel)'; }}
                  >
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{color:'var(--text-2)'}}><rect x="4" y="4" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/></svg>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-1)' }}>{template.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Split */}
            <div>
              <div style={sectionLabel}>Split Section</div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
                Splits selected section into two (A101 → A101-A + A101-B)
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={secondaryBtn} disabled={!selectedSectionId}
                  onClick={() => selectedSectionId && onSplitSection?.(selectedSectionId, 'v')}>
                  Split Vertical
                </button>
                <button style={secondaryBtn} disabled={!selectedSectionId}
                  onClick={() => selectedSectionId && onSplitSection?.(selectedSectionId, 'h')}>
                  Split Horizontal
                </button>
              </div>
            </div>

            {/* Merge */}
            <div>
              <div style={sectionLabel}>Merge Sections</div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
                Select 2+ sections then merge into one
              </p>
              <button style={secondaryBtn}
                disabled={!selectedIds || selectedIds.size < 2}
                onClick={() => selectedIds && onMergeSections?.([...selectedIds])}>
                Merge {selectedIds && selectedIds.size >= 2 ? `(${selectedIds.size} selected)` : '(select 2+)'}
              </button>
            </div>

            {/* Rotate */}
            <div>
              <div style={sectionLabel}>Rotate Selection</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input type="number" value={rotateAngle} onChange={e => setRotateAngle(+e.target.value)}
                  style={{ ...input, width: 70 }} min={-360} max={360} />
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>degrees</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {[45, 90, 180, -45, -90].map(d => (
                  <button key={d} style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 10 }}
                    onClick={() => onRotate?.(d)}>{d > 0 ? `+${d}°` : `${d}°`}</button>
                ))}
              </div>
              <button style={primaryBtn} disabled={!selectedIds || selectedIds.size === 0}
                onClick={() => onRotate?.(rotateAngle)}>
                Rotate {rotateAngle}°
              </button>
            </div>
          </div>
        )}

        {tab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>Import / Export</h3>
              <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 16 }}>Bulk data operations</p>
            </div>

            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Import</h4>
              <p style={{ fontSize: 10, color: 'var(--text-2)', marginBottom: 12 }}>Supported: CSV, JSON, GeoJSON</p>
              <input ref={fileInputRef} type="file" accept=".csv,.json,.geojson" onChange={handleFileImport} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} style={secondaryBtn}>
                Choose File
              </button>
            </div>

            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Export</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => handleExport('csv')} style={secondaryBtn}>
                  Export as CSV
                </button>
                <button onClick={() => handleExport('geojson')} style={secondaryBtn}>
                  Export as GeoJSON
                </button>
              </div>
            </div>

            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>CSV Format</h4>
              <pre style={{ fontSize: 9, color: '#78350f', fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0 }}>
                section_id,row,seat,x,y,price,category,status
              </pre>
            </div>
          </div>
        )}

        {tab === 'validate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>Layout Validation</h3>
              <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 16 }}>Check for errors and warnings</p>
            </div>

            <button onClick={handleValidate} style={primaryBtn}>
              Run Validation
            </button>

            {validation && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: 12, background: validation.valid ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `1px solid ${validation.valid ? '#86efac' : '#fca5a5'}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: validation.valid ? '#166534' : '#991b1b' }}>
                    {validation.valid ? '✓ Layout Valid' : `✗ ${validation.errors.length} Error(s)`}
                  </div>
                </div>

                {validation.errors.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Errors:</h4>
                    {validation.errors.map((err, i) => (
                      <div key={i} style={{ padding: 8, background: '#fef2f2', borderRadius: 6, marginBottom: 6, fontSize: 10, color: '#991b1b' }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{err.type}</div>
                        <div>{err.message}</div>
                      </div>
                    ))}
                  </div>
                )}

                {validation.warnings.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginBottom: 8 }}>Warnings:</h4>
                    {validation.warnings.map((warn, i) => (
                      <div key={i} style={{ padding: 8, background: '#fffbeb', borderRadius: 6, marginBottom: 6, fontSize: 10, color: '#92400e' }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{warn.type}</div>
                        <div>{warn.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const fieldGroup: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-2)',
};

const sectionLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: 'uppercase' as const,
  color: 'var(--text-3)',
  marginBottom: 8,
};

const input: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 12,
  border: 'none',
  borderRadius: 8,
  background: 'var(--bg)',
  color: 'var(--text-1)',
  fontFamily: 'inherit',
  outline: 'none',
};

const primaryBtn: React.CSSProperties = {
  padding: '9px 16px',
  fontSize: 12,
  fontWeight: 600,
  border: 'none',
  borderRadius: 8,
  background: 'var(--text-1)',
  color: 'var(--panel)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryBtn: React.CSSProperties = {
  padding: '7px 12px',
  fontSize: 11,
  fontWeight: 600,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--panel)',
  color: 'var(--text-2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

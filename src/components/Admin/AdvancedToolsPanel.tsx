/**
 * Advanced Tools Panel — Grid Generator, Templates, Import/Export, Validation, Split/Merge/Rotate
 */
'use client';
import { useState, useRef } from 'react';
import type { GridConfig, SectionTemplate } from './advancedTools';
import { SECTION_TEMPLATES, generateSeatGrid, applyTemplate, validateLayout, importFromCSV, exportToCSV, exportToGeoJSON, importFromGeoJSON } from './advancedTools';
import type { Category, NumberScheme, LayoutState, ValidationResult } from './builderTypes2';

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
  selectedIds?: Set<string>;
}

export default function AdvancedToolsPanel({ layout, selectedSectionId, onApplyGrid, onApplyTemplate, onImport, onExport, onValidate, onSplitSection, onMergeSections, onRotate, selectedIds }: Props) {
  const [activeTab, setActiveTab] = useState<'grid' | 'tools' | 'import' | 'validate'>('grid');
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    rows: 10,
    seatsPerRow: 20,
    rowSpacing: 12,
    seatSpacing: 10,
    curveRadius: 0,
    aisleAfter: [],
    startRow: 'A',
    startNumber: 1,
    numberScheme: '1,2,3',
    category: 'STANDARD',
    basePrice: 100,
    adaEvery: 0,
    vomitoryAfter: [],
    premiumSpacing: false,
  });
  const [aisleInput, setAisleInput] = useState('');
  const [vomInput, setVomInput] = useState('');
  const [rotateAngle, setRotateAngle] = useState(45);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateGrid = () => {
    if (!selectedSectionId) { alert('Select a section first'); return; }
    const section = layout.shapes.find(s => s.id === selectedSectionId);
    if (!section) return;
    const xs = section.vertices.map(v => v[0]);
    const ys = section.vertices.map(v => v[1]);
    const bounds = {
      x0: Math.min(...xs),
      y0: Math.min(...ys),
      x1: Math.max(...xs),
      y1: Math.max(...ys),
    };
    
    const { rows, seats } = generateSeatGrid(selectedSectionId, bounds, gridConfig);
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
        alert(`Import errors:\n${errors.join('\n')}`);
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
        {(['grid', 'tools', 'import', 'validate'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '10px 4px', fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.5, border: 'none',
              background: activeTab === tab ? 'var(--panel)' : 'transparent',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-3)',
              borderBottom: activeTab === tab ? `2px solid var(--accent)` : '2px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {tab === 'grid' ? 'Grid' : tab === 'tools' ? 'Tools' : tab === 'import' ? 'I/O' : 'Validate'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {activeTab === 'grid' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>Seat Grid Generator</h3>
              <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 16 }}>Generate seats in bulk for selected section</p>
            </div>

            <div style={fieldGroup}>
              <label style={label}>Rows</label>
              <input type="number" value={gridConfig.rows} onChange={e => setGridConfig({ ...gridConfig, rows: +e.target.value })} style={input} min={1} max={50} />
            </div>

            <div style={fieldGroup}>
              <label style={label}>Seats per Row</label>
              <input type="number" value={gridConfig.seatsPerRow} onChange={e => setGridConfig({ ...gridConfig, seatsPerRow: +e.target.value })} style={input} min={1} max={100} />
            </div>

            <div style={fieldGroup}>
              <label style={label}>Row Spacing</label>
              <input type="number" value={gridConfig.rowSpacing} onChange={e => setGridConfig({ ...gridConfig, rowSpacing: +e.target.value })} style={input} min={5} max={30} />
            </div>

            <div style={fieldGroup}>
              <label style={label}>Seat Spacing</label>
              <input type="number" value={gridConfig.seatSpacing} onChange={e => setGridConfig({ ...gridConfig, seatSpacing: +e.target.value })} style={input} min={5} max={20} />
            </div>

            <div style={fieldGroup}>
              <label style={label}>Curve Radius (0 = straight)</label>
              <input type="number" value={gridConfig.curveRadius || 0} onChange={e => setGridConfig({ ...gridConfig, curveRadius: +e.target.value || undefined })} style={input} min={0} max={500} />
            </div>

            <div style={fieldGroup}>
              <label style={label}>Start Row</label>
              <input type="text" value={gridConfig.startRow} onChange={e => setGridConfig({ ...gridConfig, startRow: e.target.value.toUpperCase() })} style={input} maxLength={1} />
            </div>

            <div style={fieldGroup}>
              <label style={label}>Number Scheme</label>
              <select value={gridConfig.numberScheme} onChange={e => setGridConfig({ ...gridConfig, numberScheme: e.target.value as NumberScheme })} style={input}>
                <option value="1,2,3">1, 2, 3...</option>
                <option value="odd">Odd (1, 3, 5...)</option>
                <option value="even">Even (2, 4, 6...)</option>
                <option value="rtl">Right to Left</option>
              </select>
            </div>

            <div style={fieldGroup}>
              <label style={label}>Category</label>
              <select value={gridConfig.category} onChange={e => setGridConfig({ ...gridConfig, category: e.target.value as Category })} style={input}>
                <option value="VIP">VIP</option>
                <option value="PREMIUM">Premium</option>
                <option value="STANDARD">Standard</option>
                <option value="BUDGET">Budget</option>
                <option value="GA">General Admission</option>
              </select>
            </div>

            <div style={fieldGroup}>
              <label style={label}>Base Price ($)</label>
              <input type="number" value={gridConfig.basePrice} onChange={e => setGridConfig({ ...gridConfig, basePrice: +e.target.value })} style={input} min={10} max={5000} />
            </div>

            {/* ── Advanced spacing ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>Advanced Spacing</div>

              <div style={fieldGroup}>
                <label style={label}>Aisle after seat # (comma-separated)</label>
                <input type="text" value={aisleInput} placeholder="e.g. 5,10,15"
                  onChange={e => {
                    setAisleInput(e.target.value);
                    const nums = e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                    setGridConfig(c => ({ ...c, aisleAfter: nums }));
                  }} style={input} />
              </div>

              <div style={fieldGroup}>
                <label style={label}>Vomitory after row # (comma-separated)</label>
                <input type="text" value={vomInput} placeholder="e.g. 5,10"
                  onChange={e => {
                    setVomInput(e.target.value);
                    const nums = e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                    setGridConfig(c => ({ ...c, vomitoryAfter: nums }));
                  }} style={input} />
              </div>

              <div style={fieldGroup}>
                <label style={label}>ADA seat every N seats (0 = off)</label>
                <input type="number" value={gridConfig.adaEvery ?? 0}
                  onChange={e => setGridConfig(c => ({ ...c, adaEvery: +e.target.value }))}
                  style={input} min={0} max={20} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={label}>Premium spacing (+20%)</span>
                <label className="tf-toggle">
                  <input type="checkbox" checked={!!gridConfig.premiumSpacing}
                    onChange={e => setGridConfig(c => ({ ...c, premiumSpacing: e.target.checked }))} />
                  <span className="tf-toggle-track" />
                </label>
              </div>
            </div>

            <button onClick={handleGenerateGrid} style={primaryBtn} disabled={!selectedSectionId}>
              {selectedSectionId ? 'Generate Seats' : 'Select a Section First'}
            </button>
          </div>
        )}

        {activeTab === 'tools' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Section Templates */}
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

        {activeTab === 'import' && (
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

        {activeTab === 'validate' && (
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
  border: '1px solid var(--border)',
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

/**
 * Advanced Tools Panel — Grid Generator, Templates, Import/Export, Validation
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
}

export default function AdvancedToolsPanel({ layout, selectedSectionId, onApplyGrid, onApplyTemplate, onImport, onExport, onValidate }: Props) {
  const [activeTab, setActiveTab] = useState<'grid' | 'templates' | 'import' | 'validate'>('grid');
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
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateGrid = () => {
    if (!selectedSectionId) {
      alert('Please select a section first');
      return;
    }
    
    const section = layout.shapes.find(s => s.id === selectedSectionId);
    if (!section) return;
    
    // Calculate bounds from section vertices
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
    <div style={{ width: 320, background: '#fff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        {(['grid', 'templates', 'import', 'validate'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '10px 8px',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              border: 'none',
              background: activeTab === tab ? '#fff' : 'transparent',
              color: activeTab === tab ? '#3b82f6' : '#64748b',
              borderBottom: activeTab === tab ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
            }}
          >
            {tab === 'grid' && '⚡ Grid'}
            {tab === 'templates' && '📐 Templates'}
            {tab === 'import' && '📥 I/O'}
            {tab === 'validate' && '✓ Validate'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {activeTab === 'grid' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Seat Grid Generator</h3>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>Generate seats in bulk for selected section</p>
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

            <button onClick={handleGenerateGrid} style={primaryBtn} disabled={!selectedSectionId}>
              {selectedSectionId ? '⚡ Generate Seats' : '⚠️ Select Section First'}
            </button>
          </div>
        )}

        {activeTab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Section Templates</h3>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>Quick-start shapes for common section types</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {SECTION_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleApplyTemplate(template)}
                  style={{
                    padding: '16px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.background = '#eff6ff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#fff';
                  }}
                >
                  <div style={{ fontSize: 32 }}>{template.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>{template.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Import / Export</h3>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>Bulk data operations</p>
            </div>

            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>📥 Import</h4>
              <p style={{ fontSize: 10, color: '#64748b', marginBottom: 12 }}>Supported: CSV, JSON, GeoJSON</p>
              <input ref={fileInputRef} type="file" accept=".csv,.json,.geojson" onChange={handleFileImport} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} style={secondaryBtn}>
                Choose File
              </button>
            </div>

            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>📤 Export</h4>
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
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Layout Validation</h3>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>Check for errors and warnings</p>
            </div>

            <button onClick={handleValidate} style={primaryBtn}>
              🔍 Run Validation
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
  color: '#475569',
};

const input: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  background: '#fff',
  color: '#0f172a',
  fontFamily: 'inherit',
};

const primaryBtn: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 12,
  fontWeight: 600,
  border: 'none',
  borderRadius: 8,
  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
  color: '#fff',
  cursor: 'pointer',
  transition: 'transform 0.15s',
};

const secondaryBtn: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  background: '#fff',
  color: '#475569',
  cursor: 'pointer',
};

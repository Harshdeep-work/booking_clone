'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import BuilderCanvas from './BuilderCanvas';
import PropertiesPanel from './PropertiesPanel';
import EnhancedPropertiesPanel from './EnhancedPropertiesPanel';
import AdvancedToolsPanel from './AdvancedToolsPanel';
import GenerateDialogs from './GenerateDialogs';
import LeftPanel from './LeftPanel';
import EmptyState from './EmptyState';
import { useBuilderEngine } from './useBuilderEngine';
import { icons } from './BuilderIcons';
import type { LayoutState } from './builderTypes2';
import { validateLayout } from './advancedTools';

type DialogType = 'ring' | 'arc' | 'block' | null;

export default function VenueBuilder() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef      = useRef<HTMLInputElement>(null);
  const [dialog, setDialog]           = useState<DialogType>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showEmpty, setShowEmpty]     = useState(true);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [useEnhancedProps, setUseEnhancedProps] = useState(true);

  const eng = useBuilderEngine();

  const isEmpty = eng.layout.shapes.length === 0 && eng.layout.seats.length === 0;

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const img = new Image();
    img.onload = () => eng.setBgImage(img);
    img.src = URL.createObjectURL(file);
  };

  const handleInsertPreset = (patch: Partial<LayoutState>) => {
    eng.applyGeneratedLayout(patch);
    setShowEmpty(false);
  };

  const handleApplyGrid = (sectionId: string, rows: any[], seats: any[]) => {
    eng.applyGeneratedLayout({ rows, seats });
  };

  const handleApplyTemplate = (shape: any) => {
    eng.applyGeneratedLayout({ shapes: [shape] });
  };

  const handleImport = (data: Partial<LayoutState>) => {
    eng.applyGeneratedLayout(data);
    setShowEmpty(false);
  };

  const handleExport = (format: 'csv' | 'geojson') => {
    // Trigger export via eng.exportLayout or custom logic
    eng.exportLayout();
  };

  const handleValidate = () => {
    const result = validateLayout(eng.layout);
    if (result.valid) {
      alert('✓ Layout is valid!');
    } else {
      alert(`✗ ${result.errors.length} error(s) found:\n\n${result.errors.map(e => e.message).join('\n')}`);
    }
  };

  const handleUploadPhoto = async (file: File): Promise<string> => {
    // TODO: Implement photo upload to S3/Cloudinary
    // For now, return a local object URL
    return URL.createObjectURL(file);
  };

  const getSelectedEntity = () => {
    if (eng.selectedShape) return eng.selectedShape;
    if (eng.selectedSeat) return eng.selectedSeat;
    if (eng.selectedRow) return eng.selectedRow;
    return null;
  };

  const handleEntityUpdate = (updates: any) => {
    if (updates._delete) {
      eng.deleteSelected();
      return;
    }
    
    if (eng.selectedShape) eng.updateShape(updates);
    else if (eng.selectedSeat) eng.updateSeat(updates);
    else if (eng.selectedRow) eng.updateRow(eng.selectedRow.id, updates);
  };

  const fitToScreen = () => {
    // reset camera to origin
    eng.loadTemplate({ ...eng.layout }); // triggers re-render
    // just reset camera via a zoom reset
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: '#f1f5f9', overflow: 'hidden', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0, zIndex: 50, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 6.5h10M6.5 1.5l5 5-5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3 }}>TicketFlow</span>
          </Link>
          <div style={{ width: 1, height: 18, background: '#e2e8f0', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 10px' }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1l1.2 2.5 2.8.4-2 2 .5 2.8L5.5 7.4 3 8.7l.5-2.8-2-2 2.8-.4L5.5 1z" stroke="#94a3b8" strokeWidth="1.1" strokeLinejoin="round"/></svg>
            <input value={eng.venueName} onChange={e => eng.setVenueName(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#0f172a', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', width: 160 }} />
          </div>
        </div>

        {/* Centre: undo/redo + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))} style={topBtn} title="Undo (Ctrl+Z)">{icons.undo}</button>
          <button onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }))} style={topBtn} title="Redo (Ctrl+Y)">{icons.redo}</button>
          <div style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 4px' }} />
          <div style={{ display: 'flex', gap: 10, fontSize: 11, fontWeight: 600 }}>
            <span style={{ color: '#475569' }}>{eng.counts.sections} <span style={{ color: '#94a3b8', fontWeight: 400 }}>sections</span></span>
            <span style={{ color: '#475569' }}>{eng.counts.seats.toLocaleString()} <span style={{ color: '#94a3b8', fontWeight: 400 }}>seats</span></span>
          </div>
          <div style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 4px' }} />
          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, padding: '2px 4px' }}>
            <button onClick={() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }))} style={{ ...topBtn, border: 'none', background: 'transparent', width: 24, height: 24 }} title="Zoom out">−</button>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', minWidth: 36, textAlign: 'center' }}>{eng.zoomPct}%</span>
            <button onClick={() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }))} style={{ ...topBtn, border: 'none', background: 'transparent', width: 24, height: 24 }} title="Zoom in">+</button>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setShowAdvancedTools(!showAdvancedTools)} title="Advanced Tools"
            style={{ ...chipBtn, borderColor: showAdvancedTools ? '#c084fc' : '#e2e8f0', background: showAdvancedTools ? '#faf5ff' : '#fff', color: showAdvancedTools ? '#9333ea' : '#64748b' }}>
            ⚡ <span>Advanced</span>
          </button>
          <button onClick={() => eng.setHeatmap(!eng.heatmap)} title="Price Heat Map"
            style={{ ...chipBtn, borderColor: eng.heatmap ? '#fde68a' : '#e2e8f0', background: eng.heatmap ? '#fffbeb' : '#fff', color: eng.heatmap ? '#d97706' : '#64748b' }}>
            {icons.heatmap} <span>Heat Map</span>
          </button>
          <button onClick={() => setShowHistory(h => !h)} title="Version History"
            style={{ ...chipBtn, borderColor: showHistory ? '#bfdbfe' : '#e2e8f0', background: showHistory ? '#eff6ff' : '#fff', color: showHistory ? '#2563eb' : '#64748b' }}>
            {icons.history} <span>History</span>
          </button>
          <button onClick={() => fileRef.current?.click()} style={{ ...chipBtn, borderColor: eng.bgImage ? '#bfdbfe' : '#e2e8f0', background: eng.bgImage ? '#eff6ff' : '#fff', color: eng.bgImage ? '#2563eb' : '#64748b' }} title="Upload Reference Image">
            {icons.image} <span>{eng.bgImage ? 'Reference ✓' : 'Reference'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgUpload} />
          {eng.bgImage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, padding: '3px 8px' }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>Opacity</span>
              <input type="range" min={0.05} max={1} step={0.05} value={eng.bgOpacity}
                onChange={e => eng.setBgOpacity(+e.target.value)} style={{ width: 70 }} />
              <button onClick={() => eng.setBgImage(null)} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }} title="Remove reference">✕</button>
            </div>
          )}
          <div style={{ width: 1, height: 18, background: '#e2e8f0' }} />
          <Link href="/booking" style={{ ...chipBtn, textDecoration: 'none', color: '#475569' }}>
            {icons.eye} <span>Preview</span>
          </Link>
          <button onClick={eng.exportLayout} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
            {icons.export} Export
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left Panel (Figma-style) ─────────────────────────────────────── */}
        <LeftPanel
          activeTool={eng.tool}
          onTool={eng.changeTool}
          snapOn={eng.snapOn}
          onSnap={() => eng.setSnapOn(!eng.snapOn)}
          onInsertPreset={handleInsertPreset}
          onDialog={setDialog}
        />

        {/* ── Canvas ──────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <BuilderCanvas
            layout={eng.layout}
            camera={eng.camera}
            preview={eng.preview}
            selectedIds={eng.selectedIds}
            sectionMode={eng.sectionMode}
            bgImage={eng.bgImage}
            bgOpacity={eng.bgOpacity}
            heatmap={eng.heatmap}
            onCamera={() => {}}
            onPointerDown={eng.onPointerDown}
            onPointerMove={eng.onPointerMove}
            onPointerUp={eng.onPointerUp}
            onDblClick={eng.onDblClick}
            onWheel={eng.onWheel}
            canvasRef={canvasRef}
            containerRef={containerRef}
            cursor={eng.cursor}
          />

          {/* Empty state */}
          <AnimatePresence>
            {isEmpty && showEmpty && (
              <EmptyState onDismiss={() => setShowEmpty(false)} />
            )}
          </AnimatePresence>

          {/* Section-mode banner */}
          <AnimatePresence>
            {eng.sectionMode && (
              <motion.div key="secbanner"
                initial={{ y: -48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -48, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 100, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 20, boxShadow: '0 4px 16px rgba(37,99,235,0.12)' }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>
                  Editing: <span style={{ color: '#2563eb' }}>{eng.layout.shapes.find(s => s.id === eng.sectionMode)?.label}</span>
                </span>
                <button onClick={eng.exitSectionMode} style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 99, padding: '3px 10px', cursor: 'pointer' }}>
                  ← Exit
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom status bar */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, justifyContent: 'space-between', minHeight: 32 }}>
            {/* Contextual hint per tool */}
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
              {eng.tool === 'select'  && '↖ Click to select · Shift+click multi-select · Drag to move · Dbl-click section to edit inside'}
              {eng.tool === 'section' && '⬡ Click to place points · Dbl-click to close and create section'}
              {eng.tool === 'rect'    && '▭ Drag to draw a rectangle section'}
              {eng.tool === 'row'      && '⋯ Click start point → click end point → row of seats is placed'}
              {eng.tool === 'multirow' && '⊞ Drag rectangle → fills with multiple parallel rows of seats'}
              {eng.tool === 'arcrow'   && '◜ Click centre → click radius → click end angle → curved row placed'}
              {eng.tool === 'block'   && '⊞ Drag to draw a rectangle filled with seats'}
              {eng.tool === 'text'    && 'T Click to place a text label'}
              {eng.tool === 'pan'     && '✥ Drag to pan · Also: Alt+drag in any tool'}
              {!['select','section','rect','row','arcrow','block','text','pan'].includes(eng.tool) && `${eng.tool} — Drag to draw shape`}
            </span>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              {/* Seats per row input — for row and multirow tools */}
              {(eng.tool === 'row' || eng.tool === 'multirow') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, padding: '2px 8px' }}>
                  <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>Seats/row</span>
                  <input
                    type="number" min={0} max={60} value={eng.rowSeatsCount || ''}
                    placeholder="auto"
                    onChange={e => eng.setRowSeatsCount(+e.target.value || 0)}
                    style={{ width: 44, fontSize: 11, fontWeight: 700, border: 'none', background: 'transparent', outline: 'none', color: '#0f172a', textAlign: 'center' }}
                  />
                </div>
              )}
              <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: 5 }}>
                {eng.tool.toUpperCase()}
              </span>
              {eng.snapOn && <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#f0fdf4', padding: '2px 8px', borderRadius: 5 }}>SNAP</span>}
            </div>
          </div>
        </div>

        {/* ── Right Properties Panel ───────────────────────────────────────── */}
        {useEnhancedProps ? (
          <div style={{ width: 320, background: '#fff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Properties</span>
              <button onClick={() => setUseEnhancedProps(false)} style={{ fontSize: 9, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>
                Classic
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <EnhancedPropertiesPanel
                selectedEntity={getSelectedEntity()}
                onUpdate={handleEntityUpdate}
                onUploadPhoto={handleUploadPhoto}
              />
            </div>
          </div>
        ) : (
          <PropertiesPanel
            shape={eng.selectedShape}
            seat={eng.selectedSeat}
            text={eng.selectedText}
            row={eng.selectedRow}
            multiCount={eng.selectedIds.size}
            onShape={eng.updateShape}
            onSeat={eng.updateSeat}
            onText={eng.updateText}
            onRow={eng.updateRow}
            onMultiCategory={c => eng.multiUpdate(c)}
            onMultiPrice={p => eng.multiUpdate(undefined, p)}
            onMultiStatus={s => eng.multiUpdate(undefined, undefined, s)}
            onDelete={eng.deleteSelected}
            onFillSection={eng.fillSection}
            sectionMode={eng.sectionMode}
            totalElements={eng.layout.shapes.length + eng.layout.seats.length + eng.layout.texts.length}
            totalSeats={eng.layout.seats.length}
            totalSections={eng.counts.sections}
            selectedCount={eng.selectedIds.size}
          />
        )}

        {/* ── Advanced Tools Panel (Collapsible) ───────────────────────────── */}
        <AnimatePresence>
          {showAdvancedTools && (
            <motion.div key="advanced"
              initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{ flexShrink: 0, boxShadow: '-4px 0 16px rgba(0,0,0,0.08)' }}
            >
              <AdvancedToolsPanel
                layout={eng.layout}
                selectedSectionId={eng.selectedShape?.id || null}
                onApplyGrid={handleApplyGrid}
                onApplyTemplate={handleApplyTemplate}
                onImport={handleImport}
                onExport={handleExport}
                onValidate={handleValidate}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── History drawer ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {showHistory && (
            <motion.div key="history"
              initial={{ x: 260, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 260, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{ width: 220, background: '#fff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0, boxShadow: '-4px 0 16px rgba(0,0,0,0.04)' }}
            >
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>History</span>
                <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                {eng.history.length === 0 && <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: 12 }}>No history yet</div>}
                {eng.history.map((s, i) => (
                  <div key={s.id} onClick={() => i > 0 && eng.restoreSnapshot(s)}
                    style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 4, cursor: i === 0 ? 'default' : 'pointer', background: i === 0 ? '#eff6ff' : '#fff', border: `1px solid ${i === 0 ? '#bfdbfe' : '#f1f5f9'}` }}
                    onMouseEnter={e => { if (i > 0) (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (i > 0) (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: i === 0 ? '#2563eb' : '#475569' }}>{s.label}</span>
                      {i === 0 && <span style={{ fontSize: 9, fontWeight: 800, color: '#2563eb', background: '#dbeafe', padding: '1px 5px', borderRadius: 99 }}>NOW</span>}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{new Date(s.ts).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GenerateDialogs open={dialog} onClose={() => setDialog(null)} onApply={patch => { eng.applyGeneratedLayout(patch); setShowEmpty(false); }} />

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow: hidden; }
        input[type=range] { accent-color: #2563eb; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
      `}</style>
    </div>
  );
}

const topBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 7, border: '1px solid #e2e8f0',
  background: '#fff', color: '#64748b', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 14, fontWeight: 700,
};
const chipBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0',
  background: '#fff', color: '#64748b', fontSize: 11, fontWeight: 600,
  cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

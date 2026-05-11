'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import BuilderCanvas from './BuilderCanvas';
import EnhancedPropertiesPanel from './EnhancedPropertiesPanel';
import AdvancedToolsPanel from './AdvancedToolsPanel';
import GenerateDialogs from './GenerateDialogs';
import LeftPanel from './LeftPanel';
import EmptyState from './EmptyState';
import LayerPanel from './LayerPanel';
import { useBuilderEngine } from './useBuilderEngine';
import { icons } from './BuilderIcons';
import type { LayoutState } from './builderTypes2';
import { validateLayout } from './advancedTools';
import './theme.css';

type DialogType = 'ring' | 'arc' | 'block' | null;

export default function VenueBuilder() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef      = useRef<HTMLInputElement>(null);
  const [dialog, setDialog]                   = useState<DialogType>(null);
  const [showHistory, setShowHistory]         = useState(false);
  const [showEmpty, setShowEmpty]             = useState(true);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [advancedTab, setAdvancedTab]         = useState<'grid' | 'tools' | 'import' | 'validate'>('grid');
  const [rightTab, setRightTab]               = useState<'design'|'data'|'ai'>('design');
  const [aiInput, setAiInput]                 = useState('');
  const [aiMessages, setAiMessages]           = useState<{role:'user'|'assistant';text:string}[]>([
    { role: 'assistant', text: 'Hi! I can help you design your venue layout. Try: "Add 20 rows to section 101" or "Generate an NBA arena".' }
  ]);
  const [darkMode, setDarkMode]               = useState(false);
  const [showLayers, setShowLayers]           = useState(false);
  const [show3D, setShow3D]                   = useState(false);
  const [viewMode, setViewMode]               = useState<'top'|'perspective'>('top');

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

  const openAdvanced = (tab: 'grid' | 'tools' | 'import' | 'validate') => {
    setAdvancedTab(tab);
    setShowAdvancedTools(true);
  };

  const handleApplyGrid = (_sectionId: string, rows: any[], seats: any[]) => {
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
    import('./advancedTools').then(({ exportToCSV, exportToGeoJSON }) => {
      let content: string, filename: string;
      if (format === 'csv') {
        content = exportToCSV(eng.layout, true);
        filename = `${eng.venueName.replace(/\s+/g,'_')}.csv`;
      } else {
        content = JSON.stringify(exportToGeoJSON(eng.layout), null, 2);
        filename = `${eng.venueName.replace(/\s+/g,'_')}.geojson`;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
      a.download = filename;
      a.click();
    });
  };

  const [validationMsg, setValidationMsg] = useState<{ok:boolean;text:string}|null>(null);

  const handleValidate = () => {
    const result = validateLayout(eng.layout);
    setValidationMsg(result.valid
      ? { ok: true, text: `Valid — ${eng.counts.sections} sections, ${eng.counts.seats} seats` }
      : { ok: false, text: result.errors.map(e => e.message).join('\n') }
    );
    setTimeout(() => setValidationMsg(null), 5000);
  };

  const handleUploadPhoto = async (file: File): Promise<string> => URL.createObjectURL(file);

  const getSelectedEntity = () => eng.selectedShape ?? eng.selectedSeat ?? eng.selectedRow ?? null;

  const handleEntityUpdate = (updates: any) => {
    if (updates._delete) { eng.deleteSelected(); return; }
    if (eng.selectedShape) eng.updateShape(updates);
    else if (eng.selectedSeat) eng.updateSeat(updates);
    else if (eng.selectedRow) eng.updateRow(eng.selectedRow.id, updates);
  };

  const sendAiMessage = () => {
    if (!aiInput.trim()) return;
    setAiMessages(m => [...m,
      { role: 'user', text: aiInput },
      { role: 'assistant', text: 'Got it! Working on that for you...' }
    ]);
    setAiInput('');
  };

  const toolHint: Record<string, string> = {
    select:   'Click to select · Shift+click multi-select · Drag to move · Dbl-click section to edit',
    section:  'Click to place points · Dbl-click to close and create section',
    rect:     'Drag to draw a rectangle section',
    row:      'Click start point then end point to place a row of seats',
    multirow: 'Drag rectangle to fill with multiple parallel rows',
    arcrow:   'Click centre, radius, then end angle for a curved row',
    block:    'Drag to draw a rectangle filled with seats',
    text:     'Click to place a text label',
    pan:      'Drag to pan · Also: Alt+drag in any tool',
  };

  return (
    <div className="tf-admin" data-theme={darkMode ? 'dark' : 'light'}>

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="tf-topbar">

        {/* Left */}
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <Link href="/" className="tf-logo">
            <div className="tf-logo-mark">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M7 2l5 5-5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="tf-logo-text">TicketFlow</span>
          </Link>
          <div className="tf-divider-v" />
          <div className="tf-venue-input">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{color:'var(--text-3)'}}>
              <path d="M5.5 1l1.2 2.5 2.8.4-2 2 .5 2.8L5.5 7.4 3 8.7l.5-2.8-2-2 2.8-.4L5.5 1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
            </svg>
            <input
              value={eng.venueName}
              onChange={e => eng.setVenueName(e.target.value)}
              placeholder="Venue name"
            />
          </div>
        </div>

        {/* Centre */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button className="tf-icon-btn" onClick={eng.undo} title="Undo (Ctrl+Z)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5h6a4 4 0 010 8H4M2 5l3-3M2 5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="tf-icon-btn" onClick={eng.redo} title="Redo (Ctrl+Y)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 5H6a4 4 0 000 8h4M12 5l-3-3M12 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="tf-divider-v" />
          <div className="tf-stats">
            <span style={{color:'var(--text-1)'}}>{eng.counts.sections}</span> sections
            <span style={{color:'var(--text-1)'}}>{eng.counts.seats.toLocaleString()}</span> seats
          </div>
          <div className="tf-divider-v" />
          <div className="tf-zoom-group">
            <button className="tf-zoom-btn" onClick={eng.zoomOut} title="Zoom out">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>
            <span className="tf-zoom-pct">{eng.zoomPct}%</span>
            <button className="tf-zoom-btn" onClick={eng.zoomIn} title="Zoom in">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>

        {/* Right */}
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <button className={`tf-chip-btn${showAdvancedTools?' active':''}`} onClick={() => setShowAdvancedTools(!showAdvancedTools)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.2 2.5 2.8.4-2 2 .5 2.8L6 7.4 3.5 8.7l.5-2.8-2-2 2.8-.4L6 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
            Advanced
          </button>
          <button className={`tf-chip-btn${showHistory?' active':''}`} onClick={() => setShowHistory(h => !h)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            History
          </button>
          <button className={`tf-chip-btn${showLayers?' active':''}`} onClick={() => setShowLayers(l => !l)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 4l5-3 5 3-5 3-5-3zM1 8l5 3 5-3M1 6l5 3 5-3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
            Layers
          </button>
          <button className={`tf-chip-btn${show3D?' active':''}`} onClick={() => setShow3D(v => !v)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l5 3v4l-5 3-5-3V4l5-3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
            3D
          </button>
          <button className={`tf-chip-btn${viewMode==='perspective'?' active':''}`} onClick={() => setViewMode(v => v==='top'?'perspective':'top')}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 9L6 3l5 6H1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
            {viewMode === 'top' ? 'Top' : 'Persp'}
          </button>
          <button className={`tf-chip-btn${eng.bgImage?' active':''}`} onClick={() => fileRef.current?.click()}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="4" cy="5" r="1" stroke="currentColor" strokeWidth="1.1"/><path d="M1 8l3-2.5 2 2 2-2.5 3 3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>
            {eng.bgImage ? 'Reference' : 'Reference'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleBgUpload} />
          {eng.bgImage && (
            <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'4px 10px'}}>
              <span style={{fontSize:10,color:'var(--text-3)',fontWeight:600}}>Opacity</span>
              <input type="range" min={0.05} max={1} step={0.05} value={eng.bgOpacity} onChange={e => eng.setBgOpacity(+e.target.value)} style={{width:64}} />
              <button onClick={() => eng.setBgImage(null)} style={{fontSize:12,color:'var(--text-3)',background:'none',border:'none',cursor:'pointer',lineHeight:1,padding:0}}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          )}
          <div className="tf-divider-v" />
          <button className="tf-theme-btn" onClick={() => setDarkMode(d => !d)} title="Toggle dark mode">
            {darkMode
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M7 1v1M7 12v1M1 7h1M12 7h1M3 3l.7.7M10.3 10.3l.7.7M3 11l.7-.7M10.3 3.7l.7-.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11.5 8.5A5 5 0 015.5 2.5a5 5 0 100 9 5 5 0 006-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
            }
          </button>
          <Link href="/booking" className="tf-chip-btn" style={{textDecoration:'none'}}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.3"/><circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
            Preview
          </Link>
          <button className="tf-primary-btn" onClick={eng.exportLayout}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Export
          </button>
        </div>
      </header>

      <div className="tf-body">

        {/* ── Left Sidebar ──────────────────────────────────────────────── */}
        <LeftPanel
          activeTool={eng.tool}
          onTool={eng.changeTool}
          snapOn={eng.snapOn}
          onSnap={() => eng.setSnapOn(!eng.snapOn)}
          onInsertPreset={handleInsertPreset}
          onDialog={setDialog}
          onOpenAdvanced={openAdvanced}
        />

        {/* ── Canvas ────────────────────────────────────────────────────── */}
        <div className="tf-canvas-wrap" style={viewMode === 'perspective' ? {
          perspective: '800px',
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        } : undefined}>
          <BuilderCanvas
            layout={eng.layout}
            camera={eng.camera}
            preview={eng.preview}
              selectedIds={eng.selectedIds}
              sectionMode={eng.sectionMode}
              bgImage={eng.bgImage}
              bgOpacity={eng.bgOpacity}
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

          <AnimatePresence>
            {isEmpty && showEmpty && <EmptyState onDismiss={() => setShowEmpty(false)} />}
          </AnimatePresence>

          {/* Validation toast */}
          <AnimatePresence>
            {validationMsg && (
              <motion.div
                key="toast"
                initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:20}}
                style={{
                  position:'absolute', bottom:48, left:'50%', transform:'translateX(-50%)',
                  background: validationMsg.ok ? '#F0FDF4' : '#FEF2F2',
                  border: `1px solid ${validationMsg.ok ? '#86EFAC' : '#FCA5A5'}`,
                  color: validationMsg.ok ? '#166534' : '#991B1B',
                  borderRadius:12, padding:'10px 18px', fontSize:12, fontWeight:600,
                  boxShadow:'0 4px 16px rgba(0,0,0,0.1)', zIndex:30, maxWidth:400,
                  whiteSpace:'pre-wrap', textAlign:'center',
                }}
              >
                {validationMsg.ok ? '✓ ' : '✗ '}{validationMsg.text}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {eng.sectionMode && (
              <motion.div key="secbanner" className="tf-section-banner"
                initial={{y:-48,opacity:0}} animate={{y:0,opacity:1}} exit={{y:-48,opacity:0}}
                transition={{type:'spring',stiffness:400,damping:30}}
              >
                <div className="tf-section-banner-dot" />
                <span>Editing: <strong>{eng.layout.shapes.find(s => s.id === eng.sectionMode)?.label}</strong></span>
                <button className="tf-exit-btn" onClick={eng.exitSectionMode}>Exit</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status bar */}
          <div className="tf-statusbar">
            <span>{toolHint[eng.tool] ?? `${eng.tool} — drag to draw`}</span>
            <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
              {(eng.tool === 'row' || eng.tool === 'multirow') && (
                <div style={{display:'flex',alignItems:'center',gap:5,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'2px 8px'}}>
                  <span style={{fontSize:10,color:'var(--text-3)',fontWeight:600}}>Seats/row</span>
                  <input type="number" min={0} max={60} value={eng.rowSeatsCount||''} placeholder="auto"
                    onChange={e => eng.setRowSeatsCount(+e.target.value||0)}
                    style={{width:40,fontSize:11,fontWeight:700,border:'none',background:'transparent',outline:'none',color:'var(--text-1)',textAlign:'center'}} />
                </div>
              )}
              <span className="tf-status-badge">{eng.tool.toUpperCase()}</span>
              {eng.snapOn && <span className="tf-status-badge snap">SNAP</span>}
            </div>
          </div>
        </div>

        {/* ── Right Panel ───────────────────────────────────────────────── */}
        <div className="tf-right-panel">
          <div className="tf-panel-tabs">
            {(['design','data','ai'] as const).map(t => (
              <button key={t} className={`tf-panel-tab${rightTab===t?' active':''}`} onClick={() => setRightTab(t)}>
                {t === 'design' ? 'Design' : t === 'data' ? 'Data' : 'AI'}
              </button>
            ))}
          </div>

          {rightTab === 'design' && (
            <div className="tf-panel-body">
              <EnhancedPropertiesPanel
                selectedEntity={getSelectedEntity()}
                onUpdate={handleEntityUpdate}
                onUploadPhoto={handleUploadPhoto}
              />
            </div>
          )}

          {rightTab === 'data' && (
            <div className="tf-panel-body">
              <div className="tf-prop-group">
                <div className="tf-prop-group-label">Venue Stats</div>
                {[
                  ['Sections', eng.counts.sections],
                  ['Total Seats', eng.counts.seats.toLocaleString()],
                  ['Rows', eng.layout.rows?.length ?? 0],
                  ['Texts', eng.layout.texts?.length ?? 0],
                ].map(([k, v]) => (
                  <div key={String(k)} className="tf-prop-row">
                    <span className="tf-prop-label">{k}</span>
                    <span style={{fontSize:12,fontWeight:700,color:'var(--text-1)'}}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="tf-prop-group">
                <div className="tf-prop-group-label">Actions</div>
                <button className="tf-chip-btn" style={{width:'100%',justifyContent:'center'}} onClick={handleValidate}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Validate Layout
                </button>
                <button className="tf-chip-btn" style={{width:'100%',justifyContent:'center'}} onClick={eng.exportLayout}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Export GeoJSON
                </button>
              </div>
            </div>
          )}

          {rightTab === 'ai' && (
            <div className="tf-ai-panel">
              <div className="tf-ai-messages">
                {aiMessages.map((m, i) => (
                  <div key={i} className={`tf-ai-msg ${m.role}`}>{m.text}</div>
                ))}
              </div>
              <div className="tf-ai-input-row">
                <textarea
                  className="tf-ai-input"
                  rows={2}
                  placeholder="Ask AI to help design your venue..."
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } }}
                />
                <button className="tf-ai-send" onClick={sendAiMessage}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 6.5h11M7 1.5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Advanced Tools ────────────────────────────────────────────── */}
        <AnimatePresence>
          {showAdvancedTools && (
            <motion.div key="advanced"
              initial={{x:320,opacity:0}} animate={{x:0,opacity:1}} exit={{x:320,opacity:0}}
              transition={{type:'spring',stiffness:320,damping:32}}
              style={{flexShrink:0,boxShadow:'-4px 0 24px rgba(0,0,0,0.08)'}}
            >
              <AdvancedToolsPanel
                layout={eng.layout}
                selectedSectionId={eng.selectedShape?.id || null}
                selectedIds={eng.selectedIds}
                onApplyGrid={handleApplyGrid}
                onApplyTemplate={handleApplyTemplate}
                onImport={handleImport}
                onExport={handleExport}
                onValidate={handleValidate}
                onSplitSection={eng.splitSection}
                onMergeSections={eng.mergeSections}
                onRotate={eng.rotateSelected}
                activeTab={advancedTab}
                onTabChange={setAdvancedTab}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── History ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showHistory && (
            <motion.div key="history"
              initial={{x:240,opacity:0}} animate={{x:0,opacity:1}} exit={{x:240,opacity:0}}
              transition={{type:'spring',stiffness:320,damping:32}}
              style={{width:220,background:'var(--panel)',borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',flexShrink:0}}
            >
              <div style={{padding:'12px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:11,fontWeight:700,color:'var(--text-1)'}}>History</span>
                <button onClick={() => setShowHistory(false)} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:16,lineHeight:1}}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:8}}>
                {eng.history.length === 0 && (
                  <div style={{textAlign:'center',padding:'32px 16px',color:'var(--text-3)',fontSize:12}}>No history yet</div>
                )}
                {eng.history.map((s, i) => (
                  <div key={s.id} className={`tf-history-item${i===0?' current':''}`}
                    onClick={() => i > 0 && eng.restoreSnapshot(s)}
                  >
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span className="tf-history-item-label">{s.label}</span>
                      {i === 0 && <span className="tf-now-badge">NOW</span>}
                    </div>
                    <div className="tf-history-item-time">{new Date(s.ts).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Layers ────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showLayers && (
            <motion.div key="layers"
              initial={{x:240,opacity:0}} animate={{x:0,opacity:1}} exit={{x:240,opacity:0}}
              transition={{type:'spring',stiffness:320,damping:32}}
            >
              <LayerPanel onClose={() => setShowLayers(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 3D Preview ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {show3D && (
            <motion.div key="3d"
              initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}}
              transition={{type:'spring',stiffness:300,damping:28}}
              style={{position:'fixed',inset:60,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',borderRadius:20,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:40}}
            >
              <button onClick={() => setShow3D(false)} style={{position:'absolute',top:20,right:20,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:10,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'white'}}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
              <div style={{color:'white',fontSize:18,fontWeight:600}}>
                3D Preview (Three.js integration coming soon)
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GenerateDialogs
        open={dialog}
        onClose={() => setDialog(null)}
        onApply={patch => { eng.applyGeneratedLayout(patch); setShowEmpty(false); }}
      />
    </div>
  );
}

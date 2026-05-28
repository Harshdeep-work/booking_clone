'use client';
import { useRef, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import BuilderCanvas from './BuilderCanvas';
import AdvancedToolsPanel from './AdvancedToolsPanel';
import GenerateDialogs from './GenerateDialogs';
import LeftPanel from './LeftPanel';
import EmptyState from './EmptyState';
import LayerPanel from './LayerPanel';
import RowManagerPanel from './RowManagerPanel';
import SectionContextToolbar from './SectionContextToolbar';
import PropertiesPanel from './PropertiesPanel';
import { useBuilderEngine } from './useBuilderEngine';
import { icons } from './BuilderIcons';
import type { LayoutState } from './builderTypes2';
import { validateLayout } from './advancedTools';
import { packLayout } from '../../utils/stadiumOptimizer';
import { savePreviewLayoutLocal, savePreviewLayoutRemote } from '../../utils/previewStorage';
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
  const [advancedTab, setAdvancedTab]         = useState<'tools' | 'spacing' | 'import' | 'validate'>('tools');
  const [rightTab, setRightTab]               = useState<'data'|'rows'|'ai'|'props'>('rows');
  const [aiInput, setAiInput]                 = useState('');
  const [spacingInput, setSpacingInput]       = useState(14);
  const [aiMessages, setAiMessages]           = useState<{role:'user'|'assistant';text:string}[]>([
    { role: 'assistant', text: 'Hi! I can help you design your venue layout. Try: "Add 20 rows to section 101" or "Generate an NBA arena".' }
  ]);
  const [darkMode, setDarkMode]               = useState(false);
  const [showLayers, setShowLayers]           = useState(false);
  const [show3D, setShow3D]                   = useState(false);
  const [viewMode, setViewMode]               = useState<'top'|'perspective'>('top');
  const [seatView, setSeatView]               = useState<'seats'|'rows'>('seats');
  const [displayModePrompt, setDisplayModePrompt] = useState<string | null>(null); // sectionId pending
  const [promptStep, setPromptStep] = useState<'display' | 'style'>('display');
  const [promptDisplayMode, setPromptDisplayMode] = useState<'rows' | 'seats' | 'both'>('seats');
  const [leftCollapsed, setLeftCollapsed]     = useState(false);
  const [rightCollapsed, setRightCollapsed]   = useState(false);
  const [fullscreen, setFullscreen]           = useState(false);

  const eng = useBuilderEngine();

  // Show display-mode prompt after row/multirow is drawn
  useEffect(() => {
    if (eng.rowCommitTick > 0) {
      setDisplayModePrompt(eng.lastRowSectionId ?? '');
      setPromptStep('display');
    }
  }, [eng.rowCommitTick, eng.lastRowSectionId]);

  const isEmpty = eng.layout.shapes.length === 0 && eng.layout.seats.length === 0;

  // Track canvas container rect for context toolbar positioning
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerRect(el.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('scroll', update, true);
    return () => { ro.disconnect(); window.removeEventListener('scroll', update, true); };
  }, []);

  // Section stats for the context toolbar
  const sectionStats = useMemo(() => {
    if (!eng.selectedShape) return { seatCount: 0, rowCount: 0 };
    const sid = eng.selectedShape.id;
    const sectionSeats = eng.layout.seats.filter(s => s.sectionId === sid);
    const rowIds = new Set(sectionSeats.map(s => s.rowId).filter(Boolean));
    return { seatCount: sectionSeats.length, rowCount: rowIds.size };
  }, [eng.selectedShape, eng.layout.seats]);

  // Fullscreen toggle (F key) + Escape to exit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'f' || e.key === 'F') setFullscreen(v => !v);
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleZoomFit = () => {
    const el = containerRef.current;
    eng.zoomFit(el?.clientWidth ?? window.innerWidth, el?.clientHeight ?? window.innerHeight);
  };

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

  const openAdvanced = (tab: 'tools' | 'spacing' | 'import' | 'validate') => {
    setAdvancedTab(tab);
    setShowAdvancedTools(true);
  };

  const handleApplyGrid = (sectionId: string, rows: any[], seats: any[]) => {
    eng.applyGeneratedLayout({ rows, seats, _replaceSectionId: sectionId } as any);
    setDisplayModePrompt(sectionId);
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

  const handleSaveForPreview = () => {
    const packed = packLayout({ ...eng.layout, venueName: eng.venueName });
    savePreviewLayoutLocal(packed);
    savePreviewLayoutRemote(packed);
    setValidationMsg({ ok: true, text: '✓ Saved to preview — open /booking or /3d to see it' });
    setTimeout(() => setValidationMsg(null), 4000);
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
    seatselect: 'Drag to select seats inside rectangle · Shift+drag to add to selection',
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
      {!fullscreen && <header className="tf-topbar">

        {/* Left */}
        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
          <Link href="/" className="tf-logo">
            <div className="tf-logo-mark">
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M7 2l5 5-5 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="tf-logo-text">TicketFlow</span>
          </Link>
          <div className="tf-divider-v" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
             <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Venue Builder</span>
             <span style={{ color: 'var(--border)', fontSize: 14 }}>/</span>
             <div className="tf-venue-input">
              <input
                value={eng.venueName}
                onChange={e => eng.setVenueName(e.target.value)}
                placeholder="Untitled Venue"
              />
            </div>
          </div>
        </div>

        {/* Centre */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display: 'flex', background: 'var(--bg)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
            <button className={`tf-icon-btn`} style={{ border: 'none', width: 32, height: 32, background: 'transparent' }} onClick={eng.undo} title="Undo (Ctrl+Z)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5h6a4 4 0 010 8H4M2 5l3-3M2 5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className={`tf-icon-btn`} style={{ border: 'none', width: 32, height: 32, background: 'transparent' }} onClick={eng.redo} title="Redo (Ctrl+Y)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 5H6a4 4 0 000 8h4M12 5l-3-3M12 5l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div className="tf-divider-v" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{eng.counts.sections} <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Sections</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{eng.counts.seats.toLocaleString()} <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Seats</span></span>
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display: 'flex', background: 'var(--bg)', padding: 3, borderRadius: 100, border: '1px solid var(--border)', marginRight: 8 }}>
            <button className={`tf-chip-btn ${!show3D ? 'active' : ''}`} style={{ border: 'none', padding: '6px 12px', height: 28, fontSize: 11 }} onClick={() => setShow3D(false)}>2D</button>
            <button className={`tf-chip-btn ${show3D ? 'active' : ''}`} style={{ border: 'none', padding: '6px 12px', height: 28, fontSize: 11 }} onClick={() => setShow3D(true)}>3D View</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/booking" target="_blank" className="tf-chip-btn" style={{ textDecoration: 'none' }}>
              <span style={{ marginRight: 4 }}>👁️</span> Preview
            </Link>
            <button className="tf-chip-btn" onClick={() => openAdvanced('tools')}>
              <span style={{ marginRight: 4 }}>⚙️</span> Advanced
            </button>
            <div className="tf-divider-v" />
            <div className="tf-status-badge snap" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, border: 'none', background: '#ecfdf5', color: '#059669', fontSize: 10, fontWeight: 800 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'tf-pulse 2s infinite' }} />
              LIVE
            </div>
            <button className="tf-primary-btn" onClick={handleSaveForPreview}>
               Save for Preview
            </button>
          </div>
        </div>
      </header>}

      <div className="tf-body">

        {/* ── Left Sidebar ──────────────────────────────────────────────── */}
        {!leftCollapsed && !fullscreen && (
          <div style={{ width: 'var(--sidebar-w)', display: 'flex', flexDirection: 'column', background: 'var(--panel)', borderRight: '1px solid var(--border)', backdropFilter: 'blur(20px)', zIndex: 10 }}>
            <div style={{ padding: '24px 20px 16px' }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.5px', marginBottom: 4 }}>My Venue</h1>
              <p style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>Design your venue layout</p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <LeftPanel
                activeTool={eng.tool}
                onTool={eng.changeTool}
                snapOn={eng.snapOn}
                onSnap={() => eng.setSnapOn(!eng.snapOn)}
                onInsertPreset={handleInsertPreset}
                onDialog={setDialog}
                onOpenAdvanced={openAdvanced}
              />
            </div>
          </div>
        )}

        {/* ── Canvas ────────────────────────────────────────────────────── */}
        <div className="tf-canvas-wrap">
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
            seatView={seatView}
            orphanDisplayModes={eng.orphanDisplayModes}
            orphanRenderStyles={eng.orphanRenderStyles}
            layers={eng.layers}
          />

          <AnimatePresence>
            {isEmpty && showEmpty && <EmptyState onDismiss={() => setShowEmpty(false)} />}
          </AnimatePresence>

          {/* ── Floating Zoom Controls (TickPick style) ────────────────── */}
          <div style={{
            position: 'absolute', right: 24, top: 24,
            display: 'flex', flexDirection: 'column', gap: 8,
            zIndex: 30
          }}>
             <div style={{
                background: 'var(--panel)', backdropFilter: 'blur(12px)',
                borderRadius: 16, padding: 6, boxShadow: 'var(--shadow-lg)',
                display: 'flex', flexDirection: 'column', border: '1px solid var(--border)'
             }}>
                <button className="tf-zoom-btn" onClick={eng.zoomIn} style={{ width: 40, height: 40, fontSize: 20 }}>+</button>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
                <button className="tf-zoom-btn" onClick={eng.zoomOut} style={{ width: 40, height: 40, fontSize: 20 }}>−</button>
             </div>
             <button
               onClick={handleZoomFit}
               style={{
                 width: 52, height: 52, borderRadius: 16, border: '1px solid var(--border)',
                 background: 'var(--panel)', backdropFilter: 'blur(12px)', color: 'var(--text-1)',
                 cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                 boxShadow: 'var(--shadow-lg)', transition: 'all 0.2s'
               }}
               onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
               onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
             >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 15v6h-6M3 9V3h6"/></svg>
             </button>
          </div>

          {/* ── Bottom Controls ─────────────────────────────────────────── */}
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            bottom: 24, display: 'flex', alignItems: 'center', gap: 12,
            zIndex: 30
          }}>
             <div style={{
                background: 'var(--panel)', backdropFilter: 'blur(12px)',
                borderRadius: 100, padding: '6px 20px', boxShadow: 'var(--shadow-lg)',
                display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)'
             }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>{eng.zoomPct}% Zoom</span>
                <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
                <button
                  onClick={() => setShowLayers(!showLayers)}
                  style={{ background: 'none', border: 'none', color: showLayers ? 'var(--accent)' : 'var(--text-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  Layers
                </button>
             </div>
          </div>


          {/* Spacing toolbar — shown when seats are selected */}
          {eng.selectedIds.size > 1 && [...eng.selectedIds].some(id => eng.layout.seats.find(s => s.id === id)) && (
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--panel)', borderRadius: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', zIndex: 20,
              fontSize: 11, fontWeight: 600, color: 'var(--text-2)',
            }}>
              <span>{eng.selectedIds.size} seats</span>
              <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
              <button onClick={() => eng.distributeSeats('h')} title="Distribute horizontally"
                style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-1)' }}>
                ↔ Distribute H
              </button>
              <button onClick={() => eng.distributeSeats('v')} title="Distribute vertically"
                style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-1)' }}>
                ↕ Distribute V
              </button>
              <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
              <span>Spacing</span>
              <input type="number" value={spacingInput} min={4} max={100}
                onChange={e => setSpacingInput(+e.target.value)}
                style={{ width: 44, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, textAlign: 'center', background: 'var(--bg)', color: 'var(--text-1)' }} />
              <button onClick={() => eng.setSpacing(spacingInput, 'h')}
                style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-1)' }}>H</button>
              <button onClick={() => eng.setSpacing(spacingInput, 'v')}
                style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-1)' }}>V</button>
            </div>
          )}

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
              {fullscreen && (
                <button onClick={() => setFullscreen(false)}
                  style={{fontSize:10,fontWeight:700,background:'var(--text-1)',color:'var(--panel)',border:'none',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontFamily:'inherit'}}>
                  ESC — Exit Fullscreen
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Panel ───────────────────────────────────────────────── */}
        {!rightCollapsed && !fullscreen && (
        <div className="tf-right-panel">
          <div className="tf-panel-tabs">
            {(['data','rows','ai','props'] as const).map(t => (
              <button key={t} className={`tf-panel-tab${rightTab===t?' active':''}`} onClick={() => setRightTab(t)}>
                {t === 'data' ? 'Data' : t === 'rows' ? 'Rows' : t === 'ai' ? 'AI' : 'Props'}
              </button>
            ))}
          </div>

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

          {rightTab === 'rows' && (
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <RowManagerPanel
                layout={eng.layout}
                selectedSectionId={eng.selectedShape?.id || null}
                onAddRow={eng.addRow}
                onDeleteRow={eng.deleteRow}
                onDuplicateRow={eng.duplicateRow}
                onUpdateRow={(rowId, updates) => eng.updateRow(rowId, updates)}
                onClearRowSeats={eng.clearRowSeats}
                onRestoreRowSeats={eng.restoreRowSeats}
                onSplitRow={(rowId, seatIds) => eng.splitRow(rowId, seatIds)}
                onSelectSeat={(seatId) => {
                  eng.selectEntity(seatId);
                  eng.changeTool('select');
                }}
                selectedSeatId={eng.selectedSeat?.id || null}
                onAddCurvedRows={(sectionId, ...args) => { eng.addCurvedRows(sectionId, ...args); setDisplayModePrompt(sectionId); }}
                onCreateArcSection={eng.createArcSection}
                onSetDisplayMode={eng.setDisplayMode}
              />
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

          {rightTab === 'props' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {eng.selectedShape || eng.selectedSeat || eng.selectedText || eng.selectedRow || eng.selectedIds.size > 0 ? (
                <PropertiesPanel
                  key={eng.selectedShape?.id ?? eng.selectedSeat?.id ?? eng.selectedText?.id ?? 'none'}
                  shape={eng.selectedShape ?? (eng.sectionMode ? eng.layout.shapes.find(s => s.id === eng.sectionMode) ?? null : null)}
                  seat={eng.selectedSeat}
                  text={eng.selectedText}
                  row={eng.selectedRow}
                  multiCount={eng.selectedIds.size}
                  onShape={(u) => eng.updateShape(u, eng.selectedShape?.id ?? eng.sectionMode ?? undefined)}
                  onSeat={eng.updateSeat}
                  onText={eng.updateText}
                  onRow={eng.updateRow}
                  onMultiCategory={(cat) => eng.multiUpdate(cat)}
                  onMultiPrice={(price) => eng.multiUpdate(undefined, price)}
                  onMultiStatus={(status) => eng.multiUpdate(undefined, undefined, status)}
                  onDelete={eng.deleteSelected}
                  onFillSection={eng.fillSection}
                  sectionMode={eng.sectionMode}
                  totalElements={eng.layout.seats.length + eng.layout.shapes.length + eng.layout.texts.length}
                  totalSeats={eng.layout.seats.length}
                  totalSections={eng.layout.shapes.filter(s => s.type === 'section').length}
                  selectedCount={eng.selectedIds.size}
                />
              ) : (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                  Select an item (section, seat, or text label) to edit its properties
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* ── Advanced Tools ────────────────────────────────────────────── */}
        <AnimatePresence>
          {showAdvancedTools && (
            <motion.div key="advanced"
              initial={{x:320,opacity:0}} animate={{x:0,opacity:1}} exit={{x:320,opacity:0}}
              transition={{type:'spring',stiffness:320,damping:32}}
              style={{flexShrink:0,boxShadow:'-4px 0 24px rgba(0,0,0,0.08)',position:'relative',zIndex:10,height:'100%'}}
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
                onAddAisle={eng.addAisle}
                onSetDensity={eng.setSectionDensity}
                onAutoBalance={eng.autoBalance}
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
              style={{width:220,background:'var(--panel)',borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',flexShrink:0,position:'relative',zIndex:10,height:'100%'}}
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
              style={{position:'relative',zIndex:10,height:'100%'}}
            >
              <LayerPanel
                layers={eng.layers}
                onToggle={eng.toggleLayer}
                onClose={() => setShowLayers(false)}
              />
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
        onApply={patch => {
          eng.applyGeneratedLayout(patch);
          setShowEmpty(false);
          // Prompt display mode if seats were generated
          const sid = patch.shapes?.[0]?.id;
          if (sid && patch.seats && patch.seats.length > 0) setDisplayModePrompt(sid);
        }}
      />

      {/* ── Display Mode Prompt ─────────────────────────────────────────── */}
      {displayModePrompt !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg, #fff)', borderRadius: 16, padding: '28px 32px', boxShadow: '0 8px 40px rgba(0,0,0,0.22)', minWidth: 360, textAlign: 'center' }}>

            {promptStep === 'display' ? (<>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>How would you like to display this layout?</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>Step 1 of 2 — Display mode</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {([
                  { key: 'rows',  icon: '≡', label: 'Rows Only',    desc: 'Thin guide lines, no seat circles' },
                  { key: 'both',  icon: '⊞', label: 'Rows + Seats', desc: 'Guide lines + seats on zoom in' },
                  { key: 'seats', icon: '●', label: 'Seats Only',   desc: 'Individual seat circles always visible' },
                ] as const).map(m => (
                  <button key={m.key} onClick={() => { setPromptDisplayMode(m.key); setPromptStep('style'); }} style={{
                    flex: 1, padding: '14px 8px', borderRadius: 12, cursor: 'pointer',
                    border: '1.5px solid var(--border, #e2e8f0)', background: 'var(--bg, #fff)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLButtonElement).style.background = '#eff6ff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border, #e2e8f0)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg, #fff)'; }}
                  >
                    <span style={{ fontSize: 22 }}>{m.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{m.label}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>{m.desc}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setDisplayModePrompt(null)} style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Skip</button>
            </>) : (<>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>What kind of rows do you want?</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>Step 2 of 2 — Row appearance</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {([
                  { key: 'dots', icon: '⬤ ⬤ ⬤', label: 'Dots',       desc: 'Individual seat circles' },
                  { key: 'bar',  icon: '━━━━━',   label: 'Bar',        desc: 'Solid filled row bar' },
                  { key: 'line', icon: '─────',   label: 'Line',       desc: 'Thin guide line only' },
                ] as const).map(m => (
                  <button key={m.key} onClick={() => {
                    eng.setDisplayMode(displayModePrompt, promptDisplayMode);
                    eng.setRowRenderStyle(displayModePrompt, m.key);
                    setDisplayModePrompt(null);
                  }} style={{
                    flex: 1, padding: '14px 8px', borderRadius: 12, cursor: 'pointer',
                    border: '1.5px solid var(--border, #e2e8f0)', background: 'var(--bg, #fff)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLButtonElement).style.background = '#eff6ff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border, #e2e8f0)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg, #fff)'; }}
                  >
                    <span style={{ fontSize: m.key === 'dots' ? 10 : 16, fontWeight: 700, letterSpacing: m.key === 'dots' ? 3 : 0, color: '#475569' }}>{m.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{m.label}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>{m.desc}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setPromptStep('display')} style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
            </>)}

          </div>
        </div>
      )}
    </div>
  );
}

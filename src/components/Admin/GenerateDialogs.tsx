'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CATS, CAT_COLOR, arcPoly, centroid, generateBlockSeats, type Category, type BShape, type LayoutState } from './builderTypes2';

type DialogType = 'ring' | 'arc' | 'block' | 'row-config' | null;

interface Props {
  open: DialogType;
  onClose: () => void;
  onApply: (patch: Partial<LayoutState>) => void;
}

const INP: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 7,
  border: '1px solid #e2e8f0', background: '#fff',
  color: '#0f172a', fontSize: 13, outline: 'none', marginBottom: 12,
  fontFamily: 'Inter,sans-serif',
};
const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 };
const ROW2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };

export default function GenerateDialogs({ open, onClose, onApply }: Props) {
  const [cat, setCat] = useState<Category>('STANDARD');
  const [price, setPrice] = useState(100);

  // Ring
  const [rInner, setRInner] = useState(100);
  const [rOuter, setROuter] = useState(160);
  const [rDivs, setRDivs] = useState(8);

  // Arc
  const [aInner, setAInner] = useState(100);
  const [aOuter, setAOuter] = useState(160);
  const [aStart, setAStart] = useState(-45);
  const [aEnd, setAEnd] = useState(45);

  // Block
  const [bRows, setBRows] = useState(10);
  const [bCols, setBCols] = useState(15);
  const [bW, setBW] = useState(200);
  const [bH, setBH] = useState(120);

  const applyRing = () => {
    const step = 360 / rDivs;
    const shapes: BShape[] = [];
    for (let i = 0; i < rDivs; i++) {
      const a0 = i * step, a1 = (i + 1) * step;
      const verts = arcPoly(0, 0, rInner, rOuter, a0, a1);
      const [cx, cy] = centroid(verts);
      shapes.push({ id: `ring-${Date.now()}-${i}`, type: 'section', label: `Sec ${i + 1}`, category: cat, color: CAT_COLOR[cat], vertices: verts, cx, cy });
    }
    onApply({ shapes });
    // Advance radii outward for next ring
    const thickness = rOuter - rInner;
    setRInner(rOuter);
    setROuter(rOuter + thickness);
    onClose();
  };

  const applyArc = () => {
    const verts = arcPoly(0, 0, aInner, aOuter, aStart, aEnd);
    const [cx, cy] = centroid(verts);
    const shape: BShape = { id: `arc-${Date.now()}`, type: 'section', label: 'Section', category: cat, color: CAT_COLOR[cat], vertices: verts, cx, cy };
    onApply({ shapes: [shape] });
    onClose();
  };

  const applyBlock = () => {
    const x0 = -bW / 2, y0 = -bH / 2, x1 = bW / 2, y1 = bH / 2;
    const sid = `block-${Date.now()}`;
    const verts: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const [cx, cy] = centroid(verts);
    const shape: BShape = { id: sid, type: 'section', label: 'Block', category: cat, color: CAT_COLOR[cat], vertices: verts, cx, cy };
    const { rows, seats } = generateBlockSeats(x0, y0, x1, y1, bRows, bCols, sid, cat, price);
    onApply({ shapes: [shape], rows, seats });
    onClose();
  };

  const titles: Record<NonNullable<DialogType>, string> = {
    ring: 'Generate Ring Sections',
    arc: 'Generate Arc Section',
    block: 'Generate Seat Block',
    'row-config': 'Row Configuration',
  };

  const handlers: Record<NonNullable<DialogType>, () => void> = {
    ring: applyRing, arc: applyArc, block: applyBlock, 'row-config': onClose,
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 10 }}
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, width: 400, boxShadow: '0 24px 48px rgba(0,0,0,0.12)', fontFamily: 'Inter,sans-serif' }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>
              {open ? titles[open] : ''}
            </div>

            {/* Category picker */}
            <label style={LBL}>Category</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {CATS.map(c => (
                <button key={c} onClick={() => setCat(c)} style={{
                  padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1.5px solid',
                  borderColor: cat === c ? CAT_COLOR[c] : '#e2e8f0',
                  background: cat === c ? CAT_COLOR[c] + '15' : '#fff',
                  color: cat === c ? CAT_COLOR[c] : '#94a3b8',
                }}>{c}</button>
              ))}
            </div>

            <label style={LBL}>Base Price ($)</label>
            <input style={INP} type="number" value={price} onChange={e => setPrice(+e.target.value)} />

            {open === 'ring' && (
              <>
                <div style={ROW2}>
                  <div><label style={LBL}>Inner Radius</label><input style={INP} type="number" value={rInner} onChange={e => setRInner(+e.target.value)} /></div>
                  <div><label style={LBL}>Outer Radius</label><input style={INP} type="number" value={rOuter} onChange={e => setROuter(+e.target.value)} /></div>
                </div>
                <label style={LBL}>Sections (divisions)</label>
                <input style={INP} type="number" value={rDivs} onChange={e => setRDivs(+e.target.value)} />
              </>
            )}

            {open === 'arc' && (
              <>
                <div style={ROW2}>
                  <div><label style={LBL}>Inner Radius</label><input style={INP} type="number" value={aInner} onChange={e => setAInner(+e.target.value)} /></div>
                  <div><label style={LBL}>Outer Radius</label><input style={INP} type="number" value={aOuter} onChange={e => setAOuter(+e.target.value)} /></div>
                </div>
                <div style={ROW2}>
                  <div><label style={LBL}>Start Angle°</label><input style={INP} type="number" value={aStart} onChange={e => setAStart(+e.target.value)} /></div>
                  <div><label style={LBL}>End Angle°</label><input style={INP} type="number" value={aEnd} onChange={e => setAEnd(+e.target.value)} /></div>
                </div>
              </>
            )}

            {open === 'block' && (
              <>
                <div style={ROW2}>
                  <div><label style={LBL}>Rows</label><input style={INP} type="number" value={bRows} onChange={e => setBRows(+e.target.value)} /></div>
                  <div><label style={LBL}>Cols</label><input style={INP} type="number" value={bCols} onChange={e => setBCols(+e.target.value)} /></div>
                </div>
                <div style={ROW2}>
                  <div><label style={LBL}>Width</label><input style={INP} type="number" value={bW} onChange={e => setBW(+e.target.value)} /></div>
                  <div><label style={LBL}>Height</label><input style={INP} type="number" value={bH} onChange={e => setBH(+e.target.value)} /></div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={open ? handlers[open] : onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
                Generate
              </button>
              <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

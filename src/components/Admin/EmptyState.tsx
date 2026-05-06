'use client';
import { motion } from 'framer-motion';

interface Props { onDismiss: () => void; }

const TIPS = [
  { key: 'S', label: 'Draw polygon section', color: '#C97B36' },
  { key: 'R', label: 'Draw rectangle section', color: '#7AA7FF' },
  { key: 'W', label: 'Row of seats (click to click)', color: '#C97B36' },
  { key: 'A', label: 'Curved arc row', color: '#7AA7FF' },
  { key: 'B', label: 'Seat block (drag)', color: '#C97B36' },
  { key: 'T', label: 'Text label', color: '#7AA7FF' },
];

export default function EmptyState({ onDismiss }: Props) {
  return (
    <motion.div className="tf-empty"
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
    >
      <motion.div className="tf-empty-card"
        initial={{scale:0.96,y:12}} animate={{scale:1,y:0}}
        transition={{type:'spring',stiffness:300,damping:28}}
      >
        <div className="tf-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{color:'var(--text-2)'}}>
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="tf-empty-title">Start building your venue</div>
        <div className="tf-empty-desc">
          Pick a template from the left panel to start instantly,<br/>or use the tools to draw from scratch.
        </div>

        <div className="tf-shortcut-grid">
          {TIPS.map(t => (
            <div key={t.key} className="tf-shortcut-item">
              <span className="tf-shortcut-key" style={{background:t.color+'18',border:`1.5px solid ${t.color}44`,color:t.color}}>
                {t.key}
              </span>
              <span className="tf-shortcut-label">{t.label}</span>
            </div>
          ))}
        </div>

        <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap',marginBottom:20}}>
          {[['Scroll','Zoom'],['Alt+drag','Pan'],['Dbl-click','Edit section'],['Del','Delete'],['Ctrl+Z','Undo']].map(([k,d]) => (
            <div key={k} style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:10,fontWeight:700,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:5,padding:'2px 6px',color:'var(--text-2)'}}>{k}</span>
              <span style={{fontSize:10,color:'var(--text-3)'}}>{d}</span>
            </div>
          ))}
        </div>

        <button className="tf-primary-btn" style={{margin:'0 auto'}} onClick={onDismiss}>
          Start Drawing
        </button>
      </motion.div>
    </motion.div>
  );
}

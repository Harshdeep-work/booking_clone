'use client';
import React from 'react';
import type { BuilderSection, BuilderSeat, ValidationError, LayoutSnapshot, Category } from './types';
import { CATS, CAT_COLOR } from './types';

const SECTION_HEADER: React.CSSProperties = { fontSize:11, fontWeight:800, color:'#475569', textTransform:'uppercase', letterSpacing:1, padding:'16px 20px 8px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' };

export function PropertyPanel({ seat, section, multiCount, onSeat, onSection, onMultiPrice, onMultiCategory, onMultiStatus }: any) {
  const LBL: React.CSSProperties = { fontSize:11, color:'#64748b', fontWeight:600, display:'block', marginBottom:6 };
  const INP: React.CSSProperties = { width:'100%', padding:'8px 10px', borderRadius:6, border:'1px solid #e2e8f0', background:'#fff', color:'#0f172a', fontSize:13, outline:'none', marginBottom:12 };

  if (multiCount && multiCount > 1) {
    return (
      <div>
        <div style={SECTION_HEADER}>{multiCount} Selected Elements</div>
        <div style={{ padding:20 }}>
          <label style={LBL}>Set Bulk Price ($)</label><input style={INP} type="number" onBlur={e=>e.target.value && onMultiPrice(+e.target.value)} placeholder="e.g. 150" />
          <label style={LBL}>Set Category</label>
          <select style={INP} onChange={e=>e.target.value && onMultiCategory(e.target.value)}>
            <option value="">— select —</option>
            {CATS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <label style={LBL}>Set Status</label>
          <select style={INP} onChange={e=>e.target.value && onMultiStatus(e.target.value)}>
            <option value="">— select —</option>
            <option value="available">Available</option>
            <option value="sold">Sold</option>
            <option value="locked">Locked</option>
          </select>
        </div>
      </div>
    );
  }

  if (seat) {
    return (
      <div>
        <div style={SECTION_HEADER}>Seat Details</div>
        <div style={{ padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <div style={{ width:16, height:16, borderRadius:'50%', background:CAT_COLOR[seat.category as Category] }} />
            <span style={{ fontSize:14, fontWeight:700 }}>Row {seat.row} · #{seat.number}</span>
          </div>
          <label style={LBL}>Seat Row</label><input style={INP} value={seat.row} onChange={e=>onSeat({row:e.target.value})} />
          <label style={LBL}>Seat Number</label><input style={INP} type="number" value={seat.number} onChange={e=>onSeat({number:+e.target.value})} />
          <label style={LBL}>Ticket Price ($)</label><input style={INP} type="number" value={seat.price} onChange={e=>onSeat({price:+e.target.value})} />
          <label style={LBL}>Category</label>
          <select style={INP} value={seat.category} onChange={e=>onSeat({category:e.target.value})}>
            {CATS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <label style={LBL}>Status</label>
          <select style={INP} value={seat.status} onChange={e=>onSeat({status:e.target.value as any})}>
            <option value="available">Available</option>
            <option value="sold">Sold</option>
            <option value="locked">Locked</option>
          </select>
        </div>
      </div>
    );
  }

  if (section) {
    return (
      <div>
        <div style={SECTION_HEADER}>Section Configuration</div>
        <div style={{ padding:20 }}>
          <label style={LBL}>Section Label</label><input style={INP} value={section.label} onChange={e=>onSection({label:e.target.value})} />
          <label style={LBL}>Category</label>
          <select style={INP} value={section.category} onChange={e=>onSection({category:e.target.value})}>
            {CATS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <label style={LBL}>Base Price ($)</label><input style={INP} type="number" value={section.basePrice} onChange={e=>onSection({basePrice:+e.target.value})} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
      <div style={{ fontSize:40, marginBottom:16 }}>❂</div>
      <div style={{ fontSize:12, fontWeight:700 }}>Select Object</div>
      <div style={{ fontSize:11, marginTop:8 }}>Click any seat or section on the canvas to edit.</div>
    </div>
  );
}

export function ValidationPanel({ errors }: { errors: ValidationError[] }) {
  return (
    <div style={{ padding:20 }}>
      <div style={{ fontSize:10, fontWeight:800, color:'#64748b', textTransform:'uppercase', marginBottom:12 }}>Health Check</div>
      {errors.length === 0 ? (
        <div style={{ color:'#16a34a', fontSize:12, fontWeight:600 }}>✓ All systems operational.</div>
      ) : (
        errors.map((e,i)=><div key={i} style={{ color:'#dc2626', fontSize:12, marginBottom:10, background:'#fef2f2', padding:10, borderRadius:6, borderLeft:'3px solid #ef4444' }}>{e.message}</div>)
      )}
    </div>
  );
}

export function VersionPanel({ history, onRestore }: any) {
  return (
    <div style={{ padding:10 }}>
      {history.map((s:any,i:number)=>(
        <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:i===0?'#f8fafc':'#fff', border:'1px solid #e2e8f0', borderRadius:8, marginBottom:8 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>{s.name}</div>
            <div style={{ fontSize:10, color:'#94a3b8' }}>{new Date(s.timestamp).toLocaleTimeString()}</div>
          </div>
          {i > 0 && <button onClick={()=>onRestore(s)} style={{ fontSize:10, padding:'4px 8px', border:'1px solid #e2e8f0', background:'#fff', borderRadius:4, cursor:'pointer' }}>Undo to here</button>}
          {i===0 && <span style={{ fontSize:9, color:'#3b82f6', fontWeight:900 }}>CURRENT</span>}
        </div>
      ))}
    </div>
  );
}

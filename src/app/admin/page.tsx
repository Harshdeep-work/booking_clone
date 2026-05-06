'use client';
import dynamic from 'next/dynamic';

const VenueBuilder = dynamic(() => import('@/components/Admin/VenueBuilder'), {
  ssr: false,
  loading: () => (
    <div style={{width:'100vw',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F5F5F3',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
        <div style={{width:36,height:36,background:'#1C1C1C',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h12M8 2l6 6-6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{width:24,height:24,border:'2px solid #E8E8E6',borderTopColor:'#C97B36',borderRadius:'50%',animation:'spin 0.7s linear infinite'}} />
        <span style={{fontSize:12,color:'#777',fontWeight:500}}>Loading builder</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  ),
});

export default function AdminPage() {
  return <VenueBuilder />;
}

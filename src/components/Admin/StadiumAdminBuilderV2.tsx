'use client';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { arcPolygon, CAT_HEX, CAT_COLOR, SECTIONS } from '@/data/stadiumEngine';
import type { Category, StadiumSection, StadiumSeat } from '@/data/stadiumEngine';

type Tool = 'select'|'draw'|'vertex'|'seat'|'pan';
const CATS: Category[] = ['FIELD','PLATINUM','GOLD','SILVER','BRONZE','GENERAL'];
interface RingCfg { innerR:number;outerR:number;divisions:number;category:Category;basePrice:number }
interface ArcCfg  { innerR:number;outerR:number;aStart:number;aEnd:number;category:Category;basePrice:number }

function sprite(short:string, price:number, cat:Category): THREE.Sprite {
  const cv = document.createElement('canvas'); cv.width=140; cv.height=56;
  const c = cv.getContext('2d')!;
  c.fillStyle='rgba(0,0,0,0.78)'; c.roundRect(3,3,134,50,7); c.fill();
  c.fillStyle='#fff'; c.font='bold 17px sans-serif'; c.textAlign='center'; c.fillText(short,70,24);
  c.font='600 13px sans-serif'; c.fillStyle=CAT_COLOR[cat]; c.fillText(`$${price}`,70,44);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthTest:false,transparent:true}));
  sp.scale.set(22,9,1); return sp;
}

function buildSecMesh(scene:THREE.Scene, sec:StadiumSection, map:Map<string,THREE.Object3D[]>) {
  const pts = arcPolygon(0,0,sec.innerRadius,sec.outerRadius,sec.angleStart,sec.angleEnd,48);
  const shape = new THREE.Shape();
  pts.forEach(([x,y],i)=>i===0?shape.moveTo(x,y):shape.lineTo(x,y)); shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({color:CAT_HEX[sec.category],transparent:true,opacity:0.55,side:THREE.DoubleSide}));
  mesh.userData={id:sec.id,type:'section'};  scene.add(mesh);
  const outPts=[...pts,pts[0]].map(([x,y])=>new THREE.Vector3(x,y,0.5));
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(outPts),new THREE.LineBasicMaterial({color:0xffffff}));
  scene.add(line);
  const sp=sprite(sec.shortLabel,sec.basePrice,sec.category);
  sp.position.set(sec.centerX,sec.centerY,2); scene.add(sp);
  map.set(sec.id,[mesh,line,sp]);
}

export default function StadiumAdminBuilderV2() {
  const mountRef=useRef<HTMLDivElement>(null);
  const rendRef =useRef<THREE.WebGLRenderer|undefined>(undefined);
  const camRef  =useRef<THREE.OrthographicCamera|undefined>(undefined);
  const sceneRef=useRef<THREE.Scene|undefined>(undefined);
  const rafRef  =useRef<number|undefined>(undefined);
  const toolRef =useRef<Tool>('select');
  const catRef  =useRef<Category>('GENERAL');
  const snapRef =useRef(true);
  const secMeshes =useRef<Map<string,THREE.Object3D[]>>(new Map());
  const seatMeshes=useRef<Map<string,THREE.Mesh>>(new Map());
  const polyMeshes=useRef<Map<string,THREE.Object3D[]>>(new Map());
  const polyData  =useRef<Map<string,[number,number][]>>(new Map());
  const liveSecs  =useRef<StadiumSection[]>([...SECTIONS]);
  const liveSeats =useRef<StadiumSeat[]>([]);
  const isPanning =useRef(false);
  const isDragging=useRef(false);
  const lastMouse =useRef({x:0,y:0});
  const zoomLevel =useRef(1);
  const selId     =useRef<string|null>(null);
  const hovId     =useRef<string|null>(null);
  const dragOff   =useRef({x:0,y:0});
  const drawPts   =useRef<[number,number][]>([]);
  const prevLine  =useRef<THREE.Line|null>(null);
  const prevDots  =useRef<THREE.Mesh[]>([]);
  const vHandles  =useRef<Map<string,THREE.Mesh[]>>(new Map());
  const dragVtx   =useRef<{id:string;vi:number}|null>(null);

  const [tool,  setTool_]  =useState<Tool>('select');
  const [cat,   setCat_]   =useState<Category>('GENERAL');
  const [snap,  setSnap_]  =useState(true);
  const [cursor,setCursor] =useState<[number,number]|null>(null);
  const [selSec,setSelSec] =useState<StadiumSection|null>(null);
  const [hovSec,setHovSec] =useState<StadiumSection|null>(null);
  const [secCnt,setSecCnt] =useState(SECTIONS.length);
  const [seatCnt,setSeatCnt]=useState(0);
  const [showRing,setShowRing]=useState(false);
  const [showArc, setShowArc] =useState(false);
  const [ringCfg,setRingCfg]=useState<RingCfg>({innerR:100,outerR:150,divisions:8,category:'GENERAL',basePrice:100});
  const [arcCfg, setArcCfg] =useState<ArcCfg>({innerR:100,outerR:150,aStart:-30,aEnd:30,category:'GENERAL',basePrice:100});
  const [priceEdit,setPriceEdit]=useState('');

  const setTool=(t:Tool)=>{toolRef.current=t;setTool_(t);clearDraw();clearVH();};
  const setCat =(c:Category)=>{catRef.current=c;setCat_(c);};
  const toggleSnap=()=>{snapRef.current=!snapRef.current;setSnap_(snapRef.current);};

  const worldPos=useCallback((cx:number,cy:number):[number,number]=>{
    const el=mountRef.current!,cam=camRef.current!;
    const r=el.getBoundingClientRect();
    const v=new THREE.Vector3(((cx-r.left)/r.width)*2-1,-((cy-r.top)/r.height)*2+1,0).unproject(cam);
    const s=snapRef.current?5:1;
    return [Math.round(v.x/s)*s,Math.round(v.y/s)*s];
  },[]);

  const clearDraw=useCallback(()=>{
    const sc=sceneRef.current;if(!sc)return;
    if(prevLine.current){sc.remove(prevLine.current);prevLine.current=null;}
    prevDots.current.forEach(d=>sc.remove(d));prevDots.current=[];drawPts.current=[];
  },[]);

  const updatePreview=useCallback((pts:[number,number][],mouse?:[number,number])=>{
    const sc=sceneRef.current!;
    if(prevLine.current){sc.remove(prevLine.current);prevLine.current=null;}
    const all=mouse?[...pts,mouse]:pts; if(all.length<2)return;
    const geo=new THREE.BufferGeometry().setFromPoints(all.map(([x,y])=>new THREE.Vector3(x,y,1)));
    const mat=new THREE.LineDashedMaterial({color:0x4f6ef7,dashSize:5,gapSize:3});
    const l=new THREE.Line(geo,mat); l.computeLineDistances();
    prevLine.current=l; sc.add(l);
  },[]);

  const commitDraw=useCallback(()=>{
    const pts=drawPts.current; if(pts.length<3){clearDraw();return;}
    const sc=sceneRef.current!; const id=`poly-${Date.now()}`;
    const cat=catRef.current;
    const shape=new THREE.Shape();
    pts.forEach(([x,y],i)=>i===0?shape.moveTo(x,y):shape.lineTo(x,y)); shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({color:CAT_HEX[cat],transparent:true,opacity:0.55,side:THREE.DoubleSide}));
    mesh.userData={id,type:'poly'}; sc.add(mesh);
    const outPts=[...pts,pts[0]].map(([x,y])=>new THREE.Vector3(x,y,0.5));
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(outPts),new THREE.LineBasicMaterial({color:CAT_HEX[cat]}));
    sc.add(line);
    polyMeshes.current.set(id,[mesh,line]); polyData.current.set(id,[...pts]);
    setSecCnt(s=>s+1); clearDraw();
  },[clearDraw]);

  const clearVH=useCallback(()=>{
    const sc=sceneRef.current;if(!sc)return;
    vHandles.current.forEach(hs=>hs.forEach(h=>sc.remove(h))); vHandles.current.clear(); dragVtx.current=null;
  },[]);

  const showVH=useCallback((id:string)=>{
    const sc=sceneRef.current!; clearVH();
    const pts=polyData.current.get(id);if(!pts)return;
    const hs:THREE.Mesh[]=[];
    pts.forEach(([x,y],vi)=>{
      const dot=new THREE.Mesh(new THREE.CircleGeometry(5,12),new THREE.MeshBasicMaterial({color:0x4f6ef7}));
      dot.position.set(x,y,3); dot.userData={type:'vtx',id,vi}; sc.add(dot); hs.push(dot);
      const ring=new THREE.Mesh(new THREE.RingGeometry(5,7,12),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}));
      ring.position.set(x,y,2.5); sc.add(ring); hs.push(ring);
    });
    vHandles.current.set(id,hs);
  },[clearVH]);

  const rebuildPoly=useCallback((id:string)=>{
    const sc=sceneRef.current!; const pts=polyData.current.get(id);if(!pts)return;
    const old=polyMeshes.current.get(id);if(old)old.forEach(o=>sc.remove(o));
    const cat=catRef.current;
    const shape=new THREE.Shape();
    pts.forEach(([x,y],i)=>i===0?shape.moveTo(x,y):shape.lineTo(x,y)); shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({color:CAT_HEX[cat],transparent:true,opacity:0.55,side:THREE.DoubleSide}));
    mesh.userData={id,type:'poly'}; sc.add(mesh);
    const outPts=[...pts,pts[0]].map(([x,y])=>new THREE.Vector3(x,y,0.5));
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(outPts),new THREE.LineBasicMaterial({color:CAT_HEX[cat]}));
    sc.add(line); polyMeshes.current.set(id,[mesh,line]);
  },[]);

  const deleteSelected=useCallback(()=>{
    const id=selId.current;if(!id)return;
    const sc=sceneRef.current!;
    secMeshes.current.get(id)?.forEach(o=>sc.remove(o)); secMeshes.current.delete(id);
    polyMeshes.current.get(id)?.forEach(o=>sc.remove(o)); polyMeshes.current.delete(id); polyData.current.delete(id);
    const sm=seatMeshes.current.get(id);if(sm){sc.remove(sm);seatMeshes.current.delete(id);}
    liveSecs.current=liveSecs.current.filter(s=>s.id!==id);
    liveSeats.current=liveSeats.current.filter(s=>s.id!==id);
    clearVH(); selId.current=null; setSelSec(null);
    setSecCnt(secMeshes.current.size+polyMeshes.current.size);
    setSeatCnt(seatMeshes.current.size);
  },[clearVH]);

  const addRing=useCallback(()=>{
    const sc=sceneRef.current!;const{innerR,outerR,divisions,category,basePrice}=ringCfg;
    const step=360/divisions; const midR=(innerR+outerR)/2;
    for(let i=0;i<divisions;i++){
      const aStart=-180+i*step,aEnd=aStart+step;
      const a=((aStart+aEnd)/2)*Math.PI/180;
      const sec:StadiumSection={
        id:`sec-ring-${Date.now()}-${i}`,label:`${category} ${i+1}`,shortLabel:`${i+1}`,
        category,color:CAT_COLOR[category],innerRadius:innerR,outerRadius:outerR,
        angleStart:aStart,angleEnd:aEnd,
        centerX:Math.cos(a)*midR,centerY:Math.sin(a)*midR,
        basePrice,minPrice:Math.round(basePrice*0.85),available:0,total:0,
      };
      buildSecMesh(sc,sec,secMeshes.current); liveSecs.current.push(sec);
    }
    setSecCnt(secMeshes.current.size+polyMeshes.current.size); setShowRing(false);
  },[ringCfg]);

  const addArc=useCallback(()=>{
    const sc=sceneRef.current!;const{innerR,outerR,aStart,aEnd,category,basePrice}=arcCfg;
    const midR=(innerR+outerR)/2; const a=((aStart+aEnd)/2)*Math.PI/180;
    const sec:StadiumSection={
      id:`sec-arc-${Date.now()}`,label:`${category} Arc`,shortLabel:'ARC',
      category,color:CAT_COLOR[category],innerRadius:innerR,outerRadius:outerR,
      angleStart:aStart,angleEnd:aEnd,
      centerX:Math.cos(a)*midR,centerY:Math.sin(a)*midR,
      basePrice,minPrice:Math.round(basePrice*0.85),available:0,total:0,
    };
    buildSecMesh(sc,sec,secMeshes.current); liveSecs.current.push(sec);
    setSecCnt(secMeshes.current.size+polyMeshes.current.size); setShowArc(false);
  },[arcCfg]);

  const placeSeat=useCallback((x:number,y:number)=>{
    const sc=sceneRef.current!; const id=`seat-${Date.now()}`;
    const seat:StadiumSeat={id,sectionId:'',row:'A',number:liveSeats.current.length+1,x,y,price:100,status:'available',category:catRef.current};
    liveSeats.current.push(seat);
    const mesh=new THREE.Mesh(new THREE.CircleGeometry(2.5,8),new THREE.MeshBasicMaterial({color:CAT_HEX[catRef.current]}));
    mesh.position.set(x,y,1); mesh.userData={id,type:'seat'}; sc.add(mesh);
    seatMeshes.current.set(id,mesh); setSeatCnt(seatMeshes.current.size);
  },[]);

  // ── Scene init ───────────────────────────────────────────────────────────────
  useEffect(()=>{
    const el=mountRef.current!;
    let inited=false;
    const init=()=>{
      if(inited)return; const W=el.clientWidth,H=el.clientHeight; if(!W||!H)return; inited=true;
      const renderer=new THREE.WebGLRenderer({antialias:true});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)); renderer.setSize(W,H);
      renderer.setClearColor(0xf8fafc); el.appendChild(renderer.domElement); rendRef.current=renderer;
      const fH=350,cam=new THREE.OrthographicCamera(-fH*W/H,fH*W/H,fH,-fH,0.1,1000);
      cam.position.set(0,0,100); camRef.current=cam;
      const scene=new THREE.Scene(); sceneRef.current=scene;
      // grid
      const grid=new THREE.GridHelper(2000,100,0xe5e7eb,0xf1f5f9);
      grid.rotation.x=Math.PI/2; grid.position.z=-1; scene.add(grid);
      // guide circles
      [60,100,150,200,250,300].forEach(r=>{
        const pts:THREE.Vector3[]=[];
        for(let i=0;i<=64;i++){const a=(i/64)*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,-0.5));}
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xdde1e7})));
      });
      // load all SECTIONS
      SECTIONS.forEach(sec=>buildSecMesh(scene,sec,secMeshes.current));
      const animate=()=>{rafRef.current=requestAnimationFrame(animate);renderer.render(scene,cam);};
      animate();
      const onResize=()=>{
        const W2=el.clientWidth,H2=el.clientHeight; renderer.setSize(W2,H2);
        const fH2=350/zoomLevel.current;
        cam.left=-fH2*W2/H2;cam.right=fH2*W2/H2;cam.top=fH2;cam.bottom=-fH2;cam.updateProjectionMatrix();
      };
      window.addEventListener('resize',onResize);
      ro.disconnect();
      return ()=>{cancelAnimationFrame(rafRef.current!);window.removeEventListener('resize',onResize);renderer.dispose();if(el.contains(renderer.domElement))el.removeChild(renderer.domElement);};
    };
    const ro=new ResizeObserver(init); ro.observe(el); init();
    return ()=>ro.disconnect();
  },[]);

  return <div ref={mountRef} style={{width:'100%',height:'100%'}} />;
}

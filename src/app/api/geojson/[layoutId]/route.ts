import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(req: NextRequest, { params }: { params: Promise<{ layoutId: string }> }) {
  try {
    const { layoutId } = await params;
    const url = new URL(req.url);
    const bbox = url.searchParams.get('bbox');
    const backendUrl = `${BACKEND_URL}/api/geojson/${layoutId}${bbox ? `?bbox=${bbox}` : ''}`;
    const res = await fetch(backendUrl, { next: { revalidate: 60 } });
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=30' },
    });
  } catch {
    // Return minimal fallback GeoJSON when backend is unavailable
    return NextResponse.json({
      type: 'FeatureCollection',
      features: Array.from({ length: 8 }, (_, i) => {
        const angle1 = (i / 8) * 2 * Math.PI - Math.PI / 2;
        const angle2 = ((i + 1) / 8) * 2 * Math.PI - Math.PI / 2;
        const cx = -74.0742, cy = 40.8135;
        const r1 = 0.004, r2 = 0.01;
        const CATS = ['FIELD','PLATINUM','GOLD','SILVER','BRONZE','GENERAL'];
        const COLORS = { FIELD:'#FF6B35',PLATINUM:'#A855F7',GOLD:'#F59E0B',SILVER:'#94A3B8',BRONZE:'#D97706',GENERAL:'#3B82F6' };
        const cat = CATS[i % CATS.length] as keyof typeof COLORS;
        return {
          type: 'Feature', id: String(i),
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [cx + r2 * Math.cos(angle1), cy + r2 * Math.sin(angle1)],
              [cx + r2 * Math.cos(angle2), cy + r2 * Math.sin(angle2)],
              [cx + r1 * Math.cos(angle2), cy + r1 * Math.sin(angle2)],
              [cx + r1 * Math.cos(angle1), cy + r1 * Math.sin(angle1)],
              [cx + r2 * Math.cos(angle1), cy + r2 * Math.sin(angle1)],
            ]],
          },
          properties: {
            section_id: `S${i+1}`, label: `Section ${i+1}`, category: cat,
            color: COLORS[cat], height: 20 - i * 2,
            availableCount: 40 + i * 5, basePrice: [800,500,350,220,150,80,80,80][i],
            centerLng: cx + 0.006 * Math.cos((angle1+angle2)/2),
            centerLat: cy + 0.006 * Math.sin((angle1+angle2)/2),
          },
        };
      }),
    });
  }
}

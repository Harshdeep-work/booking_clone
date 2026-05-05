import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const section_id = searchParams.get('section_id');
  try {
    const res = await fetch(`${BACKEND_URL}/api/seats/geojson?section_id=${section_id}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // Demo: generate grid of seats
    const features = Array.from({ length: 80 }, (_, i) => ({
      type: 'Feature',
      id: String(i),
      geometry: {
        type: 'Point',
        coordinates: [-74.0742 + 0.0001 * (i % 10), 40.8135 + 0.0001 * Math.floor(i / 10)],
      },
      properties: {
        seat_id: `${section_id}-R${String.fromCharCode(65 + Math.floor(i / 10))}-S${(i % 10) + 1}`,
        row: String.fromCharCode(65 + Math.floor(i / 10)),
        number: (i % 10) + 1,
        price: 150 + (i % 5) * 25,
        status: i % 7 === 0 ? 'SOLD' : 'AVAILABLE',
      },
    }));
    return NextResponse.json({ type: 'FeatureCollection', features });
  }
}

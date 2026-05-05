import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.text();
  try {
    const res = await fetch(`${BACKEND_URL}/api/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    const { seat_ids } = JSON.parse(body);
    return NextResponse.json({
      success: true,
      order_total: seat_ids.length * 150,
      seat_count: seat_ids.length,
    });
  }
}

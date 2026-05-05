import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.text();
  try {
    const res = await fetch(`${BACKEND_URL}/api/lock-seat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Demo mode: always succeed
    const { seat_id } = JSON.parse(body);
    return NextResponse.json({ success: true, seat_id, expires_at: Date.now() + 600000 });
  }
}

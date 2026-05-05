import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function proxy(req: NextRequest, path: string) {
  const url = `${BACKEND_URL}${path}`;
  const body = req.method !== 'GET' ? await req.text() : undefined;
  
  try {
    const res = await fetch(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Fallback mock response for demo without backend
    return NextResponse.json({ status: 'ok', demo: true });
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, '/api/health');
}

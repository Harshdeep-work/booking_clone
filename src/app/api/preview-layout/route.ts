import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const PREVIEW_PATH = process.env.PREVIEW_LAYOUT_PATH || '/tmp/ticketflow_preview.json';

async function readPreviewFile() {
  try {
    return await fs.readFile(PREVIEW_PATH, 'utf8');
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function GET() {
  const raw = await readPreviewFile();
  if (!raw) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return new NextResponse(raw, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!body) {
    return NextResponse.json({ error: 'Empty body' }, { status: 400 });
  }
  try {
    JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  await fs.mkdir(path.dirname(PREVIEW_PATH), { recursive: true });
  await fs.writeFile(PREVIEW_PATH, body, 'utf8');
  return NextResponse.json({ ok: true });
}

export const PREVIEW_KEY = 'ticketflow_live_preview';

export function savePreviewLayoutLocal(payload: unknown) {
  try {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(payload));
  } catch {
    // Ignore localStorage failures
  }
}

export async function savePreviewLayoutRemote(payload: unknown): Promise<boolean> {
  try {
    const res = await fetch('/api/preview-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadPreviewLayout(): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREVIEW_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore localStorage failures
  }

  try {
    const res = await fetch('/api/preview-layout', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    savePreviewLayoutLocal(data);
    return data;
  } catch {
    return null;
  }
}

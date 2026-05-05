/**
 * Admin Builder — shared types and constants
 */
export type Tool =
  | 'select'      // select + move + resize
  | 'polygon'     // draw freeform polygon (click vertices, dbl-click close)
  | 'ring'        // parametric ring generator
  | 'arc'         // parametric arc section
  | 'seat'        // place individual seat
  | 'row'         // draw a row (auto-place seats along curve)
  | 'pan'         // pan camera
  | 'zoom';       // zoom box

export type Category = 'FIELD' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'GENERAL';

export const CAT_COLOR: Record<Category, string> = {
  FIELD: '#ef4444', PLATINUM: '#a855f7', GOLD: '#f59e0b',
  SILVER: '#64748b', BRONZE: '#d97706', GENERAL: '#3b82f6',
};
export const CAT_HEX: Record<Category, number> = {
  FIELD: 0xef4444, PLATINUM: 0xa855f7, GOLD: 0xf59e0b,
  SILVER: 0x64748b, BRONZE: 0xd97706, GENERAL: 0x3b82f6,
};
export const CATS: Category[] = ['FIELD','PLATINUM','GOLD','SILVER','BRONZE','GENERAL'];

export interface BuilderSection {
  id: string;
  label: string;
  category: Category;
  basePrice: number;
  // polygon vertices in world space
  vertices: [number, number][];
  // computed centroid
  cx: number;
  cy: number;
}

export interface BuilderSeat {
  id: string;
  sectionId: string;
  row: string;
  number: number;
  x: number;
  y: number;
  price: number;
  category: Category;
}

export interface HistoryEntry {
  sections: BuilderSection[];
  seats: BuilderSeat[];
}

/** Generate arc polygon vertices */
export function arcPoly(
  cx: number, cy: number,
  innerR: number, outerR: number,
  aStartDeg: number, aEndDeg: number,
  segs = 40
): [number, number][] {
  const pts: [number, number][] = [];
  const step = (aEndDeg - aStartDeg) / segs;
  for (let i = 0; i <= segs; i++) {
    const a = ((aStartDeg + i * step) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR]);
  }
  for (let i = segs; i >= 0; i--) {
    const a = ((aStartDeg + i * step) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR]);
  }
  return pts;
}

export function centroid(verts: [number, number][]): [number, number] {
  const cx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
  const cy = verts.reduce((s, v) => s + v[1], 0) / verts.length;
  return [cx, cy];
}

export function snapVal(v: number, grid: number) {
  return Math.round(v / grid) * grid;
}

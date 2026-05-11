export type Tool = 'select' | 'polygon' | 'rect' | 'ellipse' | 'ring' | 'arc' | 'seat' | 'row' | 'fill' | 'pan' | 'element';
export type Category = 'FIELD' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'GENERAL';
export type SeatStatus = 'available' | 'sold' | 'locked';

export const CAT_COLOR: Record<Category, string> = {
  FIELD: '#ef4444', PLATINUM: '#a855f7', GOLD: '#f59e0b',
  SILVER: '#64748b', BRONZE: '#d97706', GENERAL: '#3b82f6',
};
export const CAT_HEX: Record<Category, number> = {
  FIELD: 0xef4444, PLATINUM: 0xa855f7, GOLD: 0xf59e0b,
  SILVER: 0x64748b, BRONZE: 0xd97706, GENERAL: 0x3b82f6,
};
export const CATS: Category[] = ['FIELD', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'GENERAL'];

export interface BuilderSection {
  id: string;
  label: string;
  category: Category;
  basePrice: number;
  vertices: [number, number][];
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
  status: SeatStatus;
  category: Category;
}

export interface BuilderElement {
  id: string;
  type: 'rect' | 'text';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  color: string;
  bg: string;
}

export interface ValidationError {
  type: 'duplicate_id' | 'overlap' | 'spacing';
  message: string;
  ids: string[];
}

export interface LayoutSnapshot {
  id: string;
  name: string;
  timestamp: number;
  sections: BuilderSection[];
  seats: BuilderSeat[];
  elements: BuilderElement[];
}

export function arcPoly(
  cx: number, cy: number,
  innerR: number, outerR: number,
  aStartDeg: number, aEndDeg: number,
  segs = 48
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
  return [
    verts.reduce((s, v) => s + v[0], 0) / verts.length,
    verts.reduce((s, v) => s + v[1], 0) / verts.length,
  ];
}

export function snapVal(v: number, grid: number) {
  return Math.round(v / grid) * grid;
}

export function validateLayout(sections: BuilderSection[], seats: BuilderSeat[]): ValidationError[] {
  const errors: ValidationError[] = [];
  // Duplicate section IDs
  const secIds = sections.map(s => s.id);
  const dupSec = secIds.filter((id, i) => secIds.indexOf(id) !== i);
  if (dupSec.length) errors.push({ type: 'duplicate_id', message: `Duplicate section IDs: ${[...new Set(dupSec)].join(', ')}`, ids: dupSec });
  // Duplicate seat IDs
  const seatIds = seats.map(s => s.id);
  const dupSeat = seatIds.filter((id, i) => seatIds.indexOf(id) !== i);
  if (dupSeat.length) errors.push({ type: 'duplicate_id', message: `Duplicate seat IDs: ${[...new Set(dupSeat)].join(', ')}`, ids: dupSeat });
  // Seat spacing (< 3 units apart)
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const dx = seats[i].x - seats[j].x, dy = seats[i].y - seats[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < 3) {
        errors.push({ type: 'spacing', message: `Seats ${seats[i].id} and ${seats[j].id} are too close`, ids: [seats[i].id, seats[j].id] });
        if (errors.filter(e => e.type === 'spacing').length >= 5) return errors; // cap
      }
    }
  }
  return errors;
}

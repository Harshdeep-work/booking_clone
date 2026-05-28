// ── Types ─────────────────────────────────────────────────────────────────────
export type ToolId = 'select' | 'seatselect' | 'section' | 'rect' | 'circle' | 'ellipse' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'row' | 'multirow' | 'arcrow' | 'block' | 'text' | 'pan' | 'grid' | 'curve' | '4corner' | 'table' | 'rotate' | 'split' | 'merge';
export type ShapeType = 'section' | 'stage' | 'ga' | 'court' | 'suite' | 'pressbox' | 'scoreboard' | 'tunnel' | 'concourse' | 'ada' | 'text' | 'table' | 'standing';
export type Category = 'VIP' | 'PREMIUM' | 'STANDARD' | 'BUDGET' | 'GA';
export type SeatStatus = 'available' | 'sold' | 'locked' | 'obstructed';
export type LabelScheme = 'ABC' | '123' | 'SKIP_I';
export type NumberScheme = '1,2,3' | 'odd' | 'even' | 'rtl';
export type VenueLevel = '100' | '200' | '300' | 'SUITE' | 'CLUB';

export interface BShape {
  id: string;
  type: ShapeType;
  label: string;
  category: Category;
  color: string;
  vertices: [number, number][];
  cx: number; cy: number;
  level?: VenueLevel;
  curveRadius?: number;
  photoUrl?: string;
  isAccessible?: boolean;
  isObstructed?: boolean;
  subsections?: string[];
  /** Arc section metadata — when set, rows are drawn as filled arc bands */
  arcCenter?: [number, number];
  arcInnerR?: number;
  arcOuterR?: number;
  arcA0?: number; // degrees
  arcA1?: number; // degrees
  /** Per-section display mode: 'rows' = arc bands only, 'seats' = circles only, 'both' = both */
  displayMode?: 'rows' | 'seats' | 'both';
  // Properties panel fields
  notes?: string;
  capacity?: number;
  seatingLayout?: 'circular' | 'rectangular';
  labelVisible?: boolean;
  labelFontSize?: number;
  rotation?: number;
  scale?: number;
  /** Whether this shape/block is visible in preview */
  visible?: boolean;
  /** Default seat price for this block */
  blockPrice?: number;
}

export interface BRow {
  id: string;
  sectionId: string;
  label: string;
  category: Category;
  color?: string;
  seats: BSeat[];
  curveRadius?: number;
  /** If set, seats are arranged along an arc centred here */
  curveCenter?: [number, number];
  /** Arc start/end angles in degrees (only used when curveCenter is set) */
  curveA0?: number;
  curveA1?: number;
  priceOverride?: number;
}

export interface BSeat {
  id: string;
  rowId: string;
  sectionId: string;
  number: number;
  label: string;
  x: number; y: number;
  price: number;
  status: SeatStatus;
  category: Category;
  color?: string;
  isAccessible?: boolean;
  isCompanion?: boolean;
  isObstructed?: boolean;
  isVIP?: boolean;
  aisleGap?: boolean;
}

export interface BText {
  id: string;
  x: number; y: number;
  text: string;
  fontSize: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  background?: string;
}

export interface LayoutState {
  shapes: BShape[];
  rows: BRow[];
  seats: BSeat[];
  texts: BText[];
}

export type LayerId = 'sections' | 'seats' | 'labels' | 'pricing' | 'entrances' | 'overlays';

export interface LayerState {
  id: LayerId;
  label: string;
  visible: boolean;
  locked: boolean;
}

export const DEFAULT_LAYERS: LayerState[] = [
  { id: 'sections',  label: 'Sections',  visible: true, locked: false },
  { id: 'seats',     label: 'Seats',     visible: true, locked: false },
  { id: 'labels',    label: 'Labels',    visible: true, locked: false },
  { id: 'pricing',   label: 'Pricing',   visible: true, locked: false },
  { id: 'entrances', label: 'Entrances', visible: true, locked: false },
  { id: 'overlays',  label: 'Overlays',  visible: true, locked: false },
];

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'overlap' | 'duplicate_id' | 'spacing' | 'numbering';
  message: string;
  entityIds: string[];
}

export interface ValidationWarning {
  type: 'accessibility' | 'pricing' | 'capacity';
  message: string;
  entityIds: string[];
}

export interface ImportFormat {
  type: 'csv' | 'json' | 'geojson' | 'svg' | 'dxf';
  data: string | object;
}

export interface ExportFormat {
  type: 'csv' | 'json' | 'geojson';
  includeMetadata?: boolean;
}

export interface Snapshot {
  id: string;
  label: string;
  ts: number;
  state: LayoutState;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const CAT_COLOR: Record<Category, string> = {
  VIP:      '#c084fc',
  PREMIUM:  '#fbbf24',
  STANDARD: '#94a3b8',
  BUDGET:   '#38bdf8',
  GA:       '#10b981',
};

export const CATS: Category[] = ['VIP', 'PREMIUM', 'STANDARD', 'BUDGET', 'GA'];

export const EMPTY_LAYOUT: LayoutState = { shapes: [], rows: [], seats: [], texts: [] };

// ── Geometry helpers ──────────────────────────────────────────────────────────
export function centroid(verts: [number, number][]): [number, number] {
  return [
    verts.reduce((s, v) => s + v[0], 0) / verts.length,
    verts.reduce((s, v) => s + v[1], 0) / verts.length,
  ];
}

export function snapVal(v: number, grid: number) {
  return Math.round(v / grid) * grid;
}

/** Regular polygon vertices centred at (cx,cy) with rx/ry radii */
export function regularPoly(cx: number, cy: number, rx: number, ry: number, sides: number, rotDeg = 0): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = ((rotDeg + (i * 360) / sides - 90) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** Star polygon */
export function starPoly(cx: number, cy: number, outerR: number, innerR: number, points = 5): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = ((i * 180) / points - 90) * Math.PI / 180;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function arcPoly(
  cx: number, cy: number,
  innerR: number, outerR: number,
  a0: number, a1: number,
  segs = 48,
): [number, number][] {
  const pts: [number, number][] = [];
  const step = (a1 - a0) / segs;
  for (let i = 0; i <= segs; i++) {
    const a = ((a0 + i * step) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR]);
  }
  for (let i = segs; i >= 0; i--) {
    const a = ((a0 + i * step) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR]);
  }
  return pts;
}

export function pointInPoly(px: number, py: number, verts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i][0], yi = verts[i][1], xj = verts[j][0], yj = verts[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function generateRowSeats(
  p1: [number, number], p2: [number, number],
  count: number, rowId: string, sectionId: string,
  rowLabel: string, category: Category, price: number,
  scheme: NumberScheme = '1,2,3',
): BSeat[] {
  const seats: BSeat[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = p1[0] + t * (p2[0] - p1[0]);
    const y = p1[1] + t * (p2[1] - p1[1]);
    let num = i + 1;
    if (scheme === 'odd') num = i * 2 + 1;
    else if (scheme === 'even') num = (i + 1) * 2;
    else if (scheme === 'rtl') num = count - i;
    seats.push({
      id: `seat-${rowId}-${i}`,
      rowId, sectionId,
      number: num, label: `${rowLabel}${num}`,
      x, y, price, status: 'available', category,
    });
  }
  return seats;
}

/** Generate seats along an arc (curved row) */
export function generateArcRowSeats(
  cx: number, cy: number,
  radius: number,
  a0deg: number, a1deg: number,
  rowId: string, sectionId: string,
  rowLabel: string, category: Category, price: number,
): BSeat[] {
  const arcLen = Math.abs(a1deg - a0deg) / 360 * 2 * Math.PI * radius;
  const count = Math.max(2, Math.floor(arcLen / 13));
  const seats: BSeat[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const a = ((a0deg + t * (a1deg - a0deg)) * Math.PI) / 180;
    seats.push({
      id: `seat-${rowId}-${i}`,
      rowId, sectionId,
      number: i + 1, label: `${rowLabel}${i + 1}`,
      x: cx + Math.cos(a) * radius,
      y: cy + Math.sin(a) * radius,
      price, status: 'available', category,
    });
  }
  return seats;
}

export function generateBlockSeats(
  x0: number, y0: number, x1: number, y1: number,
  rows: number, cols: number,
  sectionId: string, category: Category, price: number,
): { rows: BRow[]; seats: BSeat[] } {
  const outRows: BRow[] = [];
  const outSeats: BSeat[] = [];
  const w = x1 - x0, h = y1 - y0;
  for (let r = 0; r < rows; r++) {
    const rowLabel = String.fromCharCode(65 + r);
    const rowId = `row-${sectionId}-${r}`;
    const rowSeats: BSeat[] = [];
    for (let c = 0; c < cols; c++) {
      const x = x0 + (c + 0.5) * (w / cols);
      const y = y0 + (r + 0.5) * (h / rows);
      rowSeats.push({
        id: `seat-${rowId}-${c}`,
        rowId, sectionId,
        number: c + 1, label: `${rowLabel}${c + 1}`,
        x, y, price, status: 'available', category,
      });
    }
    outRows.push({ id: rowId, sectionId, label: rowLabel, category, seats: rowSeats });
    outSeats.push(...rowSeats);
  }
  return { rows: outRows, seats: outSeats };
}

/**
 * Generate concentric curved rows inside a section.
 * cx/cy = arc centre (usually the stage/field centre).
 * innerRadius = radius of the first (closest) row.
 * rowCount = number of rows.
 * rowSpacing = distance between consecutive rows.
 * a0deg/a1deg = arc sweep in degrees.
 */
export function generateCurvedRows(
  cx: number, cy: number,
  innerRadius: number,
  rowCount: number,
  rowSpacing: number,
  a0deg: number, a1deg: number,
  sectionId: string,
  category: Category,
  price: number,
  startLabelIndex = 0,
): { rows: BRow[]; seats: BSeat[] } {
  const outRows: BRow[] = [];
  const outSeats: BSeat[] = [];
  for (let r = 0; r < rowCount; r++) {
    const radius = innerRadius + r * rowSpacing;
    const rowLabel = String.fromCharCode(65 + ((startLabelIndex + r) % 26));
    const rowId = `row-${sectionId}-arc-${r}`;
    const arcLen = Math.abs(a1deg - a0deg) / 360 * 2 * Math.PI * radius;
    const seatCount = Math.max(2, Math.floor(arcLen / 13));
    const rowSeats: BSeat[] = [];
    for (let i = 0; i < seatCount; i++) {
      const t = seatCount === 1 ? 0.5 : i / (seatCount - 1);
      const a = ((a0deg + t * (a1deg - a0deg)) * Math.PI) / 180;
      rowSeats.push({
        id: `seat-${rowId}-${i}`,
        rowId, sectionId,
        number: i + 1, label: `${rowLabel}${i + 1}`,
        x: cx + Math.cos(a) * radius,
        y: cy + Math.sin(a) * radius,
        price, status: 'available', category,
      });
    }
    outRows.push({
      id: rowId, sectionId, label: rowLabel, category, seats: rowSeats,
      curveCenter: [cx, cy], curveRadius: radius, curveA0: a0deg, curveA1: a1deg,
    });
    outSeats.push(...rowSeats);
  }
  return { rows: outRows, seats: outSeats };
}
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2,6)}`; }

/** Ellipse-arc polygon: scales x by xScale, y by yScale for oval arenas */
export function ellipseArcPoly(
  cx: number, cy: number,
  innerRx: number, innerRy: number,
  outerRx: number, outerRy: number,
  a0deg: number, a1deg: number,
  segs = 20,
): [number, number][] {
  const pts: [number, number][] = [];
  const step = (a1deg - a0deg) / segs;
  for (let i = 0; i <= segs; i++) {
    const a = ((a0deg + i * step) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * outerRx, cy + Math.sin(a) * outerRy]);
  }
  for (let i = segs; i >= 0; i--) {
    const a = ((a0deg + i * step) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * innerRx, cy + Math.sin(a) * innerRy]);
  }
  return pts;
}

export function buildNBAArena(): LayoutState {
  const shapes: BShape[] = [];
  const seats: BSeat[] = [];
  const texts: BText[] = [];

  // ── Court ─────────────────────────────────────────────────────────────────
  // LCA court: 94ft × 50ft → world units ~150 × 80
  const cW = 150, cH = 80;
  shapes.push({
    id: 'court', type: 'court', label: 'COURT', category: 'GA', color: '#1e293b',
    vertices: [[-cW/2,-cH/2],[cW/2,-cH/2],[cW/2,cH/2],[-cW/2,cH/2]], cx: 0, cy: 0,
  });

  // ── Courtside sections AA, A–F, FF ────────────────────────────────────────
  // AA = west baseline, FF = east baseline, A/B/C = west sideline, D/E/F = east sideline
  const csW = 9, csH = (cH - 8) / 3;
  const csData: { id: string; x: number; y: number; w: number; h: number }[] = [
    { id: 'AA', x: -cW/2 - csW,     y: -cH/2 + 4,           w: csW, h: cH - 8 },
    { id: 'FF', x:  cW/2,            y: -cH/2 + 4,           w: csW, h: cH - 8 },
    { id: 'A',  x: -cW/2 - csW*2,   y: -cH/2 + 4,           w: csW, h: csH },
    { id: 'B',  x: -cW/2 - csW*2,   y: -cH/2 + 4 + csH,     w: csW, h: csH },
    { id: 'C',  x: -cW/2 - csW*2,   y: -cH/2 + 4 + csH*2,   w: csW, h: csH },
    { id: 'D',  x:  cW/2 + csW,     y: -cH/2 + 4,           w: csW, h: csH },
    { id: 'E',  x:  cW/2 + csW,     y: -cH/2 + 4 + csH,     w: csW, h: csH },
    { id: 'F',  x:  cW/2 + csW,     y: -cH/2 + 4 + csH*2,   w: csW, h: csH },
  ];
  csData.forEach(s => {
    const v: [number,number][] = [[s.x,s.y],[s.x+s.w,s.y],[s.x+s.w,s.y+s.h],[s.x,s.y+s.h]];
    const [cx, cy] = centroid(v);
    shapes.push({ id: `cs-${s.id}`, type: 'section', label: s.id, category: 'VIP', color: CAT_COLOR.VIP, vertices: v, cx, cy });
    const cols = Math.max(2, Math.floor(s.w / 5));
    const rows = Math.max(3, Math.floor(s.h / 7));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const rowLbl = String.fromCharCode(65 + r);
      seats.push({ id: `s-cs-${s.id}-${r}-${c}`, rowId: `cs-${s.id}-${r}`, sectionId: `cs-${s.id}`, number: c+1, label: `${rowLbl}${c+1}`, x: s.x+(c+0.5)*(s.w/cols), y: s.y+(r+0.5)*(s.h/rows), price: 820, status: 'available', category: 'VIP' });
    }
  });

  // ── Lower bowl 101–126 (26 sections, oval) ────────────────────────────────
  // Sections start at top-left (101 = north-west corner), go clockwise
  // Real LCA: 101-113 on west/south side, 114-126 on east/north side
  // Oval slightly wider east-west (arena is ~800ft wide, 600ft tall)
  const ROWS_LOWER = 'ABCDEFGHJKLMNPQRST'; // 18 rows, skip I
  const lInRx = 92, lInRy = 70, lOutRx = 148, lOutRy = 118;
  for (let i = 0; i < 26; i++) {
    const step = 360 / 26;
    const a0 = i * step - 90, a1 = (i + 1) * step - 90;
    const verts = ellipseArcPoly(0, 0, lInRx, lInRy, lOutRx, lOutRy, a0, a1, 14);
    const [cx, cy] = centroid(verts);
    const num = 101 + i;
    const sid = `sec-${num}`;
    // Center sections (closest to court sidelines): 108-110, 121-123
    const isCenter = (num >= 108 && num <= 110) || (num >= 121 && num <= 123);
    // Corner sections: 105-107, 111-113, 118-120, 124-126
    const isCorner = [105,106,107,111,112,113,118,119,120,124,125,126].includes(num);
    const cat: Category = isCenter ? 'VIP' : 'PREMIUM';
    const price = isCenter ? 480 : isCorner ? 220 : 320;
    shapes.push({ id: sid, type: 'section', label: `${num}`, category: cat, color: CAT_COLOR[cat], vertices: verts, cx, cy });

    // Rows: center sections ~20 rows, end sections ~14 rows, corners ~16
    const numRows = isCenter ? 20 : isCorner ? 16 : 18;
    for (let r = 0; r < numRows; r++) {
      const t = (r + 0.5) / numRows;
      const rx = lInRx + t * (lOutRx - lInRx);
      const ry = lInRy + t * (lOutRy - lInRy);
      const arcLen = Math.abs(a1 - a0) / 360 * 2 * Math.PI * ((rx + ry) / 2);
      // avg 15 seats/row, max 28 (section 114 row 27)
      const count = Math.max(4, Math.min(28, Math.floor(arcLen / 10)));
      const rowId = `row-${sid}-${r}`;
      for (let s = 0; s < count; s++) {
        const tt = count === 1 ? 0.5 : s / (count - 1);
        const a = ((a0 + 1 + tt * (a1 - a0 - 2)) * Math.PI) / 180;
        seats.push({ id: `seat-${rowId}-${s}`, rowId, sectionId: sid, number: s+1, label: `${ROWS_LOWER[r]}${s+1}`, x: Math.cos(a)*rx, y: Math.sin(a)*ry, price, status: 'available', category: cat });
      }
    }
  }

  // ── Mezzanine suites (between lower and upper) ────────────────────────────
  const mInRx = 151, mInRy = 121, mOutRx = 162, mOutRy = 130;
  for (let i = 0; i < 34; i++) {
    const step = 360 / 34;
    const a0 = i * step - 90, a1 = (i + 1) * step - 90;
    const verts = ellipseArcPoly(0, 0, mInRx, mInRy, mOutRx, mOutRy, a0, a1, 8);
    const [cx, cy] = centroid(verts);
    shapes.push({ id: `mez-${i+1}`, type: 'suite', label: `M${i+1}`, category: 'VIP', color: '#d97706', vertices: verts, cx, cy });
  }

  // ── Upper bowl 201–232 (32 sections) ─────────────────────────────────────
  const ROWS_UPPER = 'ABCDEFGHJKLMNP'; // 14 rows
  const uInRx = 165, uInRy = 133, uOutRx = 210, uOutRy = 168;
  for (let i = 0; i < 32; i++) {
    const step = 360 / 32;
    const a0 = i * step - 90, a1 = (i + 1) * step - 90;
    const verts = ellipseArcPoly(0, 0, uInRx, uInRy, uOutRx, uOutRy, a0, a1, 12);
    const [cx, cy] = centroid(verts);
    const num = 201 + i;
    const sid = `sec-${num}`;
    // North end club: 201-205 (premium)
    const isNorthClub = num <= 205 || num >= 229;
    const cat: Category = isNorthClub ? 'PREMIUM' : 'BUDGET';
    const price = isNorthClub ? 160 : 75;
    shapes.push({ id: sid, type: 'section', label: `${num}`, category: cat, color: CAT_COLOR[cat], vertices: verts, cx, cy });

    const numRows = 12;
    for (let r = 0; r < numRows; r++) {
      const t = (r + 0.5) / numRows;
      const rx = uInRx + t * (uOutRx - uInRx);
      const ry = uInRy + t * (uOutRy - uInRy);
      const arcLen = Math.abs(a1 - a0) / 360 * 2 * Math.PI * ((rx + ry) / 2);
      const count = Math.max(4, Math.min(27, Math.floor(arcLen / 11)));
      const rowId = `row-${sid}-${r}`;
      for (let s = 0; s < count; s++) {
        const tt = count === 1 ? 0.5 : s / (count - 1);
        const a = ((a0 + 1 + tt * (a1 - a0 - 2)) * Math.PI) / 180;
        seats.push({ id: `seat-${rowId}-${s}`, rowId, sectionId: sid, number: s+1, label: `${ROWS_UPPER[r]}${s+1}`, x: Math.cos(a)*rx, y: Math.sin(a)*ry, price, status: 'available', category: cat });
      }
    }
  }

  // ── Press box + scoreboards + tunnels + ADA ───────────────────────────────
  shapes.push({ id: 'pressbox', type: 'pressbox', label: 'PRESS', category: 'GA', color: '#0284c7', vertices: [[-35,-213],[-35,-203],[35,-203],[35,-213]], cx: 0, cy: -208 });
  [[0,-220],[0,220]].forEach(([x,y],i) => {
    const v: [number,number][] = [[x-16,y-9],[x+16,y-9],[x+16,y+9],[x-16,y+9]];
    shapes.push({ id: `score-${i}`, type: 'scoreboard', label: 'SCORE', category: 'GA', color: '#f59e0b', vertices: v, cx: x, cy: y });
  });
  [[0,-225],[0,225],[-225,0],[225,0]].forEach(([x,y],i) => {
    const isH = i >= 2;
    const v: [number,number][] = isH ? [[x-8,y-18],[x+8,y-18],[x+8,y+18],[x-8,y+18]] : [[x-18,y-8],[x+18,y-8],[x+18,y+8],[x-18,y+8]];
    shapes.push({ id: `tun-${i}`, type: 'tunnel', label: 'TUNNEL', category: 'GA', color: '#94a3b8', vertices: v, cx: x, cy: y });
  });
  [[-100,-155],[100,-155],[-100,155],[100,155]].forEach(([x,y],i) => {
    const v: [number,number][] = [[x-13,y-7],[x+13,y-7],[x+13,y+7],[x-13,y+7]];
    shapes.push({ id: `ada-${i}`, type: 'ada', label: 'ADA', category: 'GA', color: '#3b82f6', vertices: v, cx: x, cy: y });
  });

  // ── Labels ────────────────────────────────────────────────────────────────
  texts.push(
    { id: 'lbl-court',  x: 0, y: 0,    text: 'COURT',              fontSize: 10, color: '#f8fafc' },
    { id: 'lbl-lower',  x: 0, y: -130, text: 'LOWER BOWL 101–126', fontSize: 8,  color: '#94a3b8' },
    { id: 'lbl-mez',    x: 0, y: -157, text: 'MEZZANINE SUITES',   fontSize: 7,  color: '#fbbf24' },
    { id: 'lbl-upper',  x: 0, y: -190, text: 'UPPER BOWL 201–232', fontSize: 8,  color: '#94a3b8' },
    { id: 'lbl-vis',    x: -cW/2 - 30, y: 0, text: 'VISITORS',     fontSize: 8,  color: '#94a3b8' },
    { id: 'lbl-home',   x:  cW/2 + 30, y: 0, text: 'HOME TEAM',    fontSize: 8,  color: '#38bdf8' },
  );

  return { shapes, rows: [], seats, texts };
}

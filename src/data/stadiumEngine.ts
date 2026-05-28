/**
 * Stadium Layout Engine
 * Generates clean radial stadium geometry from structured data.
 * No free polygons — everything is arcs, rings, and slices.
 */

export type Category = 'FIELD' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'GENERAL';
export type SeatStatus = 'available' | 'sold' | 'locked';

export interface StadiumSection {
  id: string;
  label: string;
  shortLabel: string;
  category: Category;
  color: string;
  // radial geometry
  innerRadius: number;
  outerRadius: number;
  angleStart: number; // degrees
  angleEnd: number;
  // computed
  centerX: number;
  centerY: number;
  // pricing
  basePrice: number;
  minPrice: number;
  available: number;
  total: number;
}

export interface StadiumSeat {
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

export const CAT_COLOR: Record<Category, string> = {
  FIELD:    '#fb7185',
  PLATINUM: '#c084fc',
  GOLD:     '#fbbf24',
  SILVER:   '#94a3b8',
  BRONZE:   '#d97706',
  GENERAL:  '#38bdf8',
};

export const CAT_HEX: Record<Category, number> = {
  FIELD:    0xfb7185,
  PLATINUM: 0xc084fc,
  GOLD:     0xfbbf24,
  SILVER:   0x94a3b8,
  BRONZE:   0xd97706,
  GENERAL:  0x38bdf8,
};

const ROWS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function degToRad(d: number) { return (d * Math.PI) / 180; }

/** Generate arc polygon points for a radial section */
export function arcPolygon(
  cx: number, cy: number,
  innerR: number, outerR: number,
  aStart: number, aEnd: number,
  segments = 32
): [number, number][] {
  const pts: [number, number][] = [];
  const step = (aEnd - aStart) / segments;
  // outer arc
  for (let i = 0; i <= segments; i++) {
    const a = degToRad(aStart + i * step);
    pts.push([cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR]);
  }
  // inner arc (reverse)
  for (let i = segments; i >= 0; i--) {
    const a = degToRad(aStart + i * step);
    pts.push([cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR]);
  }
  return pts;
}

/** Midpoint of an arc */
function arcMid(cx: number, cy: number, r: number, aStart: number, aEnd: number): [number, number] {
  const a = degToRad((aStart + aEnd) / 2);
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

/** Generate seats along curved rows inside a section */
function generateSeatsForSection(sec: StadiumSection): StadiumSeat[] {
  const seats: StadiumSeat[] = [];
  const radialSpan = sec.outerRadius - sec.innerRadius;
  const numRows = Math.max(2, Math.floor(radialSpan / 6));
  const rowStep = radialSpan / (numRows + 1);
  const angleSpan = sec.angleEnd - sec.angleStart;

  for (let r = 0; r < numRows; r++) {
    const radius = sec.innerRadius + rowStep * (r + 1);
    const arcLen = (angleSpan / 360) * 2 * Math.PI * radius;
    const numSeats = Math.max(2, Math.floor(arcLen / 6));
    const angleStep = angleSpan / (numSeats + 1);

    for (let s = 0; s < numSeats; s++) {
      const angle = degToRad(sec.angleStart + angleStep * (s + 1));
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const roll = Math.random();
      const status: SeatStatus = roll < 0.55 ? 'available' : roll < 0.78 ? 'sold' : 'locked';
      const price = Math.round(sec.basePrice * (1 + (Math.random() - 0.5) * 0.15));
      seats.push({
        id: `${sec.id}-${ROWS[r % 26]}-${s + 1}`,
        sectionId: sec.id,
        row: ROWS[r % 26],
        number: s + 1,
        x, y, price, status,
        category: sec.category,
      });
    }
  }
  return seats;
}

// ── Stadium Definition ────────────────────────────────────────────────────────
// MetLife-style: concentric rings divided into radial slices
// All coordinates are in world units centred at (0,0)

interface RingDef {
  category: Category;
  innerR: number;
  outerR: number;
  basePrice: number;
  sections: { label: string; short: string; aStart: number; aEnd: number }[];
}

const RINGS: RingDef[] = [
  {
    category: 'FIELD', innerR: 0, outerR: 55, basePrice: 850,
    sections: [{ label: 'Field', short: 'FLD', aStart: -180, aEnd: 180 }],
  },
  {
    category: 'PLATINUM', innerR: 58, outerR: 95, basePrice: 520,
    sections: [
      { label: 'Platinum 101', short: '101', aStart: -30, aEnd: 30 },
      { label: 'Platinum 102', short: '102', aStart: 30, aEnd: 90 },
      { label: 'Platinum 103', short: '103', aStart: 90, aEnd: 150 },
      { label: 'Platinum 104', short: '104', aStart: 150, aEnd: 210 },
      { label: 'Platinum 105', short: '105', aStart: 210, aEnd: 270 },
      { label: 'Platinum 106', short: '106', aStart: 270, aEnd: 330 },
    ],
  },
  {
    category: 'GOLD', innerR: 98, outerR: 145, basePrice: 280,
    sections: [
      { label: 'Gold 201', short: '201', aStart: -22, aEnd: 22 },
      { label: 'Gold 202', short: '202', aStart: 22, aEnd: 66 },
      { label: 'Gold 203', short: '203', aStart: 66, aEnd: 110 },
      { label: 'Gold 204', short: '204', aStart: 110, aEnd: 154 },
      { label: 'Gold 205', short: '205', aStart: 154, aEnd: 198 },
      { label: 'Gold 206', short: '206', aStart: 198, aEnd: 242 },
      { label: 'Gold 207', short: '207', aStart: 242, aEnd: 286 },
      { label: 'Gold 208', short: '208', aStart: 286, aEnd: 330 },
      { label: 'Gold 209', short: '209', aStart: 330, aEnd: 338 },
    ],
  },
  {
    category: 'SILVER', innerR: 148, outerR: 195, basePrice: 160,
    sections: [
      { label: 'Silver 301', short: '301', aStart: -20, aEnd: 20 },
      { label: 'Silver 302', short: '302', aStart: 20, aEnd: 60 },
      { label: 'Silver 303', short: '303', aStart: 60, aEnd: 100 },
      { label: 'Silver 304', short: '304', aStart: 100, aEnd: 140 },
      { label: 'Silver 305', short: '305', aStart: 140, aEnd: 180 },
      { label: 'Silver 306', short: '306', aStart: 180, aEnd: 220 },
      { label: 'Silver 307', short: '307', aStart: 220, aEnd: 260 },
      { label: 'Silver 308', short: '308', aStart: 260, aEnd: 300 },
      { label: 'Silver 309', short: '309', aStart: 300, aEnd: 340 },
    ],
  },
  {
    category: 'BRONZE', innerR: 198, outerR: 245, basePrice: 95,
    sections: [
      { label: 'Bronze 401', short: '401', aStart: -18, aEnd: 18 },
      { label: 'Bronze 402', short: '402', aStart: 18, aEnd: 54 },
      { label: 'Bronze 403', short: '403', aStart: 54, aEnd: 90 },
      { label: 'Bronze 404', short: '404', aStart: 90, aEnd: 126 },
      { label: 'Bronze 405', short: '405', aStart: 126, aEnd: 162 },
      { label: 'Bronze 406', short: '406', aStart: 162, aEnd: 198 },
      { label: 'Bronze 407', short: '407', aStart: 198, aEnd: 234 },
      { label: 'Bronze 408', short: '408', aStart: 234, aEnd: 270 },
      { label: 'Bronze 409', short: '409', aStart: 270, aEnd: 306 },
      { label: 'Bronze 410', short: '410', aStart: 306, aEnd: 342 },
    ],
  },
  {
    category: 'GENERAL', innerR: 248, outerR: 295, basePrice: 55,
    sections: [
      { label: 'General 501', short: '501', aStart: -15, aEnd: 15 },
      { label: 'General 502', short: '502', aStart: 15, aEnd: 45 },
      { label: 'General 503', short: '503', aStart: 45, aEnd: 75 },
      { label: 'General 504', short: '504', aStart: 75, aEnd: 105 },
      { label: 'General 505', short: '505', aStart: 105, aEnd: 135 },
      { label: 'General 506', short: '506', aStart: 135, aEnd: 165 },
      { label: 'General 507', short: '507', aStart: 165, aEnd: 195 },
      { label: 'General 508', short: '508', aStart: 195, aEnd: 225 },
      { label: 'General 509', short: '509', aStart: 225, aEnd: 255 },
      { label: 'General 510', short: '510', aStart: 255, aEnd: 285 },
      { label: 'General 511', short: '511', aStart: 285, aEnd: 315 },
      { label: 'General 512', short: '512', aStart: 315, aEnd: 345 },
    ],
  },
];

function buildSections(): StadiumSection[] {
  const sections: StadiumSection[] = [];
  for (const ring of RINGS) {
    for (const s of ring.sections) {
      const midR = (ring.innerR + ring.outerR) / 2;
      const [cx, cy] = arcMid(0, 0, midR, s.aStart, s.aEnd);
      const total = Math.floor(Math.random() * 200 + 80);
      const available = Math.floor(total * (0.3 + Math.random() * 0.5));
      sections.push({
        id: `sec-${s.short}`,
        label: s.label,
        shortLabel: s.short,
        category: ring.category,
        color: CAT_COLOR[ring.category],
        innerRadius: ring.innerR,
        outerRadius: ring.outerR,
        angleStart: s.aStart,
        angleEnd: s.aEnd,
        centerX: cx,
        centerY: cy,
        basePrice: ring.basePrice,
        minPrice: Math.round(ring.basePrice * 0.85),
        available,
        total,
      });
    }
  }
  return sections;
}

export const SECTIONS = buildSections();
export const ALL_SEATS: StadiumSeat[] = SECTIONS.flatMap(generateSeatsForSection);

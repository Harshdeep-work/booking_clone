export type Tier = 'VIP' | 'Premium' | 'Standard' | 'Budget';
export type SeatStatus = 'available' | 'selected' | 'booked';

export interface Section {
  id: string;
  label: string;
  tier: Tier;
  price: number;       // base price
  priceMax: number;
  available: number;
  total: number;
  // radial geometry (world units, centre 0,0)
  innerR: number;
  outerR: number;
  angleStart: number;  // degrees
  angleEnd: number;
}

export interface Seat {
  id: string;
  sectionId: string;
  row: string;
  number: number;
  price: number;
  status: SeatStatus;
  x: number;   // world coords (populated at runtime)
  y: number;
}

// ── Tier palette ──────────────────────────────────────────────────────────────
export const TIER_COLOR: Record<Tier, string> = {
  VIP:      '#A855F7',
  Premium:  '#F59E0B',
  Standard: '#94A3B8',
  Budget:   '#3B82F6',
};

export const TIER_GLOW: Record<Tier, string> = {
  VIP:      'rgba(168,85,247,0.55)',
  Premium:  'rgba(245,158,11,0.55)',
  Standard: 'rgba(148,163,184,0.45)',
  Budget:   'rgba(59,130,246,0.55)',
};

// ── Ring definitions ──────────────────────────────────────────────────────────
interface RingDef {
  tier: Tier;
  innerR: number;
  outerR: number;
  basePrice: number;
  priceMax: number;
  slices: { label: string; aStart: number; aEnd: number }[];
}

const RINGS: RingDef[] = [
  {
    tier: 'VIP', innerR: 0, outerR: 60, basePrice: 800, priceMax: 1200,
    slices: [{ label: 'VIP Floor', aStart: -180, aEnd: 180 }],
  },
  {
    tier: 'VIP', innerR: 63, outerR: 105, basePrice: 520, priceMax: 750,
    slices: [
      { label: '101', aStart: -30, aEnd: 30 },
      { label: '102', aStart: 30, aEnd: 90 },
      { label: '103', aStart: 90, aEnd: 150 },
      { label: '104', aStart: 150, aEnd: 210 },
      { label: '105', aStart: 210, aEnd: 270 },
      { label: '106', aStart: 270, aEnd: 330 },
    ],
  },
  {
    tier: 'Premium', innerR: 108, outerR: 158, basePrice: 280, priceMax: 420,
    slices: [
      { label: '201', aStart: -22, aEnd: 22 },
      { label: '202', aStart: 22, aEnd: 66 },
      { label: '203', aStart: 66, aEnd: 110 },
      { label: '204', aStart: 110, aEnd: 154 },
      { label: '205', aStart: 154, aEnd: 198 },
      { label: '206', aStart: 198, aEnd: 242 },
      { label: '207', aStart: 242, aEnd: 286 },
      { label: '208', aStart: 286, aEnd: 330 },
    ],
  },
  {
    tier: 'Standard', innerR: 161, outerR: 210, basePrice: 140, priceMax: 200,
    slices: [
      { label: '301', aStart: -20, aEnd: 20 },
      { label: '302', aStart: 20, aEnd: 60 },
      { label: '303', aStart: 60, aEnd: 100 },
      { label: '304', aStart: 100, aEnd: 140 },
      { label: '305', aStart: 140, aEnd: 180 },
      { label: '306', aStart: 180, aEnd: 220 },
      { label: '307', aStart: 220, aEnd: 260 },
      { label: '308', aStart: 260, aEnd: 300 },
      { label: '309', aStart: 300, aEnd: 340 },
    ],
  },
  {
    tier: 'Budget', innerR: 213, outerR: 260, basePrice: 65, priceMax: 100,
    slices: [
      { label: '401', aStart: -18, aEnd: 18 },
      { label: '402', aStart: 18, aEnd: 54 },
      { label: '403', aStart: 54, aEnd: 90 },
      { label: '404', aStart: 90, aEnd: 126 },
      { label: '405', aStart: 126, aEnd: 162 },
      { label: '406', aStart: 162, aEnd: 198 },
      { label: '407', aStart: 198, aEnd: 234 },
      { label: '408', aStart: 234, aEnd: 270 },
      { label: '409', aStart: 270, aEnd: 306 },
      { label: '410', aStart: 306, aEnd: 342 },
      { label: '411', aStart: 342, aEnd: 360 },
    ],
  },
];

function deg(d: number) { return (d * Math.PI) / 180; }

function arcMidPoint(innerR: number, outerR: number, aStart: number, aEnd: number) {
  const r = (innerR + outerR) / 2;
  const a = deg((aStart + aEnd) / 2);
  return { cx: Math.cos(a) * r, cy: Math.sin(a) * r };
}

let _idCounter = 0;
function buildSections(): Section[] {
  const out: Section[] = [];
  for (const ring of RINGS) {
    for (const sl of ring.slices) {
      const total = Math.floor(Math.random() * 180 + 60);
      const available = Math.floor(total * (0.25 + Math.random() * 0.55));
      out.push({
        id: `sec-${sl.label.replace(/\s+/g, '-')}`,
        label: sl.label,
        tier: ring.tier,
        price: ring.basePrice,
        priceMax: ring.priceMax,
        available,
        total,
        innerR: ring.innerR,
        outerR: ring.outerR,
        angleStart: sl.aStart,
        angleEnd: sl.aEnd,
      });
      _idCounter++;
    }
  }
  return out;
}

const ROWS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateSeats(sec: Section): Seat[] {
  const seats: Seat[] = [];
  const radialSpan = sec.outerR - sec.innerR;
  const numRows = Math.max(2, Math.floor(radialSpan / 7));
  const rowStep = radialSpan / (numRows + 1);
  const angleSpan = sec.angleEnd - sec.angleStart;

  for (let r = 0; r < numRows; r++) {
    const radius = sec.innerR + rowStep * (r + 1);
    const arcLen = (Math.abs(angleSpan) / 360) * 2 * Math.PI * radius;
    const numSeats = Math.max(2, Math.floor(arcLen / 7));
    const angleStep = angleSpan / (numSeats + 1);

    for (let s = 0; s < numSeats; s++) {
      const angle = deg(sec.angleStart + angleStep * (s + 1));
      const roll = Math.random();
      const status: SeatStatus = roll < 0.5 ? 'available' : 'booked';
      const price = Math.round(sec.price * (0.9 + Math.random() * 0.25));
      seats.push({
        id: `${sec.id}-${ROWS[r % 26]}-${s + 1}`,
        sectionId: sec.id,
        row: ROWS[r % 26],
        number: s + 1,
        price,
        status,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    }
  }
  return seats;
}

export const SECTIONS: Section[] = buildSections();

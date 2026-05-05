// Static mock layout — no backend needed
export type SeatStatus = 'available' | 'locked' | 'sold';
export type Category = 'FIELD' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'GENERAL';

export interface MockSection {
  id: string;
  label: string;
  category: Category;
  color: string;
  // polygon vertices in world units (metres-ish)
  vertices: [number, number][];
  basePrice: number;
}

export interface MockSeat {
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

const CAT_COLORS: Record<Category, string> = {
  FIELD:    '#FF6B35',
  PLATINUM: '#A855F7',
  GOLD:     '#F59E0B',
  SILVER:   '#94A3B8',
  BRONZE:   '#D97706',
  GENERAL:  '#3B82F6',
};

function rect(cx: number, cy: number, w: number, h: number): [number, number][] {
  return [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ];
}

// ── Sections ──────────────────────────────────────────────────────────────────
export const SECTIONS: MockSection[] = [
  // Field (centre)
  { id: 'S-FIELD', label: 'Field', category: 'FIELD', color: CAT_COLORS.FIELD,
    vertices: rect(0, 0, 120, 70), basePrice: 850 },

  // Platinum ring
  { id: 'S-PLAT-N', label: 'Platinum North', category: 'PLATINUM', color: CAT_COLORS.PLATINUM,
    vertices: rect(0, -65, 130, 20), basePrice: 550 },
  { id: 'S-PLAT-S', label: 'Platinum South', category: 'PLATINUM', color: CAT_COLORS.PLATINUM,
    vertices: rect(0, 65, 130, 20), basePrice: 550 },
  { id: 'S-PLAT-E', label: 'Platinum East', category: 'PLATINUM', color: CAT_COLORS.PLATINUM,
    vertices: rect(75, 0, 20, 110), basePrice: 550 },
  { id: 'S-PLAT-W', label: 'Platinum West', category: 'PLATINUM', color: CAT_COLORS.PLATINUM,
    vertices: rect(-75, 0, 20, 110), basePrice: 550 },

  // Gold ring
  { id: 'S-GOLD-N', label: 'Gold North', category: 'GOLD', color: CAT_COLORS.GOLD,
    vertices: rect(0, -100, 160, 25), basePrice: 320 },
  { id: 'S-GOLD-S', label: 'Gold South', category: 'GOLD', color: CAT_COLORS.GOLD,
    vertices: rect(0, 100, 160, 25), basePrice: 320 },
  { id: 'S-GOLD-E', label: 'Gold East', category: 'GOLD', color: CAT_COLORS.GOLD,
    vertices: rect(110, 0, 25, 170), basePrice: 320 },
  { id: 'S-GOLD-W', label: 'Gold West', category: 'GOLD', color: CAT_COLORS.GOLD,
    vertices: rect(-110, 0, 25, 170), basePrice: 320 },

  // Silver ring
  { id: 'S-SILV-N', label: 'Silver North', category: 'SILVER', color: CAT_COLORS.SILVER,
    vertices: rect(0, -140, 200, 30), basePrice: 180 },
  { id: 'S-SILV-S', label: 'Silver South', category: 'SILVER', color: CAT_COLORS.SILVER,
    vertices: rect(0, 140, 200, 30), basePrice: 180 },
  { id: 'S-SILV-E', label: 'Silver East', category: 'SILVER', color: CAT_COLORS.SILVER,
    vertices: rect(150, 0, 30, 250), basePrice: 180 },
  { id: 'S-SILV-W', label: 'Silver West', category: 'SILVER', color: CAT_COLORS.SILVER,
    vertices: rect(-150, 0, 30, 250), basePrice: 180 },

  // General (upper bowl)
  { id: 'S-GEN-NE', label: 'General NE', category: 'GENERAL', color: CAT_COLORS.GENERAL,
    vertices: rect(90, -170, 120, 30), basePrice: 80 },
  { id: 'S-GEN-NW', label: 'General NW', category: 'GENERAL', color: CAT_COLORS.GENERAL,
    vertices: rect(-90, -170, 120, 30), basePrice: 80 },
  { id: 'S-GEN-SE', label: 'General SE', category: 'GENERAL', color: CAT_COLORS.GENERAL,
    vertices: rect(90, 170, 120, 30), basePrice: 80 },
  { id: 'S-GEN-SW', label: 'General SW', category: 'GENERAL', color: CAT_COLORS.GENERAL,
    vertices: rect(-90, 170, 120, 30), basePrice: 80 },
];

// ── Seat generation ───────────────────────────────────────────────────────────
function generateSeatsForSection(section: MockSection): MockSeat[] {
  const seats: MockSeat[] = [];
  const xs = section.vertices.map(v => v[0]);
  const ys = section.vertices.map(v => v[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spacing = 5.5;
  const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let rowIdx = 0;

  for (let y = minY + 3; y < maxY - 2; y += spacing) {
    let seatNum = 1;
    for (let x = minX + 3; x < maxX - 2; x += spacing) {
      const statRoll = Math.random();
      const status: SeatStatus = statRoll < 0.55 ? 'available' : statRoll < 0.75 ? 'sold' : 'locked';
      const priceJitter = 1 + (Math.random() - 0.5) * 0.2;
      seats.push({
        id: `${section.id}-${rows[rowIdx % 26]}-${seatNum}`,
        sectionId: section.id,
        row: rows[rowIdx % 26],
        number: seatNum,
        x, y,
        price: Math.round(section.basePrice * priceJitter),
        status,
        category: section.category,
      });
      seatNum++;
    }
    rowIdx++;
  }
  return seats;
}

export const ALL_SEATS: MockSeat[] = SECTIONS.flatMap(generateSeatsForSection);

export const LAYOUT_JSON = { sections: SECTIONS, seats: ALL_SEATS };

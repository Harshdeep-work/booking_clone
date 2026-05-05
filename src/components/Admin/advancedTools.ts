/**
 * Advanced Admin Builder Tools
 * - Seat Grid Generator
 * - Row Curve Editor
 * - Import/Export (CSV, JSON, GeoJSON)
 * - Validation Engine
 * - Section Templates
 */

import type { BShape, BSeat, BRow, Category, NumberScheme, LayoutState, ValidationResult, ValidationError, ValidationWarning, ImportFormat, ExportFormat } from './builderTypes2';
import { CAT_COLOR, centroid, generateBlockSeats, generateRowSeats, generateArcRowSeats } from './builderTypes2';

// ═══════════════════════════════════════════════════════════════════════════
// SEAT GRID GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

export interface GridConfig {
  rows: number;
  seatsPerRow: number;
  rowSpacing: number;
  seatSpacing: number;
  curveRadius?: number;
  aisleAfter?: number[];
  startRow: string;
  startNumber: number;
  numberScheme: NumberScheme;
  category: Category;
  basePrice: number;
}

export function generateSeatGrid(
  sectionId: string,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  config: GridConfig
): { rows: BRow[]; seats: BSeat[] } {
  const { rows, seatsPerRow, rowSpacing, seatSpacing, curveRadius, aisleAfter, startRow, startNumber, numberScheme, category, basePrice } = config;
  
  const outRows: BRow[] = [];
  const outSeats: BSeat[] = [];
  
  const totalHeight = bounds.y1 - bounds.y0;
  const totalWidth = bounds.x1 - bounds.x0;
  
  for (let r = 0; r < rows; r++) {
    const rowLabel = String.fromCharCode(startRow.charCodeAt(0) + r);
    const rowId = `row-${sectionId}-${r}`;
    const rowY = bounds.y0 + (r + 0.5) * (totalHeight / rows);
    
    const rowSeats: BSeat[] = [];
    let seatNum = startNumber;
    
    for (let s = 0; s < seatsPerRow; s++) {
      // Check for aisle gap
      const isAisle = aisleAfter?.includes(s);
      
      let x: number, y: number;
      
      if (curveRadius) {
        // Curved row
        const angle = ((s / (seatsPerRow - 1)) - 0.5) * (totalWidth / curveRadius);
        x = bounds.x0 + totalWidth / 2 + Math.sin(angle) * curveRadius;
        y = rowY + (1 - Math.cos(angle)) * Math.abs(curveRadius) * 0.3;
      } else {
        // Straight row
        x = bounds.x0 + (s + 0.5) * (totalWidth / seatsPerRow);
        y = rowY;
      }
      
      // Apply aisle spacing
      if (isAisle) {
        x += seatSpacing * 2;
      }
      
      // Number scheme
      let num = seatNum;
      if (numberScheme === 'odd') num = seatNum * 2 - 1;
      else if (numberScheme === 'even') num = seatNum * 2;
      else if (numberScheme === 'rtl') num = startNumber + seatsPerRow - seatNum;
      
      rowSeats.push({
        id: `seat-${rowId}-${s}`,
        rowId,
        sectionId,
        number: num,
        label: `${rowLabel}${num}`,
        x, y,
        price: basePrice,
        status: 'available',
        category,
        aisleGap: isAisle,
      });
      
      seatNum++;
    }
    
    outRows.push({ id: rowId, sectionId, label: rowLabel, category, seats: rowSeats, curveRadius });
    outSeats.push(...rowSeats);
  }
  
  return { rows: outRows, seats: outSeats };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export interface SectionTemplate {
  id: string;
  name: string;
  icon: string;
  vertices: [number, number][];
  defaultCategory: Category;
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: 'rect',
    name: 'Rectangle',
    icon: '▭',
    vertices: [[0, 0], [100, 0], [100, 60], [0, 60]],
    defaultCategory: 'STANDARD',
  },
  {
    id: 'trapezoid',
    name: 'Trapezoid',
    icon: '⏢',
    vertices: [[20, 0], [80, 0], [100, 60], [0, 60]],
    defaultCategory: 'STANDARD',
  },
  {
    id: 'arc',
    name: 'Arc Section',
    icon: '◠',
    vertices: generateArcVertices(50, 50, 30, 50, -30, 30, 20),
    defaultCategory: 'PREMIUM',
  },
  {
    id: 'corner',
    name: 'Corner',
    icon: '⌜',
    vertices: [[0, 0], [60, 0], [60, 20], [20, 20], [20, 60], [0, 60]],
    defaultCategory: 'BUDGET',
  },
  {
    id: 'suite',
    name: 'Suite Box',
    icon: '▢',
    vertices: [[0, 0], [40, 0], [40, 30], [0, 30]],
    defaultCategory: 'VIP',
  },
];

function generateArcVertices(cx: number, cy: number, innerR: number, outerR: number, a0: number, a1: number, segs: number): [number, number][] {
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

export function applyTemplate(template: SectionTemplate, position: { x: number; y: number }, scale = 1): BShape {
  const vertices = template.vertices.map(([x, y]) => [position.x + x * scale, position.y + y * scale] as [number, number]);
  const [cx, cy] = centroid(vertices);
  
  return {
    id: `sec-${Date.now()}`,
    type: 'section',
    label: template.name,
    category: template.defaultCategory,
    color: CAT_COLOR[template.defaultCategory],
    vertices,
    cx, cy,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4-CORNER DRAG TOOL
// ═══════════════════════════════════════════════════════════════════════════

export function generate4CornerSection(
  corners: [number, number][],
  rows: number,
  seatsPerRow: number,
  sectionId: string,
  category: Category,
  basePrice: number
): { shape: BShape; rows: BRow[]; seats: BSeat[] } {
  if (corners.length !== 4) throw new Error('Need exactly 4 corners');
  
  const [cx, cy] = centroid(corners);
  const shape: BShape = {
    id: sectionId,
    type: 'section',
    label: sectionId.replace('sec-', 'SEC '),
    category,
    color: CAT_COLOR[category],
    vertices: corners,
    cx, cy,
  };
  
  // Generate seats in perspective grid
  const outRows: BRow[] = [];
  const outSeats: BSeat[] = [];
  
  for (let r = 0; r < rows; r++) {
    const t = (r + 0.5) / rows;
    const rowLabel = String.fromCharCode(65 + r);
    const rowId = `row-${sectionId}-${r}`;
    
    // Interpolate between front and back edges
    const frontLeft = lerp2D(corners[0], corners[3], t);
    const frontRight = lerp2D(corners[1], corners[2], t);
    
    const rowSeats: BSeat[] = [];
    for (let s = 0; s < seatsPerRow; s++) {
      const st = (s + 0.5) / seatsPerRow;
      const [x, y] = lerp2D(frontLeft, frontRight, st);
      
      rowSeats.push({
        id: `seat-${rowId}-${s}`,
        rowId,
        sectionId,
        number: s + 1,
        label: `${rowLabel}${s + 1}`,
        x, y,
        price: basePrice,
        status: 'available',
        category,
      });
    }
    
    outRows.push({ id: rowId, sectionId, label: rowLabel, category, seats: rowSeats });
    outSeats.push(...rowSeats);
  }
  
  return { shape, rows: outRows, seats: outSeats };
}

function lerp2D(p1: [number, number], p2: [number, number], t: number): [number, number] {
  return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export function validateLayout(layout: LayoutState): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // 1. Check for duplicate seat IDs
  const seatIds = new Set<string>();
  layout.seats.forEach(seat => {
    if (seatIds.has(seat.label)) {
      errors.push({
        type: 'duplicate_id',
        message: `Duplicate seat ID: ${seat.label}`,
        entityIds: [seat.id],
      });
    }
    seatIds.add(seat.label);
  });
  
  // 2. Check for seat overlaps (within 8 units)
  const MIN_SPACING = 8;
  for (let i = 0; i < layout.seats.length; i++) {
    for (let j = i + 1; j < layout.seats.length; j++) {
      const s1 = layout.seats[i];
      const s2 = layout.seats[j];
      const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
      if (dist < MIN_SPACING) {
        errors.push({
          type: 'overlap',
          message: `Seats too close: ${s1.label} and ${s2.label} (${dist.toFixed(1)} units)`,
          entityIds: [s1.id, s2.id],
        });
      }
    }
  }
  
  // 3. Check for section overlaps
  for (let i = 0; i < layout.shapes.length; i++) {
    for (let j = i + 1; j < layout.shapes.length; j++) {
      const sh1 = layout.shapes[i];
      const sh2 = layout.shapes[j];
      if (polygonsOverlap(sh1.vertices, sh2.vertices)) {
        errors.push({
          type: 'overlap',
          message: `Sections overlap: ${sh1.label} and ${sh2.label}`,
          entityIds: [sh1.id, sh2.id],
        });
      }
    }
  }
  
  // 4. Check numbering conflicts
  layout.rows.forEach(row => {
    const numbers = row.seats.map(s => s.number);
    const unique = new Set(numbers);
    if (numbers.length !== unique.size) {
      errors.push({
        type: 'numbering',
        message: `Duplicate seat numbers in row ${row.label}`,
        entityIds: [row.id],
      });
    }
  });
  
  // 5. Accessibility warnings
  const accessibleSeats = layout.seats.filter(s => s.isAccessible).length;
  const totalSeats = layout.seats.length;
  if (totalSeats > 0 && accessibleSeats / totalSeats < 0.01) {
    warnings.push({
      type: 'accessibility',
      message: `Only ${accessibleSeats} accessible seats (${((accessibleSeats / totalSeats) * 100).toFixed(1)}%). ADA requires ~1%.`,
      entityIds: [],
    });
  }
  
  // 6. Pricing warnings
  const priceRange = layout.seats.reduce((acc, s) => {
    acc.min = Math.min(acc.min, s.price);
    acc.max = Math.max(acc.max, s.price);
    return acc;
  }, { min: Infinity, max: -Infinity });
  
  if (priceRange.max / priceRange.min > 20) {
    warnings.push({
      type: 'pricing',
      message: `Large price variance: $${priceRange.min} - $${priceRange.max} (${(priceRange.max / priceRange.min).toFixed(1)}x)`,
      entityIds: [],
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function polygonsOverlap(p1: [number, number][], p2: [number, number][]): boolean {
  // Simple centroid distance check (fast approximation)
  const [c1x, c1y] = centroid(p1);
  const [c2x, c2y] = centroid(p2);
  const dist = Math.hypot(c1x - c2x, c1y - c2y);
  
  // If centroids are far apart, no overlap
  const r1 = Math.max(...p1.map(([x, y]) => Math.hypot(x - c1x, y - c1y)));
  const r2 = Math.max(...p2.map(([x, y]) => Math.hypot(x - c2x, y - c2y)));
  
  return dist < (r1 + r2) * 0.5;
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export function importFromCSV(csv: string): { seats: BSeat[]; errors: string[] } {
  const lines = csv.trim().split('\n');
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  
  const requiredHeaders = ['section_id', 'row', 'seat', 'x', 'y'];
  const missing = requiredHeaders.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    return { seats: [], errors: [`Missing required columns: ${missing.join(', ')}`] };
  }
  
  const seats: BSeat[] = [];
  const errors: string[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) {
      errors.push(`Line ${i + 1}: Column count mismatch`);
      continue;
    }
    
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => row[h] = values[idx]);
    
    const x = parseFloat(row.x);
    const y = parseFloat(row.y);
    const number = parseInt(row.seat);
    const price = parseFloat(row.price || '100');
    
    if (isNaN(x) || isNaN(y) || isNaN(number)) {
      errors.push(`Line ${i + 1}: Invalid numeric values`);
      continue;
    }
    
    const sectionId = row.section_id;
    const rowLabel = row.row;
    const rowId = `row-${sectionId}-${rowLabel}`;
    
    seats.push({
      id: `seat-${rowId}-${number}`,
      rowId,
      sectionId,
      number,
      label: `${rowLabel}${number}`,
      x, y,
      price,
      status: (row.status as SeatStatus) || 'available',
      category: (row.category as Category) || 'STANDARD',
      isAccessible: row.accessible === 'true',
      isObstructed: row.obstructed === 'true',
    });
  }
  
  return { seats, errors };
}

export function exportToCSV(layout: LayoutState, includeMetadata = true): string {
  const headers = includeMetadata
    ? ['section_id', 'row', 'seat', 'x', 'y', 'price', 'category', 'status', 'accessible', 'obstructed']
    : ['section_id', 'row', 'seat', 'x', 'y'];
  
  const rows = layout.seats.map(seat => {
    const rowLabel = seat.label.match(/^[A-Z]+/)?.[0] || 'A';
    const basic = [seat.sectionId, rowLabel, seat.number, seat.x.toFixed(2), seat.y.toFixed(2)];
    
    if (includeMetadata) {
      return [...basic, seat.price, seat.category, seat.status, seat.isAccessible || false, seat.isObstructed || false];
    }
    return basic;
  });
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function exportToGeoJSON(layout: LayoutState): object {
  return {
    type: 'FeatureCollection',
    features: [
      ...layout.shapes.map(shape => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[...shape.vertices, shape.vertices[0]]],
        },
        properties: {
          id: shape.id,
          label: shape.label,
          category: shape.category,
          type: shape.type,
          level: shape.level,
        },
      })),
      ...layout.seats.map(seat => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [seat.x, seat.y],
        },
        properties: {
          id: seat.id,
          label: seat.label,
          price: seat.price,
          status: seat.status,
          category: seat.category,
          sectionId: seat.sectionId,
        },
      })),
    ],
  };
}

export function importFromGeoJSON(geojson: any): { shapes: BShape[]; seats: BSeat[] } {
  const shapes: BShape[] = [];
  const seats: BSeat[] = [];
  
  geojson.features?.forEach((feature: any) => {
    if (feature.geometry.type === 'Polygon') {
      const coords = feature.geometry.coordinates[0];
      const vertices = coords.slice(0, -1).map(([x, y]: number[]) => [x, y] as [number, number]);
      const [cx, cy] = centroid(vertices);
      
      shapes.push({
        id: feature.properties.id || `sec-${Date.now()}`,
        type: feature.properties.type || 'section',
        label: feature.properties.label || 'Section',
        category: feature.properties.category || 'STANDARD',
        color: CAT_COLOR[feature.properties.category as Category] || CAT_COLOR.STANDARD,
        vertices,
        cx, cy,
        level: feature.properties.level,
      });
    } else if (feature.geometry.type === 'Point') {
      const [x, y] = feature.geometry.coordinates;
      const props = feature.properties;
      
      seats.push({
        id: props.id || `seat-${Date.now()}`,
        rowId: props.rowId || '',
        sectionId: props.sectionId || '',
        number: props.number || 1,
        label: props.label || '',
        x, y,
        price: props.price || 100,
        status: props.status || 'available',
        category: props.category || 'STANDARD',
      });
    }
  });
  
  return { shapes, seats };
}

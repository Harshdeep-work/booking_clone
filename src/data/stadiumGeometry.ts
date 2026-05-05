/**
 * MetLife Stadium — 30 Section GeoJSON Geometry Generator
 * Creates a realistic oval stadium with 6 category rings.
 * Used by seed.ts to populate the DB. Also served at /public/sample-stadium.geojson.
 */

export interface StadiumSection {
  section_id: string;
  label: string;
  category: 'FIELD' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'GENERAL';
  color: string;
  centerLng: number;
  centerLat: number;
  geometry: GeoJSON.Polygon;
  basePrice: number;
  rows: number;
  seatsPerRow: number;
}

// MetLife Stadium center (approximate)
const CENTER_LNG = -74.0742;
const CENTER_LAT = 40.8135;

const CATEGORY_COLORS: Record<string, string> = {
  FIELD: '#FF6B35',       // Orange-red for field level
  PLATINUM: '#9B59B6',    // Purple
  GOLD: '#F1C40F',        // Gold
  SILVER: '#95A5A6',      // Silver
  BRONZE: '#E67E22',      // Bronze
  GENERAL: '#3498DB',     // Blue
};

const CATEGORY_BASE_PRICES: Record<string, number> = {
  FIELD: 800,
  PLATINUM: 500,
  GOLD: 350,
  SILVER: 220,
  BRONZE: 150,
  GENERAL: 80,
};

/**
 * Convert polar coords to lat/lng with stadium oval distortion.
 */
function polarToLatLng(
  centerLng: number,
  centerLat: number,
  angleDeg: number,
  radiusLng: number,
  radiusLat: number
): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [
    centerLng + radiusLng * Math.cos(rad),
    centerLat + radiusLat * Math.sin(rad),
  ];
}

/**
 * Generate a polygon arc segment for a section.
 */
function generateSectionPolygon(
  centerLng: number,
  centerLat: number,
  innerRadiusLng: number,
  innerRadiusLat: number,
  outerRadiusLng: number,
  outerRadiusLat: number,
  startAngle: number,
  endAngle: number,
  steps = 16
): GeoJSON.Polygon {
  const outerArc: [number, number][] = [];
  const innerArc: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + ((endAngle - startAngle) * i) / steps;
    outerArc.push(polarToLatLng(centerLng, centerLat, angle, outerRadiusLng, outerRadiusLat));
    innerArc.push(polarToLatLng(centerLng, centerLat, angle, innerRadiusLng, innerRadiusLat));
  }

  // Close the polygon: outer arc → reverse inner arc
  const coordinates = [
    ...outerArc,
    ...innerArc.reverse(),
    outerArc[0], // close
  ];

  return { type: 'Polygon', coordinates: [coordinates] };
}

/**
 * Generate all 30+ stadium sections across 6 rings.
 */
export function generateStadiumSections(): StadiumSection[] {
  const sections: StadiumSection[] = [];

  // Ring definitions: [category, innerLng, outerLng, innerLat scale, outerLat scale, sectionsCount, rows, seatsPerRow]
  const rings: [
    'FIELD' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'GENERAL',
    number, number, number, number, number, number, number
  ][] = [
    ['FIELD',    0,      0.003,  0,      0.002,  4,  5,  10],
    ['PLATINUM', 0.003,  0.007,  0.002,  0.005,  6,  8,  14],
    ['GOLD',     0.007,  0.012,  0.005,  0.009,  6,  10, 18],
    ['SILVER',   0.012,  0.018,  0.009,  0.014,  6,  12, 22],
    ['BRONZE',   0.018,  0.024,  0.014,  0.019,  6,  10, 20],
    ['GENERAL',  0.024,  0.031,  0.019,  0.025,  6,  8,  16],
  ];

  rings.forEach(([category, innerLng, outerLng, innerLat, outerLat, count, rows, seatsPerRow]) => {
    const angleStep = 360 / count;

    for (let i = 0; i < count; i++) {
      const startAngle = i * angleStep - 90; // Start from top
      const endAngle = (i + 1) * angleStep - 90;
      const midAngle = (startAngle + endAngle) / 2;
      const midRad = (midAngle * Math.PI) / 180;

      const midRadiusLng = (innerLng + outerLng) / 2;
      const midRadiusLat = (innerLat + outerLat) / 2;

      const centerLng = CENTER_LNG + midRadiusLng * Math.cos(midRad);
      const centerLat = CENTER_LAT + midRadiusLat * Math.sin(midRad);

      const sectionLetter = String.fromCharCode(65 + rings.indexOf([category, innerLng, outerLng, innerLat, outerLat, count, rows, seatsPerRow] as any));
      const sectionNumber = (i + 1).toString().padStart(3, '0');
      const section_id = `${sectionLetter}${sectionNumber}`;
      const label = `${category.charAt(0)}${sectionNumber}`;

      sections.push({
        section_id,
        label,
        category,
        color: CATEGORY_COLORS[category],
        centerLng,
        centerLat,
        geometry: generateSectionPolygon(
          CENTER_LNG, CENTER_LAT,
          innerLng, innerLat,
          outerLng, outerLat,
          startAngle, endAngle
        ),
        basePrice: CATEGORY_BASE_PRICES[category],
        rows,
        seatsPerRow,
      });
    }
  });

  return sections;
}

export { CENTER_LNG, CENTER_LAT, CATEGORY_COLORS, CATEGORY_BASE_PRICES };

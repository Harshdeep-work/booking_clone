/**
 * stadiumOptimizer.ts
 * Utilities to pack and unpack stadium layout data for efficient storage and rendering.
 */

import { LayoutState, BShape, BRow, BSeat, BText, Category, SeatStatus, CAT_COLOR } from '../components/Admin/builderTypes2';

export interface CompactLayout {
  v: string; // version
  n?: string; // venue name
  m: {
    c: Record<string, { c: string; l: string }>; // categories lookup
    s: string[]; // statuses lookup
    t: string[]; // shape types lookup
  };
  sh: Array<{
    id: string;
    t: number;  // type index
    l: string;  // label
    c: string;  // category key
    v: number[]; // flat vertices [x1,y1,x2,y2...]
    cx: number;
    cy: number;
    r?: Array<{
      id: string;
      l: string; // row label (e.g. "A")
      p: number; // default row price
      s: Array<[
        number,   // number
        number,   // x
        number,   // y
        number,   // status index
        number?,  // price override (optional)
        string?   // category override (optional)
      ]>;
    }>;
  }>;
  os?: Array<{
    id: string; // orphan sectionId
    c: string;  // base category
    r: Array<{
      id: string;
      l: string; // row label (e.g. "A")
      p: number; // default row price
      s: Array<[
        number,   // number
        number,   // x
        number,   // y
        number,   // status index
        number?,  // price override (optional)
        string?   // category override (optional)
      ]>;
    }>;
  }>;
  txt: Array<{
    x: number; y: number;
    t: string; // text
    s: number; // fontSize
    c: string; // color
  }>;
}

const STATUS_MAP: SeatStatus[] = ['available', 'sold', 'locked', 'obstructed'];
const TYPE_MAP = ['section', 'stage', 'ga', 'court', 'suite', 'pressbox', 'scoreboard', 'tunnel', 'concourse', 'ada', 'text', 'table', 'standing'];

export function packLayout(layout: LayoutState & { venueName?: string }): CompactLayout {
  const { shapes, seats, texts, venueName } = layout;

  // 1. Build Metadata — include ALL entries from CAT_COLOR registry (preserves custom tiers)
  const cats: Record<string, { c: string; l: string }> = {};
  // First seed from global registry so unused custom tiers are preserved
  Object.entries(CAT_COLOR).forEach(([key, color]) => {
    cats[key] = { c: color as string, l: key };
  });
  // Then overwrite with any shape-specific colors
  shapes.forEach(sh => {
    cats[sh.category] = { c: sh.color, l: sh.category };
  });

  // 2. Group Seats by Section -> Row
  const structure: Record<string, Record<string, BSeat[]>> = {};
  seats.forEach(s => {
    if (!structure[s.sectionId]) structure[s.sectionId] = {};
    const rId = s.rowId || 'unassigned';
    if (!structure[s.sectionId][rId]) structure[s.sectionId][rId] = [];
    structure[s.sectionId][rId].push(s);
  });

  // 3. Compact Shapes
  const buildRows = (rowMap: Record<string, BSeat[]>, baseCategory: Category) =>
    Object.entries(rowMap).map(([rowId, rowSeats]) => {
      if (!rowSeats.length) return null;
      // Find common price in row to use as default
      const prices = rowSeats.map(s => s.price);
      const commonPrice = prices.sort((a, b) =>
        prices.filter(v => v === a).length - prices.filter(v => v === b).length
      ).pop() || 0;

      return {
        id: rowId,
        l: rowSeats[0]?.label.replace(/\d+$/, '') || '?',
        p: commonPrice,
        s: rowSeats.map(s => {
          const seatData: any[] = [
            s.number,
            Math.round(s.x * 10) / 10,
            Math.round(s.y * 10) / 10,
            STATUS_MAP.indexOf(s.status)
          ];
          if (s.price !== commonPrice) seatData.push(s.price);
          if (s.category !== baseCategory) {
            if (seatData.length === 4) seatData.push(null); // padding if price is default
            seatData.push(s.category);
          }
          return seatData as [number, number, number, number, number?, string?];
        })
      };
    }).filter(Boolean) as Array<{
      id: string;
      l: string;
      p: number;
      s: Array<[number, number, number, number, number?, string?]>;
    }>;

  const sh = shapes.map(shape => {
    const sectionRows = structure[shape.id] || {};
    const rows = buildRows(sectionRows, shape.category);

    return {
      id: shape.id,
      t: TYPE_MAP.indexOf(shape.type),
      l: shape.label,
      c: shape.category,
      v: shape.vertices.flat().map(v => Math.round(v * 10) / 10),
      cx: Math.round(shape.cx * 10) / 10,
      cy: Math.round(shape.cy * 10) / 10,
      r: rows.length > 0 ? rows : undefined
    };
  });

  const shapeIds = new Set(shapes.map(s => s.id));
  const orphanSections = Object.entries(structure)
    .filter(([sectionId]) => !shapeIds.has(sectionId))
    .map(([sectionId, sectionRows]) => {
      const sectionSeats = Object.values(sectionRows).flat();
      const baseCategory = sectionSeats.reduce((acc, s) => {
        acc.set(s.category, (acc.get(s.category) ?? 0) + 1);
        return acc;
      }, new Map<Category, number>());
      const mostCommonCategory = [...baseCategory.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'STANDARD';
      const rows = buildRows(sectionRows, mostCommonCategory);
      return { id: sectionId, c: mostCommonCategory, r: rows };
    })
    .filter(sec => sec.r.length > 0);

  return {
    v: '1.0',
    n: venueName,
    m: { c: cats, s: STATUS_MAP, t: TYPE_MAP },
    sh,
    ...(orphanSections.length ? { os: orphanSections } : {}),
    txt: texts.map(t => ({
      x: Math.round(t.x * 10) / 10,
      y: Math.round(t.y * 10) / 10,
      t: t.text,
      s: t.fontSize,
      c: t.color
    }))
  };
}

export function unpackLayout(compact: CompactLayout): LayoutState {
  // Restore custom categories into the global CAT_COLOR registry
  Object.entries(compact.m.c).forEach(([key, val]) => {
    if (!(key in CAT_COLOR)) {
      (CAT_COLOR as Record<string, string>)[key] = val.c;
    }
  });

  const shapes: BShape[] = compact.sh.map(s => ({
    id: s.id,
    type: TYPE_MAP[s.t] as any,
    label: s.l,
    category: s.c as Category,
    color: compact.m.c[s.c]?.c || '#ccc',
    vertices: Array.from({ length: s.v.length / 2 }, (_, i) => [s.v[i*2], s.v[i*2+1]]),
    cx: s.cx, cy: s.cy
  }));

  const seats: BSeat[] = [];
  const rows: BRow[] = [];

  const expandRows = (sectionId: string, baseCategory: Category, rowData?: CompactLayout['sh'][number]['r']) => {
    if (!rowData) return;
    rowData.forEach(r => {
      const rowSeats: BSeat[] = r.s.map(s => ({
        id: `s-${sectionId}-${r.l}-${s[0]}`,
        rowId: r.id,
        sectionId,
        number: s[0],
        label: `${r.l}${s[0]}`,
        x: s[1], y: s[2],
        status: STATUS_MAP[s[3]],
        price: s[4] ?? r.p,
        category: (s[5] ?? baseCategory) as Category
      }));
      seats.push(...rowSeats);
      rows.push({
        id: r.id,
        sectionId,
        label: r.l,
        category: baseCategory,
        seats: rowSeats
      });
    });
  };

  compact.sh.forEach(shape => {
    expandRows(shape.id, shape.c as Category, shape.r);
  });

  compact.os?.forEach(section => {
    const baseCategory = (section.c as Category) || 'STANDARD';
    expandRows(section.id, baseCategory, section.r);
  });

  const texts: BText[] = compact.txt.map((t, i) => ({
    id: `txt-${i}`,
    x: t.x, y: t.y,
    text: t.t,
    fontSize: t.s,
    color: t.c
  }));

  return { shapes, rows, seats, texts };
}

# TicketFlow Admin Builder — Data Architecture

## Overview

All layout data lives in **React state** (RAM only). Nothing is written to a database or localStorage automatically. Data is lost on page refresh unless exported.

---

## File Map

| File | Role |
|------|------|
| `src/components/Admin/builderTypes2.ts` | All TypeScript types + seat/row geometry generators |
| `src/components/Admin/useBuilderEngine.ts` | Central state engine — all layout state, undo/redo, tools |
| `src/components/Admin/BuilderCanvas.tsx` | Canvas renderer — reads state, draws to `<canvas>` |
| `src/components/Admin/VenueBuilder.tsx` | Main UI shell — wires engine → canvas → panels |
| `src/components/Admin/RowManagerPanel.tsx` | Right panel — row/seat list editor |
| `src/components/Admin/advancedTools.ts` | CSV/GeoJSON import & export, validation, grid generator |
| `src/utils/stadiumOptimizer.ts` | `packLayout` / `unpackLayout` — compact JSON serialization |
| `prisma/schema.prisma` | Database schema (Venue, Section, Row, Seat) — used by booking, NOT by builder |

---

## Core Data Structure

Defined in `builderTypes2.ts`. The entire layout is one object:

```ts
interface LayoutState {
  shapes: BShape[];   // section polygons
  rows:   BRow[];     // curved row metadata
  seats:  BSeat[];    // every individual seat
  texts:  BText[];    // canvas text labels
}
```

### BShape — Section polygon

```ts
interface BShape {
  id: string;
  type: ShapeType;          // 'section' | 'stage' | 'court' | 'ga' | 'suite' | ...
  label: string;            // e.g. "101", "VIP-A"
  category: Category;       // 'VIP' | 'PREMIUM' | 'STANDARD' | 'BUDGET' | 'GA'
  color: string;            // hex color
  vertices: [number,number][]; // polygon corners in world coords
  cx: number; cy: number;   // centroid (for label placement)
  // Arc section fields (for curved stadium sections):
  arcCenter?: [number,number];
  arcInnerR?: number;
  arcOuterR?: number;
  arcA0?: number;           // start angle in degrees
  arcA1?: number;           // end angle in degrees
  displayMode?: 'rows' | 'seats' | 'both';
}
```

### BRow — Row metadata (curved rows only)

```ts
interface BRow {
  id: string;
  sectionId: string;        // parent BShape.id
  label: string;            // row letter e.g. "A"
  category: Category;
  color?: string;
  seats: BSeat[];           // seats belonging to this row
  curveCenter?: [number,number]; // arc center in world coords
  curveRadius?: number;
  curveA0?: number;         // arc start angle (degrees)
  curveA1?: number;         // arc end angle (degrees)
  priceOverride?: number;
}
```

### BSeat — Individual seat

```ts
interface BSeat {
  id: string;
  rowId: string;            // parent BRow.id
  sectionId: string;        // parent BShape.id (or group id for orphan rows)
  number: number;           // seat number (1, 2, 3...)
  label: string;            // e.g. "A1", "B12"
  x: number; y: number;    // position in world coordinates
  price: number;
  status: SeatStatus;       // 'available' | 'sold' | 'locked' | 'obstructed'
  category: Category;
  color?: string;
  isAccessible?: boolean;
  isCompanion?: boolean;
  isObstructed?: boolean;
  isVIP?: boolean;
  aisleGap?: boolean;
}
```

### BText — Canvas label

```ts
interface BText {
  id: string;
  x: number; y: number;
  text: string;
  fontSize: number;
  color: string;
}
```

---

## State Engine — `useBuilderEngine.ts`

### State variables (all in RAM)

| Variable | Type | Purpose |
|----------|------|---------|
| `layout` | `LayoutState` | **The live layout** — current shapes, rows, seats, texts |
| `history` | `Snapshot[]` | Up to 80 undo snapshots (deep-cloned JSON) |
| `redoStack` | `Snapshot[]` | Redo snapshots |
| `selectedIds` | `Set<string>` | Currently selected shape/seat/row IDs |
| `camera` | `{x,y,zoom}` | Viewport position and zoom level |
| `sectionMode` | `string\|null` | ID of section being edited in isolation |
| `orphanDisplayModes` | `Record<string, 'rows'\|'seats'\|'both'>` | Display mode per orphan row group |
| `orphanRenderStyles` | `Record<string, 'dots'\|'bar'\|'line'>` | Visual style per orphan row group |
| `rowGroupRef` | `ref<string\|null>` | Current row-tool group ID (for sequential A,B,C letters) |

### How every edit works

```
User action (draw/move/edit)
  → handler in useBuilderEngine (onPointerUp, updateRow, etc.)
    → builds next = { ...layoutRef.current, ... }  (immutable update)
      → commit(next, label)
          → setLayout(next)           triggers React re-render
          → layoutRef.current = next  keeps ref in sync for hot path
          → setHistory([snap, ...h])  pushes JSON.parse(JSON.stringify(next)) snapshot
          → setRedoStack([])          clears redo on new action
```

### Refs vs State

Hot-path handlers (pointer events, canvas draw) use **refs** to avoid stale closures:

| Ref | Mirrors |
|-----|---------|
| `layoutRef` | `layout` state |
| `camRef` | `camera` state |
| `selRef` | `selectedIds` state |
| `secModeRef` | `sectionMode` state |
| `toolRef` | `tool` state |

---

## Canvas Renderer — `BuilderCanvas.tsx`

Reads from refs (not state) inside a `requestAnimationFrame` loop:

```
useEffect → schedules RAF loop
  draw() called every frame:
    reads: layoutRef, camRef, selRef, secModeRef, orphanDMRef, orphanRSRef
    writes: ctx (CanvasRenderingContext2D)
```

### Coordinate system

- **World coords** — layout positions (e.g. seat at x=120, y=80)
- **Screen coords** — pixel position on canvas

Conversion:
```ts
// world → screen
w2s(wx, wy, cam, W, H) = [(wx - cam.x) * cam.zoom + W/2,  (wy - cam.y) * cam.zoom + H/2]

// screen → world
s2w(sx, sy, cam, W, H) = [(sx - W/2) / cam.zoom + cam.x,  (sy - H/2) / cam.zoom + cam.y]
```

### LOD (Level of Detail) thresholds

| Zoom | What renders |
|------|-------------|
| `< 0.6` | Row guide lines only |
| `0.6 – 1.0` | Seat circles (no numbers) |
| `≥ 1.0` | Seat circles + seat numbers |

---

## Seat & Row Generation — `builderTypes2.ts`

| Function | What it does |
|----------|-------------|
| `generateRowSeats(p1, p2, count, ...)` | Evenly spaces `count` seats from point p1 to p2 |
| `generateArcRowSeats(cx, cy, r, a0, a1, count, ...)` | Places seats along an arc |
| `generateBlockSeats(x0,y0,x1,y1, ...)` | Fills a rectangle with a grid of rows+seats |
| `generateCurvedRows(...)` | Generates multiple concentric arc rows |
| `arcPoly(...)` | Builds arc section polygon vertices |
| `regularPoly(...)` | Builds circle/triangle/pentagon/etc. vertices |

---

## Row Display Modes

Each row group has two independent settings:

### Display Mode (`orphanDisplayModes`)
Controls **when** seats/rows are visible:

| Mode | Behavior |
|------|----------|
| `'rows'` | Only guide lines shown, never seat circles |
| `'seats'` | Always show seat circles |
| `'both'` | Guide lines at low zoom, circles at zoom ≥ 0.6 |

### Render Style (`orphanRenderStyles`)
Controls **how** the row background looks:

| Style | Appearance |
|-------|-----------|
| `'dots'` | Individual seat circles only, no background |
| `'bar'` | Filled capsule bar behind seats |
| `'line'` | Thin 1.5px guide line |

---

## Import / Export — `advancedTools.ts`

| Function | Format | Direction |
|----------|--------|-----------|
| `exportToCSV(layout)` | CSV | Layout → downloadable file |
| `importFromCSV(text)` | CSV | File → LayoutState patch |
| `exportToGeoJSON(layout)` | GeoJSON | Layout → downloadable file |
| `importFromGeoJSON(json)` | GeoJSON | File → LayoutState patch |
| `validateLayout(layout)` | — | Returns errors + warnings |
| `generateSeatGrid(...)` | — | Bulk seat generation |

CSV format:
```
section_id, row, seat, x, y, price, category
101, A, 1, 120.5, 80.3, 250, PREMIUM
```

---

## Compact Serialization — `stadiumOptimizer.ts`

Used by `loadTemplate` to store/load layouts as compact JSON (e.g. for presets):

```ts
packLayout(layout)    → compact object (shorter keys, delta-encoded coords)
unpackLayout(packed)  → full LayoutState
```

---

## Database Schema — `prisma/schema.prisma`

The Prisma schema has `Venue → Section → Row → Seat` models used by the **booking frontend** (real-time seat locking, purchases). The admin builder does **not** read/write Prisma directly.

To save a builder layout to the database, you would need to:
1. Call `exportToGeoJSON(layout)` or serialize `layout` as JSON
2. POST to an API route (e.g. `/api/layout`)
3. The API route stores it via Prisma

---

## Data Flow Diagram

```
User draws on canvas
        │
        ▼
useBuilderEngine (onPointerDown/Move/Up)
        │  builds next LayoutState
        ▼
    commit(next)
    ├── setLayout(next)  ──────────────────► React re-render
    │                                              │
    │                                              ▼
    │                                       VenueBuilder.tsx
    │                                              │
    │                                              ▼
    │                                       BuilderCanvas.tsx
    │                                       (reads layoutRef via RAF)
    │                                              │
    │                                              ▼
    │                                       <canvas> pixels
    │
    └── setHistory([snapshot, ...])  ──────► Undo stack (80 deep-cloned snapshots)


Export button clicked
        │
        ▼
advancedTools.exportToCSV / exportToGeoJSON
        │
        ▼
Browser downloads file  (only persistence available by default)
```

---

## What is NOT persisted

- Layout data on page refresh
- Camera position
- Display mode / render style selections
- Undo history

To add persistence, implement auto-save to `localStorage` or a POST to `/api/layout`.

# TicketFlow — Technical Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Backend API](#5-backend-api)
6. [WebSocket Events](#6-websocket-events)
7. [Frontend — Booking Experience](#7-frontend--booking-experience)
8. [Frontend — Admin Builder](#8-frontend--admin-builder)
9. [Services](#9-services)
10. [State Management](#10-state-management)
11. [Data Flow](#11-data-flow)
12. [Environment Variables](#12-environment-variables)
13. [Scripts & Commands](#13-scripts--commands)

---

## 1. Project Overview

TicketFlow is a production-grade event ticketing platform with two main surfaces:

- **Booking Experience** (`/`) — Users browse a 3D stadium map, select seats, and purchase tickets.
- **Admin Layout Builder** (`/admin`) — Venue operators design seating layouts with a canvas-based editor.

**Tech stack:**

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React, TypeScript |
| Canvas rendering | HTML5 Canvas (custom 2D engine) |
| 3D map | Mapbox GL JS with WebGL seat layer |
| Backend | Express + Socket.IO (custom server, port 4000) |
| Database | PostgreSQL via Prisma ORM |
| Cache / Locks | Redis (ioredis) |
| Real-time | Socket.IO (room-based) |

---

## 2. Architecture

```
Browser
  ├── Next.js App (port 3000/3001)
  │     ├── /           → Booking page (StadiumMap + BookingSidebar)
  │     └── /admin      → Admin builder (VenueBuilder)
  │
  └── Express + Socket.IO (port 4000)
        ├── REST API  (/api/*)
        └── WebSocket (Socket.IO)
              └── Redis (locks + GeoJSON cache)
                    └── PostgreSQL (persistent data)
```

### Key Design Decisions

**Derived GeoJSON** — GeoJSON is never stored as a blob in the DB. It is computed from `Section.geometry` + `Seat` coordinates at request time and cached in Redis for 5 minutes. This keeps the DB schema clean and the cache always consistent.

**Redis-only seat locks** — Seat locks are stored exclusively in Redis with a 10-minute TTL using `SETNX` (atomic). The DB is only written when a seat is permanently `SOLD`. This prevents race conditions without DB-level locking.

**Tile-based section loading** — The `/api/sections` endpoint accepts a `bbox` (bounding box) query parameter so the frontend only loads sections visible in the current viewport.

**Spatial indexing** — Each `Seat` stores `x`, `y` (canvas coordinates) and `lng`, `lat` (map coordinates) for instant spatial lookups without geometry parsing.

---

## 3. Project Structure

```
/
├── prisma/
│   ├── schema.prisma          # DB schema (Event, Layout, Section, Seat, Order, PricingRule)
│   └── seed.ts                # Seeds MetLife Stadium (34 sections, 2500+ seats)
│
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── page.tsx           # Home / Booking entry point
│   │   ├── booking/           # Booking page shell
│   │   ├── admin/             # Admin builder page
│   │   └── api/               # Next.js API routes (proxy to Express)
│   │       ├── lock-seat/
│   │       ├── unlock-seat/
│   │       ├── purchase/
│   │       ├── layout/
│   │       ├── seats/geojson/
│   │       ├── geojson/[layoutId]/
│   │       └── health/
│   │
│   ├── components/
│   │   ├── Admin/             # Admin builder components (see §8)
│   │   ├── StadiumMap/        # Mapbox booking map
│   │   ├── KonvaBooking/      # Alternative Konva-based booking view
│   │   ├── ThreeViewer/       # Three.js 3D preview
│   │   └── Sidebar/           # Booking sidebar / cart
│   │
│   ├── context/
│   │   ├── SocketContext.tsx  # Socket.IO client + event helpers
│   │   └── CartContext.tsx    # Shopping cart (useReducer)
│   │
│   ├── server/                # Express backend (runs separately)
│   │   ├── index.ts           # Server entry point
│   │   ├── websocket.ts       # Socket.IO server + event emitters
│   │   ├── routes/
│   │   │   ├── seats.ts       # GET /api/seats, GET /api/seats/geojson
│   │   │   ├── sections.ts    # GET /api/sections, GET /api/geojson/:layoutId
│   │   │   ├── layout.ts      # CRUD /api/layout
│   │   │   └── seatActions.ts # POST lock/unlock/purchase
│   │   ├── services/
│   │   │   ├── lockService.ts     # Redis seat locking
│   │   │   ├── pricingService.ts  # Dynamic pricing engine
│   │   │   └── geojsonService.ts  # GeoJSON derivation + Redis cache
│   │   └── lib/
│   │       ├── prisma.ts      # Prisma client singleton
│   │       └── redis.ts       # ioredis client singleton
│   │
│   ├── data/
│   │   ├── stadiumEngine.ts   # Generates section polygons + seat coordinates
│   │   ├── stadiumGeometry.ts # Lat/lng polygon generation for Mapbox
│   │   └── mockLayout.ts      # Fallback layout (no DB required)
│   │
│   └── utils/
│       └── stadiumOptimizer.ts # Layout pack/unpack for localStorage persistence
```

---

## 4. Database Schema

### Models

#### `Event`
Represents a ticketed event (concert, game, etc.).

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | String | Event name |
| `date` | DateTime | Event date/time |
| `venue` | String | Venue name |
| `city` | String | City |
| `imageUrl` | String? | Promotional image |

#### `Layout`
A versioned seating layout for an event. Multiple versions can exist; only one is `isActive`.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `eventId` | UUID | FK → Event |
| `version` | Int | Auto-incremented version number |
| `name` | String | Layout name |
| `isActive` | Boolean | Whether this is the live layout |

#### `Section`
A named seating area (e.g. "Section 101", "Floor GA").

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `section_id` | String | Human-readable ID (e.g. `A101`) — unique |
| `label` | String | Display name |
| `category` | SeatCategory | FIELD / PLATINUM / GOLD / SILVER / BRONZE / GENERAL |
| `color` | String | Hex fill color |
| `geometry` | Json | GeoJSON Polygon (section outline) |
| `centerX/Y` | Float | Centroid for label placement and bbox filtering |
| `level` | String? | Venue level: 100 / 200 / 300 / SUITE / CLUB |
| `curveRadius` | Float? | Radius for curved sections |
| `photoUrl` | String? | Seat-view photo URL |
| `isAccessible` | Boolean | ADA accessible section |
| `isObstructed` | Boolean | Obstructed view section |

#### `Seat`
An individual seat within a section.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `seat_id` | String | Human-readable ID (e.g. `A101-R1-S1`) — unique |
| `sectionId` | UUID | FK → Section |
| `row` | String | Row label (e.g. `A`, `B`) |
| `number` | Int | Seat number within row |
| `x`, `y` | Float | Canvas coordinates |
| `lng`, `lat` | Float | Mapbox coordinates |
| `price` | Decimal | Base price |
| `status` | SeatStatus | AVAILABLE / LOCKED / SOLD / OBSTRUCTED |
| `isAccessible` | Boolean | Wheelchair accessible |
| `isCompanion` | Boolean | Companion seat (next to accessible) |
| `isObstructed` | Boolean | Obstructed view |
| `isVIP` | Boolean | VIP seat |
| `aisleGap` | Boolean | Aisle seat |

#### `PricingRule`
Dynamic pricing configuration per section.

| Field | Type | Description |
|---|---|---|
| `sectionId` | UUID | FK → Section |
| `base_price` | Decimal | Starting price |
| `min_price` | Decimal | Floor price |
| `max_price` | Decimal | Ceiling price |
| `demand_multiplier` | Float | Max multiplier at 100% sold (e.g. 2.0 = 2×) |
| `time_factor` | Float | Multiplier applied as event approaches |

#### `Order`
A confirmed purchase.

| Field | Type | Description |
|---|---|---|
| `userId` | String | Buyer identifier |
| `seatIds` | String[] | Array of `seat_id` values |
| `total` | Float | Total amount charged |
| `status` | String | CONFIRMED / REFUNDED |

---

## 5. Backend API

Base URL: `http://localhost:4000`

### Seat Actions

#### `POST /api/lock-seat`
Atomically locks a seat for a user using Redis `SETNX`. Lock expires in 10 minutes.

**Request body:**
```json
{ "seat_id": "A101-R1-S1", "user_id": "user_abc" }
```

**Response (success):**
```json
{ "success": true, "seat_id": "A101-R1-S1", "expires_at": 1716123456789 }
```

**Response (conflict — seat locked by another user):**
```json
{ "error": "Seat is locked by another user", "locked_by": "user_xyz", "expires_at": 1716123456789 }
```
HTTP 409.

**Side effects:** Emits `seat_locked` WebSocket event to the section room. Schedules a `section_update` batch event.

---

#### `POST /api/unlock-seat`
Releases a seat lock. Only the lock owner can release.

**Request body:**
```json
{ "seat_id": "A101-R1-S1", "user_id": "user_abc" }
```

**Response:** `{ "success": true, "seat_id": "A101-R1-S1" }`

HTTP 403 if the caller does not own the lock.

---

#### `POST /api/purchase`
Finalises a purchase. Verifies all seats are not already sold, marks them `SOLD` in the DB in a single Prisma transaction, creates an `Order` record, and invalidates Redis caches.

**Request body:**
```json
{
  "seat_ids": ["A101-R1-S1", "A101-R1-S2"],
  "user_id": "user_abc",
  "payment_token": "tok_stripe_xxx"
}
```

**Response:**
```json
{ "success": true, "order_total": 500, "seat_count": 2 }
```

**Side effects:** Emits `bulk_seat_update` WebSocket event. Invalidates pricing and GeoJSON caches for affected sections.

---

### Seats

#### `GET /api/seats?section_id=A101`
Returns all seats for a section with live lock status merged from Redis.

**Response:**
```json
{
  "section_id": "A101",
  "seats": [
    {
      "seat_id": "A101-R1-S1",
      "row": "A", "number": 1,
      "x": 120.5, "y": 80.3,
      "lng": -74.0, "lat": 40.8,
      "price": 250,
      "status": "LOCKED",
      "lockedBy": "user_xyz"
    }
  ]
}
```

---

#### `GET /api/seats/geojson?section_id=A101`
Returns a GeoJSON `FeatureCollection` of seat `Point` features for Mapbox rendering. Cached in Redis.

---

### Sections

#### `GET /api/sections?layoutId=xxx&bbox=west,south,east,north`
Returns sections for a layout. If `bbox` is provided, only returns sections whose centroid falls within the bounding box (tile-based loading).

**Response:**
```json
{
  "sections": [
    {
      "section_id": "A101",
      "label": "101",
      "category": "GOLD",
      "color": "#f59e0b",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "seatCount": 80,
      "availableCount": 62,
      "basePrice": 350,
      "centerX": -74.07, "centerY": 40.81
    }
  ]
}
```

---

#### `GET /api/geojson/:layoutId`
Returns a full GeoJSON `FeatureCollection` of all section polygons for a layout. Cached in Redis for 5 minutes. Response includes `Cache-Control: public, max-age=60`.

---

### Layout

#### `POST /api/layout`
Creates a new layout version for an event. Auto-increments `version`.

**Request body:**
```json
{
  "eventId": "uuid",
  "name": "Main Layout v2",
  "sections": [{ "section_id": "A101", "label": "101", "geometry": {...} }]
}
```

---

#### `GET /api/layout/:id`
Returns a layout with all sections, pricing rules, and seat counts.

---

#### `PUT /api/layout/:id`
Updates layout name or `isActive` flag. Invalidates GeoJSON cache.

---

#### `GET /api/layout/:id/versions`
Returns all version history for the event that owns this layout.

---

#### `POST /api/layout/:id/rollback/:version`
Deactivates all versions and activates the specified version. Invalidates GeoJSON cache.

---

## 6. WebSocket Events

The Socket.IO server runs on the same port as Express (4000). Clients connect with `auth: { userId }`.

### Rooms
Clients join section-specific rooms to receive targeted updates:
```js
socket.emit('join_section', 'A101');
socket.emit('leave_section', 'A101');
```

### Server → Client Events

| Event | Room | Payload | Description |
|---|---|---|---|
| `seat_locked` | `section:{id}` | `{ seat_id, user_id, expires_at }` | A seat was just locked |
| `seat_unlocked` | `section:{id}` | `{ seat_id }` | A seat lock was released |
| `seat_sold` | `section:{id}` | `{ seat_id, section_id }` | A seat was purchased |
| `section_update` | `section:{id}` | `{ section_id, available_count, locked_count, price }` | Batched section stats (every 2s) |
| `bulk_seat_update` | broadcast | `{ seats: [{ seat_id, status }] }` | Multiple seats changed at once |
| `heartbeat` | broadcast | `{ ts }` | Sent every 30s for connection health |

### Disconnect Behaviour
When a client disconnects, all their Redis seat locks are automatically released and a `bulk_seat_update` is broadcast to free those seats for other users.

### Client Usage (React)
```tsx
const { joinSection, onSeatLocked, onSeatUnlocked } = useSocket();

useEffect(() => {
  joinSection('A101');
  const off = onSeatLocked((e) => {
    // update local seat state
  });
  return off; // removes listener
}, []);
```

---

## 7. Frontend — Booking Experience

### Pages

- `/` — Home page with `StadiumMap` (Mapbox) or `KonvaStadium` fallback
- `/booking` — Full booking shell with sidebar cart

### Components

#### `StadiumMap` (`src/components/StadiumMap/StadiumMap.tsx`)
Mapbox GL JS map with:
- Extruded 3D section polygons (fill-extrusion layer)
- WebGL seat point layer (single draw call for 5000+ seats)
- Floating price marker pins per section
- Level-of-detail: sections at low zoom, individual seats at high zoom
- Subscribes to Socket.IO section rooms on section click

#### `BookingSidebar` (`src/components/Sidebar/BookingSidebar.tsx`)
Cart panel showing selected seats, total price, and checkout button. Calls `POST /api/purchase` on confirm.

#### `KonvaStadium` (`src/components/KonvaBooking/KonvaStadium.tsx`)
Fallback canvas renderer using Konva.js. Used when Mapbox token is not configured.

### Cart State (`CartContext`)
Global cart managed with `useReducer`. Actions:

| Action | Description |
|---|---|
| `ADD_SEAT` | Adds a seat (deduplicates by `seat_id`) |
| `REMOVE_SEAT` | Removes a seat and subtracts price |
| `CLEAR_CART` | Empties cart |
| `SET_LOCKING` | Tracks in-flight lock requests per seat |

### Socket State (`SocketContext`)
Wraps Socket.IO client. Provides:
- `joinSection(id)` / `leaveSection(id)` — room management
- `onSeatLocked(cb)` / `onSeatUnlocked(cb)` / `onSeatSold(cb)` — event subscriptions (return cleanup function)
- `onSectionUpdate(cb)` / `onBulkSeatUpdate(cb)` — aggregate updates
- Heartbeat monitoring: reconnects if 2 consecutive heartbeats are missed (70s window)

---

## 8. Frontend — Admin Builder

Entry point: `/admin` → `VenueBuilder` component.

### Component Tree

```
VenueBuilder
├── LeftPanel              — Tool palette + shape presets
├── BuilderCanvas          — HTML5 Canvas renderer (all drawing)
├── SectionContextToolbar  — Floating toolbar above selected section
├── RowManagerPanel        — Right panel: row/seat management
├── SectionPropertiesPanel — Right panel: section properties editor
├── AdvancedToolsPanel     — Slide-in: grid generator, templates, CSV import/export, validation
├── LayerPanel             — Layer visibility/lock controls
└── GenerateDialogs        — Ring / Arc / Block generation dialogs
```

### `useBuilderEngine` (`useBuilderEngine.ts`)
The single source of truth for all builder state. ~1650 lines. Key responsibilities:

- **Layout state** — `layout: LayoutState` (shapes, rows, seats, texts) with `layoutRef` for hot-path access
- **Camera** — pan/zoom with `w2s` / `s2w` coordinate transforms
- **Tool system** — 20+ tools: `select`, `seatselect`, `section`, `rect`, `row`, `multirow`, `arcrow`, `block`, `text`, `pan`, and shape presets
- **Hit testing** — polygon point-in-test for sections, radius test for seats
- **Drag system** — move shapes, drag vertices, bbox resize handles, rotation handle, arc row handles
- **History** — 80-snapshot undo/redo stack
- **Commit** — all mutations go through `commit(nextLayout, label)` which updates both `layoutRef` (sync) and `setLayout` (React state)

Key exported functions:

| Function | Description |
|---|---|
| `updateShape(u, shapeId?)` | Patch a section's fields. Accepts optional `shapeId` to work outside selection context |
| `updateSeat(u)` | Patch the selected seat |
| `updateRow(rowId, u)` | Patch a row (label, category, curve, price override, etc.) |
| `addRow(sectionId)` | Add a new row to a section |
| `deleteRow(rowId)` | Remove a row and its seats |
| `fillSection(sectionId)` | Auto-fill a section with a seat grid |
| `addCurvedRows(sectionId, ...)` | Generate arc-curved rows |
| `splitSection(sectionId)` | Split a section into two halves |
| `mergeSections(ids)` | Merge multiple sections into one |
| `distributeSeats(axis)` | Evenly space selected seats horizontally or vertically |
| `setSpacing(gap, axis)` | Set exact pixel spacing between selected seats |
| `rotateSelected(deg)` | Rotate selected shapes/seats |
| `autoBalance(sectionId)` | Redistribute rows evenly within section bounds |
| `exportLayout()` | Download layout as GeoJSON |
| `undo()` / `redo()` | History navigation |
| `zoomIn/Out/Reset/Fit()` | Camera controls |

### `BuilderCanvas` (`BuilderCanvas.tsx`)
Pure canvas renderer (~1337 lines). Receives layout + camera as props, redraws on every change. Renders:
- Section polygons with category-based fill/stroke colours (TickPick style)
- Section labels (large grey number) + price badge pill
- Row bands (arc or straight)
- Individual seat circles with status colours
- Selection highlight (blue glow)
- Draw preview (ghost polygon/line while drawing)
- Bbox resize handles and rotation handle for selected shapes
- Arc row endpoint handles

Coordinate helpers exported for use in other components:
```ts
w2s(wx, wy, camera, W, H) → [screenX, screenY]  // world → screen
s2w(sx, sy, camera, W, H) → [worldX, worldY]     // screen → world
```

### `SectionPropertiesPanel` (`SectionPropertiesPanel.tsx`)
Fully controlled component — all values read from `shape` prop, all changes call `onUpdate`. Fields:

| Field | Stored on `BShape` | Description |
|---|---|---|
| Label | `label` | Section display name |
| Category | `category` | VIP / PREMIUM / STANDARD / BUDGET / GA |
| Scale | `scale` | Visual scale factor (0.1–3.0) |
| Label visible | `labelVisible` | Show/hide canvas label |
| Font size | `labelFontSize` | Label font size in pt |
| Rotation | `rotation` | Rotation in degrees |
| Position X/Y | `cx`, `cy` + `vertices` | Moves centroid AND all vertices |
| Capacity | `capacity` | Max capacity (informational) |
| Seating layout | `seatingLayout` | circular / rectangular |
| Notes | `notes` | Free-text notes |
| Level | `level` | 100 / 200 / 300 / SUITE / CLUB |
| Accessible | `isAccessible` | ADA flag |
| Obstructed | `isObstructed` | Obstructed view flag |

### `AdvancedToolsPanel` (`AdvancedToolsPanel.tsx`)
Slide-in panel with four tabs:

- **Tools** — Section split/merge, rotation, aisle insertion, density controls, auto-balance
- **Grid** — Seat grid generator: rows × seats, curve radius, aisle placement, numbering scheme
- **I/O** — CSV import (10,000+ seats), GeoJSON export, venue clone
- **Validate** — Overlap detection, spacing validation (8-unit minimum), duplicate ID check, ADA warnings (1% requirement), pricing variance alerts

### `RowManagerPanel` (`RowManagerPanel.tsx`)
Manages rows within the selected section:
- Add / delete / duplicate rows
- Edit row label, category, price override, curve radius
- Split a row at a selected seat
- Clear / restore row seats
- Add curved rows with configurable parameters
- Per-seat strip view with status indicators

### Type Definitions (`builderTypes2.ts`)

```ts
interface BShape {
  id, type, label, category, color
  vertices: [number, number][]
  cx, cy                          // centroid
  level?, curveRadius?, photoUrl?
  isAccessible?, isObstructed?
  displayMode?                    // 'rows' | 'seats' | 'both'
  // Properties panel fields:
  notes?, capacity?, seatingLayout?
  labelVisible?, labelFontSize?
  rotation?, scale?
}

interface BRow {
  id, sectionId, label, category
  seats: BSeat[]
  curveRadius?, curveCenter?, curveA0?, curveA1?
  priceOverride?
}

interface BSeat {
  id, rowId, sectionId
  number, label, x, y, price
  status: 'available' | 'sold' | 'locked' | 'obstructed'
  category, color?
  isAccessible?, isCompanion?, isObstructed?, isVIP?, aisleGap?
}

interface LayoutState {
  shapes: BShape[]
  rows: BRow[]
  seats: BSeat[]
  texts: BText[]
}
```

---

## 9. Services

### Lock Service (`lockService.ts`)

Uses Redis `SETNX` for atomic lock acquisition. Lock value is `{ userId, expiresAt }` JSON.

```
Key pattern:  seat:lock:{seat_id}
TTL:          600 seconds (10 minutes)
```

- **Re-lock own seat** — If the same user tries to lock a seat they already hold, the TTL is extended.
- **Bulk status** — Uses Redis pipeline to check N seats in a single round-trip.
- **Disconnect cleanup** — `unlockAllByUser(userId)` scans `seat:lock:*` keys and deletes all owned by the user.

### Pricing Service (`pricingService.ts`)

Computes dynamic price from three factors:

```
effectivePrice = basePrice × demandFactor × timeFactor
```

- **demandFactor** — scales from 1.0 (0% sold) to `demand_multiplier` (100% sold)
- **timeFactor** — `rule.time_factor × 1.5` in last 7 days, `× 1.2` in last 30 days, `× 1.0` otherwise
- Result is clamped to `[min_price, max_price]`
- Cached in Redis for 30 seconds per section

**Demand levels:**

| Sold ratio | Level |
|---|---|
| < 30% | LOW |
| 30–60% | MEDIUM |
| 60–85% | HIGH |
| > 85% | SURGE |

**Price badges:**
- `Amazing Deal` — effective price ≤ 80% of base
- `Great Value` — effective price ≤ 105% of base

### GeoJSON Service (`geojsonService.ts`)

- `deriveLayoutGeoJSON(layoutId)` — builds a `FeatureCollection` from all sections in a layout. Cached in Redis for 5 minutes.
- `deriveSeatGeoJSON(sectionId)` — builds a `FeatureCollection` of seat `Point` features. Cached in Redis.
- `invalidateGeoJSONCache(layoutId)` / `invalidateSeatGeoJSONCache(sectionId)` — called after mutations.

---

## 10. State Management

### Builder State
All builder state lives in `useBuilderEngine`. No external state library. Uses:
- `useRef` for hot-path data (camera, layout, selection, tool) — avoids re-renders during pointer events
- `useState` for UI-reactive data (layout copy, selectedIds, camera copy, preview) — triggers canvas redraws
- `useCallback` with explicit deps for all mutations

### Cart State
`CartContext` uses `useReducer`. Persists only in memory (no localStorage). Cart is cleared on page reload.

### Socket State
`SocketContext` manages a single Socket.IO connection per session. Event subscriptions return cleanup functions for use in `useEffect`.

---

## 11. Data Flow

### Seat Selection (Booking)

```
User clicks seat on map
  → StadiumMap onClick
  → POST /api/lock-seat  (Redis SETNX)
  → Server emits seat_locked to section room
  → Other clients receive seat_locked → mark seat grey
  → CartContext.addSeat()
  → BookingSidebar shows seat in cart
```

### Purchase

```
User clicks "Buy Now"
  → POST /api/purchase
  → Prisma transaction: seats → SOLD, Order created
  → Redis: pricing + GeoJSON caches invalidated
  → Server emits bulk_seat_update (broadcast)
  → All clients update seat colours to sold
```

### Admin Save

```
User clicks Export in VenueBuilder
  → exportLayout() in useBuilderEngine
  → Downloads GeoJSON file
  → (Optional) POST /api/layout to persist to DB
```

### Real-time Section Stats

```
Any seat action (lock/unlock/purchase)
  → scheduleSectionUpdate(sectionId)
  → Batched every 2s
  → section_update emitted to section:{id} room
  → Clients in that room update available count + price display
```

---

## 12. Environment Variables

Create `.env.local` in the project root:

```env
# Mapbox (required for 3D map; fallback to Konva if missing)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here

# Database
DATABASE_URL="postgresql://ticketing:ticketing123@localhost:5432/ticketing"

# Redis
REDIS_URL="redis://localhost:6379"

# Socket.IO server URL (consumed by frontend)
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000

# App URL (consumed by backend CORS)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Backend port (default: 4000)
BACKEND_PORT=4000
```

---

## 13. Scripts & Commands

```bash
# Install dependencies
npm install

# Development (Next.js + Express concurrently)
npm run dev

# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend

# Start PostgreSQL + Redis via Docker
npm run db:up

# Generate Prisma client
npm run db:generate

# Apply DB migrations
npm run db:migrate

# Seed MetLife Stadium data
npm run db:seed

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

### Docker (Infrastructure only)
The `npm run db:up` command starts PostgreSQL and Redis via Docker Compose. The Next.js and Express servers run directly on the host with `npm run dev`.

```yaml
# docker-compose.yml (inferred)
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: ticketing
      POSTGRES_PASSWORD: ticketing123
      POSTGRES_DB: ticketing
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

---

*Last updated: May 2026*

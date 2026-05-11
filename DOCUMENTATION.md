# TicketFlow — Project Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [Backend Services](#7-backend-services)
8. [Frontend Components](#8-frontend-components)
9. [Real-Time System](#9-real-time-system)
10. [Admin Builder](#10-admin-builder)
11. [Environment & Configuration](#11-environment--configuration)
12. [Setup & Running](#12-setup--running)
13. [Scripts & Commands](#13-scripts--commands)

---

## 1. Project Overview

TicketFlow is a production-grade event ticketing platform inspired by StubHub/TickPick. It provides:

- A **user-facing booking experience** with a 3D Mapbox stadium map and real-time seat availability.
- An **admin layout builder** for creating and managing venue seating layouts with professional-grade tools.
- A **real-time backend** using Socket.IO and Redis to prevent double-booking.
- A **dynamic pricing engine** that adjusts seat prices based on demand and time-to-event.

The app runs two concurrent servers:

- **Next.js 16** (port 3000) — frontend + Next.js API routes (proxy layer)
- **Express + Socket.IO** (port 4000) — stateful backend for seat locking, WebSocket events, and DB writes

---

## 2. Tech Stack

| Layer               | Technology                            |
| ------------------- | ------------------------------------- |
| Frontend Framework  | Next.js 16.2.4 (App Router), React 19 |
| Language            | TypeScript 5                          |
| Styling             | Tailwind CSS 4, custom CSS            |
| 3D Map              | Mapbox GL JS 3.x                      |
| 2D Canvas (Booking) | Konva / react-konva                   |
| 3D Viewer           | Three.js                              |
| State Management    | Zustand 5                             |
| Animation           | Framer Motion 12                      |
| Backend             | Express 5, Node.js                    |
| WebSockets          | Socket.IO 4                           |
| Database            | PostgreSQL 15 (via Prisma 7)          |
| Cache / Locks       | Redis 7 (ioredis)                     |
| ORM                 | Prisma 7                              |
| Drag & Drop         | @dnd-kit                              |
| Rich Text           | Tiptap 3                              |
| Icons               | Lucide React                          |
| Dev Tools           | nodemon, ts-node, concurrently        |
| Containerization    | Docker Compose                        |

---

## 3. Architecture

```
Browser
  │
  ├── Next.js (port 3000)
  │     ├── /           → Booking page (StadiumMap + BookingSidebar)
  │     ├── /booking    → Konva-based booking view
  │     ├── /admin      → Admin Layout Builder
  │     └── /api/*      → Proxy routes → Express backend
  │
  └── Socket.IO client  ──────────────────────────────────┐
                                                           │
Express Server (port 4000)                                 │
  ├── REST API routes                                      │
  │     ├── /api/seats          → Seat queries             │
  │     ├── /api/lock-seat      → Redis SETNX lock         │
  │     ├── /api/unlock-seat    → Redis DEL unlock         │
  │     ├── /api/purchase       → Mark seats SOLD in DB    │
  │     ├── /api/sections       → Section CRUD             │
  │     ├── /api/layout         → Layout save/load         │
  │     └── /api/geojson/:id    → Derived GeoJSON          │
  │                                                        │
  ├── Socket.IO server  ◄──────────────────────────────────┘
  │     ├── seat_locked / seat_unlocked / seat_sold events
  │     ├── section_update (batched every 2s)
  │     └── bulk_seat_update (on disconnect cleanup)
  │
  ├── Redis
  │     ├── Seat locks (seat:lock:<id>, TTL 10 min)
  │     ├── GeoJSON cache (geojson:<layoutId>, TTL 5 min)
  │     └── Pricing cache (pricing:<sectionId>, TTL 30s)
  │
  └── PostgreSQL (via Prisma)
        ├── Event, Layout, Section, Seat
        ├── PricingRule, Order
        └── Enums: SeatStatus, SeatCategory, OrderStatus
```

### Key Design Decisions

- **GeoJSON is never stored as a blob.** It is derived from Section + Seat rows and cached in Redis (5 min TTL). This keeps the DB normalized and GeoJSON always consistent.
- **Redis is the source of truth for locks.** The DB is only written when a seat is permanently SOLD. This avoids DB contention under high concurrency.
- **Next.js API routes are thin proxies.** They forward requests to the Express backend and include demo-mode fallbacks so the UI works without a running backend.
- **Socket.IO uses room-based subscriptions.** Clients join `section:<id>` rooms so they only receive events relevant to the section they are viewing.

---

## 4. Project Structure

```
booking_clone/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout (CartProvider, SocketProvider)
│   │   ├── page.tsx                # Home page → StadiumMap booking UI
│   │   ├── globals.css             # Global styles
│   │   ├── admin/
│   │   │   ├── layout.tsx          # Admin layout wrapper
│   │   │   └── page.tsx            # Admin page → VenueBuilder
│   │   ├── booking/
│   │   │   ├── page.tsx            # Booking page
│   │   │   └── BookingShell.tsx    # Booking shell with Konva stadium
│   │   └── api/
│   │       ├── health/route.ts     # GET /api/health
│   │       ├── lock-seat/route.ts  # POST /api/lock-seat
│   │       ├── unlock-seat/route.ts# POST /api/unlock-seat
│   │       ├── purchase/route.ts   # POST /api/purchase
│   │       ├── layout/route.ts     # POST /api/layout
│   │       ├── seats/geojson/      # GET /api/seats/geojson
│   │       └── geojson/[layoutId]/ # GET /api/geojson/:layoutId
│   │
│   ├── components/
│   │   ├── StadiumMap/
│   │   │   ├── StadiumMap.tsx      # Mapbox GL 3D map with seat layers
│   │   │   └── SectionTooltip.tsx  # Hover tooltip for sections
│   │   ├── Sidebar/
│   │   │   └── BookingSidebar.tsx  # Cart + seat selection sidebar
│   │   ├── KonvaBooking/
│   │   │   ├── KonvaStadium.tsx    # Konva 2D stadium canvas
│   │   │   ├── BookingPanel.tsx    # Booking panel UI
│   │   │   ├── stadiumData.ts      # Static stadium geometry data
│   │   │   └── index.tsx           # StadiumBooking export
│   │   ├── ThreeViewer/
│   │   │   ├── ThreeViewer.tsx     # Three.js 3D venue viewer
│   │   │   ├── StadiumViewer.tsx   # Stadium-specific Three.js scene
│   │   │   └── ViewerSidebar.tsx   # Viewer controls sidebar
│   │   └── Admin/
│   │       ├── VenueBuilder.tsx         # Main admin builder UI
│   │       ├── BuilderCanvas.tsx        # Canvas rendering engine
│   │       ├── useBuilderEngine.ts      # Core builder state & logic hook
│   │       ├── AdvancedToolsPanel.tsx   # Grid gen, templates, I/O, validation
│   │       ├── PropertiesPanel.tsx      # Section/seat property editor
│   │       ├── EnhancedPropertiesPanel.tsx # Extended metadata editor
│   │       ├── LeftPanel.tsx            # Shape/section palette
│   │       ├── LayerPanel.tsx           # Layer visibility controls
│   │       ├── Toolbar.tsx              # Top toolbar
│   │       ├── ValidationPanel.tsx      # Validation results display
│   │       ├── VersionHistory.tsx       # Undo/redo history
│   │       ├── GenerateDialogs.tsx      # Seat generation dialogs
│   │       ├── advancedTools.ts         # Algorithms: grid gen, validation, I/O
│   │       ├── builderTypes.ts          # Base type definitions
│   │       ├── builderTypes2.ts         # Extended types + geometry helpers
│   │       ├── types.ts                 # Shared admin types
│   │       ├── BuilderIcons.tsx         # Icon components
│   │       ├── BuilderPanels.tsx        # Panel wrappers
│   │       ├── EmptyState.tsx           # Empty canvas state
│   │       ├── KonvaEditor.tsx          # Konva-based editor
│   │       ├── ProBuilder.tsx           # Pro builder variant
│   │       ├── StadiumAdminBuilder.tsx  # Stadium admin builder
│   │       ├── StadiumAdminBuilderV2.tsx# V2 stadium admin builder
│   │       ├── ThreeAdminBuilder.tsx    # Three.js admin builder
│   │       └── theme.css               # Admin UI theme
│   │
│   ├── context/
│   │   ├── CartContext.tsx         # Shopping cart state (useReducer)
│   │   └── SocketContext.tsx       # Socket.IO connection context
│   │
│   ├── store/
│   │   └── viewerStore.ts          # Zustand store for 3D viewer state
│   │
│   ├── data/
│   │   ├── stadiumGeometry.ts      # Geometry generation (polar → lat/lng)
│   │   ├── stadiumEngine.ts        # Section/seat arc geometry engine
│   │   └── mockLayout.ts           # Mock layout data for demo mode
│   │
│   └── server/
│       ├── index.ts                # Express app entry point (port 4000)
│       ├── websocket.ts            # Socket.IO server setup
│       ├── lib/
│       │   ├── prisma.ts           # Prisma client singleton
│       │   └── redis.ts            # ioredis client singleton
│       ├── routes/
│       │   ├── seats.ts            # GET /api/seats
│       │   ├── seatActions.ts      # POST lock/unlock/purchase
│       │   ├── sections.ts         # Section CRUD + GeoJSON
│       │   └── layout.ts           # Layout save/load
│       └── services/
│           ├── lockService.ts      # Redis seat locking logic
│           ├── pricingService.ts   # Dynamic pricing engine
│           └── geojsonService.ts   # GeoJSON derivation + caching
│
├── prisma/
│   ├── schema.prisma               # DB schema
│   └── seed.ts                     # MetLife Stadium seed data
│
├── scripts/
│   └── migrate-advanced-features.sh
│
├── public/                         # Static assets
├── docker-compose.yml              # PostgreSQL + Redis containers
├── next.config.js                  # Next.js config
├── tsconfig.json                   # Frontend TypeScript config
├── tsconfig.server.json            # Backend TypeScript config
└── package.json
```

---

## 5. Database Schema

### Models

#### Event

Represents a ticketed event (concert, game, etc.).

| Field    | Type          | Description           |
| -------- | ------------- | --------------------- |
| id       | String (UUID) | Primary key           |
| name     | String        | Event name            |
| date     | DateTime      | Event date/time       |
| venue    | String        | Venue name            |
| city     | String        | City                  |
| imageUrl | String?       | Optional banner image |
| layouts  | Layout[]      | Associated layouts    |

#### Layout

A versioned seating layout for an event. Only one layout is active at a time.

| Field    | Type          | Description                       |
| -------- | ------------- | --------------------------------- |
| id       | String (UUID) | Primary key                       |
| eventId  | String        | FK → Event                        |
| version  | Int           | Version number (unique per event) |
| name     | String        | Layout name                       |
| isActive | Boolean       | Whether this is the live layout   |
| sections | Section[]     | Sections in this layout           |

#### Section

A named seating area (e.g., "Section 101", "Floor GA").

| Field             | Type          | Description                                         |
| ----------------- | ------------- | --------------------------------------------------- |
| id                | String (UUID) | Primary key                                         |
| layoutId          | String        | FK → Layout                                         |
| section_id        | String        | Human-readable unique ID (e.g., "101")              |
| label             | String        | Display label                                       |
| category          | SeatCategory  | FIELD / PLATINUM / GOLD / SILVER / BRONZE / GENERAL |
| color             | String        | Hex color for map rendering                         |
| geometry          | Json          | GeoJSON Polygon defining section boundary           |
| centerX / centerY | Float         | Center coordinates for price markers                |
| level             | String?       | Venue level: 100 / 200 / 300 / SUITE / CLUB         |
| curveRadius       | Float?        | Curve radius for arc sections                       |
| photoUrl          | String?       | Seat view photo URL                                 |
| isAccessible      | Boolean       | ADA accessible section                              |
| isObstructed      | Boolean       | Obstructed view section                             |

#### Seat

An individual seat within a section.

| Field        | Type          | Description                            |
| ------------ | ------------- | -------------------------------------- |
| id           | String (UUID) | Primary key                            |
| seat_id      | String        | Unique ID (e.g., "A101-R1-S1")         |
| sectionId    | String        | FK → Section                           |
| row          | String        | Row label (A, B, C…)                   |
| number       | Int           | Seat number within row                 |
| x / y        | Float         | Canvas coordinates                     |
| lng / lat    | Float         | Mapbox coordinates                     |
| geometry     | Json?         | Optional GeoJSON Point                 |
| price        | Decimal       | Current price                          |
| status       | SeatStatus    | AVAILABLE / LOCKED / SOLD / OBSTRUCTED |
| isAccessible | Boolean       | Wheelchair accessible                  |
| isCompanion  | Boolean       | Companion seat                         |
| isObstructed | Boolean       | Obstructed view                        |
| isVIP        | Boolean       | VIP seat                               |
| aisleGap     | Boolean       | Aisle seat                             |

#### PricingRule

Dynamic pricing configuration per section.

| Field                 | Type    | Description                     |
| --------------------- | ------- | ------------------------------- |
| sectionId             | String  | FK → Section (unique)           |
| base_price            | Decimal | Base price                      |
| demand_multiplier     | Float   | 1.0–3.0, scales with sold ratio |
| time_factor           | Float   | Increases near event date       |
| min_price / max_price | Decimal | Price floor and ceiling         |

#### Order

A completed purchase.

| Field   | Type        | Description                     |
| ------- | ----------- | ------------------------------- |
| userId  | String      | Buyer identifier                |
| seatIds | Json        | Array of seat_id strings        |
| total   | Decimal     | Total amount charged            |
| status  | OrderStatus | PENDING / CONFIRMED / CANCELLED |

### Enums

```
SeatStatus:   AVAILABLE | LOCKED | SOLD | OBSTRUCTED
SeatCategory: FIELD | PLATINUM | GOLD | SILVER | BRONZE | GENERAL
OrderStatus:  PENDING | CONFIRMED | CANCELLED
```

---

## 6. API Reference

All Next.js API routes at `/api/*` are thin proxies to the Express backend at `http://localhost:4000`. They include demo-mode fallbacks so the UI works without a running backend.

### GET /api/health

Returns server status.

**Response:**

```json
{ "status": "ok", "timestamp": "2026-05-08T10:00:00.000Z" }
```

Demo fallback: `{ "status": "ok", "demo": true }`

---

### POST /api/lock-seat

Atomically locks a seat for a user using Redis SETNX. Lock TTL is 10 minutes.

**Request body:**

```json
{ "seat_id": "A101-R1-S1", "user_id": "user_abc" }
```

**Response (success):**

```json
{ "success": true, "seat_id": "A101-R1-S1", "expires_at": 1715161200000 }
```

**Response (already locked):**

```json
{
  "success": false,
  "error": "Seat is locked by another user",
  "expires_at": 1715161200000
}
```

---

### POST /api/unlock-seat

Releases a seat lock. Only the lock owner can release.

**Request body:**

```json
{ "seat_id": "A101-R1-S1", "user_id": "user_abc" }
```

**Response:**

```json
{ "success": true }
```

---

### POST /api/purchase

Marks seats as SOLD in the database and creates an Order record.

**Request body:**

```json
{ "seat_ids": ["A101-R1-S1", "A101-R1-S2"], "user_id": "user_abc" }
```

**Response:**

```json
{ "success": true, "order_total": 300, "seat_count": 2 }
```

---

### GET /api/geojson/[layoutId]

Returns a GeoJSON FeatureCollection of all sections in a layout. Cached in Redis for 5 minutes.

**Response:**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "101",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "properties": {
        "section_id": "101",
        "label": "Section 101",
        "category": "GOLD",
        "color": "#FFD700",
        "seatCount": 80,
        "availableCount": 62,
        "soldCount": 15,
        "lockedCount": 3,
        "height": 16,
        "centerLng": -74.0745,
        "centerLat": 40.8135
      }
    }
  ]
}
```

---

### GET /api/seats/geojson

Returns a GeoJSON FeatureCollection of seats for a section. Cached in Redis for 60 seconds.

**Query params:** `?sectionId=<id>`

---

### POST /api/layout

Saves a layout (sections + seats) to the database.

---

## 7. Backend Services

### Lock Service (`src/server/services/lockService.ts`)

Manages seat reservations using Redis as the sole source of truth.

| Function                           | Description                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `lockSeat(seatId, userId)`         | Atomic SETNX lock. Re-extends own lock if already held. Returns `LockResult`.           |
| `unlockSeat(seatId, userId)`       | Deletes lock key. Only the owner can unlock.                                            |
| `getSeatLockStatus(seatId)`        | Returns `{ locked, userId, expiresAt }`.                                                |
| `getBulkSeatLockStatus(seatIds[])` | Pipeline-based bulk status check. Returns a `Map`.                                      |
| `unlockAllByUser(userId)`          | Scans all lock keys and releases all locks held by a user. Called on socket disconnect. |

Redis key format: `seat:lock:<seat_id>` with 10-minute TTL.

---

### Pricing Service (`src/server/services/pricingService.ts`)

Computes real-time prices based on demand and time-to-event.

**Formula:**

```
effectivePrice = clamp(
  basePrice × demandFactor × timeFactor,
  minPrice,
  maxPrice
)

demandFactor = 1 + soldRatio × (demand_multiplier - 1)
timeFactor   = time_factor × 1.5  (if < 7 days to event)
             = time_factor × 1.2  (if < 30 days to event)
             = time_factor        (otherwise)
```

**Demand levels:**

- `LOW` — < 30% sold
- `MEDIUM` — 30–60% sold
- `HIGH` — 60–85% sold
- `SURGE` — > 85% sold

**Badges:** `Amazing Deal` (≤80% of base), `Great Value` (≤105% of base)

Results are cached in Redis for 30 seconds per section.

---

### GeoJSON Service (`src/server/services/geojsonService.ts`)

Derives GeoJSON from normalized DB data. Never stores GeoJSON blobs.

| Function                                | Cache TTL  | Description                               |
| --------------------------------------- | ---------- | ----------------------------------------- |
| `deriveLayoutGeoJSON(layoutId)`         | 5 minutes  | Full FeatureCollection for all sections   |
| `deriveSeatGeoJSON(sectionId)`          | 60 seconds | Point features for all seats in a section |
| `invalidateGeoJSONCache(layoutId)`      | —          | Clears layout cache on update             |
| `invalidateSeatGeoJSONCache(sectionId)` | —          | Clears seat cache on update               |

Section heights for 3D extrusion: FIELD=25, PLATINUM=20, GOLD=16, SILVER=12, BRONZE=8, GENERAL=5.

---

## 8. Frontend Components

### StadiumMap (`src/components/StadiumMap/StadiumMap.tsx`)

The main booking map using Mapbox GL JS.

- Renders sections as extruded 3D polygons (height based on category).
- Adds a WebGL seat layer for individual seat dots (single draw call for 5000+ seats).
- Shows floating price markers at section centers.
- Falls back to mock geometry if no backend is available.
- Listens to Socket.IO events to update seat colors in real time.

Key functions:

- `addSectionLayers()` — adds fill-extrusion layer for sections
- `addSeatLayer()` — adds circle layer for individual seats
- `updatePriceMarkers()` — updates floating price pins
- `loadFallbackGeometry()` — loads mock GeoJSON for demo mode

---

### KonvaStadium (`src/components/KonvaBooking/KonvaStadium.tsx`)

A 2D Konva canvas rendering of the stadium for the `/booking` route.

- Draws sections as arc polygons.
- Renders individual seats as colored circles.
- Handles seat selection, hover tooltips, and zoom/pan.
- Integrates with CartContext for seat selection state.

---

### BookingSidebar (`src/components/Sidebar/BookingSidebar.tsx`)

Right-side panel showing:

- Selected seats list with prices
- Cart total
- Checkout button (calls `/api/purchase`)
- Lock status indicators

---

### CartContext (`src/context/CartContext.tsx`)

Global cart state using `useReducer`. Actions: `ADD_SEAT`, `REMOVE_SEAT`, `CLEAR_CART`.

---

### SocketContext (`src/context/SocketContext.tsx`)

Manages the Socket.IO client connection. Provides `useSocket()` hook. Handles:

- Connection with `userId` auth
- Auto-reconnect
- Joining/leaving section rooms

---

### ThreeViewer (`src/components/ThreeViewer/ThreeViewer.tsx`)

Three.js 3D venue viewer for previewing layouts. Renders sections as extruded meshes with label sprites.

---

## 9. Real-Time System

The WebSocket server uses Socket.IO with room-based subscriptions.

### Rooms

- `section:<sectionId>` — clients join when viewing a section

### Events (server → client)

| Event              | Payload                                                | Description                              |
| ------------------ | ------------------------------------------------------ | ---------------------------------------- |
| `seat_locked`      | `{ seat_id, user_id, expires_at }`                     | A seat was just locked                   |
| `seat_unlocked`    | `{ seat_id }`                                          | A seat lock was released                 |
| `seat_sold`        | `{ seat_id, section_id }`                              | A seat was purchased                     |
| `section_update`   | `{ section_id, available_count, locked_count, price }` | Batched section stats (every 2s)         |
| `bulk_seat_update` | `{ seats: [{ seat_id, status }] }`                     | Bulk status change (e.g., on disconnect) |
| `heartbeat`        | `{ ts }`                                               | Keep-alive ping every 30s                |

### Events (client → server)

| Event           | Payload     | Description                      |
| --------------- | ----------- | -------------------------------- |
| `join_section`  | `sectionId` | Subscribe to section updates     |
| `leave_section` | `sectionId` | Unsubscribe from section updates |

### Disconnect Handling

On client disconnect, `unlockAllByUser(userId)` is called to release all locks held by that user. A `bulk_seat_update` is broadcast to all clients marking those seats as `AVAILABLE`.

---

## 10. Admin Builder

The admin builder at `/admin` is a full venue layout editor.

### Main Components

**VenueBuilder** (`VenueBuilder.tsx`) — Top-level orchestrator. Manages layout state, section/seat selection, and coordinates all sub-panels.

**BuilderCanvas** (`BuilderCanvas.tsx`) — The main canvas (HTML Canvas 2D). Handles:

- Rendering sections, seats, selection handles
- Mouse events: pan, zoom, drag, select, draw
- World ↔ screen coordinate transforms (`s2w`, `w2s`)
- Snap-to-grid

**useBuilderEngine** (`useBuilderEngine.ts`) — Core state hook (~816 lines). Manages:

- Section and seat CRUD
- Undo/redo history
- Selection state
- Convex hull computation
- Snap logic

**AdvancedToolsPanel** (`AdvancedToolsPanel.tsx`) — Four tabs:

| Tab       | Features                                                                             |
| --------- | ------------------------------------------------------------------------------------ |
| Grid      | Generate seat grids: rows × seats, curve radius, aisle placement, numbering schemes  |
| Templates | 5 section shapes: Rectangle, Trapezoid, Arc, Corner, Suite Box                       |
| I/O       | CSV import (10,000+ seats), GeoJSON export, venue clone                              |
| Validate  | Overlap detection, spacing validation, duplicate IDs, ADA warnings, pricing variance |

**advancedTools.ts** — Core algorithms:

| Function                       | Description                                                  |
| ------------------------------ | ------------------------------------------------------------ |
| `generateSeatGrid(config)`     | Generates a grid of seats with optional curve and aisle gaps |
| `applyTemplate(type, section)` | Applies a shape template to a section                        |
| `validateLayout(sections)`     | Runs all validation checks, returns warnings array           |
| `polygonsOverlap(a, b)`        | SAT-based polygon overlap detection                          |
| `importFromCSV(text)`          | Parses CSV into seat objects                                 |
| `exportToGeoJSON(sections)`    | Serializes layout to GeoJSON                                 |
| `exportToCSV(sections)`        | Serializes seats to CSV                                      |

### CSV Import Format

```csv
section_id,row,seat,x,y,price,category
101,A,1,120.5,80.3,250,PREMIUM
101,A,2,128.5,80.3,250,PREMIUM
```

### Validation Rules

- Overlap detection between sections (polygon intersection)
- Minimum seat spacing: 8 units
- Duplicate seat ID check
- ADA requirement: ≥1% of seats must be accessible
- Pricing variance alert: sections with >3× price difference

### Performance Benchmarks

| Operation            | Scale        | Time |
| -------------------- | ------------ | ---- |
| Seat grid generation | 500 seats    | < 1s |
| CSV import           | 10,000 seats | ~2s  |
| Validation           | 20,000 seats | ~3s  |
| GeoJSON export       | 20,000 seats | ~1s  |

---

## 11. Environment & Configuration

### `.env.local` (frontend + backend)

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token_here
DATABASE_URL="postgresql://ticketing:ticketing123@localhost:5432/ticketing"
REDIS_URL="redis://localhost:6379"
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_PORT=4000
```

### `next.config.js`

- Sets CORS headers for API routes
- Allows cross-origin requests from the Express backend

### `tsconfig.json` vs `tsconfig.server.json`

- `tsconfig.json` — Next.js frontend (targets ES2017, includes `src/`)
- `tsconfig.server.json` — Express backend (CommonJS output, targets `src/server/`)

### Docker Compose Services

| Service  | Image              | Port | Purpose                                 |
| -------- | ------------------ | ---- | --------------------------------------- |
| postgres | postgres:15-alpine | 5432 | Primary database                        |
| redis    | redis:7-alpine     | 6379 | Locks + cache (keyspace events enabled) |

---

## 12. Setup & Running

### Quick Start (Demo Mode — no Docker needed)

```bash
npm install
npm run dev
```

- Booking UI: http://localhost:3000
- Admin Builder: http://localhost:3000/admin

The app runs in demo mode with mock data and fallback API responses when the backend is unavailable.

### Full Stack Setup

**1. Start infrastructure:**

```bash
npm run db:up          # Starts PostgreSQL + Redis via Docker
```

**2. Initialize database:**

```bash
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Apply schema migrations
npm run db:seed        # Seed MetLife Stadium (34 sections, 2500+ seats)
```

**3. Run full stack:**

```bash
npm run dev            # Starts Next.js (3000) + Express (4000) concurrently
```

### Production Build

```bash
npm run build          # Generates Prisma client + Next.js build
npm run start          # Starts Next.js production server
```

---

## 13. Scripts & Commands

| Command                                | Description                                           |
| -------------------------------------- | ----------------------------------------------------- |
| `npm run dev`                          | Start Next.js + Express concurrently (development)    |
| `npm run dev:frontend`                 | Start Next.js only                                    |
| `npm run dev:backend`                  | Start Express + Socket.IO only (with nodemon)         |
| `npm run build`                        | Generate Prisma client + build Next.js                |
| `npm run start`                        | Start Next.js production server                       |
| `npm run lint`                         | Run ESLint                                            |
| `npm run db:up`                        | Start PostgreSQL + Redis via Docker Compose           |
| `npm run db:generate`                  | Generate Prisma client from schema                    |
| `npm run db:migrate`                   | Run Prisma migrations                                 |
| `npm run db:seed`                      | Seed database with MetLife Stadium data               |
| `scripts/migrate-advanced-features.sh` | Shell script for applying advanced metadata migration |

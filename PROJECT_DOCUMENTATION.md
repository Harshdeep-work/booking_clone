# 🏟️ TicketFlow — Comprehensive Technical Documentation

TicketFlow is a high-performance, production-grade event ticketing platform and venue management system. Inspired by elite industry platforms like StubHub and TickPick, TicketFlow delivers a high-fidelity 3D seating Mapbox experience for customers alongside a feature-rich, high-performance HTML5 Canvas seating layout designer for admins.

---

## 🗺️ Table of Contents

1. [Executive Summary & Tech Stack](#1-executive-summary--tech-stack)
2. [System Architecture](#2-system-architecture)
3. [Database Schema & Models](#3-database-schema--models)
4. [Real-time WebSocket Coordination](#4-real-time-websocket-coordination)
5. [REST API Endpoint Reference](#5-rest-api-endpoint-reference)
6. [Frontend Client Architecture](#6-frontend-client-architecture)
7. [Advanced Admin Layout Builder](#7-advanced-admin-layout-builder)
8. [Core Algorithms & Backend Services](#8-core-algorithms--backend-services)
9. [Development & Operations Guide](#9-development--operations-guide)

---

## 1. Executive Summary & Tech Stack

TicketFlow solves the classic, high-concurrency seat-booking problem (avoiding double-bookings under heavy load) while giving venue designers elite, CAD-level design tools to craft 20,000+ seat venues in minutes.

### The Stack

```
   ┌──────────────────────────────────────────────────────────┐
   │                       Next.js 16                         │
   │           App Router • React 19 • TypeScript             │
   └────────────────────────────┬─────────────────────────────┘
                                │
                  Proxies /api requests & sockets
                                │
                                ▼
   ┌──────────────────────────────────────────────────────────┐
   │                 Express + Socket.IO                      │
   │               Custom Real-Time Server                    │
   └──────────────┬────────────────────────────┬──────────────┘
                  │                            │
            Reads/Writes                 Acquires Locks
                  │                            │
                  ▼                            ▼
   ┌──────────────────────────┐  ┌────────────────────────────┐
   │        PostgreSQL        │  │       Redis (ioredis)      │
   │      via Prisma ORM      │  │ Dynamic Pricing • Locks    │
   └──────────────────────────┘  └────────────────────────────┘
```

| Layer | Technologies & Libraries | Key Responsibility |
| :--- | :--- | :--- |
| **Frontend UI** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS | Single-page App Shell, state routing, and server proxies. |
| **3D Stadium View** | Mapbox GL JS, Custom WebGL Point Overlay, Framer Motion | High-framerate 3D section views & perspective dynamic price pins. |
| **Admin Canvas** | Vanilla HTML5 Canvas (custom rendering loop), Konva.js | CAD-style designer capable of placing, scaling, and validating 20,000+ seats. |
| **Backend API** | Node.js, Express, Socket.IO, TypeScript | Concurrent request handling, room-based sockets, and locks. |
| **Database & ORM**| PostgreSQL 15, Prisma Client | Permanent event metadata, layouts, orders, and sold seats. |
| **Caching & Locks**| Redis 7 (ioredis client) | 10-minute atomic seat locks (`SETNX`), dynamic pricing caches, GeoJSON cache. |

---

## 2. System Architecture

TicketFlow uses a **microservices-adjacent** hybrid design where the Next.js app handles page rendering and client-side proxies, while a dedicated Node.js/Express server manages WebSockets, Redis, and high-throughput transactional seat operations.

### Data Flow & Component Architecture

```mermaid
graph TD
    %% Clients
    User[Booking Customer] -->|Interacts| MapboxView[Mapbox GL JS 3D Map]
    Admin[Venue Admin] -->|Interacts| CanvasBuilder[HTML5 Canvas Builder]

    %% Next.js Web Server
    MapboxView -->|GraphQL/REST Proxy| NextAPI[Next.js Server /api]
    CanvasBuilder -->|REST Calls| NextAPI

    %% Backend Server
    NextAPI -->|Internal Proxy| ExpressServer[Express + Socket.IO Backend]
    
    %% Realtime Communication
    ExpressServer -->|Socket Events| MapboxView
    ExpressServer -->|Socket Events| CanvasBuilder

    %% Storage & Caching
    ExpressServer -->|Atomic Locks| RedisCache[(Redis Cache & Key-Locks)]
    ExpressServer -->|Prisma Transactions| PostgresDB[(PostgreSQL Database)]

    %% Services
    ExpressServer -->|Compute GeoJSON| GeoJSONServ[GeoJSON Derivation Engine]
    ExpressServer -->|Compute Dynamic Pricing| PriceEngine[Dynamic Pricing Engine]
```

### Key Architectural Decisions

1. **Derived GeoJSON Layer**: To avoid cluttering the relational database with gigantic geometry polygons and GeoJSON coordinates, all spatial structures are dynamically assembled at query time from lightweight mathematical descriptors (`Section.geometry` & seat coordinates), then cached in Redis.
2. **In-Memory Redis Lock Manager**: Seat locking requires sub-millisecond response times. TicketFlow bypasses expensive database row-level locking during the checkout phase by storing active seat locks directly in Redis using atomic transaction commands (`SETNX`).
3. **Tile-Based Bounding-Box (BBox) Section Loading**: Bounding-box parameters (`bbox=west,south,east,north`) are parsed at the section endpoint. This prevents browser crashes by only fetching section shapes visible in the user's current viewport.

---

## 3. Database Schema & Models

The database schema is defined in Prisma and manages event structure, versioned venue layouts, pricing parameters, and transaction records.

```mermaid
erDiagram
    Event ||--o{ Layout : "has versioned"
    Layout ||--o{ Section : "contains"
    Section ||--o{ Seat : "has"
    Section ||--o| PricingRule : "configures"
    Order ||--|{ Seat : "includes sold"

    Event {
        uuid id PK
        string name
        datetime date
        string venue
        string city
        string imageUrl
    }
    Layout {
        uuid id PK
        uuid eventId FK
        int version
        string name
        boolean isActive
    }
    Section {
        uuid id PK
        uuid layoutId FK
        string section_id UK
        string label
        string category
        string color
        json geometry
        float centerX
        float centerY
        string level
        float curveRadius
        string photoUrl
        boolean isAccessible
        boolean isObstructed
    }
    Seat {
        uuid id PK
        string seat_id UK
        uuid sectionId FK
        string row
        int number
        float x
        float y
        float lng
        float lat
        decimal price
        string status
        boolean isAccessible
        boolean isCompanion
        boolean isObstructed
        boolean isVIP
        boolean aisleGap
    }
    PricingRule {
        uuid id PK
        uuid sectionId FK
        decimal base_price
        decimal min_price
        decimal max_price
        float demand_multiplier
        float time_factor
    }
    Order {
        uuid id PK
        string userId
        string[] seatIds
        float total
        string status
    }
```

### Models & Schema Definition

#### `Section` Metadata Fields
The `Section` table includes several advanced properties utilized by both the 3D stadium viewer and the Admin Layout builder:
- **`level`**: Categorizes the seat tier (`100`, `200`, `300`, `SUITE`, `CLUB`).
- **`curveRadius`**: A floating-point number indicating if a section's seat placement has an active circular curvature.
- **`photoUrl`**: Stores real-life stadium seat-view photo links, displayed when a customer clicks a section.
- **`isAccessible` / `isObstructed`**: Flags showing standard ADA and view obstruction status.

#### `Seat` Structural Integrity
Seats are uniquely indexed using `seat_id` (`{section_id}-{row}-{number}`).
- **`status`**: Enum containing `AVAILABLE`, `LOCKED`, `SOLD`, or `OBSTRUCTED`.
- **ADA Features**: Supports `isAccessible` (wheelchair-friendly) and `isCompanion` (adjacent to accessible seats) status.
- **Premium Indicators**: Features `isVIP` (gives special badges) and `aisleGap` (identifies aisle-adjacent seating).

---

## 4. Real-time WebSocket Coordination

Socket.IO acts as the coordination engine across client views. Clients connect to the Socket.IO cluster, authenticating via a standard `userId`.

### Room Strategy
To minimize client bandwidth overhead, users only receive updates for sections they are currently viewing.
- **Section Room (`section:{section_id}`)**: Clients emit a `join_section` event to join a section's specific room when zoomed in. This targets seat-specific updates only to active viewers.

### Message Choreography

```
Client A (Booking Cart)       Socket.IO Gateway            Client B (Stethoscope)
       │                              │                              │
       ├─────── lock_seat ───────────>│                              │
       │   (Writes Redis SETNX)       │                              │
       │                              ├─────── seat_locked ─────────>│
       │                              │  (Greys out seat on A101)    │
       │                              │                              │
       ├─────── unlock_seat ─────────>│                              │
       │   (Removes Redis Key)        │                              │
       │                              ├─────── seat_unlocked ───────>│
       │                              │  (Restores green color)      │
```

### Event Registry

| Event Name | Direction | Room Target | Payload | Description |
| :--- | :--- | :--- | :--- | :--- |
| `join_section` | Client $\rightarrow$ Server | Room Orchestrator | `section_id` | Joins a targeted real-time room. |
| `leave_section` | Client $\rightarrow$ Server | Room Orchestrator | `section_id` | Leaves the room to stop updates. |
| `seat_locked` | Server $\rightarrow$ Client | `section:{id}` | `{ seat_id, user_id, expires_at }` | Disables selectable seat state. |
| `seat_unlocked` | Server $\rightarrow$ Client | `section:{id}` | `{ seat_id }` | Re-enables selectable seat state. |
| `section_update` | Server $\rightarrow$ Client | `section:{id}` | `{ section_id, available_count, locked_count, price }` | Batched section capacity & pricing stats (throttled to 2s). |
| `bulk_seat_update`| Server $\rightarrow$ Client | Broadcast Global | `{ seats: [{ seat_id, status }] }` | Broadcasts broad bulk changes (e.g. locks cleared on disconnect). |

---

## 5. REST API Endpoint Reference

All endpoints return JSON responses. If Next.js runs on Port `3000`, client requests proxy to the Express API running on Port `4000`.

### Seat Locking and Purchases

#### 1. Lock a Seat
Atomically acquires a temporary 10-minute hold on an individual seat in Redis.
* **HTTP Method**: `POST`
* **Path**: `/api/lock-seat`
* **Payload**:
  ```json
  { "seat_id": "A101-R1-S1", "user_id": "user_1e7b99" }
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "seat_id": "A101-R1-S1",
    "expires_at": 1716123456789
  }
  ```
* **Error Response (`409 Conflict` - already locked)**:
  ```json
  {
    "error": "Seat is locked by another user",
    "locked_by": "user_45a23",
    "expires_at": 1716123439900
  }
  ```

#### 2. Unlock a Seat
Releases an owned lock early. Will error if the user attempting release does not own the active lock.
* **HTTP Method**: `POST`
* **Path**: `/api/unlock-seat`
* **Payload**:
  ```json
  { "seat_id": "A101-R1-S1", "user_id": "user_1e7b99" }
  ```
* **Success Response (`200 OK`)**:
  ```json
  { "success": true, "seat_id": "A101-R1-S1" }
  ```

#### 3. Complete Purchase
Finalizes order, updates DB statuses in a single atomic Prisma transaction, and clears active Redis locks.
* **HTTP Method**: `POST`
* **Path**: `/api/purchase`
* **Payload**:
  ```json
  {
    "seat_ids": ["A101-R1-S1", "A101-R1-S2"],
    "user_id": "user_1e7b99",
    "payment_token": "tok_visa"
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "order_total": 500.00,
    "seat_count": 2
  }
  ```

### Data Fetching

#### 4. Fetch Seats for a Section
Returns seats in a specific section, automatically merging relational database entries with live Redis lock statuses.
* **HTTP Method**: `GET`
* **Path**: `/api/seats?section_id=A101`
* **Response**:
  ```json
  {
    "section_id": "A101",
    "seats": [
      {
        "seat_id": "A101-R1-S1",
        "row": "1",
        "number": 1,
        "x": 120.5,
        "y": 80.3,
        "price": 250.00,
        "status": "LOCKED",
        "lockedBy": "user_45a23"
      }
    ]
  }
  ```

#### 5. Fetch Sections with Bounding-Box Filtering
Fetches section polygon configurations, executing a spatial boundary check.
* **HTTP Method**: `GET`
* **Path**: `/api/sections?layoutId=uuid&bbox=-74.08,40.80,-74.06,40.82`
* **Response**:
  ```json
  {
    "sections": [
      {
        "section_id": "A101",
        "label": "101",
        "category": "GOLD",
        "color": "#f59e0b",
        "geometry": { "type": "Polygon", "coordinates": [...] },
        "availableCount": 62,
        "basePrice": 350.00,
        "centerX": -74.07,
        "centerY": 40.81
      }
    ]
  }
  ```

---

## 6. Frontend Client Architecture

TicketFlow features two core consumer flows: the **Interactive Booking App** and the **Layout Builder**.

```
                           React Application
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
  Booking Surface (Next.js `/`)                      Admin Surface (`/admin`)
   ├── Mapbox GL JS 3D Canvas                         ├── Custom HTML5 Canvas Engine
   │    ├── Extruded Polygons (3D)                    │    ├── Custom Mouse Pan & Zoom
   │    └── WebGL Seat Point Layers                   │    ├── Vector Shapes & Rotation
   ├── Booking Sidebar & Cart Context                 │    └── Advanced Tools Panel
   └── WebSocket Connection Context                   └── Builder State Hook (React Refs)
```

### The Interactive Booking Surface (`/`)

1. **Mapbox GL 3D Canvas**: Renders section polygons using a Mapbox `fill-extrusion` layer. Sections extrude vertically based on their pricing level tier, presenting a high-end 3D stadium bowl.
2. **WebGL Seat Point Layers**: Rather than loading thousands of individual DOM elements, TicketFlow uses a custom WebGL rendering context overlay. This processes the coordinates of up to 5,000+ seats in a single GPU draw call, sustaining a locked 60 FPS even during heavy panning.
3. **Cart Context (`CartContext`)**: A lightweight React context managing cart locks using `useReducer`. It persists selected seats in memory, ensuring that locking and unlocking states sync smoothly with background REST actions.

---

## 7. Advanced Admin Layout Builder

Located at `/admin`, the main venue layout designer utilizes a specialized HTML5 Canvas rendering engine and a custom coordinate projection layer.

### Component Structure

```
VenueBuilder (Main Layout Container)
 ├── TopBar (Undo/Redo History, Camera Controls, Advanced Tools Toggle)
 ├── LeftPanel (Interactive Tool Palette & Pre-built Section Presets)
 ├── BuilderCanvas (HTML5 Drawing, Coordinates, Drag & Drop Logic)
 ├── RowManagerPanel (Right-side Row Configuration, Pricing, Curved Row Builders)
 ├── SectionPropertiesPanel (Right-side Section Metadata and Seat View Photos)
 └── AdvancedToolsPanel (Collapsible Slide-out Sidebar Drawer)
      ├── Tab: Grid Generator (Custom curve algorithms, seat counts, margins)
      ├── Tab: Templates (Fast template drops: arc, rectangle, corner, suites)
      ├── Tab: Import/Export (GeoJSON venue exporting, bulk 10,000+ CAD CSV imports)
      └── Tab: Validation (Run overlay, duplicate, distance, and ADA compliance checks)
```

### Canvas Coordinates & Pan/Zoom
To reconcile standard browser pointer events with the custom infinite-canvas coordinate plane, TicketFlow exposes two core projection helpers:

```typescript
// Transforms world coordinates to absolute screen pixels
export function w2s(wx: number, wy: number, camera: Camera, width: number, height: number) {
  const screenX = (wx - camera.x) * camera.zoom + width / 2;
  const screenY = (wy - camera.y) * camera.zoom + height / 2;
  return [screenX, screenY];
}

// Transforms absolute screen pixels back to local world coordinates
export function s2w(sx: number, sy: number, camera: Camera, width: number, height: number) {
  const worldX = (sx - width / 2) / camera.zoom + camera.x;
  const worldY = (sy - height / 2) / camera.zoom + camera.y;
  return [worldX, worldY];
}
```

### High-Performance State Architecture
Re-rendering thousands of seats inside React's Virtual DOM on every mouse move would cause severe input latency. The `useBuilderEngine` hook avoids this by utilizing a split-state strategy:
* **`layoutRef` (Mutable React Ref)**: Houses the complete canvas graph (vertices, coordinate lists, and metadata). High-frequency mouse drag, panning, and rendering functions read directly from this ref synchronously to guarantee instantaneous rendering updates.
* **`layout` (React State)**: Triggered only when major canvas changes are finalized (e.g. releasing a mouse drag or clicking "Generate Seats"), which updates the properties panels and writes snapshot points to the 80-step undo/redo stack.

---

## 8. Core Algorithms & Backend Services

### 1. Redis Seat Lock Manager (`lockService.ts`)

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export async function lockSeat(seatId: string, userId: string): Promise<boolean> {
  const lockKey = `seat:lock:${seatId}`;
  const lockValue = JSON.stringify({ userId, expiresAt: Date.now() + 600000 });
  
  // NX: Only set if the key does not exist; EX: set key TTL to 600s
  const acquired = await redis.set(lockKey, lockValue, "NX", "EX", 600);
  return acquired === "OK";
}
```

When a user disconnects, an active Redis search scan triggers to release all temporary locks:

```typescript
export async function unlockAllByUser(userId: string): Promise<string[]> {
  const keys = await redis.keys("seat:lock:*");
  const unlockedSeats: string[] = [];
  
  for (const key of keys) {
    const data = await redis.get(key);
    if (data && JSON.parse(data).userId === userId) {
      await redis.del(key);
      unlockedSeats.push(key.replace("seat:lock:", ""));
    }
  }
  return unlockedSeats;
}
```

### 2. Dynamic Pricing Engine (`pricingService.ts`)

Pricing rules adjust dynamically using a real-time demand multiplier and historical purchase data:

$$\text{Price}_{\text{effective}} = \text{Price}_{\text{base}} \times \text{Multiplier}_{\text{demand}} \times \text{Factor}_{\text{time}}$$

```typescript
export function calculateDynamicPrice(basePrice: number, soldRatio: number, daysToEvent: number): number {
  // Demand scales price up to 2x based on capacity sold
  const demandMultiplier = 1.0 + (soldRatio * 1.0); // e.g. 2.0x at 100% sold
  
  // Time factors push prices higher as the event date approaches
  let timeFactor = 1.0;
  if (daysToEvent <= 7) {
    timeFactor = 1.5; // Last-minute booking premium
  } else if (daysToEvent <= 30) {
    timeFactor = 1.2;
  }
  
  return basePrice * demandMultiplier * timeFactor;
}
```

### 3. Layout Grid Generator (`advancedTools.ts`)

Calculates circular row paths using trigonometric calculations:

```typescript
export function generateCurvedRow(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  seatCount: number
): { x: number; y: number }[] {
  const coordinates = [];
  const angleStep = (endAngle - startAngle) / (seatCount - 1 || 1);
  
  for (let i = 0; i < seatCount; i++) {
    const angle = startAngle + i * angleStep;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    coordinates.push({ x, y });
  }
  
  return coordinates;
}
```

### 4. Layout Validation Engine (`advancedTools.ts`)
Ensures spatial layouts remain free of overlaps and conform to regulatory standards.
* **Seat Overlap Check ($O(N^2)$ with optimization)**: Compares the distance between each seat using a standard Euclidean formula. Flags an error if two seats sit closer than $8$ grid units.
* **ADA Accessibility Audit**: Scrapes section layouts to verify that wheelchair-accessible (`isAccessible`) seats represent at least $1.0\%$ of total seating capacity, flagging a warning if a venue falls below this safety ratio.

---

## 9. Development & Operations Guide

### Prerequisites
- **Node.js**: Version 18.0.0 or higher.
- **Docker**: Docker Desktop (for Postgres/Redis database support).
- **Mapbox Account**: Standard API key required for 3D map features.

### Environment Variable Schema
Create a `.env.local` file in the project's root:

```env
# Mapbox (Required for 3D Map view)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_goes_here

# PostgreSQL Connection String
DATABASE_URL="postgresql://ticketing:ticketing123@localhost:5432/ticketing?schema=public"

# Redis Server Connection
REDIS_URL="redis://localhost:6379"

# Sockets and Client Communication URLs
NEXT_PUBLIC_SOCKET_URL="http://localhost:4000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Server Ports
PORT=3000
BACKEND_PORT=4000
NODE_ENV=development
```

### Quick Start Commands

```bash
# 1. Install Node modules
npm install

# 2. Start PostgreSQL & Redis services via Docker
npm run db:up

# 3. Synchronize database schema and seed layout info
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. Start Next.js and the Express backend concurrently
npm run dev
```

> [!TIP]
> **No Docker installed?**
> Next.js and the Express API will run with mock data in-memory fallbacks if Postgres or Redis is unavailable, allowing you to test client views and layouts without database infrastructure.

---
*Document Version: 1.2.0 • Last Updated: May 2026*

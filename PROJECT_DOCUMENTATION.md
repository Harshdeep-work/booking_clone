# 📋 Project Documentation — `booking_clone`

> **Last updated:** 2026-05-04  
> A production-grade stadium seat-map & ticketing platform with a real-time seat builder, 2D/3D viewer, and booking engine.

---

## 🗂️ Table of Contents

1. [Project Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Backend — Express Server](#backend)
6. [Frontend — Next.js App](#frontend)
7. [Key Components](#key-components)
8. [State Management](#state-management)
9. [Real-time System](#real-time-system)
10. [API Routes](#api-routes)
11. [Scripts & Commands](#scripts--commands)

---

## Overview

`booking_clone` is a full-stack web application that provides:

- **Professional Seat Map Builder** — drag-and-drop canvas editor for creating stadium layouts with sections, seats, tables, and shapes.
- **3D Venue Viewer** — Three.js powered 3D visualization of stadium layouts.
- **2D Interactive Booking** — Konva.js canvas for customers to select and purchase seats.
- **Real-time Seat Locking** — Socket.IO + Redis to prevent double-booking.
- **Dynamic Pricing Engine** — Prisma ORM with PostgreSQL for pricing rules.

---

## Tech Stack

### Frontend

| Technology              | Version           | Purpose                                 |
| ----------------------- | ----------------- | --------------------------------------- |
| **Next.js**             | 16.2.4            | Full-stack React framework (App Router) |
| **React**               | 19.2.4            | UI library                              |
| **TypeScript**          | ^5                | Type safety across the entire codebase  |
| **Tailwind CSS**        | ^4                | Utility-first styling                   |
| **Framer Motion**       | ^12.38.0          | Animations and transitions              |
| **Konva / react-konva** | ^10.2.5 / ^19.2.3 | 2D canvas rendering for seat maps       |
| **Three.js**            | ^0.184.0          | 3D stadium visualization                |
| **Mapbox GL JS**        | ^3.22.0           | Geographic map integration              |
| **Lucide React**        | ^1.8.0            | Icon library                            |
| **Zustand**             | ^5.0.12           | Lightweight global state management     |
| **Socket.IO Client**    | ^4.8.3            | Real-time seat locking on the client    |

### Backend

| Technology             | Version    | Purpose                                         |
| ---------------------- | ---------- | ----------------------------------------------- |
| **Node.js / Express**  | ^5.2.1     | REST API server (runs alongside Next.js)        |
| **Prisma ORM**         | ^7.8.0     | Database access layer (type-safe queries)       |
| **@prisma/adapter-pg** | ^7.8.0     | PostgreSQL adapter for Prisma                   |
| **PostgreSQL**         | via Docker | Primary relational database                     |
| **Redis / IORedis**    | ^5.10.1    | Seat lock TTL caching (prevents double booking) |
| **Socket.IO**          | ^4.8.3     | WebSocket server for real-time seat state       |
| **UUID**               | ^14.0.0    | Unique ID generation                            |
| **CORS**               | ^2.8.6     | Cross-origin resource sharing                   |

### Dev Tools

| Tool               | Purpose                                                  |
| ------------------ | -------------------------------------------------------- |
| **nodemon**        | Auto-restart backend on file changes                     |
| **ts-node**        | Execute TypeScript server directly                       |
| **concurrently**   | Run frontend + backend simultaneously with `npm run dev` |
| **Docker Compose** | Spin up PostgreSQL + Redis containers                    |
| **ESLint**         | Code linting (Next.js config)                            |

---

## Project Structure

```
booking_clone/
├── prisma/
│   ├── schema.prisma          # Database models (Event, Layout, Section, Seat, etc.)
│   └── seed.ts                # Initial database seed data
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── page.tsx           # Home / landing page
│   │   ├── layout.tsx         # Root HTML layout
│   │   ├── globals.css        # Global styles + Tailwind
│   │   ├── admin/             # Admin builder page (/admin)
│   │   ├── booking/           # Customer booking page (/booking)
│   │   └── api/               # Next.js API route handlers
│   │       ├── geojson/       # GeoJSON export endpoint
│   │       ├── health/        # Health check endpoint
│   │       ├── layout/        # Layout CRUD
│   │       ├── lock-seat/     # Seat locking endpoint
│   │       ├── purchase/      # Order / purchase endpoint
│   │       ├── seats/         # Seat status endpoints
│   │       └── unlock-seat/   # Seat unlocking endpoint
│   ├── components/
│   │   ├── Admin/             # Seat Map Builder (editor) components
│   │   │   ├── ProBuilder.tsx          # Main builder shell + orchestration
│   │   │   ├── BuilderCanvas.tsx       # Canvas rendering engine
│   │   │   ├── LeftPanel.tsx           # Left toolbar (tools, generate, templates)
│   │   │   ├── PropertiesPanel.tsx     # Right sidebar (properties, categories, layers)
│   │   │   ├── BuilderPanels.tsx       # Panel layout wrapper
│   │   │   ├── GenerateDialogs.tsx     # Ring/Arc/Block generation modals
│   │   │   ├── KonvaEditor.tsx         # Konva-based editor variant
│   │   │   ├── VenueBuilder.tsx        # Alternate venue builder
│   │   │   ├── StadiumAdminBuilder.tsx # Full stadium builder v1
│   │   │   ├── StadiumAdminBuilderV2.tsx # Stadium builder v2
│   │   │   ├── ThreeAdminBuilder.tsx   # 3D builder using Three.js
│   │   │   ├── useBuilderEngine.ts     # Core editor state + logic hook
│   │   │   ├── builderTypes.ts         # TypeScript types (v1)
│   │   │   ├── builderTypes2.ts        # TypeScript types (v2) + geometry helpers
│   │   │   ├── BuilderIcons.tsx        # Tool icons + TOOL_GROUPS config
│   │   │   ├── Toolbar.tsx             # Top toolbar bar
│   │   │   ├── PropertyPanel.tsx       # Simple property panel variant
│   │   │   ├── ValidationPanel.tsx     # Map validation errors panel
│   │   │   ├── VersionHistory.tsx      # Layout version history UI
│   │   │   ├── EmptyState.tsx          # Canvas empty state illustration
│   │   │   └── types.ts                # Shared admin types
│   │   ├── KonvaBooking/      # Customer-facing 2D interactive seat map
│   │   │   ├── KonvaStadium.tsx       # Main Konva canvas stadium renderer
│   │   │   ├── BookingPanel.tsx       # Seat selection + checkout sidebar
│   │   │   ├── stadiumData.ts         # Static/mock stadium section data
│   │   │   └── index.tsx              # Re-export barrel
│   │   ├── StadiumMap/        # Mapbox-based geographic seat map
│   │   ├── ThreeViewer/       # Three.js 3D stadium viewer
│   │   └── Sidebar/           # Shared sidebar component
│   ├── context/
│   │   ├── CartContext.tsx    # React context for shopping cart state
│   │   └── SocketContext.tsx  # React context wrapping Socket.IO client
│   ├── data/                  # Static data files (mock/seed data)
│   ├── server/                # Express backend (runs on separate port)
│   │   ├── index.ts           # Express app entry point
│   │   ├── websocket.ts       # Socket.IO server setup + seat lock events
│   │   ├── routes/
│   │   │   ├── layout.ts      # Layout CRUD routes
│   │   │   ├── seats.ts       # Seat fetch routes
│   │   │   ├── sections.ts    # Section fetch routes
│   │   │   └── seatActions.ts # Lock / unlock / purchase seat routes
│   │   ├── lib/               # Shared server utilities (DB client, Redis)
│   │   └── services/          # Business logic services
│   └── store/
│       └── viewerStore.ts     # Zustand store for 3D viewer state
├── docker-compose.yml         # PostgreSQL + Redis containers
├── next.config.js             # Next.js configuration
├── tsconfig.json              # Frontend TypeScript config
├── tsconfig.server.json       # Backend TypeScript config
└── package.json               # Dependencies and scripts
```

---

## Database Schema

Powered by **Prisma ORM** with **PostgreSQL**.

```
Event ──────┐
            │ 1:N
          Layout ──────┐
                       │ 1:N
                    Section ──┬── 1:N ── Seat
                              └── 1:1 ── PricingRule

Order (independent — stores purchased seatIds as JSON array)
```

### Models

| Model         | Key Fields                                                                                      | Purpose                                       |
| ------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `Event`       | `id`, `name`, `date`, `venue`, `city`, `imageUrl`                                               | A ticketed event                              |
| `Layout`      | `id`, `eventId`, `version`, `name`, `isActive`                                                  | Versioned seat map layout for an event        |
| `Section`     | `id`, `layoutId`, `section_id`, `label`, `category`, `color`, `geometry (GeoJSON)`, `centerX/Y` | A named polygon section on the map            |
| `Seat`        | `id`, `sectionId`, `seat_id`, `row`, `number`, `x`, `y`, `lng`, `lat`, `price`, `status`        | Individual seat with canvas + geo coordinates |
| `PricingRule` | `sectionId`, `base_price`, `demand_multiplier`, `time_factor`, `min/max_price`                  | Dynamic pricing rule per section              |
| `Order`       | `userId`, `seatIds (JSON)`, `total`, `status`                                                   | A customer's purchase order                   |

### Enums

| Enum           | Values                                                     |
| -------------- | ---------------------------------------------------------- |
| `SeatStatus`   | `AVAILABLE`, `LOCKED`, `SOLD`                              |
| `SeatCategory` | `FIELD`, `PLATINUM`, `GOLD`, `SILVER`, `BRONZE`, `GENERAL` |
| `OrderStatus`  | `PENDING`, `CONFIRMED`, `CANCELLED`                        |

---

## Backend

An **Express v5** server runs concurrently alongside Next.js (via `concurrently`).

### Entry Point: `src/server/index.ts`

Sets up:

- Express middleware (JSON, CORS)
- Mounts all route groups
- Initializes Socket.IO (`websocket.ts`)

### Routes (`src/server/routes/`)

| File             | Endpoints                                      | Purpose                           |
| ---------------- | ---------------------------------------------- | --------------------------------- |
| `layout.ts`      | `GET/POST /layouts`, `GET /layouts/:id`        | Create and fetch seat map layouts |
| `seats.ts`       | `GET /seats/:sectionId`                        | Fetch seats for a section         |
| `sections.ts`    | `GET /sections/:layoutId`                      | Fetch all sections for a layout   |
| `seatActions.ts` | `POST /lock`, `POST /unlock`, `POST /purchase` | Real-time seat booking actions    |

### WebSocket (`src/server/websocket.ts`)

Uses **Socket.IO** + **Redis (IORedis)** for:

- `lock-seat` event → stores a TTL lock in Redis, broadcasts `seat-locked` to all clients
- `unlock-seat` event → removes Redis lock, broadcasts `seat-unlocked`
- `purchase-seat` event → marks seat as `SOLD` in PostgreSQL

---

## Frontend

### Next.js App Router (`src/app/`)

| Route      | Page               | Purpose                               |
| ---------- | ------------------ | ------------------------------------- |
| `/`        | `page.tsx`         | Landing/home page with event listings |
| `/admin`   | `admin/page.tsx`   | Admin seat map builder (ProBuilder)   |
| `/booking` | `booking/page.tsx` | Customer seat selection + checkout    |

### Next.js API Routes (`src/app/api/`)

| Route              | Purpose                   |
| ------------------ | ------------------------- |
| `/api/health`      | Server health check       |
| `/api/layout`      | Layout CRUD via Prisma    |
| `/api/seats`       | Seat availability queries |
| `/api/lock-seat`   | Lock a seat (Redis TTL)   |
| `/api/unlock-seat` | Release a seat lock       |
| `/api/purchase`    | Create an Order record    |
| `/api/geojson`     | Export layout as GeoJSON  |

---

## Key Components

### `ProBuilder.tsx` (Admin Editor)

The main seat map builder shell. Orchestrates:

- Active tool state
- Canvas pan/zoom
- Undo/redo history stack
- Save/Load/Export to JSON, SVG, PNG, PDF
- Templates (Cinema, Theater, Concert, Stadium presets)
- Category Manager modal
- Preview Mode

### `BuilderCanvas.tsx`

SVG-based canvas for rendering:

- Polygon sections (drag to create, resize, rotate)
- Seat rows (auto-generated within sections)
- Tables (rectangular + circular)
- Text labels
- Decorative shapes

### `useBuilderEngine.ts`

The core custom React hook driving all editor state:

- Element CRUD (shapes, sections, seats, tables, text)
- Selection, multi-select, marquee select
- Keyboard shortcuts (V, Q, N, P, B, T, H, Del, Ctrl+Z/Y, etc.)
- Pan/zoom transforms
- History (undo/redo stack)
- Snap-to-grid logic

### `KonvaStadium.tsx` (Customer Booking)

Konva.js 2D canvas rendering stadium sections for customer interaction:

- Click to select/deselect seats
- Category color coding
- Seat status (available / locked / sold) visual states
- Zoom and pan support

### `ThreeAdminBuilder.tsx`

Three.js 3D stadium viewer for visualizing the layout in 3D perspective using the same layout data as the 2D builder.

---

## State Management

| Store / Context    | Technology                  | Purpose                                            |
| ------------------ | --------------------------- | -------------------------------------------------- |
| `useBuilderEngine` | React `useState` / `useRef` | All editor state (single large hook)               |
| `CartContext`      | React Context API           | Shopping cart (selected seats + total)             |
| `SocketContext`    | React Context API           | Socket.IO client instance shared across components |
| `viewerStore`      | **Zustand**                 | 3D viewer settings (camera, section visibility)    |

---

## Real-time System

```
Customer Browser                 Express Server              Redis
      │                               │                        │
      │ ── socket emit "lock-seat" ─▶ │                        │
      │                               │ ── SET seat:ID EX 120 ▶│
      │                               │ ◀─ OK ─────────────────│
      │                               │ ── broadcast "seat-locked" to all clients
      │ ◀── "seat-locked" ────────────│
      │  (seat turns gray for others) │
```

- Seat locks expire after **120 seconds** (TTL in Redis)
- When a purchase completes → seat status updated to `SOLD` in PostgreSQL

---

## Scripts & Commands

```bash
# Start both frontend (Next.js) and backend (Express) together
npm run dev

# Start only Next.js frontend
npm run dev:frontend

# Start only Express backend
npm run dev:backend

# Start Docker containers (PostgreSQL + Redis)
npm run db:up        # docker-compose up -d

# Run Prisma migrations
npm run db:migrate   # prisma migrate dev

# Seed the database
npm run db:seed      # prisma db seed

# Generate Prisma client
npm run db:generate  # prisma generate

# Production build
npm run build        # prisma generate && next build
```

---

## Environment Variables

The project uses `.env` and `.env.local` files. Key variables:

| Variable                   | Purpose                               |
| -------------------------- | ------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string (Prisma) |
| `REDIS_URL`                | Redis connection string (IORedis)     |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL JS public access token      |
| `NEXT_PUBLIC_API_URL`      | Express backend base URL              |

---

_Generated automatically from codebase analysis — 2026-05-04_

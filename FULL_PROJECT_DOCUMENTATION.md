# 🏟️ TicketFlow — Full Project Documentation

This document serves as the absolute, comprehensive, deep-dive reference for the TicketFlow platform. It meticulously details the architecture, real-time concurrency, geometric layout builder, data models, and individual file responsibilities. It is designed for system architects, full-stack engineers, and onboarding developers who need an exhaustive understanding of how TicketFlow operates under the hood.

---

## 📖 Table of Contents
1. [Executive Summary & Core Capabilities](#-executive-summary--core-capabilities)
2. [High-Level System Architecture](#-high-level-system-architecture)
3. [Comprehensive Directory Structure](#-comprehensive-directory-structure)
4. [Admin Venue Builder Engine (Deep Dive)](#-admin-venue-builder-engine-deep-dive)
5. [Frontend Booking & Rendering (Mapbox & 3D)](#-frontend-booking--rendering-mapbox--3d)
6. [Real-Time Concurrency & Locking Engine](#-real-time-concurrency--locking-engine)
7. [Database Schema & Data Models](#-database-schema--data-models)
8. [Backend API Services](#-backend-api-services)
9. [State Management Ecosystem](#-state-management-ecosystem)
10. [Configuration & Environment Setup](#-configuration--environment-setup)

---

## 🚀 Executive Summary & Core Capabilities

TicketFlow is a production-grade, highly concurrent venue management and ticketing platform designed to solve the complex problem of real-time seat reservation in large stadiums. 

### Core Capabilities:
- **Real-Time Concurrency Handling**: Utilizes an atomic locking mechanism via Redis and Socket.IO to completely eliminate double-booking scenarios.
- **Enterprise-Grade Admin Builder**: Features a high-performance, CAD-style 2D canvas editor (built with Konva.js and HTML5 Canvas) capable of managing complex spatial geometries, curved rows, and thousands of distinct seat entities.
- **Immersive 3D Customer Experience**: Employs Mapbox GL JS for 3D geographical stadium rendering and Three.js for localized 3D section previews, giving customers unprecedented visual context before purchasing.
- **Dynamic Pricing Engine**: A rules-based backend system that adjusts seat pricing in real-time based on demand metrics and event proximity.

---

## 🏗️ High-Level System Architecture

TicketFlow implements a decoupled, modern web architecture:

1. **Client Tier (Next.js 16 - React 19)**
   - Utilizes the Next.js App Router for server-side rendering (SSR) and optimized routing.
   - Tailored with Tailwind CSS 4 for rapid, responsive UI design.
   - Employs Next.js API Routes strictly as proxies to forward client requests to the backend, circumventing CORS and hiding backend URLs.

2. **API & Real-Time Tier (Express & Socket.IO)**
   - A dedicated Node.js/Express server (running on a separate port, e.g., 4000) handles heavy computational tasks, geometric generation, and stateful WebSocket connections.
   - Socket.IO manages client rooms (users viewing specific sections) and broadcasts locking events.

3. **In-Memory Cache & Locking (Redis)**
   - Acts as the fast-access, ephemeral state store. When a user clicks a seat, an atomic lock with a Time-To-Live (TTL) is placed in Redis.

4. **Persistence Tier (PostgreSQL & Prisma ORM)**
   - The authoritative source of truth. Stores structured layout metadata, permanent seat statuses (`AVAILABLE`, `SOLD`), user data, and financial transactions.

### Architectural Data Flow Example (Seat Purchase)
1. **Selection**: User clicks a seat on the Mapbox GL canvas.
2. **Lock Request**: Frontend emits `lock_seat` via WebSocket.
3. **Lock Acquisition**: Backend validates the seat in Postgres, then attempts `SETNX` in Redis.
4. **Broadcast**: If successful, backend emits `seat_locked` to all connected clients in that specific stadium section room.
5. **Checkout**: User completes payment via HTTP POST to Express.
6. **Commit**: Prisma executes a transaction: updates Postgres seat status to `SOLD`, creates an `Order` record, and deletes the Redis lock.
7. **Update**: Backend broadcasts `seat_sold`, prompting UI updates globally.

---

## 📁 Comprehensive Directory Structure

Below is a granular breakdown of the project file tree and responsibilities.

### 1. Root Configuration Files
- `package.json` & `package-lock.json`: Node dependencies and executable scripts (`dev`, `build`, `start`, `lint`).
- `tsconfig.json`: TypeScript compiler options for the Next.js frontend (JSX preservation, DOM types).
- `tsconfig.server.json`: Strict TypeScript settings for the Express backend.
- `next.config.js`: Next.js configuration, including image domains and experimental features.
- `prisma.config.ts`: Configuration for the Prisma ORM instance.
- `docker-compose.yml`: Local development orchestration for PostgreSQL and Redis.
- `.env` & `.env.local`: Environment secrets (DB strings, JWT secrets, Mapbox tokens).
- `eslint.config.mjs`: Centralized linting rules to enforce code quality.
- `postcss.config.mjs`: PostCSS processing for Tailwind CSS 4.

### 2. Frontend Source (`src/app` & `src/components`)
- **`src/app/`** (App Router Pages)
  - `layout.tsx`: Root layout injecting global contexts (`SocketProvider`, `CartProvider`).
  - `page.tsx`: Global landing page.
  - `globals.css`: Core Tailwind directives and root CSS variables.
  - `admin/` (Admin Domain)
    - `layout.tsx`: Admin-specific navigation shell.
    - `page.tsx`: Mounts the Venue Builder.
  - `booking/` (Customer Domain)
    - `page.tsx`: Entry point for purchasing.
    - `BookingShell.tsx`: High-level orchestrator for the Map, Sidebar, and Cart.
  - `api/proxy/route.ts`: Generic Next.js API route that pipes HTTP requests to the Express backend.

- **`src/components/Admin/`** (The Layout Builder Module)
  - `VenueBuilder.tsx`: Top-level orchestrator connecting canvas, history, and tools.
  - `BuilderCanvas.tsx`: High-performance React wrapper around raw HTML5/Konva canvas for drawing sections and seats.
  - `useBuilderEngine.ts`: The massive (800+ line) brain of the builder. Handles state updates, undo/redo stacks, coordinate mapping (World $\leftrightarrow$ Screen), and selection logic.
  - `advancedTools.ts`: Pure mathematics for geometry manipulation (Bezier curves for rows, grid generation).
  - `AdvancedToolsPanel.tsx`: UI for CAD features (snapping, grids, template insertion).
  - `RowManagerPanel.tsx`: Contextual sidebar for editing row curvature and properties.
  - `EnhancedPropertiesPanel.tsx`: Form UI for section metadata (ADA accessibility, photos).
  - `builderTypes2.ts`: Strict TypeScript definitions (`BShape`, `BSeat`, `BRow`, `Point`).
  - `BuilderIcons.tsx`: SVG icon components for the builder UI.
  - `theme.css`: Dark mode specific styling for the admin workspace.

- **`src/components/StadiumMap/`** (Mapbox Integration)
  - `StadiumMap.tsx`: React wrapper for Mapbox GL JS. Initializes layers (`fill-extrusion` for 3D polygons, `circle` for seats). Handles hover states and viewport transitions.
  - `SectionTooltip.tsx`: Floating UI element displaying aggregated section data (avg price, available count).

- **`src/components/ThreeViewer/`** (3D Rendering)
  - `ThreeViewer.tsx`: Uses `@react-three/fiber` to render individual section geometries, providing a "seat view" representation.
  - `StadiumViewer.tsx`: Aggregates multiple `ThreeViewer` instances to render the full macro-stadium structure.
  - `ViewerSidebar.tsx`: Controls for manipulating the 3D camera and filtering visible levels.

### 3. Backend Source (`src/server`)
- **`src/server/`**
  - `index.ts`: Express application bootstrap. Applies CORS, JSON parsing, and route mounting.
  - `websocket.ts`: Socket.IO server initialization, connection handling, room joining, and disconnect logic.
  - **`routes/`**
    - `seats.ts`: REST controllers for querying seat status and metadata.
    - `seatActions.ts`: Mutation endpoints for purchasing and state transitions.
    - `sections.ts`: Endpoints generating and serving GeoJSON data for Mapbox.
    - `layout.ts`: Endpoints for saving and versioning builder layouts.
  - **`services/`**
    - `lockService.ts`: Abstraction layer over Redis for managing concurrent seat locks.
    - `pricingService.ts`: Algorithm for calculating dynamic pricing modifiers.
  - **`lib/`**
    - `prisma.ts`: Prisma client singleton to prevent connection exhaustion.
    - `redis.ts`: High-performance `ioredis` client setup.

### 4. Data & Geometry Helpers (`src/data`)
- `stadiumEngine.ts`: Core trigonometric and geometric functions for plotting seat coordinates along arcs and grids.
- `stadiumGeometry.ts`: Pre-defined constants (e.g., standard seat width, default aisle gap) and static layout templates.
- `mockLayout.ts`: Hardcoded JSON representations of a stadium for local testing without DB access.

### 5. Utilities (`src/utils`)
- `stadiumOptimizer.ts`: Geospatial algorithms (like Douglas-Peucker) to simplify GeoJSON boundaries and reduce API payload sizes for complex stadiums.
- `previewStorage.ts`: LocalStorage/SessionStorage wrappers for persisting admin draft layouts before committing to PostgreSQL.

### 6. Database (`prisma/`)
- `schema.prisma`: The master schema definition (Detailed below).
- `seed.ts`: Script utilizing Prisma to inject a base stadium configuration and test users into a fresh database.

---

## 🛠️ Admin Venue Builder Engine (Deep Dive)

The Admin Builder is the most computationally complex frontend module. It operates as a miniature CAD system.

### Coordinate Systems
- **World Coordinates**: The absolute, infinite coordinate space where sections and seats mathematically exist.
- **Screen Coordinates**: The pixel space of the user's monitor.
- The `useBuilderEngine.ts` hook manages a transform matrix (Scale, Pan X, Pan Y) to translate World $\leftrightarrow$ Screen coordinates at 60FPS.

### The History Stack (Undo/Redo)
To support a robust editing experience, the builder maintains an immutable array of layout states. Every action (move, add, delete) creates a deep copy of the layout objects and pushes it to the `history` array. `undo()` decrements the pointer, `redo()` increments it.

### Data Structures (`builderTypes2.ts`)
```typescript
interface BShape {
  id: string;
  type: 'section' | 'polygon';
  points: Point[]; // Array of X,Y vertices
  metadata: { name: string; capacity: number; level: string };
}
interface BRow {
  id: string;
  curve: number; // 0 for straight, > 0 for arc
  seats: BSeat[];
}
```

---

## 🗺️ Frontend Booking & Rendering (Mapbox & 3D)

### Mapbox GL JS Implementation
We utilize Mapbox primarily for its highly optimized WebGL rendering capabilities, which can handle tens of thousands of geometric shapes.
1. **Source Loading**: The Express API serves a highly optimized GeoJSON payload containing `Polygon` features for sections and `Point` features for individual seats.
2. **Extrusion**: We use Mapbox's `fill-extrusion` layer type to render stadium sections as 3D blocks. Height properties in the GeoJSON dictate the 3D elevation.
3. **Interactivity**: Mapbox's native `queryRenderedFeatures` is used to detect mouse hovers and clicks, mapping them back to database IDs.

### Three.js "Seat View"
For detailed previews, `@react-three/fiber` constructs a localized 3D scene. When a user hovers a seat, we calculate a camera position simulating human eye level at those specific X/Y/Z coordinates, looking toward a defined focal point (the pitch/stage).

---

## ⚡ Real-Time Concurrency & Locking Engine

Handling multiple users attempting to buy the same seat requires strict transactional integrity.

1. **The Race Condition**: User A and User B click "Seat 1A" at the exact same millisecond.
2. **The Redis Solution (`lockService.ts`)**: 
   - Both clients emit `lock_seat`. 
   - The Node server attempts to execute a Redis `SETNX` (Set if Not eXists) command for the key `seat_lock:1A`.
   - Redis guarantees atomicity. It returns `1` to the first request and `0` to the second.
3. **The Result**: User A gets the lock, their UI shows the seat in their cart. User B receives a `lock_failed` event, and their UI immediately renders the seat as unavailable.
4. **Timeouts**: The Redis lock is created with a `PX` (expire in milliseconds) argument, typically 5-10 minutes. If User A doesn't check out in time, Redis automatically deletes the key.
5. **Synchronization**: Socket.IO broadcasts the lock state to all clients viewing that section, ensuring everyone's screen accurately reflects the locking in real-time.

---

## 🗄️ Database Schema & Data Models

The Prisma schema (`prisma/schema.prisma`) defines the PostgreSQL relational structure.

### Key Models
- **`Event`**: Represents a concert or game.
  - Fields: `id`, `name`, `date`, `layoutId` (Relation to the spatial layout).
- **`Layout`**: A versioned snapshot of a stadium's physical arrangement.
  - Fields: `id`, `name`, `version`, `createdAt`.
- **`Section`**: A major block of seats (e.g., "Section 101").
  - Fields: `id`, `layoutId`, `name`, `geoJsonBoundary`, `basePrice`.
- **`Seat`**: The granular ticketable entity.
  - Fields: `id`, `sectionId`, `row`, `number`, `x`, `y`, `status` (`AVAILABLE`, `LOCKED`, `SOLD`).
  - *Indexes*: High-performance indexes on `(sectionId, status)` for fast querying.
- **`PricingRule`**: Dynamic modifiers.
  - Fields: `id`, `eventId`, `condition` (e.g., "< 24 hours to event"), `multiplier` (e.g., 0.8 for discount).
- **`Order`**: Financial transactions tying Users to Seats.

---

## 🔌 Backend API Services

The Express server (`src/server/`) exposes RESTful endpoints:

### Core Endpoints
- `GET /api/sections/:layoutId`
  - Returns: GeoJSON `FeatureCollection` of section boundaries. Optimized via `stadiumOptimizer.ts`.
- `GET /api/seats/:sectionId`
  - Returns: Array of seat objects, hydrated with real-time lock status from Redis.
- `POST /api/seatActions/checkout`
  - Payload: `{ seatIds: string[], userId: string, paymentToken: string }`
  - Action: Verifies Redis locks, executes PostgreSQL transaction to mark seats `SOLD`, processes payment (mocked), deletes locks, broadcasts via Socket.IO.
- `POST /api/layout/save`
  - Payload: Complex JSON from the Admin Builder.
  - Action: Parses and normalizes `BShape` and `BSeat` data into relational Prisma inserts for `Section` and `Seat` tables.

---

## 🧠 State Management Ecosystem

We utilize targeted state management to avoid React re-render bottlenecks:

1. **Zustand (`src/store/viewerStore.ts`)**: Used exclusively for UI states that change rapidly and don't need persistence (e.g., current 3D camera angle, active hovered section ID). Zustand allows component subscription to specific slices of state, preventing global re-renders.
2. **React Context (`SocketContext`, `CartContext`)**: Used for state that permeates the entire app tree but changes less frequently (e.g., WebSocket connection status, items currently in the shopping cart).
3. **Local Component State (`useState`, `useReducer`)**: Used in highly isolated components (like an individual input field in the Admin panel).

---

## ⚙️ Configuration & Environment Setup

To run TicketFlow locally, the environment must be correctly bootstrapped.

### Requirements
- Node.js v20+
- PostgreSQL v15+ (via Docker)
- Redis v7+ (via Docker)

### Environment Variables (`.env`)
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ticketflow"

# Redis
REDIS_URL="redis://localhost:6379"

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN="pk.eyJ1... (Your token)"

# Backend & Sockets
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

### Startup Sequence
1. `docker-compose up -d`: Starts Postgres and Redis.
2. `npx prisma db push` & `npx prisma db seed`: Initializes the schema and loads mock data.
3. `npm run dev:server`: Starts the Express backend on port 4000.
4. `npm run dev:client`: Starts the Next.js frontend on port 3000.

---

*This document is maintained by the Core Engineering Team. For architectural changes or schema modifications, please refer to the pull request guidelines in `CONTRIBUTING.md`.*

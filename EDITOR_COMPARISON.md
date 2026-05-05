# Seat Map Editor — Feature Comparison & Gap Analysis

Reference: **MapMyVenue** (https://mapmyvenue.preplex.app/)  
Our editor: `/src/components/Admin/` (ProBuilder + VenueBuilder + KonvaEditor)

---

## What MapMyVenue Has (Full Feature Set)

### Toolbar / Tools
| Tool | Shortcut | Description |
|------|----------|-------------|
| Select & Move | V | Select, move, resize elements |
| Select Seats Only | Q | Restrict selection to seats |
| Add Section (Rect) | N | Draw rectangular sections |
| Add Polygon Section | P | Draw freeform polygon sections |
| Add Row | L | Draw a row of seats |
| Add Multiple Rows | — | Batch-draw rows |
| Add Segment Row | — | Curved/arc row |
| Add Seat | R | Place individual seats |
| Add Table | B | Place table (book-by-seat or whole) |
| Add Shape | H | Lines, arrows, rectangles, circles, ellipses, triangles, stars, wedges, paths |
| Add Text | T | Place text labels |
| Measurement Tool | — | Measure distances on canvas |
| Pan Mode | Space (hold) | Pan the canvas |
| Deselect / Exit Tool | Esc | Clear selection |

### Left Sidebar — Sections Panel
- List of all sections with section name, seat count
- Click to isolate/enter section edit mode ("Enter Section Isolation Mode")
- "Exit section view" button
- Section search / filter
- "No sections detected" empty state

### Left Sidebar — Categories Panel
- Create / rename / delete categories
- Each category has: name, color swatch
- "Category Manager" modal
- "Add New Category" button
- "No categories created yet" empty state
- Default category assignment

### Canvas
- Infinite canvas with pan + scroll-to-zoom
- Snap to grid (toggle S, shows SNAP / SNAPPED indicator)
- Grid overlay (toggle)
- Zoom in / Zoom out / Reset zoom / Fit to screen
- "Drag to pan - Scroll to zoom" hint
- Coordinate display (x, y)
- Multi-select with drag-box
- Nudge selected 1px (arrow keys) / 10px (Shift+arrow)
- Copy / Paste / Duplicate / Delete
- Undo / Redo
- Group / Ungroup selection
- Bring to Front / Send to Back / Bring Forward / Send Backward
- Lock / Unlock elements
- Hide / Show elements
- Align rows: left, right, top, bottom, center H, center V
- Distribute rows evenly

### Right Panel — Properties (context-sensitive)
**When nothing selected:**
- "Select an element to edit properties"
- Canvas stats: total elements, seats, sections

**Section selected:**
- Section name (editable)
- Section label (displayed label)
- Section type (Seating Section / Stage / GA / etc.)
- Category (pill selector)
- Fill color (color picker + hex input)
- Stroke color + stroke width
- Opacity
- Position X, Y
- Width, Height
- Rotation angle
- Corner radius (for rect sections)
- "Auto-fill with Seats" button
- Section labeling: label text, position (left/right/middle), direction (L→R / R→L)
- Section info stats (tier, type, seat count)
- "Zoom to Section" button

**Row selected:**
- Row label (editable)
- Number of seats (stepper)
- Curve (degree stepper)
- Seat spacing (stepper, in pt)
- Row labeling: enabled toggle, label text, start-at value
- Seat labeling: enabled toggle, label format
- Category selector
- "Apply to selected elements" bulk action

**Seat selected:**
- Seat label (editable)
- Row + Number fields
- Price ($)
- Category (pill selector)
- Status: Normal / Accessible / Companion / Blocked / Standing / VIP / Semi-ambulatory / Plus-size / Obstructed view / Partial view / Restricted view / Sign language view / Lift-up armrests
- Position X, Y
- "Seat properties" header

**Shape selected:**
- Fill color
- Stroke color + width
- Opacity
- Position X, Y
- Width, Height
- Rotation angle
- Corner radius
- Shape type label

**Text selected:**
- Text content
- Font size
- Text color
- Bold / Italic toggles
- Displayed label

**Multi-select (Bulk Actions):**
- Category → apply to all
- Price → apply to all
- Status → apply to all
- "Apply to selected elements" button

### Right Panel — Tabs
- Properties (default)
- Validate (real-time errors/warnings)
- History (version snapshots, rollback)

### Top Bar
- Venue name / title
- Save button
- Export: JSON / SVG / PNG
- Import (load JSON)
- Preview ("Seatmap Preview" / "Customer Preview Mode")
- Undo / Redo buttons
- Zoom % display
- Tools Reference / Help (keyboard shortcuts modal)

### Seat Types (Quick Seat Types panel)
- Normal
- Accessible (blue, wheelchair icon)
- Companion (green)
- Blocked (red)
- Standing area (purple)
- VIP
- Semi-ambulatory
- Plus-size
- Obstructed view
- Partial view
- Restricted view
- Sign language view
- Lift-up armrests

### Venue Templates / Presets
- Stadium Layout (large stadium, tiered sections)
- Theater Layout (standard movie theater, curved rows)
- Concert Hall
- Cinema Layout
- Custom (blank canvas)

### Legend
- Color-coded legend panel showing category → color mapping

### Keyboard Shortcuts (Tools Reference modal)
- V: Select, Q: Seats only, N: Rect section, P: Polygon section
- L: Add row, R: Add seat, B: Table, H: Shapes, T: Text
- S: Toggle snap, Esc: Deselect
- Arrow keys: Nudge 1px, Shift+Arrow: Nudge 10px
- Ctrl+Z: Undo, Ctrl+Y/Ctrl+Shift+Z: Redo
- Ctrl+C/V: Copy/Paste, Ctrl+D: Duplicate
- Ctrl+G: Group, Ctrl+Shift+G: Ungroup
- Delete/Backspace: Delete selected
- Ctrl+A: Select all
- Space (hold): Pan mode
- Scroll: Zoom

---

## What Our Editor Currently Has

### ProBuilder (`/src/components/Admin/ProBuilder.tsx`)
Canvas-based (raw `<canvas>`) editor with:
- Tools: select, polygon section, row, seat, pan, rect, circle, ellipse, arc
- Snap to grid (toggle)
- Zoom + pan (camera system)
- Undo / Redo (history snapshots)
- Multi-select
- Drag to move elements
- Vertex editing for polygon sections
- Ring / Arc / Rect / Ellipse generation modals
- Right panel tabs: Properties, Validate, History
- Validation engine (duplicate IDs, spacing)
- Version history with rollback
- Category system (GENERAL, PREMIUM, VIP, GOLD, SILVER, BRONZE, BUDGET, STANDARD, GA)

### VenueBuilder (`/src/components/Admin/VenueBuilder.tsx`)
Konva-based editor with:
- Left panel: tool groups, shape grid (8 shapes), snap toggle, Generate buttons (ring/arc/block), Insert Shape (10 presets), Venue Templates (NBA Arena, Soccer, Theatre, Hockey, Stage Only, GA Pit)
- Right panel: PropertiesPanel (section, seat, text, row, multi-select bulk edit)
- Properties: label, type, category pills, color picker, price, position X/Y, row curve/spacing/count, seat status, text font/color

### KonvaEditor (`/src/components/Admin/KonvaEditor.tsx`)
Simpler Konva editor:
- Tools: select, section (polygon), row, seat, pan
- Grid overlay
- Zoom + pan
- Transformer for resize/rotate
- Polygon drawing with double-click to close
- Seat placement with snap

### Toolbar (`/src/components/Admin/Toolbar.tsx`)
- 5 tools: select, section, row, seat, pan
- Undo/Redo (placeholder, disabled)
- Delete

---

## Gap Analysis — What We're Missing vs MapMyVenue

### Critical Missing Tools
| Missing | Priority |
|---------|----------|
| "Select Seats Only" mode (Q) | High |
| Add Multiple Rows (batch) | High |
| Add Segment Row (curved arc row) | High |
| Add Table (book-by-seat / whole) | Medium |
| Measurement Tool | Low |
| Dedicated shape sub-tools: Line, Arrow, Path, Wedge | Medium |

### Missing Canvas Features
| Missing | Priority |
|---------|----------|
| Drag-box multi-select | High |
| Nudge with arrow keys (1px / 10px) | High |
| Copy / Paste / Duplicate | High |
| Group / Ungroup | Medium |
| Bring to Front / Send to Back / layer ordering | Medium |
| Lock / Unlock elements | Medium |
| Hide / Show elements | Low |
| Align rows (6 directions) | Medium |
| Distribute rows evenly | Medium |
| Fit to screen button | Medium |
| Zoom % display in top bar | Low |

### Missing Properties Panel Features
| Missing | Priority |
|---------|----------|
| Stroke color + stroke width controls | High |
| Opacity slider | High |
| Corner radius for rect sections | Medium |
| Section labeling: position (left/right/middle) + direction (L→R / R→L) | High |
| Seat labeling: enabled toggle + format | High |
| Row labeling: start-at value | Medium |
| Full seat type list (12 types: accessible, companion, blocked, standing, VIP, semi-ambulatory, plus-size, obstructed, partial, restricted, sign-language, lift-up) | High |
| "Zoom to Section" button | Low |
| "Apply to selected elements" bulk action button | Medium |

### Missing Top Bar Features
| Missing | Priority |
|---------|----------|
| Export as SVG (currently stub) | High |
| Export as PNG (currently stub) | High |
| Import JSON | High |
| "Customer Preview Mode" (read-only preview) | High |
| Keyboard shortcuts help modal | Medium |

### Missing Left Panel Features
| Missing | Priority |
|---------|----------|
| Sections list panel (click to isolate section) | High |
| "Enter Section Isolation Mode" / "Exit section view" | High |
| Category Manager (full CRUD with color) | High |
| Legend panel | Low |

### Missing Seat Types
Our editor has: available, sold, locked  
MapMyVenue has: normal, accessible, companion, blocked, standing, VIP, semi-ambulatory, plus-size, obstructed view, partial view, restricted view, sign language view, lift-up armrests

### Missing Venue Templates
We have: NBA Arena, Soccer/Football, Theatre, Hockey, Stage Only, GA Pit  
MapMyVenue has: Stadium, Theater, Concert Hall, Cinema, Custom  
**Status: Roughly equivalent — ours is actually more detailed.**

---

## Implementation Plan (Priority Order)

### Phase 1 — Core Interaction Gaps (1–2 days)
1. Arrow key nudge (1px / 10px with Shift)
2. Copy / Paste / Duplicate (Ctrl+C/V/D)
3. Drag-box multi-select
4. Stroke color + opacity in properties panel
5. Full seat type list (12 types) with icons

### Phase 2 — Row & Section Tools (1–2 days)
6. Multiple Rows tool (batch row drawing)
7. Segment Row tool (curved arc)
8. Section Isolation Mode (enter/exit)
9. Sections list in left panel
10. Section labeling position + direction controls

### Phase 3 — Layer & Organization (1 day)
11. Bring to Front / Send to Back / layer ordering
12. Lock / Unlock elements
13. Group / Ungroup
14. Align + Distribute tools

### Phase 4 — Export & Preview (1 day)
15. Export as PNG (html2canvas or canvas.toDataURL)
16. Export as SVG (Konva stage to SVG)
17. Import JSON
18. Customer Preview Mode

### Phase 5 — Polish (1 day)
19. Category Manager (full CRUD)
20. Keyboard shortcuts modal
21. Fit to screen / Zoom % display
22. Legend panel
23. Measurement tool

---

## Architecture Note

The project has **three overlapping editors** (ProBuilder, VenueBuilder, KonvaEditor). The admin page at `/src/app/admin/page.tsx` should consolidate to one. **VenueBuilder** (Konva-based with LeftPanel + PropertiesPanel) is the most complete and closest to MapMyVenue's architecture — recommend building all new features there and deprecating ProBuilder and KonvaEditor.

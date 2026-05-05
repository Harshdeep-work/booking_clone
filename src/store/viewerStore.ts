import { create } from 'zustand';
import type { StadiumSeat, StadiumSection } from '@/data/stadiumEngine';

interface ViewerState {
  hoveredSeatId: string | null;
  hoveredSectionId: string | null;
  selectedSeatIds: Set<string>;
  cart: StadiumSeat[];
  zoom: number;
  setHovered: (id: string | null) => void;
  setHoveredSection: (id: string | null) => void;
  toggleSelect: (seat: StadiumSeat) => void;
  removeFromCart: (id: string) => void;
  setZoom: (z: number) => void;
  adminSections: StadiumSection[];
  adminSeats: StadiumSeat[];
  setAdminLayout: (s: StadiumSection[], seats: StadiumSeat[]) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  hoveredSeatId: null,
  hoveredSectionId: null,
  selectedSeatIds: new Set(),
  cart: [],
  zoom: 1,
  setHovered: (id) => set({ hoveredSeatId: id }),
  setHoveredSection: (id) => set({ hoveredSectionId: id }),
  toggleSelect: (seat) =>
    set((s) => {
      const next = new Set(s.selectedSeatIds);
      const cart = [...s.cart];
      if (next.has(seat.id)) {
        next.delete(seat.id);
        return { selectedSeatIds: next, cart: cart.filter(c => c.id !== seat.id) };
      }
      if (seat.status !== 'available') return s;
      next.add(seat.id);
      return { selectedSeatIds: next, cart: [...cart, seat] };
    }),
  removeFromCart: (id) =>
    set((s) => {
      const next = new Set(s.selectedSeatIds);
      next.delete(id);
      return { selectedSeatIds: next, cart: s.cart.filter(c => c.id !== id) };
    }),
  setZoom: (zoom) => set({ zoom }),
  adminSections: [],
  adminSeats: [],
  setAdminLayout: (adminSections, adminSeats) => set({ adminSections, adminSeats }),
}));

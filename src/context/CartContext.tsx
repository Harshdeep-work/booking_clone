'use client';
import React, { createContext, useContext, useReducer, useCallback } from 'react';

export interface CartSeat {
  seat_id: string;
  section_id: string;
  row: string;
  number: number;
  price: number;
  label: string; // "Section A101 - Row B - Seat 4"
  category: string;
  color: string;
}

interface CartState {
  seats: CartSeat[];
  total: number;
  isLocking: Record<string, boolean>;
}

type CartAction =
  | { type: 'ADD_SEAT'; seat: CartSeat }
  | { type: 'REMOVE_SEAT'; seat_id: string }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_LOCKING'; seat_id: string; value: boolean };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_SEAT':
      if (state.seats.find((s) => s.seat_id === action.seat.seat_id)) return state;
      return {
        ...state,
        seats: [...state.seats, action.seat],
        total: state.total + action.seat.price,
      };
    case 'REMOVE_SEAT':
      const removed = state.seats.find((s) => s.seat_id === action.seat_id);
      return {
        ...state,
        seats: state.seats.filter((s) => s.seat_id !== action.seat_id),
        total: state.total - (removed?.price || 0),
      };
    case 'CLEAR_CART':
      return { seats: [], total: 0, isLocking: {} };
    case 'SET_LOCKING':
      return {
        ...state,
        isLocking: { ...state.isLocking, [action.seat_id]: action.value },
      };
    default:
      return state;
  }
}

interface CartContextValue {
  cart: CartState;
  addSeat: (seat: CartSeat) => void;
  removeSeat: (seat_id: string) => void;
  clearCart: () => void;
  isInCart: (seat_id: string) => boolean;
  setLocking: (seat_id: string, value: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, { seats: [], total: 0, isLocking: {} });

  const addSeat = useCallback((seat: CartSeat) => dispatch({ type: 'ADD_SEAT', seat }), []);
  const removeSeat = useCallback((seat_id: string) => dispatch({ type: 'REMOVE_SEAT', seat_id }), []);
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);
  const isInCart = useCallback((seat_id: string) => cart.seats.some((s) => s.seat_id === seat_id), [cart.seats]);
  const setLocking = useCallback((seat_id: string, value: boolean) =>
    dispatch({ type: 'SET_LOCKING', seat_id, value }), []);

  return (
    <CartContext.Provider value={{ cart, addSeat, removeSeat, clearCart, isInCart, setLocking }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

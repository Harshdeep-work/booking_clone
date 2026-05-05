'use client';
import { useState, useCallback } from 'react';
import KonvaStadium from './KonvaStadium';
import BookingPanel from './BookingPanel';
import { type Section, type Seat } from './stadiumData';

export default function StadiumBooking() {
  const [hoveredSection, setHoveredSection] = useState<Section | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const selectedIds = new Set(selectedSeats.map(s => s.id));

  const onSeatToggle = useCallback((seat: Seat) => {
    setSelectedSeats(prev => {
      if (prev.some(s => s.id === seat.id)) return prev.filter(s => s.id !== seat.id);
      return [...prev, { ...seat, status: 'selected' }];
    });
  }, []);

  const onRemove = useCallback((id: string) => {
    setSelectedSeats(prev => prev.filter(s => s.id !== id));
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <KonvaStadium
          selectedIds={selectedIds}
          onSeatToggle={onSeatToggle}
          onSectionHover={setHoveredSection}
        />
      </div>
      <BookingPanel
        hoveredSection={hoveredSection}
        selectedSeats={selectedSeats}
        onRemove={onRemove}
      />
    </div>
  );
}

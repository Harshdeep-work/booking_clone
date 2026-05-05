import type { Metadata } from 'next';
import BookingShell from './BookingShell';

export const metadata: Metadata = {
  title: 'Book Seats — TicketFlow',
  description: 'Interactive stadium seat booking',
};

export default function BookingPage() {
  return <BookingShell />;
}

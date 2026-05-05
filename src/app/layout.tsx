import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TicketFlow — Interactive Stadium Tickets',
  description: 'Book your seats with our immersive 3D stadium experience',
  keywords: 'tickets, stadium, soccer, football, world cup, metlife',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Layout Builder — TicketFlow Admin',
  description: 'Admin seat map editor',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

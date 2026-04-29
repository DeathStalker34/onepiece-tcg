import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { UserProvider } from '@/lib/user-context';
import { UserGate } from '@/components/user-gate';
import { TopNav } from '@/components/top-nav';

export const metadata: Metadata = {
  title: 'OPTCG Sim',
  description: 'Simulador web del One Piece Trading Card Game',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <UserProvider>
          <TopNav />
          {children}
          <UserGate />
        </UserProvider>
      </body>
    </html>
  );
}

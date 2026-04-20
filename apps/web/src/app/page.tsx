import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">Simulador One Piece TCG</h1>
      <p className="text-muted-foreground">Fase 1 · card data pipeline.</p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/cards">Explore cards</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/builder">My decks</Link>
        </Button>
      </div>
    </main>
  );
}

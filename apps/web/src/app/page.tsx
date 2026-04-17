import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">Simulador One Piece TCG</h1>
      <p className="text-muted-foreground">Fase 0 · setup completo.</p>
      <Button>Empezar (próximamente)</Button>
    </main>
  );
}

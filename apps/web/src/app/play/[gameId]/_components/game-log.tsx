'use client';

import type { GameEvent } from '@optcg/engine';
import { useGame } from './game-provider';
import { Button } from '@/components/ui/button';

function eventLabel(e: GameEvent): string {
  switch (e.kind) {
    case 'PhaseEntered':
      return `→ ${e.phase} phase`;
    case 'CardDrawn':
      return `P${e.player} drew ${e.count}`;
    case 'CardPlayed':
      return `P${e.player} played ${e.cardId}`;
    case 'DonAttached':
      return `P${e.player} attached DON to ${e.target}`;
    case 'AttackDeclared':
      return `${e.attacker} → ${e.target} (power ${e.power})`;
    case 'CounterPlayed':
      return `P${e.player} countered with ${e.cardId} (+${e.counterAmount})`;
    case 'BlockerUsed':
      return `Blocker ${e.blockerInstanceId}`;
    case 'CharacterKod':
      return `KO: ${e.cardId}`;
    case 'LifeLost':
      return `P${e.player} life -1 (→ ${e.remaining}) revealed ${e.revealedCardId}`;
    case 'TriggerResolved':
      return `Trigger on ${e.cardId}: ${e.activated ? 'activated' : 'declined'}`;
    case 'EffectResolved':
      return `Effect: ${e.effect.kind} from ${e.sourceCardId}`;
    case 'GameOver':
      return `GAME OVER — winner: P${e.winner}`;
  }
}

export function GameLog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { events } = useGame();
  const last = events.slice(-100).reverse();
  return (
    <aside
      className={`fixed right-0 top-0 z-30 h-screen w-80 transform border-l border-amber-800/50 bg-stone-900/95 p-4 text-xs text-amber-100 shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      aria-hidden={!open}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold uppercase tracking-wider">Game log</div>
        <Button size="sm" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
      <ol className="max-h-[calc(100vh-80px)] space-y-1 overflow-y-auto">
        {last.length === 0 ? (
          <li className="italic opacity-50">No events yet.</li>
        ) : (
          last.map((e, i) => <li key={i}>{eventLabel(e)}</li>)
        )}
      </ol>
    </aside>
  );
}

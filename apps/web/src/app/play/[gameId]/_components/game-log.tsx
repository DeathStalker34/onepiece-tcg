'use client';

import type { GameEvent } from '@optcg/engine';
import { useGame } from './game-provider';

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

export function GameLog() {
  const { events } = useGame();
  const last = events.slice(-50).reverse();
  return (
    <aside className="zone-frame max-h-[400px] w-56 shrink-0 overflow-y-auto p-3 text-xs">
      <div className="zone-label mb-2">Game log</div>
      <ol className="space-y-1">
        {last.length === 0 ? (
          <li className="italic opacity-50">No events yet.</li>
        ) : (
          last.map((e, i) => <li key={i}>{eventLabel(e)}</li>)
        )}
      </ol>
    </aside>
  );
}

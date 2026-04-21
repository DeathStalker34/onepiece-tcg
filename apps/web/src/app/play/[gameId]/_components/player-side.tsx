'use client';

import { useGame } from './game-provider';
import type { PlayerIndex } from '@optcg/engine';

export function PlayerSide({ playerIndex }: { playerIndex: PlayerIndex }) {
  const { state } = useGame();
  const p = state.players[playerIndex];
  const isActive = state.activePlayer === playerIndex && state.priorityWindow === null;
  const label = `Player ${playerIndex} — ${p.playerId}`;

  return (
    <section
      className={`zone-frame space-y-3 ${isActive ? 'active-player-glow' : ''}`}
      aria-label={label}
    >
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="zone-label">Turn {state.turn}</span>
      </header>

      <div className="grid grid-cols-[auto_1fr_auto] gap-3">
        {/* Leader + Life column */}
        <div className="space-y-1">
          <div className="zone-label">Leader / Life</div>
          <div className="zone-frame flex items-center gap-2 p-2">
            <div className="aspect-[5/7] w-16 rounded border border-amber-900/60 bg-stone-900/50">
              <div className="flex h-full items-center justify-center text-xs">
                {p.leader.cardId}
              </div>
            </div>
            <div className="text-center">
              <div className="zone-label">Life</div>
              <div className="text-2xl font-bold">{p.life.length}</div>
            </div>
          </div>
        </div>

        {/* Center: Character row + Stage */}
        <div className="space-y-2">
          <div className="zone-label">Characters</div>
          <div className="zone-frame flex h-24 items-center gap-2 p-2">
            {p.characters.length === 0 ? (
              <span className="text-xs italic opacity-50">No characters</span>
            ) : (
              p.characters.map((c) => (
                <div
                  key={c.instanceId}
                  className="aspect-[5/7] w-12 rounded border border-amber-900/60 bg-stone-900/50 text-[10px]"
                  title={c.cardId}
                >
                  <div className="flex h-full items-center justify-center truncate p-1">
                    {c.cardId}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="zone-label">Stage:</div>
            <span className="text-xs">{p.stage ? p.stage.cardId : '—'}</span>
          </div>
        </div>

        {/* Right: DON + Deck + Trash */}
        <div className="space-y-2">
          <div>
            <div className="zone-label">DON</div>
            <div className="text-sm">
              Active <strong>{p.donActive}</strong> · Rested <strong>{p.donRested}</strong> · Deck{' '}
              {p.donDeck}
            </div>
          </div>
          <div>
            <div className="zone-label">Deck</div>
            <div className="text-sm">{p.deck.length} cards</div>
          </div>
          <div>
            <div className="zone-label">Trash</div>
            <div className="text-sm">{p.trash.length} cards</div>
          </div>
          {p.banishZone.length > 0 && (
            <div>
              <div className="zone-label">Banished</div>
              <div className="text-sm">{p.banishZone.length} cards</div>
            </div>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-between text-xs">
        <span>Hand: {p.hand.length} cards</span>
        {p.mulliganTaken && <span className="opacity-70">Mulligan taken</span>}
      </footer>
    </section>
  );
}

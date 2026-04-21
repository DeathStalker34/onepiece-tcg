'use client';

import { useGame } from './game-provider';
import { LeaderCard } from './leader-card';
import { CharacterCard } from './character-card';
import { DonPool } from './don-pool';
import { Hand } from './hand';
import type { PlayerIndex } from '@optcg/engine';

export function PlayerSide({ playerIndex }: { playerIndex: PlayerIndex }) {
  const { state, dispatch } = useGame();
  const p = state.players[playerIndex];
  const isActive = state.activePlayer === playerIndex && state.priorityWindow === null;
  const label = `Player ${playerIndex} — ${p.playerId}`;

  const inMain =
    state.activePlayer === playerIndex && state.phase === 'Main' && state.priorityWindow === null;

  const leaderStatic = state.catalog[p.leader.cardId];
  const leaderHasActivateMain =
    leaderStatic?.effects.some((e) => e.trigger === 'Activate:Main') ?? false;
  const canActivateLeader = inMain && !p.leader.rested && leaderHasActivateMain;

  function activateLeader() {
    dispatch({ kind: 'ActivateMain', player: playerIndex, source: { kind: 'Leader' } });
  }

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
          <div className="zone-label">Leader</div>
          <div className="zone-frame p-2">
            <LeaderCard
              leader={p.leader}
              lifeCount={p.life.length}
              onActivateMain={activateLeader}
              canActivate={canActivateLeader}
            />
          </div>
        </div>

        {/* Center: Character row + Stage */}
        <div className="space-y-2">
          <div className="zone-label">Characters</div>
          <div className="zone-frame flex h-28 items-center gap-2 overflow-x-auto p-2">
            {p.characters.length === 0 ? (
              <span className="text-xs italic opacity-50">No characters</span>
            ) : (
              p.characters.map((c) => {
                const charStatic = state.catalog[c.cardId];
                const hasActivateMain =
                  charStatic?.effects.some((e) => e.trigger === 'Activate:Main') ?? false;
                const canActivate = inMain && !c.rested && hasActivateMain;
                return (
                  <CharacterCard
                    key={c.instanceId}
                    char={c}
                    onActivateMain={() =>
                      dispatch({
                        kind: 'ActivateMain',
                        player: playerIndex,
                        source: { kind: 'Character', instanceId: c.instanceId },
                      })
                    }
                    canActivate={canActivate}
                  />
                );
              })
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="zone-label">Stage:</div>
            <span className="text-xs">{p.stage ? p.stage.cardId : '—'}</span>
          </div>
        </div>

        {/* Right: DON + Deck + Trash */}
        <div className="space-y-2">
          <DonPool
            active={p.donActive}
            rested={p.donRested}
            donDeck={p.donDeck}
            compact
            playerIndex={playerIndex}
          />
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

      <Hand
        cards={p.hand}
        hidden={playerIndex !== state.activePlayer /* MVP: show active's hand only */}
        label={`Hand — P${playerIndex}`}
        clickable={playerIndex === state.activePlayer && state.phase === 'Main'}
        playerIndex={playerIndex}
      />

      <footer className="flex items-center justify-end text-xs">
        {p.mulliganTaken && <span className="opacity-70">Mulligan taken</span>}
      </footer>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { useGame } from './game-provider';
import type { PlayerIndex } from '@optcg/engine';
import { LeaderCard } from './leader-card';
import { CharacterCard } from './character-card';
import { Hand } from './hand';
import { DonStack } from './don-stack';
import { PileStack } from './pile-stack';
import type { ActionMenuOption } from './action-menu';
import { TargetPicker, buildAttackTargets, type AttackTarget } from './target-picker';

export function PlayerSide({ playerIndex }: { playerIndex: PlayerIndex }) {
  const { state, dispatch } = useGame();
  const p = state.players[playerIndex];
  const opp = state.players[playerIndex === 0 ? 1 : 0];
  const isActive = state.activePlayer === playerIndex && state.priorityWindow === null;
  const inMain =
    state.phase === 'Main' && state.priorityWindow === null && state.activePlayer === playerIndex;

  const [pendingAttacker, setPendingAttacker] = useState<
    { kind: 'Leader' } | { kind: 'Character'; instanceId: string } | null
  >(null);

  const leaderStatic = state.catalog[p.leader.cardId];
  const leaderActions: ActionMenuOption[] = [];
  if (inMain && !p.leader.rested) {
    if (p.firstTurnUsed) {
      leaderActions.push({
        label: 'Attack',
        onClick: () => setPendingAttacker({ kind: 'Leader' }),
      });
    }
    if (leaderStatic?.effects.some((e) => e.trigger === 'Activate:Main')) {
      leaderActions.push({
        label: 'Activate main',
        onClick: () =>
          dispatch({
            kind: 'ActivateMain',
            player: playerIndex,
            source: { kind: 'Leader' },
          }),
      });
    }
  }

  function resolveAttackTarget(target: AttackTarget) {
    if (!pendingAttacker) return;
    const actionTarget =
      target.kind === 'Leader'
        ? { kind: 'Leader' as const }
        : {
            kind: 'Character' as const,
            instanceId: target.instanceId!,
            owner: (playerIndex === 0 ? 1 : 0) as PlayerIndex,
          };
    dispatch({
      kind: 'DeclareAttack',
      player: playerIndex,
      attacker: pendingAttacker,
      target: actionTarget,
    });
    setPendingAttacker(null);
  }

  const attackTargets = buildAttackTargets(opp.leader, opp.characters);

  return (
    <section
      className={`zone-frame space-y-3 ${isActive ? 'active-player-glow' : ''}`}
      aria-label={`Player ${playerIndex}`}
    >
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          Player {playerIndex} — {p.playerId}
        </span>
        <span className="zone-label">Turn {state.turn}</span>
      </header>

      <div className="grid grid-cols-[auto_1fr_auto] gap-4">
        <div className="space-y-1">
          <div className="zone-label">Leader</div>
          <div className="zone-frame p-2">
            <LeaderCard leader={p.leader} lifeCount={p.life.length} actions={leaderActions} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="zone-label">Characters</div>
          <div className="zone-frame flex h-40 items-center gap-2 overflow-x-auto p-2">
            {p.characters.length === 0 ? (
              <span className="text-xs italic opacity-50">No characters</span>
            ) : (
              p.characters.map((c) => {
                const charStatic = state.catalog[c.cardId];
                const actions: ActionMenuOption[] = [];
                if (inMain && !c.rested) {
                  if (
                    p.firstTurnUsed &&
                    (!c.summoningSickness || (charStatic?.keywords.includes('Rush') ?? false))
                  ) {
                    actions.push({
                      label: 'Attack',
                      onClick: () =>
                        setPendingAttacker({ kind: 'Character', instanceId: c.instanceId }),
                    });
                  }
                  if (charStatic?.effects.some((e) => e.trigger === 'Activate:Main')) {
                    actions.push({
                      label: 'Activate main',
                      onClick: () =>
                        dispatch({
                          kind: 'ActivateMain',
                          player: playerIndex,
                          source: { kind: 'Character', instanceId: c.instanceId },
                        }),
                    });
                  }
                }
                return <CharacterCard key={c.instanceId} char={c} actions={actions} />;
              })
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="zone-label">Stage:</div>
            <span className="text-xs">{p.stage ? p.stage.cardId : '—'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <DonStack playerIndex={playerIndex} />
          <div className="flex gap-3">
            <PileStack count={p.deck.length} label="Deck" size="sm" />
            <PileStack count={p.trash.length} label="Trash" size="sm" />
            {p.banishZone.length > 0 && (
              <PileStack count={p.banishZone.length} label="Banish" size="sm" />
            )}
          </div>
        </div>
      </div>

      <Hand
        cards={p.hand}
        hidden={playerIndex !== state.activePlayer}
        label={`Hand — P${playerIndex}`}
        clickable={inMain}
        playerIndex={playerIndex}
      />

      {p.mulliganTaken && <div className="text-xs opacity-70">Mulligan taken</div>}

      <TargetPicker
        title="Pick attack target"
        targets={attackTargets}
        open={!!pendingAttacker}
        onPick={resolveAttackTarget}
        onCancel={() => setPendingAttacker(null)}
      />
    </section>
  );
}

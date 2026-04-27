'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cardImagePath } from '@/lib/card-image';
import { useGame } from './game-provider';
import { computeEffectivePower } from '@optcg/engine';
import type { PlayerIndex } from '@optcg/engine';
import { LeaderCard } from './leader-card';
import { CharacterCard } from './character-card';
import { Hand } from './hand';
import { OpponentStatus } from './opponent-status';
import { DonStack } from './don-stack';
import { PileStack } from './pile-stack';
import { PileViewer } from './pile-viewer';
import type { ActionMenuOption } from './action-menu';
import {
  TargetPicker,
  buildAttackTargets,
  type AttackTarget,
  type AttackerInfo,
} from './target-picker';

export function PlayerSide({
  playerIndex,
  mirror = false,
}: {
  playerIndex: PlayerIndex;
  mirror?: boolean;
}) {
  const { state, dispatch, botPlayers, isOnline, myPlayerIndex } = useGame();
  const p = state.players[playerIndex];
  const isActive = state.activePlayer === playerIndex && state.priorityWindow === null;
  const inMainRaw =
    state.phase === 'Main' && state.priorityWindow === null && state.activePlayer === playerIndex;
  const inMain = inMainRaw && (!isOnline || myPlayerIndex === playerIndex);
  const isPvAI = Boolean(botPlayers[0] || botPlayers[1]);
  const isYou =
    isOnline && myPlayerIndex !== null ? playerIndex === myPlayerIndex : !botPlayers[playerIndex];
  const friendlyName = isPvAI || isOnline ? (isYou ? 'You' : 'Opponent') : `Player ${playerIndex}`;
  const isOpponentInOnline = isOnline && myPlayerIndex !== null && playerIndex !== myPlayerIndex;

  const [pendingAttacker, setPendingAttacker] = useState<
    { kind: 'Leader' } | { kind: 'Character'; instanceId: string } | null
  >(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [banishOpen, setBanishOpen] = useState(false);

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

  const attackTargets = buildAttackTargets(state, playerIndex === 0 ? 1 : 0);

  let attackerInfo: AttackerInfo | null = null;
  if (pendingAttacker) {
    if (pendingAttacker.kind === 'Leader') {
      attackerInfo = {
        cardId: p.leader.cardId,
        power: computeEffectivePower(state, { kind: 'Leader', owner: playerIndex }),
      };
    } else {
      const char = p.characters.find((c) => c.instanceId === pendingAttacker.instanceId);
      if (char) {
        attackerInfo = {
          cardId: char.cardId,
          power: computeEffectivePower(state, {
            kind: 'Character',
            instanceId: char.instanceId,
            owner: playerIndex,
          }),
        };
      }
    }
  }

  return (
    <section
      className={`zone-frame flex ${mirror ? 'flex-col-reverse' : 'flex-col'} gap-2 ${isActive ? 'active-player-glow' : ''}`}
      aria-label={`Player ${playerIndex}`}
    >
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold">{friendlyName}</span>
        <span className="zone-label">Turn {state.turn}</span>
      </header>

      <div className="grid grid-cols-[auto_1fr_auto] gap-3">
        <div className="space-y-1">
          <div className="zone-label">Leader</div>
          <div className="zone-frame p-2">
            <LeaderCard leader={p.leader} lifeCount={p.life.length} actions={leaderActions} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="zone-label">Characters</div>
            <div className="zone-label">Stage</div>
          </div>
          <div className="flex justify-center">
            <div className="zone-frame inline-flex items-center gap-2 p-2">
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, slotIdx) => {
                  const c = p.characters[slotIdx];
                  if (c) {
                    const charStatic = state.catalog[c.cardId];
                    const actions: ActionMenuOption[] = [];
                    if (inMain && !c.rested && p.firstTurnUsed) {
                      if (
                        !c.summoningSickness ||
                        (charStatic?.keywords.includes('Rush') ?? false)
                      ) {
                        actions.push({
                          label: 'Attack',
                          onClick: () =>
                            setPendingAttacker({ kind: 'Character', instanceId: c.instanceId }),
                        });
                      }
                    }
                    if (inMain && !c.rested) {
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
                  }
                  return (
                    <div
                      key={`empty-${slotIdx}`}
                      className="aspect-[5/7] w-24 rounded border border-dashed border-amber-900/30 bg-stone-900/20"
                      aria-hidden
                    />
                  );
                })}
              </div>
              <div className="mx-2 h-28 w-px bg-amber-900/40" aria-hidden />
              <div className="flex flex-col items-center gap-1">
                {p.stage ? (
                  <div className="relative aspect-[5/7] w-24 overflow-hidden rounded border-2 border-amber-700">
                    <Image
                      src={cardImagePath(p.stage.cardId)}
                      alt={p.stage.cardId}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[5/7] w-24 rounded border border-dashed border-amber-900/30 bg-stone-900/20"
                    aria-hidden
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <DonStack playerIndex={playerIndex} />
          <div className="flex gap-3">
            <PileStack
              count={p.deck.length}
              label="Deck"
              size="sm"
              onClick={() => setDeckOpen(true)}
            />
            <PileStack
              count={p.trash.length}
              label="Trash"
              size="sm"
              onClick={() => setTrashOpen(true)}
            />
            {p.banishZone.length > 0 && (
              <PileStack
                count={p.banishZone.length}
                label="Banish"
                size="sm"
                onClick={() => setBanishOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      {botPlayers[playerIndex] || isOpponentInOnline ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex justify-end">{botPlayers[playerIndex] && <OpponentStatus />}</div>
          <Hand cards={p.hand} hidden clickable={false} playerIndex={playerIndex} />
          <div />
        </div>
      ) : (
        <Hand
          cards={p.hand}
          hidden={!isPvAI && !isOnline && playerIndex !== state.activePlayer}
          clickable={inMain}
          playerIndex={playerIndex}
        />
      )}

      <TargetPicker
        attacker={attackerInfo}
        targets={attackTargets}
        open={!!pendingAttacker}
        onPick={resolveAttackTarget}
        onCancel={() => setPendingAttacker(null)}
      />

      <PileViewer
        title={`Player ${playerIndex} — Deck`}
        cards={p.deck}
        open={deckOpen}
        onOpenChange={setDeckOpen}
      />
      <PileViewer
        title={`Player ${playerIndex} — Trash`}
        cards={p.trash}
        open={trashOpen}
        onOpenChange={setTrashOpen}
      />
      <PileViewer
        title={`Player ${playerIndex} — Banished`}
        cards={p.banishZone}
        open={banishOpen}
        onOpenChange={setBanishOpen}
      />
    </section>
  );
}

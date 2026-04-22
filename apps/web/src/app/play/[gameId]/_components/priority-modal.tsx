'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cardImagePath } from '@/lib/card-image';
import { useGame } from './game-provider';
import type { Action, PriorityWindow } from '@optcg/engine';

export function PriorityModal() {
  const { state, dispatch, dispatchBatch, botPlayers } = useGame();
  const pw = state.priorityWindow;

  if (!pw) return null;

  // Find the actor for this priority window
  let actor: 0 | 1 | null = null;
  if (pw.kind === 'Mulligan') actor = pw.player;
  else if (pw.kind === 'CounterStep') actor = pw.defender.owner;
  else if (pw.kind === 'BlockerStep') actor = pw.originalTarget.owner;
  else if (pw.kind === 'TriggerStep') actor = pw.owner;

  if (actor !== null && botPlayers[actor]) return null;

  switch (pw.kind) {
    case 'Mulligan':
      return <MulliganVariant pw={pw} />;
    case 'CounterStep':
      return <CounterVariant pw={pw} />;
    case 'BlockerStep':
      return <BlockerVariant pw={pw} />;
    case 'TriggerStep':
      return <TriggerVariant pw={pw} />;
    default:
      return null;
  }

  function MulliganVariant({ pw }: { pw: Extract<PriorityWindow, { kind: 'Mulligan' }> }) {
    const player = pw.player;
    const hand = state.players[player].hand;
    return (
      <Dialog open modal>
        <DialogContent className="max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Player {player} — Mulligan?</DialogTitle>
            <DialogDescription>
              You drew 5 cards. Keep them or redraw 5 new cards (only once).
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 overflow-x-auto py-2">
            {hand.map((cardId, i) => (
              <div
                key={`${cardId}-${i}`}
                className="relative aspect-[5/7] w-24 shrink-0 overflow-hidden rounded border border-amber-900/60"
              >
                <Image
                  src={cardImagePath(cardId)}
                  alt={cardId}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => dispatch({ kind: 'Mulligan', player, mulligan: true })}
            >
              Mulligan
            </Button>
            <Button onClick={() => dispatch({ kind: 'Mulligan', player, mulligan: false })}>
              Keep
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function CounterVariant({ pw }: { pw: Extract<PriorityWindow, { kind: 'CounterStep' }> }) {
    const [staged, setStaged] = useState<number[]>([]);

    const defenderIdx = pw.defender.owner;
    const attackerIdx = pw.attacker.owner;
    const defender = state.players[defenderIdx];

    // Resolve card IDs for attacker + defender visuals
    const attackerSource = pw.attacker.source;
    const defenderTarget = pw.defender.target;
    const attackerCardId =
      attackerSource.kind === 'Leader'
        ? state.players[attackerIdx].leader.cardId
        : (state.players[attackerIdx].characters.find(
            (c) => c.instanceId === attackerSource.instanceId,
          )?.cardId ?? '???');
    const defenderCardId =
      defenderTarget.kind === 'Leader'
        ? state.players[defenderIdx].leader.cardId
        : (state.players[defenderIdx].characters.find(
            (c) => c.instanceId === defenderTarget.instanceId,
          )?.cardId ?? '???');

    const candidates = defender.hand
      .map((cardId, i) => ({ cardId, handIndex: i, card: state.catalog[cardId] }))
      .filter((x) => x.card && x.card.counter !== null && x.card.counter > 0);

    const atk = pw.attacker.attackPower;
    const baseDef = pw.defender.defensePower;
    const stagedCounterTotal = staged.reduce((sum, idx) => {
      const c = state.catalog[defender.hand[idx]];
      return sum + (c?.counter ?? 0);
    }, 0);
    const predictedDef = baseDef + stagedCounterTotal;
    const willHit = atk >= predictedDef;

    function toggleStage(handIndex: number) {
      setStaged((prev) =>
        prev.includes(handIndex) ? prev.filter((i) => i !== handIndex) : [...prev, handIndex],
      );
    }

    function handleConfirm() {
      if (staged.length === 0) {
        dispatch({ kind: 'DeclineCounter', player: defenderIdx });
        return;
      }
      const actions: Action[] = [];
      // Apply in DESCENDING handIndex order so earlier indices don't shift
      const ordered = [...staged].sort((a, b) => b - a);
      for (const idx of ordered) {
        actions.push({ kind: 'PlayCounter', player: defenderIdx, handIndex: idx });
      }
      actions.push({ kind: 'DeclineCounter', player: defenderIdx });
      dispatchBatch(actions);
    }

    return (
      <Dialog open modal>
        <DialogContent className="max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>⚔ Counter Step</DialogTitle>
            <DialogDescription>
              Select counters to stage. Defense updates as you add/remove. Click Confirm to apply
              all at once.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center gap-6 py-4">
            <div className="flex flex-col items-center">
              <span className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-red-400">
                Attacker
              </span>
              <div className="relative aspect-[5/7] w-28 overflow-hidden rounded-md border-2 border-red-600 shadow-lg shadow-red-900/50">
                <Image
                  src={cardImagePath(attackerCardId)}
                  alt=""
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <div className="mt-2 rounded bg-red-700 px-3 py-1 text-lg font-bold text-white">
                ⚔ {atk.toLocaleString()}
              </div>
            </div>

            <div
              className={`text-7xl font-bold ${willHit ? 'animate-pulse text-red-500' : 'text-green-500'}`}
              aria-hidden
            >
              →
            </div>

            <div className="flex flex-col items-center">
              <span
                className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${willHit ? 'text-stone-400' : 'text-green-400'}`}
              >
                Defender
              </span>
              <div
                className={`relative aspect-[5/7] w-28 overflow-hidden rounded-md border-2 shadow-lg ${willHit ? 'border-stone-600 shadow-stone-900/50' : 'border-green-600 shadow-green-900/50'}`}
              >
                <Image
                  src={cardImagePath(defenderCardId)}
                  alt=""
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <div
                key={predictedDef}
                className={`mt-2 rounded px-3 py-1 text-lg font-bold text-white animate-in zoom-in-75 duration-300 ${willHit ? 'bg-stone-600' : 'bg-green-700'}`}
              >
                🛡 {predictedDef.toLocaleString()}
                {stagedCounterTotal > 0 && (
                  <span className="ml-1 text-sm opacity-80">
                    ({baseDef.toLocaleString()} + {stagedCounterTotal.toLocaleString()})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-center text-sm font-semibold">
            {willHit ? (
              <span className="text-red-400">
                Short by {(atk - predictedDef + 1).toLocaleString()} — attack will land.
              </span>
            ) : (
              <span className="text-green-400">
                Defense exceeds attack by {(predictedDef - atk).toLocaleString()} — attack will
                miss.
              </span>
            )}
          </div>

          {candidates.length > 0 ? (
            <>
              <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
                Counters in hand:
              </div>
              <div className="flex gap-2 overflow-x-auto py-2">
                {candidates.map(({ cardId, handIndex, card }) => {
                  const isStaged = staged.includes(handIndex);
                  return (
                    <button
                      key={`${cardId}-${handIndex}`}
                      type="button"
                      aria-pressed={isStaged}
                      className={`group relative flex shrink-0 flex-col items-center gap-1 rounded border p-2 transition ${
                        isStaged
                          ? 'border-green-500 bg-green-900/30 ring-2 ring-green-500'
                          : 'border-amber-900/60 hover:ring-2 hover:ring-amber-500'
                      }`}
                      onClick={() => toggleStage(handIndex)}
                    >
                      <div className="relative aspect-[5/7] w-20 overflow-hidden rounded">
                        <Image
                          src={cardImagePath(cardId)}
                          alt={cardId}
                          fill
                          sizes="80px"
                          className={`object-cover transition ${isStaged ? 'scale-95' : ''}`}
                        />
                        {isStaged && (
                          <span className="absolute inset-0 flex items-center justify-center bg-green-900/50 text-3xl font-bold text-white">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="rounded bg-green-700 px-2 py-0.5 text-xs font-bold text-white">
                        +{card?.counter ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm italic opacity-60">No counter cards in hand.</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => dispatch({ kind: 'DeclineCounter', player: defenderIdx })}
            >
              Decline counter
            </Button>
            <Button onClick={handleConfirm} disabled={staged.length === 0}>
              Confirm
              {staged.length > 0
                ? ` — ${staged.length} counter${staged.length > 1 ? 's' : ''}`
                : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function BlockerVariant({ pw }: { pw: Extract<PriorityWindow, { kind: 'BlockerStep' }> }) {
    const defenderIdx = pw.originalTarget.owner;
    const defender = state.players[defenderIdx];
    // Available blockers: active, not-used-this-turn, keyword Blocker
    const blockers = defender.characters.filter((c) => {
      if (c.rested || c.usedBlockerThisTurn) return false;
      const card = state.catalog[c.cardId];
      return card?.keywords.includes('Blocker') ?? false;
    });
    return (
      <Dialog open modal>
        <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Blocker Step — Player {defenderIdx}</DialogTitle>
            <DialogDescription>
              Redirect the attack to a Blocker character, or decline.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            {blockers.map((c) => (
              <button
                key={c.instanceId}
                type="button"
                className="flex flex-col items-center gap-1 rounded border p-2 hover:ring-2 hover:ring-primary"
                onClick={() =>
                  dispatch({
                    kind: 'UseBlocker',
                    player: defenderIdx,
                    blockerInstanceId: c.instanceId,
                  })
                }
              >
                <div className="relative aspect-[5/7] w-20 overflow-hidden rounded">
                  <Image
                    src={cardImagePath(c.cardId)}
                    alt={c.cardId}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <span className="text-xs">{c.cardId}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => dispatch({ kind: 'DeclineBlocker', player: defenderIdx })}
            >
              Decline blocker
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function TriggerVariant({ pw }: { pw: Extract<PriorityWindow, { kind: 'TriggerStep' }> }) {
    const ownerIdx = pw.owner;
    return (
      <Dialog open modal>
        <DialogContent className="max-w-xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Trigger — Player {ownerIdx}</DialogTitle>
            <DialogDescription>
              Life revealed <strong>{pw.revealedCardId}</strong>. Activate its Trigger effect?
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-4 py-2">
            <div className="relative aspect-[5/7] w-28 shrink-0 overflow-hidden rounded border border-amber-900/60">
              <Image
                src={cardImagePath(pw.revealedCardId)}
                alt={pw.revealedCardId}
                fill
                sizes="112px"
                className="object-cover"
              />
            </div>
            <pre className="text-xs opacity-80">{JSON.stringify(pw.triggerEffect, null, 2)}</pre>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                dispatch({ kind: 'ActivateTrigger', player: ownerIdx, activate: false })
              }
            >
              Decline
            </Button>
            <Button
              onClick={() =>
                dispatch({ kind: 'ActivateTrigger', player: ownerIdx, activate: true })
              }
            >
              Activate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
}

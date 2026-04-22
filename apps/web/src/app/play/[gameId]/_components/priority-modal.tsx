'use client';

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
import type { PriorityWindow } from '@optcg/engine';

export function PriorityModal() {
  const { state, dispatch } = useGame();
  const pw = state.priorityWindow;

  if (!pw) return null;

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
    const defenderIdx = pw.defender.owner;
    const defender = state.players[defenderIdx];
    // Counter candidates: hand cards with counter > 0
    const candidates = defender.hand
      .map((cardId, i) => ({ cardId, handIndex: i, card: state.catalog[cardId] }))
      .filter((x) => x.card && x.card.counter !== null && x.card.counter > 0);
    const atk = pw.attacker.attackPower;
    const def = pw.defender.defensePower;
    return (
      <Dialog open modal>
        <DialogContent className="max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Counter Step — Player {defenderIdx}</DialogTitle>
            <DialogDescription>
              Attacker power <strong>{atk}</strong> vs current defense <strong>{def}</strong>. Play
              counters to boost defense, or decline.
            </DialogDescription>
          </DialogHeader>
          {candidates.length === 0 ? (
            <p className="text-sm italic opacity-60">No counter candidates in hand.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto py-2">
              {candidates.map(({ cardId, handIndex, card }) => (
                <button
                  key={`${cardId}-${handIndex}`}
                  type="button"
                  className="group flex flex-col items-center gap-1 rounded border p-2 hover:ring-2 hover:ring-primary"
                  onClick={() => dispatch({ kind: 'PlayCounter', player: defenderIdx, handIndex })}
                >
                  <div className="relative aspect-[5/7] w-20 overflow-hidden rounded">
                    <Image
                      src={cardImagePath(cardId)}
                      alt={cardId}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <span className="text-xs">+{card?.counter ?? 0}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => dispatch({ kind: 'DeclineCounter', player: defenderIdx })}
            >
              Decline counter
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

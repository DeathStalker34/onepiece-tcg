'use client';

import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cardImagePath } from '@/lib/card-image';
import type { CardStatic, CharacterInPlay, LeaderInPlay } from '@optcg/engine';

export interface AttackTarget {
  kind: 'Leader' | 'Character';
  instanceId?: string;
  cardId: string;
  power: number;
  lifeRemaining?: number;
}

export interface AttackerInfo {
  cardId: string;
  power: number;
}

export function TargetPicker({
  attacker,
  targets,
  open,
  onPick,
  onCancel,
}: {
  attacker: AttackerInfo | null;
  targets: AttackTarget[];
  open: boolean;
  onPick: (target: AttackTarget) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a target</DialogTitle>
        </DialogHeader>

        <div className="flex items-stretch gap-4">
          {attacker && (
            <div className="flex flex-col items-center gap-2 rounded border border-amber-700/40 bg-stone-900/40 p-3">
              <span className="text-xs uppercase tracking-wide opacity-70">Attacker</span>
              <div className="relative aspect-[5/7] w-28 overflow-hidden rounded">
                <Image
                  src={cardImagePath(attacker.cardId)}
                  alt={attacker.cardId}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <span className="rounded bg-amber-600/80 px-2 py-0.5 text-sm font-bold text-white">
                {attacker.power.toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex items-center justify-center px-2 text-3xl opacity-60" aria-hidden>
            →
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <span className="text-xs uppercase tracking-wide opacity-70">Targets</span>
            {targets.length === 0 ? (
              <p className="text-sm italic opacity-60">No legal targets.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {targets.map((t) => {
                  const hits = attacker ? attacker.power >= t.power : false;
                  const delta = attacker ? attacker.power - t.power : 0;
                  return (
                    <button
                      key={`${t.kind}-${t.instanceId ?? 'leader'}`}
                      type="button"
                      className={`group flex flex-col items-center gap-2 rounded-lg border-2 p-2 transition ${
                        hits
                          ? 'border-emerald-600/60 bg-emerald-950/20 hover:border-emerald-400 hover:bg-emerald-900/30'
                          : 'border-red-700/50 bg-red-950/20 hover:border-red-500 hover:bg-red-900/30'
                      }`}
                      onClick={() => onPick(t)}
                    >
                      <div className="relative aspect-[5/7] w-24 overflow-hidden rounded shadow-md">
                        <Image
                          src={cardImagePath(t.cardId)}
                          alt={t.cardId}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                        <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
                          {t.power.toLocaleString()}
                        </span>
                        {t.kind === 'Leader' && t.lifeRemaining !== undefined && (
                          <span className="absolute bottom-1 left-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                            ♥ {t.lifeRemaining}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            hits ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                          }`}
                        >
                          {t.kind === 'Leader'
                            ? hits
                              ? '✓ Hits Leader'
                              : '✗ Defender wins'
                            : hits
                              ? '✓ Can KO'
                              : '✗ Survives'}
                        </span>
                        {attacker && delta !== 0 && (
                          <span className="text-[10px] opacity-70">
                            {delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-[10px] italic opacity-50">
              Based on base power · defender may add counters.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function buildAttackTargets(
  opponentLeader: LeaderInPlay,
  opponentLife: number,
  opponentCharacters: CharacterInPlay[],
  catalog: Record<string, CardStatic>,
): AttackTarget[] {
  const leaderCard = catalog[opponentLeader.cardId];
  const targets: AttackTarget[] = [
    {
      kind: 'Leader',
      cardId: opponentLeader.cardId,
      power: leaderCard?.power ?? 0,
      lifeRemaining: opponentLife,
    },
  ];
  for (const c of opponentCharacters) {
    if (c.rested) {
      const cs = catalog[c.cardId];
      targets.push({
        kind: 'Character',
        instanceId: c.instanceId,
        cardId: c.cardId,
        power: cs?.power ?? 0,
      });
    }
  }
  return targets;
}

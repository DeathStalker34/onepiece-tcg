'use client';

import Image from 'next/image';
import { Swords } from 'lucide-react';
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Choose a target</DialogTitle>
        </DialogHeader>

        <div className="flex items-stretch gap-4">
          {attacker && (
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs uppercase tracking-wide opacity-70">Attacker</span>
              <div className="relative aspect-[5/7] w-40 overflow-hidden rounded">
                <Image
                  src={cardImagePath(attacker.cardId)}
                  alt={attacker.cardId}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
                <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-sm font-bold text-white">
                  {attacker.power.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center px-2" aria-hidden>
            <Swords className="h-10 w-10 text-amber-600" strokeWidth={1.75} />
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
                      className="group flex flex-col items-center gap-2 rounded-lg p-1 transition hover:scale-105"
                      onClick={() => onPick(t)}
                    >
                      <div className="relative aspect-[5/7] w-40 overflow-hidden rounded shadow-md transition">
                        <Image
                          src={cardImagePath(t.cardId)}
                          alt={t.cardId}
                          fill
                          sizes="160px"
                          className="object-cover"
                        />
                        <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-sm font-bold text-white">
                          {t.power.toLocaleString()}
                        </span>
                        {t.kind === 'Leader' && t.lifeRemaining !== undefined && (
                          <span className="absolute left-1 top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
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

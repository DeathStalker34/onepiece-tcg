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
import type { CharacterInPlay, LeaderInPlay } from '@optcg/engine';

export interface AttackTarget {
  kind: 'Leader' | 'Character';
  instanceId?: string;
  cardId: string;
  label: string;
}

export function TargetPicker({
  title,
  targets,
  open,
  onPick,
  onCancel,
}: {
  title: string;
  targets: AttackTarget[];
  open: boolean;
  onPick: (target: AttackTarget) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Pick a target.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          {targets.length === 0 ? (
            <p className="col-span-3 text-sm italic opacity-60">No legal targets.</p>
          ) : (
            targets.map((t) => (
              <button
                key={`${t.kind}-${t.instanceId ?? 'leader'}`}
                type="button"
                className="group flex flex-col items-center gap-1 rounded border p-2 hover:ring-2 hover:ring-primary"
                onClick={() => onPick(t)}
              >
                <div className="relative aspect-[5/7] w-24 overflow-hidden rounded">
                  <Image
                    src={cardImagePath(t.cardId)}
                    alt={t.cardId}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
                <span className="text-xs">{t.label}</span>
              </button>
            ))
          )}
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
  opponentCharacters: CharacterInPlay[],
): AttackTarget[] {
  const targets: AttackTarget[] = [
    { kind: 'Leader', cardId: opponentLeader.cardId, label: 'Leader' },
  ];
  for (const c of opponentCharacters) {
    if (c.rested) {
      targets.push({
        kind: 'Character',
        instanceId: c.instanceId,
        cardId: c.cardId,
        label: c.cardId,
      });
    }
  }
  return targets;
}

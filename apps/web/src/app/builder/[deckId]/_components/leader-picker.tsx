'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Card } from '@optcg/card-data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  catalog: Card[];
  current: Card | null;
  onPick: (leader: Card) => void;
}

export function LeaderPicker({ catalog, current, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const leaders = catalog.filter((c) => c.type === 'LEADER');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">
          {current ? `Leader: ${current.name}` : 'Pick a leader'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Pick a leader</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[70vh] grid-cols-3 gap-3 overflow-y-auto md:grid-cols-5">
          {leaders.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`relative aspect-[5/7] overflow-hidden rounded border ${current?.id === l.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => {
                onPick(l);
                setOpen(false);
              }}
            >
              <Image src={l.imagePath} alt={l.name} fill sizes="200px" className="object-cover" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import type { Card } from '@optcg/card-data';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseDeckText, serializeDeckText } from '@/lib/deck-txt';
import { serializeDeckJson } from '@/lib/deck-json';

interface Props {
  name: string;
  leader: Card | null;
  cards: Array<{ cardId: string; quantity: number }>;
  onImport: (parsed: { cards: Array<{ cardId: string; quantity: number }> }) => void;
}

function download(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportExport({ name, leader, cards, onImport }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function handleImport() {
    try {
      const parsed = parseDeckText(input);
      onImport(parsed);
      setInput('');
      setError(null);
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleExportTxt() {
    const content = serializeDeckText({ cards });
    const header = `# Deck: ${name}\n# Leader: ${leader?.id ?? 'none'}${leader ? ` (${leader.name})` : ''}\n`;
    download(`${name.replace(/\s+/g, '-').toLowerCase()}.txt`, header + content);
  }

  function handleExportJson() {
    const content = serializeDeckJson({
      name,
      leaderCardId: leader?.id ?? null,
      cards,
    });
    download(`${name.replace(/\s+/g, '-').toLowerCase()}.json`, content, 'application/json');
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm">
              Import .txt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import deck from .txt</DialogTitle>
              <DialogDescription>
                Paste a decklist. Lines like <code>4x OP01-013</code> or <code>OP01-013 x 4</code>{' '}
                are accepted.
              </DialogDescription>
            </DialogHeader>
            <textarea
              className="min-h-[200px] w-full rounded border p-2 font-mono text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={'4x OP01-013\n4x OP01-014\n…'}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end">
              <Button onClick={handleImport}>Import</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button size="sm" variant="outline" onClick={handleExportTxt}>
          Export .txt
        </Button>
      </div>
      <Button size="sm" variant="outline" className="w-full" onClick={handleExportJson}>
        Export .json
      </Button>
    </div>
  );
}

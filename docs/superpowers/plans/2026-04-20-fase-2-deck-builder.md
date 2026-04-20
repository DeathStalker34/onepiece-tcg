# Fase 2 — Deck Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Builder web para construir mazos legales de OPTCG sobre el catálogo OP01+OP02 de Fase 1. Persistencia por usuario local + import/export `.txt`/`.json`.

**Architecture:** Extensión de `packages/card-data` (User/Deck/DeckCard en Prisma) + rutas API en `apps/web/src/app/api/**` + páginas `/builder` y `/builder/[deckId]`. Validación pura en `apps/web/src/lib/deck-validation.ts` (se mueve al engine en Fase 3).

**Tech Stack:** TypeScript strict, Prisma 5 + SQLite, Next.js 14 App Router, shadcn/ui, Tailwind, Vitest, zod.

**Branch:** `feature/fase-2-deck-builder` (ya creada con el spec commiteado).

**Modo autónomo:** plan aprobado implícitamente por el usuario. Ejecución sin gates de aprobación entre tareas; solo se escala si aparece un blocker externo (como Fase 1 con la API key).

---

## Task 1: Prisma — User/Deck/DeckCard + migración

**Files:**

- Modify: `packages/card-data/prisma/schema.prisma`
- Create: migración `prisma/migrations/YYYYMMDDHHMMSS_decks_v1/migration.sql`

- [ ] **Step 1:** añadir al final del `schema.prisma` (después del `Card` model) los 3 nuevos models:

```prisma
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  decks     Deck[]
}

model Deck {
  id            String   @id @default(uuid())
  userId        String
  name          String
  leaderCardId  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  cards         DeckCard[]

  @@index([userId])
}

model DeckCard {
  id        String @id @default(uuid())
  deckId    String
  cardId    String
  quantity  Int

  deck      Deck   @relation(fields: [deckId], references: [id], onDelete: Cascade)

  @@unique([deckId, cardId])
  @@index([deckId])
}
```

- [ ] **Step 2:** generar migración:

```bash
pnpm --filter @optcg/card-data exec prisma migrate dev --name decks_v1
```

Prisma crea `prisma/migrations/YYYYMMDDHHMMSS_decks_v1/migration.sql` con `CREATE TABLE User/Deck/DeckCard`. Client regenerado.

- [ ] **Step 3:** verificar

```bash
pnpm --filter @optcg/card-data typecheck
ls packages/card-data/prisma/migrations/
```

Expected: 3 migraciones listadas (init + cards_v1 + decks_v1). Typecheck verde.

- [ ] **Step 4:** commit

```bash
git add packages/card-data/prisma/schema.prisma packages/card-data/prisma/migrations/
git commit -m "$(cat <<'EOF'
feat(card-data): add User/Deck/DeckCard models and migration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Exportar tipos Deck/User desde @optcg/card-data

**Files:**

- Modify: `packages/card-data/src/index.ts`

- [ ] **Step 1:** añadir al final del `src/index.ts`:

```ts
export type { User, Deck, DeckCard } from '@prisma/client';
```

- [ ] **Step 2:** gates

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
```

- [ ] **Step 3:** commit

```bash
git add packages/card-data/src/index.ts
git commit -m "$(cat <<'EOF'
feat(card-data): export User/Deck/DeckCard types from package root

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: deck-validation lib (TDD)

**Files:**

- Create: `apps/web/src/lib/deck-validation.ts`
- Create: `apps/web/src/lib/deck-validation.test.ts`

- [ ] **Step 1:** red test

Crear `apps/web/src/lib/deck-validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateDeck, type DeckDraft, type CardRow } from './deck-validation';

function card(overrides: Partial<CardRow> & Pick<CardRow, 'id' | 'colors'>): CardRow {
  return {
    id: overrides.id,
    colors: overrides.colors,
    type: overrides.type ?? 'CHARACTER',
  };
}

const cards = new Map<string, CardRow>([
  ['OP01-001', card({ id: 'OP01-001', colors: ['Red'], type: 'LEADER' })],
  ['OP01-002', card({ id: 'OP01-002', colors: ['Red', 'Green'], type: 'LEADER' })],
  ['OP01-013', card({ id: 'OP01-013', colors: ['Red'] })],
  ['OP01-014', card({ id: 'OP01-014', colors: ['Green'] })],
  ['OP01-015', card({ id: 'OP01-015', colors: ['Blue'] })],
]);

describe('validateDeck', () => {
  it('flags missingLeader when leader is null', () => {
    const draft: DeckDraft = { leaderCardId: null, cards: [] };
    const r = validateDeck(draft, cards);
    expect(r.issues).toContainEqual({ kind: 'missingLeader' });
    expect(r.isLegal).toBe(false);
  });

  it('flags wrongCount when not exactly 50', () => {
    const draft: DeckDraft = {
      leaderCardId: 'OP01-001',
      cards: [{ cardId: 'OP01-013', quantity: 4 }],
    };
    const r = validateDeck(draft, cards);
    expect(r.issues).toContainEqual({ kind: 'wrongCount', expected: 50, actual: 4 });
    expect(r.totalCards).toBe(4);
  });

  it('flags overLimit when quantity > 4', () => {
    const draft: DeckDraft = {
      leaderCardId: 'OP01-001',
      cards: [{ cardId: 'OP01-013', quantity: 5 }],
    };
    const r = validateDeck(draft, cards);
    expect(r.issues).toContainEqual({
      kind: 'overLimit',
      cardId: 'OP01-013',
      quantity: 5,
    });
  });

  it('flags colorMismatch when card shares no color with leader', () => {
    const draft: DeckDraft = {
      leaderCardId: 'OP01-001',
      cards: [{ cardId: 'OP01-015', quantity: 4 }],
    };
    const r = validateDeck(draft, cards);
    expect(r.issues).toContainEqual({
      kind: 'colorMismatch',
      cardId: 'OP01-015',
      leaderColors: ['Red'],
      cardColors: ['Blue'],
    });
  });

  it('accepts a card that shares one of multiple leader colors', () => {
    const draft: DeckDraft = {
      leaderCardId: 'OP01-002',
      cards: [
        { cardId: 'OP01-013', quantity: 4 },
        { cardId: 'OP01-014', quantity: 4 },
      ],
    };
    const r = validateDeck(draft, cards);
    expect(r.issues.some((i) => i.kind === 'colorMismatch')).toBe(false);
  });

  it('considers a deck legal with leader + 50 exact + 4-max + matching colors', () => {
    const list: { cardId: string; quantity: number }[] = [];
    // 12 copies of OP01-013 wouldn't work (max 4). Use 13 distinct cards × ~4 copies ≈ 50.
    // Simpler: fake 50 via a synthetic card catalog.
    const bigCatalog = new Map(cards);
    for (let i = 100; i < 113; i += 1) {
      const id = `OP01-${i.toString().padStart(3, '0')}`;
      bigCatalog.set(id, card({ id, colors: ['Red'] }));
      list.push({ cardId: id, quantity: 4 });
    }
    // total 13 * 4 = 52, trim the last quantity to 2
    list[list.length - 1].quantity = 2;
    const draft: DeckDraft = { leaderCardId: 'OP01-001', cards: list };
    const r = validateDeck(draft, bigCatalog);
    expect(r.totalCards).toBe(50);
    expect(r.isLegal).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('sums multiple issues when deck is broken in many ways', () => {
    const draft: DeckDraft = {
      leaderCardId: null,
      cards: [
        { cardId: 'OP01-015', quantity: 5 }, // overLimit + no leader = no mismatch since leader null
      ],
    };
    const r = validateDeck(draft, cards);
    expect(r.issues.some((i) => i.kind === 'missingLeader')).toBe(true);
    expect(r.issues.some((i) => i.kind === 'overLimit')).toBe(true);
    expect(r.issues.some((i) => i.kind === 'wrongCount')).toBe(true);
  });
});
```

- [ ] **Step 2:** red run

```bash
pnpm --filter @optcg/web test -- deck-validation
```

Expected: fail (module not found).

- [ ] **Step 3:** implementar

Crear `apps/web/src/lib/deck-validation.ts`:

```ts
export interface CardRow {
  id: string;
  colors: string[];
  type: string;
}

export interface DeckDraft {
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

export type ValidationIssue =
  | { kind: 'missingLeader' }
  | { kind: 'wrongCount'; expected: 50; actual: number }
  | { kind: 'overLimit'; cardId: string; quantity: number }
  | {
      kind: 'colorMismatch';
      cardId: string;
      leaderColors: string[];
      cardColors: string[];
    };

export interface ValidationResult {
  totalCards: number;
  issues: ValidationIssue[];
  isLegal: boolean;
}

const MAX_COPIES_PER_CARD = 4;
const REQUIRED_TOTAL = 50 as const;

export function validateDeck(draft: DeckDraft, cardIndex: Map<string, CardRow>): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!draft.leaderCardId) {
    issues.push({ kind: 'missingLeader' });
  }

  const totalCards = draft.cards.reduce((sum, c) => sum + c.quantity, 0);
  if (totalCards !== REQUIRED_TOTAL) {
    issues.push({ kind: 'wrongCount', expected: REQUIRED_TOTAL, actual: totalCards });
  }

  for (const entry of draft.cards) {
    if (entry.quantity > MAX_COPIES_PER_CARD) {
      issues.push({
        kind: 'overLimit',
        cardId: entry.cardId,
        quantity: entry.quantity,
      });
    }
  }

  if (draft.leaderCardId) {
    const leader = cardIndex.get(draft.leaderCardId);
    if (leader) {
      const leaderColors = leader.colors;
      for (const entry of draft.cards) {
        const card = cardIndex.get(entry.cardId);
        if (!card) continue;
        const shared = card.colors.some((c) => leaderColors.includes(c));
        if (!shared) {
          issues.push({
            kind: 'colorMismatch',
            cardId: entry.cardId,
            leaderColors,
            cardColors: card.colors,
          });
        }
      }
    }
  }

  return {
    totalCards,
    issues,
    isLegal: issues.length === 0,
  };
}
```

- [ ] **Step 4:** green

```bash
pnpm --filter @optcg/web test -- deck-validation
```

Expected: 7 passed.

- [ ] **Step 5:** commit

```bash
git add apps/web/src/lib/deck-validation.ts apps/web/src/lib/deck-validation.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add deck-validation with leader/count/copies/colors rules

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: deck-txt y deck-json (TDD)

**Files:**

- Create: `apps/web/src/lib/deck-txt.ts`
- Create: `apps/web/src/lib/deck-txt.test.ts`
- Create: `apps/web/src/lib/deck-json.ts`
- Create: `apps/web/src/lib/deck-json.test.ts`

- [ ] **Step 1:** Crear `apps/web/src/lib/deck-txt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseDeckText, serializeDeckText, type ParsedDeck } from './deck-txt';

describe('parseDeckText', () => {
  it('parses "Nx ID" lines', () => {
    const r = parseDeckText('4x OP01-001\n4x OP01-013');
    expect(r.cards).toEqual([
      { cardId: 'OP01-001', quantity: 4 },
      { cardId: 'OP01-013', quantity: 4 },
    ]);
  });

  it('parses "ID xN" lines', () => {
    const r = parseDeckText('OP01-001 x 4\nOP01-013 x4');
    expect(r.cards).toEqual([
      { cardId: 'OP01-001', quantity: 4 },
      { cardId: 'OP01-013', quantity: 4 },
    ]);
  });

  it('defaults to quantity 1 when bare ID', () => {
    const r = parseDeckText('OP01-001');
    expect(r.cards).toEqual([{ cardId: 'OP01-001', quantity: 1 }]);
  });

  it('ignores empty lines and # comments', () => {
    const input = `# leader OP01-001
# this is a comment

4x OP01-013

    `;
    const r = parseDeckText(input);
    expect(r.cards).toEqual([{ cardId: 'OP01-013', quantity: 4 }]);
  });

  it('sums duplicates', () => {
    const r = parseDeckText('OP01-013\nOP01-013\n2x OP01-013');
    expect(r.cards).toEqual([{ cardId: 'OP01-013', quantity: 4 }]);
  });

  it('tolerates extra whitespace', () => {
    const r = parseDeckText('  4x OP01-013  ');
    expect(r.cards).toEqual([{ cardId: 'OP01-013', quantity: 4 }]);
  });

  it('throws on lines that match nothing recognisable', () => {
    expect(() => parseDeckText('some random text')).toThrow(/parse/i);
  });
});

describe('serializeDeckText', () => {
  it('produces "ID x N" lines sorted by id', () => {
    const deck: ParsedDeck = {
      cards: [
        { cardId: 'OP01-013', quantity: 4 },
        { cardId: 'OP01-001', quantity: 4 },
      ],
    };
    const out = serializeDeckText(deck);
    expect(out).toBe('OP01-001 x 4\nOP01-013 x 4');
  });

  it('round-trips parse(serialize(x))', () => {
    const original: ParsedDeck = {
      cards: [
        { cardId: 'OP01-001', quantity: 4 },
        { cardId: 'OP01-013', quantity: 2 },
        { cardId: 'OP02-001', quantity: 1 },
      ],
    };
    const text = serializeDeckText(original);
    const reparsed = parseDeckText(text);
    expect(reparsed.cards).toEqual(original.cards);
  });
});
```

- [ ] **Step 2:** red run → confirmar fallo (module not found).

- [ ] **Step 3:** Implementar `apps/web/src/lib/deck-txt.ts`:

```ts
export interface ParsedDeck {
  cards: Array<{ cardId: string; quantity: number }>;
}

// Matches: "4x OP01-001" | "OP01-001 x 4" | "OP01-001"
// Accepts optional _pN variant suffix.
const LINE_RE = /^\s*(?:(\d+)\s*[xX]\s+)?([A-Z]{2,3}\d{2}-\d+(?:_p\d+)?)(?:\s*[xX]\s*(\d+))?\s*$/;

export function parseDeckText(input: string): ParsedDeck {
  const bucket = new Map<string, number>();

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const m = LINE_RE.exec(line);
    if (!m) {
      throw new Error(`parseDeckText: cannot parse line: "${line}"`);
    }

    const [, leadingQ, cardId, trailingQ] = m;
    const qty = Number(leadingQ ?? trailingQ ?? 1);
    bucket.set(cardId, (bucket.get(cardId) ?? 0) + qty);
  }

  const cards = [...bucket.entries()]
    .map(([cardId, quantity]) => ({ cardId, quantity }))
    .sort((a, b) => a.cardId.localeCompare(b.cardId));

  return { cards };
}

export function serializeDeckText(deck: ParsedDeck): string {
  return [...deck.cards]
    .sort((a, b) => a.cardId.localeCompare(b.cardId))
    .map((c) => `${c.cardId} x ${c.quantity}`)
    .join('\n');
}
```

- [ ] **Step 4:** green (7 parse tests + 2 serialize tests = 9 total).

- [ ] **Step 5:** Crear `apps/web/src/lib/deck-json.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { serializeDeckJson, type DeckForExport } from './deck-json';

describe('serializeDeckJson', () => {
  it('produces version 1 envelope with leader and sorted cards', () => {
    const deck: DeckForExport = {
      name: 'My Deck',
      leaderCardId: 'OP01-001',
      cards: [
        { cardId: 'OP01-013', quantity: 4 },
        { cardId: 'OP01-001', quantity: 1 },
      ],
    };
    const obj = JSON.parse(serializeDeckJson(deck));
    expect(obj).toEqual({
      version: 1,
      name: 'My Deck',
      leader: 'OP01-001',
      cards: [
        { id: 'OP01-001', quantity: 1 },
        { id: 'OP01-013', quantity: 4 },
      ],
    });
  });

  it('handles null leader', () => {
    const deck: DeckForExport = {
      name: 'Empty',
      leaderCardId: null,
      cards: [],
    };
    const obj = JSON.parse(serializeDeckJson(deck));
    expect(obj.leader).toBeNull();
    expect(obj.cards).toEqual([]);
  });
});
```

- [ ] **Step 6:** Implementar `apps/web/src/lib/deck-json.ts`:

```ts
export interface DeckForExport {
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

export function serializeDeckJson(deck: DeckForExport): string {
  const payload = {
    version: 1,
    name: deck.name,
    leader: deck.leaderCardId,
    cards: [...deck.cards]
      .sort((a, b) => a.cardId.localeCompare(b.cardId))
      .map((c) => ({ id: c.cardId, quantity: c.quantity })),
  };
  return JSON.stringify(payload, null, 2);
}
```

- [ ] **Step 7:** gates + commit

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/web/src/lib/deck-txt.ts apps/web/src/lib/deck-txt.test.ts apps/web/src/lib/deck-json.ts apps/web/src/lib/deck-json.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add deck-txt parser/serializer and deck-json serializer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Fixtures — 2 decklists reales en `.txt`

**Files:**

- Create: `packages/card-data/fixtures/decks/op01-zoro-red.txt`
- Create: `packages/card-data/fixtures/decks/op02-blackbeard-black.txt`

Estos fixtures se usan:

- Para tests del parser (inyectar content y verificar cards.length > 0 + card IDs válidos).
- Como ejemplos manuales para el usuario al probar Import.

- [ ] **Step 1:** Descubrir qué leaders tenemos con `sqlite3 packages/card-data/prisma/dev.db "SELECT id, name, colors FROM Card WHERE type='LEADER' AND (setId='OP01' OR setId='OP02');"`. Si sqlite3 no está disponible, usar Prisma en un script one-shot:

```bash
pnpm --filter @optcg/card-data exec tsx -e "
import { prisma } from './src/index';
const leaders = await prisma.card.findMany({ where: { type: 'LEADER', OR: [{ setId: 'OP01' }, { setId: 'OP02' }] }, select: { id: true, name: true, colors: true } });
console.log(JSON.stringify(leaders, null, 2));
await prisma.\$disconnect();
"
```

Anotar los IDs de al menos 2 leaders de colores distintos (p.ej. un Red de OP01 y un Black de OP02) y cartas del mismo color para construir mazos de 50 legales.

- [ ] **Step 2:** Construir `fixtures/decks/op01-zoro-red.txt` (ejemplo; ajustar IDs a los reales de DB):

```
# OP01 Red deck — Zoro leader
# Approx. legal deck; quantities may need ajustment if a specific card ID doesn't exist in DB.
4x OP01-013
4x OP01-014
4x OP01-015
# ... continue until exactly 50 cards total
```

Si no hay tiempo para construir mazos 100% legales (50 cartas exactas), un MVP de ~20-30 cartas Red es suficiente para el test de import — solo verificamos que el parser reconoce todos los IDs y suma bien. La legalidad se comprueba en validate, no en import.

- [ ] **Step 3:** Añadir test al `deck-txt.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('parseDeckText fixtures', () => {
  it('parses op01-zoro-red.txt into a non-empty deck', () => {
    const content = readFileSync(
      join(__dirname, '../../../../packages/card-data/fixtures/decks/op01-zoro-red.txt'),
      'utf8',
    );
    const r = parseDeckText(content);
    expect(r.cards.length).toBeGreaterThan(0);
    for (const c of r.cards) {
      expect(c.cardId).toMatch(/^OP\d{2}-\d+/);
    }
  });

  it('parses op02-blackbeard-black.txt into a non-empty deck', () => {
    const content = readFileSync(
      join(__dirname, '../../../../packages/card-data/fixtures/decks/op02-blackbeard-black.txt'),
      'utf8',
    );
    const r = parseDeckText(content);
    expect(r.cards.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4:** gates + commit

```bash
pnpm --filter @optcg/web test -- deck-txt
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add packages/card-data/fixtures apps/web/src/lib/deck-txt.test.ts
git commit -m "$(cat <<'EOF'
test(web): add decklist fixtures and parser tests against them

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: User context + UserGate + /api/users POST

**Files:**

- Create: `apps/web/src/lib/user-context.tsx`
- Create: `apps/web/src/components/user-gate.tsx`
- Create: `apps/web/src/app/api/users/route.ts`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1:** `POST /api/users` — `apps/web/src/app/api/users/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@optcg/card-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ username: z.string().min(1).max(40) });

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const { username } = parsed.data;

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username },
  });

  return NextResponse.json({ id: user.id, username: user.username }, { status: 200 });
}
```

- [ ] **Step 2:** `apps/web/src/lib/user-context.tsx`:

```tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface User {
  id: string;
  username: string;
}

interface UserContextValue {
  user: User | null;
  setUser: (u: User | null) => void;
  ready: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

const STORAGE_KEY = 'optcg.user';

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as User;
        if (parsed?.id && parsed?.username) {
          setUserState(parsed);
        }
      }
    } catch {
      /* ignore malformed localStorage */
    }
    setReady(true);
  }, []);

  function setUser(u: User | null) {
    setUserState(u);
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return <UserContext.Provider value={{ user, setUser, ready }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
```

- [ ] **Step 3:** `apps/web/src/components/user-gate.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useUser } from '@/lib/user-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function UserGate() {
  const { user, setUser, ready } = useUser();
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready || user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to register');
        return;
      }
      const body = (await res.json()) as { id: string; username: string };
      setUser(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open modal>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Welcome!</DialogTitle>
          <DialogDescription>Pick a username to save your decks locally.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoFocus
              minLength={1}
              maxLength={40}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-2"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={submitting || !username.trim()} className="w-full">
            {submitting ? 'Creating…' : 'Continue'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4:** Montar en `apps/web/src/app/layout.tsx` (edit existing):

```tsx
import './globals.css';
import { UserProvider } from '@/lib/user-context';
import { UserGate } from '@/components/user-gate';

export const metadata = { title: 'OPTCG Sim' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          {children}
          <UserGate />
        </UserProvider>
      </body>
    </html>
  );
}
```

Ajustar `metadata`/lang si el layout existente ya tiene valores distintos — preservarlos.

- [ ] **Step 5:** gates

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
```

- [ ] **Step 6:** commit

```bash
git add apps/web/src/lib/user-context.tsx apps/web/src/components/user-gate.tsx apps/web/src/app/api/users/route.ts apps/web/src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(web): add UserProvider, UserGate modal and POST /api/users

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Decks API — POST/GET/PUT/DELETE

**Files:**

- Create: `apps/web/src/app/api/decks/route.ts` (POST create; GET list by x-user-id header)
- Create: `apps/web/src/app/api/decks/[id]/route.ts` (GET / PUT / DELETE)
- Create: `apps/web/src/lib/api-auth.ts` (helper para leer `x-user-id` y validar ownership)

- [ ] **Step 1:** `apps/web/src/lib/api-auth.ts`:

```ts
import { NextResponse } from 'next/server';

export function getUserId(req: Request): string | null {
  return req.headers.get('x-user-id');
}

export function requireUserId(req: Request): string | NextResponse {
  const id = getUserId(req);
  if (!id) return NextResponse.json({ error: 'missing x-user-id header' }, { status: 401 });
  return id;
}
```

- [ ] **Step 2:** `apps/web/src/app/api/decks/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@optcg/card-data';
import { requireUserId } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSchema = z.object({ name: z.string().min(1).max(120) });

export async function POST(req: Request) {
  const userIdOrRes = requireUserId(req);
  if (typeof userIdOrRes !== 'string') return userIdOrRes;
  const userId = userIdOrRes;

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const deck = await prisma.deck.create({
    data: { userId, name: parsed.data.name },
  });
  return NextResponse.json(deck, { status: 201 });
}

export async function GET(req: Request) {
  const userIdOrRes = requireUserId(req);
  if (typeof userIdOrRes !== 'string') return userIdOrRes;

  const decks = await prisma.deck.findMany({
    where: { userId: userIdOrRes },
    orderBy: { updatedAt: 'desc' },
    include: { cards: true },
  });
  return NextResponse.json(decks);
}
```

- [ ] **Step 3:** `apps/web/src/app/api/decks/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@optcg/card-data';
import { requireUserId } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UpdateSchema = z.object({
  name: z.string().min(1).max(120),
  leaderCardId: z.string().nullable(),
  cards: z.array(
    z.object({
      cardId: z.string().min(1),
      quantity: z.number().int().min(1).max(4),
    }),
  ),
});

async function deckGuard(id: string, userId: string) {
  const deck = await prisma.deck.findUnique({ where: { id } });
  if (!deck) return { error: NextResponse.json({ error: 'not found' }, { status: 404 }) };
  if (deck.userId !== userId) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { deck };
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const userIdOrRes = requireUserId(req);
  if (typeof userIdOrRes !== 'string') return userIdOrRes;

  const g = await deckGuard(ctx.params.id, userIdOrRes);
  if ('error' in g) return g.error;

  const deck = await prisma.deck.findUnique({
    where: { id: ctx.params.id },
    include: { cards: true },
  });
  return NextResponse.json(deck);
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const userIdOrRes = requireUserId(req);
  if (typeof userIdOrRes !== 'string') return userIdOrRes;
  const g = await deckGuard(ctx.params.id, userIdOrRes);
  if ('error' in g) return g.error;

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { name, leaderCardId, cards } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.deckCard.deleteMany({ where: { deckId: ctx.params.id } });
    await tx.deck.update({
      where: { id: ctx.params.id },
      data: { name, leaderCardId },
    });
    if (cards.length > 0) {
      await tx.deckCard.createMany({
        data: cards.map((c) => ({
          deckId: ctx.params.id,
          cardId: c.cardId,
          quantity: c.quantity,
        })),
      });
    }
    return tx.deck.findUnique({
      where: { id: ctx.params.id },
      include: { cards: true },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const userIdOrRes = requireUserId(req);
  if (typeof userIdOrRes !== 'string') return userIdOrRes;
  const g = await deckGuard(ctx.params.id, userIdOrRes);
  if ('error' in g) return g.error;

  await prisma.deck.delete({ where: { id: ctx.params.id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4:** gates + commit

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/web/src/lib/api-auth.ts apps/web/src/app/api/decks
git commit -m "$(cat <<'EOF'
feat(web): add Deck CRUD API routes with x-user-id ownership guard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: /builder page — lista de mazos + crear nuevo

**Files:**

- Create: `apps/web/src/app/builder/page.tsx` (client — lee context de user, lista vía fetch)
- Create: `apps/web/src/app/builder/_components/deck-list-item.tsx`
- Create: `apps/web/src/app/builder/_components/new-deck-button.tsx`

**Diseño:** `/builder` debe ser client (no RSC) porque lee `userId` desde localStorage vía `UserProvider`. Alternativamente se podría hacer RSC con userId en cookie, pero evitamos esa complejidad.

- [ ] **Step 1:** `apps/web/src/app/builder/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import { Button } from '@/components/ui/button';
import { NewDeckButton } from './_components/new-deck-button';
import { DeckListItem } from './_components/deck-list-item';

interface DeckSummary {
  id: string;
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
  updatedAt: string;
}

export default function BuilderPage() {
  const { user, ready } = useUser();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch('/api/decks', { headers: { 'x-user-id': user.id } })
      .then((r) => r.json())
      .then(setDecks)
      .catch((e) => setError((e as Error).message));
  }, [user]);

  if (!ready) return null;
  if (!user) return null; // UserGate se encarga

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Decks</h1>
        <NewDeckButton
          onCreated={(deck) => {
            setDecks((prev) => (prev ? [deck as DeckSummary, ...prev] : [deck as DeckSummary]));
          }}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {decks === null ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : decks.length === 0 ? (
        <p className="text-muted-foreground">No decks yet. Click "New deck" to start.</p>
      ) : (
        <ul className="space-y-2">
          {decks.map((d) => (
            <li key={d.id}>
              <DeckListItem
                deck={d}
                onDeleted={() => setDecks((prev) => prev?.filter((x) => x.id !== d.id) ?? null)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2:** `apps/web/src/app/builder/_components/new-deck-button.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import { Button } from '@/components/ui/button';

export function NewDeckButton({ onCreated }: { onCreated?: (deck: unknown) => void }) {
  const { user } = useUser();
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handle() {
    if (!user) return;
    setPending(true);
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': user.id },
      body: JSON.stringify({ name: 'Untitled deck' }),
    });
    if (res.ok) {
      const deck = (await res.json()) as { id: string };
      onCreated?.(deck);
      router.push(`/builder/${deck.id}`);
    } else {
      setPending(false);
    }
  }

  return (
    <Button onClick={handle} disabled={pending}>
      {pending ? 'Creating…' : 'New deck'}
    </Button>
  );
}
```

- [ ] **Step 3:** `apps/web/src/app/builder/_components/deck-list-item.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import { Button } from '@/components/ui/button';

export function DeckListItem({
  deck,
  onDeleted,
}: {
  deck: {
    id: string;
    name: string;
    leaderCardId: string | null;
    cards: Array<{ cardId: string; quantity: number }>;
  };
  onDeleted?: () => void;
}) {
  const { user } = useUser();
  const totalCards = deck.cards.reduce((s, c) => s + c.quantity, 0);

  async function handleDelete() {
    if (!user) return;
    if (!confirm(`Delete "${deck.name}"?`)) return;
    const res = await fetch(`/api/decks/${deck.id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': user.id },
    });
    if (res.ok) onDeleted?.();
  }

  return (
    <div className="flex items-center justify-between rounded border p-3">
      <div>
        <div className="font-medium">{deck.name}</div>
        <div className="text-xs text-muted-foreground">
          {deck.leaderCardId ? `Leader: ${deck.leaderCardId}` : 'No leader'} · {totalCards}/50 cards
        </div>
      </div>
      <div className="flex gap-2">
        <Link href={`/builder/${deck.id}`}>
          <Button variant="secondary">Open</Button>
        </Link>
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4:** añadir componentes shadcn missing si hace falta (`destructive` / `secondary` variants ya existen en Button; si no existen en el componente actual, correr `pnpm dlx shadcn@latest add button --overwrite` para actualizar). Si estropea el Button anterior, hacer manual edit restaurando variants.

- [ ] **Step 5:** Link to `/builder` from home `apps/web/src/app/page.tsx` — añadir un segundo botón:

```tsx
<div className="flex gap-3">
  <Button asChild>
    <Link href="/cards">Explore cards</Link>
  </Button>
  <Button asChild variant="secondary">
    <Link href="/builder">My decks</Link>
  </Button>
</div>
```

- [ ] **Step 6:** gates + commit

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/web/src/app/builder apps/web/src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): add /builder deck list page with create/delete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: /builder/[deckId] RSC shell + BuilderLayout client skeleton

**Files:**

- Create: `apps/web/src/app/builder/[deckId]/page.tsx`
- Create: `apps/web/src/app/builder/[deckId]/_components/builder-layout.tsx`

**Patrón:** la ruta del deck es client-side (igual que `/builder`) porque necesita userId local. Para evitar duplicar Prisma fetch en cliente, `BuilderLayout` hace `fetch('/api/decks/[id]')` + `fetch` separado al catálogo de cartas (o importa el catalog server-side vía un endpoint `/api/cards`).

Simplificación: `BuilderLayout` recibe en props el `deckId` y hace dos fetches al mount — uno para el deck, otro para todas las cartas jugables (`/api/cards?type=LEADER,CHARACTER,EVENT,STAGE`). Pagination no es necesaria en builder; servir todas las ~200 de golpe (peso ligero).

- [ ] **Step 1:** Crear endpoint `/api/cards` para servir el catálogo completo al cliente. Añadir `apps/web/src/app/api/cards/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@optcg/card-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cards = await prisma.card.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json(cards);
}
```

- [ ] **Step 2:** `apps/web/src/app/builder/[deckId]/page.tsx`:

```tsx
import { BuilderLayout } from './_components/builder-layout';

export default function DeckEditorPage({ params }: { params: { deckId: string } }) {
  return <BuilderLayout deckId={params.deckId} />;
}
```

- [ ] **Step 3:** `apps/web/src/app/builder/[deckId]/_components/builder-layout.tsx` (skeleton, placeholders para siguientes tasks):

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { Card } from '@optcg/card-data';
import { useUser } from '@/lib/user-context';

interface DeckDraftState {
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

export function BuilderLayout({ deckId }: { deckId: string }) {
  const { user, ready } = useUser();
  const [deck, setDeck] = useState<DeckDraftState | null>(null);
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`/api/decks/${deckId}`, { headers: { 'x-user-id': user.id } }).then((r) => r.json()),
      fetch('/api/cards').then((r) => r.json()),
    ])
      .then(([deckData, cardsData]: [any, Card[]]) => {
        setDeck({
          name: deckData.name,
          leaderCardId: deckData.leaderCardId,
          cards: deckData.cards.map((c: any) => ({ cardId: c.cardId, quantity: c.quantity })),
        });
        setCatalog(cardsData);
      })
      .finally(() => setLoading(false));
  }, [deckId, user]);

  async function handleSave() {
    if (!user || !deck) return;
    setSaving(true);
    await fetch(`/api/decks/${deckId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-user-id': user.id },
      body: JSON.stringify({
        name: deck.name,
        leaderCardId: deck.leaderCardId,
        cards: deck.cards,
      }),
    });
    setSaving(false);
  }

  if (!ready) return null;
  if (!user) return null;
  if (loading) return <p className="p-6">Loading…</p>;
  if (!deck) return <p className="p-6 text-red-500">Deck not found</p>;

  return (
    <div className="flex gap-6 p-6">
      <aside className="w-56 shrink-0 space-y-4">
        <h2 className="text-sm font-semibold uppercase">Filters</h2>
        <p className="text-xs text-muted-foreground">(Filter UI — Task 10)</p>
      </aside>
      <main className="flex-1">
        <h2 className="mb-4 text-sm font-semibold uppercase">Card grid</h2>
        <p className="text-xs text-muted-foreground">(CardGridBuilder — Task 10)</p>
      </main>
      <aside className="w-80 shrink-0 space-y-4 rounded border p-4">
        <div className="flex items-center justify-between">
          <input
            className="rounded border px-2 py-1 text-lg font-semibold"
            value={deck.name}
            onChange={(e) => setDeck({ ...deck, name: e.target.value })}
          />
          <button
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Leader: {deck.leaderCardId ?? 'none'} · {deck.cards.reduce((s, c) => s + c.quantity, 0)}
          /50
        </p>
        <p className="text-xs text-muted-foreground">(DeckPanel — Task 11)</p>
      </aside>
    </div>
  );
}
```

Los `any` en la destructuring son temporales — los tipos reales se restringen en Task 10/11. Lint puede dar warnings pero typecheck pasa. Si lint falla por `no-explicit-any`, reemplazar por `type DeckResp = { ... }` inline.

- [ ] **Step 4:** gates + commit

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/web/src/app/builder/[deckId] apps/web/src/app/api/cards
git commit -m "$(cat <<'EOF'
feat(web): add /builder/[deckId] editor shell and /api/cards catalog endpoint

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: CardGridBuilder — grid con add/remove + filtros

**Files:**

- Modify: `apps/web/src/app/builder/[deckId]/_components/builder-layout.tsx` (integrate real CardGridBuilder)
- Create: `apps/web/src/app/builder/[deckId]/_components/card-grid-builder.tsx`
- Create: `apps/web/src/app/builder/[deckId]/_components/filter-sidebar-builder.tsx` (reutiliza lógica de Fase 1 pero sin URL-state — todo en prop)

- [ ] **Step 1:** `CardGridBuilder` — client component:

```tsx
'use client';

import Image from 'next/image';
import type { Card } from '@optcg/card-data';

interface Props {
  cards: Card[];
  deckCards: Array<{ cardId: string; quantity: number }>;
  leaderColors: string[]; // empty if no leader
  onAdd: (cardId: string) => void;
  onRemove: (cardId: string) => void;
  onInspect: (card: Card) => void;
}

export function CardGridBuilder({
  cards,
  deckCards,
  leaderColors,
  onAdd,
  onRemove,
  onInspect,
}: Props) {
  const qtyMap = new Map(deckCards.map((c) => [c.cardId, c.quantity]));

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {cards.map((card) => {
        const qty = qtyMap.get(card.id) ?? 0;
        const cardColors = card.colors.split(',').filter(Boolean);
        const matchesLeader =
          leaderColors.length === 0 || cardColors.some((c) => leaderColors.includes(c));

        return (
          <div
            key={card.id}
            className={`group relative aspect-[5/7] overflow-hidden rounded-md border ${matchesLeader ? '' : 'opacity-40'}`}
            title={matchesLeader ? card.name : `${card.name} — color mismatch`}
          >
            <button
              type="button"
              className="absolute inset-0 h-full w-full"
              onClick={() => onInspect(card)}
              aria-label={`Inspect ${card.name}`}
            >
              <Image
                src={card.imagePath}
                alt={card.name}
                fill
                sizes="(min-width:1280px) 16vw, (min-width:768px) 25vw, 50vw"
                className="object-cover"
              />
            </button>
            {qty > 0 && (
              <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
                {qty}/4
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                className="rounded bg-white/20 px-2 text-white disabled:opacity-30"
                onClick={() => onRemove(card.id)}
                disabled={qty === 0}
              >
                −
              </button>
              <button
                type="button"
                className="rounded bg-white/20 px-2 text-white disabled:opacity-30"
                onClick={() => onAdd(card.id)}
                disabled={qty >= 4}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2:** `filter-sidebar-builder.tsx` — versión stand-alone (sin URL; cambios suben como prop):

```tsx
'use client';

import { useState } from 'react';
import { CARD_TYPES } from '@optcg/card-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const COLORS = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'] as const;
const COSTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

export interface BuilderFilters {
  q: string;
  colors: string[];
  types: string[];
  costs: number[];
}

export const INITIAL_FILTERS: BuilderFilters = { q: '', colors: [], types: [], costs: [] };

export function FilterSidebarBuilder({
  filters,
  onChange,
}: {
  filters: BuilderFilters;
  onChange: (next: BuilderFilters) => void;
}) {
  function toggleColor(c: string) {
    onChange({
      ...filters,
      colors: filters.colors.includes(c)
        ? filters.colors.filter((x) => x !== c)
        : [...filters.colors, c],
    });
  }
  function toggleType(t: string) {
    onChange({
      ...filters,
      types: filters.types.includes(t)
        ? filters.types.filter((x) => x !== t)
        : [...filters.types, t],
    });
  }
  function toggleCost(c: string) {
    const n = Number(c);
    onChange({
      ...filters,
      costs: filters.costs.includes(n)
        ? filters.costs.filter((x) => x !== n)
        : [...filters.costs, n],
    });
  }

  return (
    <aside className="w-56 shrink-0 space-y-4">
      <div>
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder="Name…"
          className="mt-2"
        />
      </div>
      <Separator />
      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Color</div>
        {COLORS.map((c) => (
          <div key={c} className="flex items-center gap-2">
            <Checkbox
              id={`color-${c}`}
              checked={filters.colors.includes(c)}
              onCheckedChange={() => toggleColor(c)}
            />
            <Label htmlFor={`color-${c}`}>{c}</Label>
          </div>
        ))}
      </div>
      <Separator />
      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Type</div>
        {CARD_TYPES.filter((t) => t !== 'DON').map((t) => (
          <div key={t} className="flex items-center gap-2">
            <Checkbox
              id={`type-${t}`}
              checked={filters.types.includes(t)}
              onCheckedChange={() => toggleType(t)}
            />
            <Label htmlFor={`type-${t}`}>{t}</Label>
          </div>
        ))}
      </div>
      <Separator />
      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Cost</div>
        {COSTS.map((c) => (
          <div key={c} className="flex items-center gap-2">
            <Checkbox
              id={`cost-${c}`}
              checked={filters.costs.includes(Number(c))}
              onCheckedChange={() => toggleCost(c)}
            />
            <Label htmlFor={`cost-${c}`}>{c}</Label>
          </div>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 3:** Wire them in `builder-layout.tsx`. Reemplazar el contenido de `<aside>` izquierda y `<main>`:

```tsx
import {
  FilterSidebarBuilder,
  INITIAL_FILTERS,
  type BuilderFilters,
} from './filter-sidebar-builder';
import { CardGridBuilder } from './card-grid-builder';
import { CardDetailDialog } from '@/app/cards/_components/card-detail-dialog';
// ... add state
const [filters, setFilters] = useState<BuilderFilters>(INITIAL_FILTERS);
const [inspecting, setInspecting] = useState<Card | null>(null);

const leader = deck.leaderCardId ? catalog.find((c) => c.id === deck.leaderCardId) : null;
const leaderColors = leader ? leader.colors.split(',').filter(Boolean) : [];

const filteredCards = catalog.filter((c) => {
  if (c.type === 'DON' || c.type === 'LEADER') return false; // leaders picked separately
  if (filters.q && !c.name.toLowerCase().includes(filters.q.toLowerCase())) return false;
  if (filters.types.length > 0 && !filters.types.includes(c.type)) return false;
  if (filters.costs.length > 0 && (c.cost === null || !filters.costs.includes(c.cost)))
    return false;
  if (filters.colors.length > 0) {
    const cs = c.colors.split(',').filter(Boolean);
    if (!filters.colors.some((col) => cs.includes(col))) return false;
  }
  return true;
});

function addCard(cardId: string) {
  setDeck((d) => {
    if (!d) return d;
    const existing = d.cards.find((c) => c.cardId === cardId);
    if (existing) {
      if (existing.quantity >= 4) return d;
      return {
        ...d,
        cards: d.cards.map((c) => (c.cardId === cardId ? { ...c, quantity: c.quantity + 1 } : c)),
      };
    }
    return { ...d, cards: [...d.cards, { cardId, quantity: 1 }] };
  });
}

function removeCard(cardId: string) {
  setDeck((d) => {
    if (!d) return d;
    const existing = d.cards.find((c) => c.cardId === cardId);
    if (!existing) return d;
    if (existing.quantity <= 1) {
      return { ...d, cards: d.cards.filter((c) => c.cardId !== cardId) };
    }
    return {
      ...d,
      cards: d.cards.map((c) => (c.cardId === cardId ? { ...c, quantity: c.quantity - 1 } : c)),
    };
  });
}
```

Y en el render:

```tsx
<FilterSidebarBuilder filters={filters} onChange={setFilters} />
<main className="flex-1">
  <CardGridBuilder
    cards={filteredCards}
    deckCards={deck.cards}
    leaderColors={leaderColors}
    onAdd={addCard}
    onRemove={removeCard}
    onInspect={setInspecting}
  />
</main>
<CardDetailDialog
  card={inspecting as any}
  open={!!inspecting}
  onOpenChange={(o) => !o && setInspecting(null)}
/>
```

(El `as any` se limpia cuando `CardDetailDialog` prop tipada coincide; si falla typecheck, ajustar el prop.)

- [ ] **Step 4:** gates + commit

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/web/src/app/builder/[deckId]
git commit -m "$(cat <<'EOF'
feat(web): add CardGridBuilder and FilterSidebarBuilder to deck editor

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: DeckPanel — leader picker + deck list + validation badges

**Files:**

- Create: `apps/web/src/app/builder/[deckId]/_components/deck-panel.tsx`
- Create: `apps/web/src/app/builder/[deckId]/_components/leader-picker.tsx`
- Modify: `apps/web/src/app/builder/[deckId]/_components/builder-layout.tsx` (sustituye placeholder del aside derecho)

- [ ] **Step 1:** `leader-picker.tsx` — modal que filtra leaders del catálogo:

```tsx
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
```

- [ ] **Step 2:** `deck-panel.tsx`:

```tsx
'use client';

import Image from 'next/image';
import type { Card } from '@optcg/card-data';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { LeaderPicker } from './leader-picker';
import { validateDeck, type ValidationResult, type CardRow } from '@/lib/deck-validation';
import { ImportExport } from './import-export';

interface Props {
  name: string;
  leader: Card | null;
  catalog: Card[];
  cards: Array<{ cardId: string; quantity: number }>;
  onNameChange: (next: string) => void;
  onLeaderChange: (leader: Card) => void;
  onAdd: (cardId: string) => void;
  onRemove: (cardId: string) => void;
  onImport: (parsed: { cards: Array<{ cardId: string; quantity: number }> }) => void;
  onSave: () => void;
  saving: boolean;
}

export function DeckPanel({
  name,
  leader,
  catalog,
  cards,
  onNameChange,
  onLeaderChange,
  onAdd,
  onRemove,
  onImport,
  onSave,
  saving,
}: Props) {
  const cardIndex = new Map<string, CardRow>(
    catalog.map((c) => [
      c.id,
      { id: c.id, colors: c.colors.split(',').filter(Boolean), type: c.type },
    ]),
  );

  const validation = validateDeck(
    {
      leaderCardId: leader?.id ?? null,
      cards,
    },
    cardIndex,
  );

  const rowsByCost = [...cards]
    .map((c) => {
      const card = catalog.find((x) => x.id === c.cardId);
      return { ...c, card };
    })
    .sort((a, b) => {
      const ca = a.card?.cost ?? 99;
      const cb = b.card?.cost ?? 99;
      if (ca !== cb) return ca - cb;
      return a.cardId.localeCompare(b.cardId);
    });

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-3 rounded border p-4">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded border px-2 py-1 text-lg font-semibold"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <LeaderPicker catalog={catalog} current={leader} onPick={onLeaderChange} />

      <Separator />

      <ValidationBadges validation={validation} />

      <Separator />

      <div className="flex items-center justify-between text-sm">
        <span>Main deck</span>
        <span className="text-muted-foreground">{validation.totalCards}/50</span>
      </div>

      <div className="max-h-[50vh] space-y-1 overflow-y-auto">
        {rowsByCost.map((row) => (
          <div key={row.cardId} className="flex items-center gap-2 text-xs">
            {row.card?.imagePath && (
              <div className="relative h-9 w-7 shrink-0 overflow-hidden rounded">
                <Image
                  src={row.card.imagePath}
                  alt={row.card.name}
                  fill
                  sizes="28px"
                  className="object-cover"
                />
              </div>
            )}
            <span className="flex-1 truncate">{row.card?.name ?? row.cardId}</span>
            <span className="w-10 text-right">
              {row.card?.cost !== null && row.card?.cost !== undefined ? `$${row.card.cost}` : ''}
            </span>
            <div className="flex items-center gap-1">
              <button
                className="rounded border px-1.5 text-xs disabled:opacity-30"
                onClick={() => onRemove(row.cardId)}
                disabled={row.quantity === 0}
              >
                −
              </button>
              <span className="w-4 text-center">{row.quantity}</span>
              <button
                className="rounded border px-1.5 text-xs disabled:opacity-30"
                onClick={() => onAdd(row.cardId)}
                disabled={row.quantity >= 4}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <ImportExport name={name} leader={leader} cards={cards} onImport={onImport} />
    </aside>
  );
}

function ValidationBadges({ validation }: { validation: ValidationResult }) {
  const has = (kind: string) => validation.issues.some((i) => i.kind === kind);
  const rows: Array<{ label: string; ok: boolean }> = [
    { label: 'Leader set', ok: !has('missingLeader') },
    { label: '50 cards', ok: !has('wrongCount') },
    { label: 'Max 4 copies', ok: !has('overLimit') },
    { label: 'Colors match leader', ok: !has('colorMismatch') },
  ];
  return (
    <div className="space-y-1 text-xs">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${r.ok ? 'bg-green-500' : 'bg-red-500'}`}
            aria-hidden
          />
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3:** Update `builder-layout.tsx` para sustituir el aside derecho por `<DeckPanel …>` con los props correspondientes.

- [ ] **Step 4:** gates + commit

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/web/src/app/builder/[deckId]
git commit -m "$(cat <<'EOF'
feat(web): add DeckPanel with leader picker, deck list and validation badges

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: ImportExport component

**Files:**

- Create: `apps/web/src/app/builder/[deckId]/_components/import-export.tsx`

- [ ] **Step 1:**

```tsx
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
              placeholder="4x OP01-013\n4x OP01-014\n…"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end">
              <Button onClick={handleImport}>Import</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={handleExportTxt}>
          Export .txt
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportJson}>
          Export .json
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Verificar que `Button` tiene variante `outline`. Si no, correr `pnpm dlx shadcn@latest add button --overwrite` y verificar no hay regresiones en Fase 1.

- [ ] **Step 3:** Gates + commit

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add apps/web/src/app/builder/[deckId]
git commit -m "$(cat <<'EOF'
feat(web): add ImportExport modal for .txt/.json deck interchange

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Verificación e2e

**Files:** ninguno nuevo. Verificación manual + fix de bugs menores.

- [ ] **Step 1:** Gates automáticos

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
```

- [ ] **Step 2:** Iniciar dev

```bash
pnpm dev
```

Abrir `http://localhost:3000`. Smoke checklist:

1. Primera carga muestra modal "Welcome! Pick a username" → pongo "tiagotest" → Continue → cierra.
2. Home muestra "Explore cards" y "My decks".
3. "My decks" → `/builder` → lista vacía + botón "New deck".
4. "New deck" → redirige a `/builder/[uuid]` → editor abierto con:
   - Sidebar con filtros (q, color, type, cost).
   - Grid central de ~230 cartas (sin LEADER/DON).
   - Panel derecho: input del nombre, botón Pick a leader, validation badges (todas rojas), counter 0/50.
5. Click "Pick a leader" → modal con LEADERs (OP01-001, OP01-002, …). Picar uno.
6. Al volver al grid, cartas de color incompatible aparecen con opacity reducida.
7. Hover sobre carta → botones +/- aparecen → click "+" → quantity 1, badge 1/4.
8. +/- funcionan. Llegar a 4 bloquea "+".
9. Validation badges se actualizan (verde cuando cumple).
10. Click "Save" → PUT se ejecuta → no errores.
11. Recargar página → deck persiste con leader + cartas + nombre.
12. Click "Import .txt" → pegar `4x OP01-013\n4x OP01-014` → Import → cartas añadidas.
13. "Export .txt" → descarga archivo con header + lista.
14. "Export .json" → descarga archivo con JSON válido.
15. Volver a `/builder` → lista muestra el deck recién creado.
16. Click "Delete" → confirm → desaparece.
17. Probar con fixtures: abrir `packages/card-data/fixtures/decks/op01-zoro-red.txt`, copiar contenido, pegarlo en el import → verificar que las ≥X cartas se importan.

Si algún paso falla y es arreglable rápido (typo, clase CSS), arreglarlo + commit `fix(web): ...`.

- [ ] **Step 3:** Parar dev (Ctrl+C).

- [ ] **Step 4:** Verificar exit criteria de spec §9:

```
sqlite3 packages/card-data/prisma/dev.db "SELECT username FROM User;"
sqlite3 packages/card-data/prisma/dev.db "SELECT d.name, d.leaderCardId, COUNT(dc.id) as cards FROM Deck d LEFT JOIN DeckCard dc ON dc.deckId = d.id GROUP BY d.id;"
```

Expected: el user "tiagotest" existe, al menos 1 deck creado con cartas.

- [ ] **Step 5:** Commit de eventuales fixes con `fix(web): e2e smoke adjustments`.

---

## Exit criteria (spec §9)

- [ ] Modal de username aparece en primera visita y crea usuario
- [ ] `/builder` lista mazos del usuario
- [ ] "New deck" crea mazo y redirige al editor
- [ ] Editor renderiza 3 paneles en desktop ≥1280px
- [ ] Añadir cartas actualiza validation badges
- [ ] Save persiste; reload mantiene el mazo
- [ ] Import fixture `op01-zoro-red.txt` reconstruye cartas
- [ ] Import fixture `op02-blackbeard-black.txt` reconstruye cartas
- [ ] Export `.txt` round-trip → idéntico
- [ ] Export `.json` válido
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` verdes

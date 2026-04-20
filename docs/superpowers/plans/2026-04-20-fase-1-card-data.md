# Fase 1 — Card Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar datos reales OP01+OP02 descargados de apitcg.com, cacheados en SQLite + imágenes locales, con galería `/cards` filtrable sin llamadas a la API en runtime.

**Architecture:** `packages/card-data` tiene Prisma + `CardDataService` (interfaz) + `ApitcgAdapter` + script `sync.ts`. `apps/web` consume solo Prisma + imágenes estáticas en `/public/cards`. Nunca importa de apitcg desde runtime. Ver spec: `docs/superpowers/specs/2026-04-20-fase-1-card-data-design.md`.

**Tech Stack:** TypeScript strict, Prisma 5 + SQLite, zod, sharp, tsx, Vitest, Next.js 14 App Router, shadcn/ui, Tailwind.

**Branch:** `feature/fase-1-card-data` (ya creada, este plan se commitea aquí).

**Entorno:** usuario puede necesitar `corepack pnpm@9.7.0 <cmd>` en lugar de `pnpm` directo (ver `CLAUDE.md`). En el plan uso `pnpm` — sustituye si no está en PATH.

---

## Task 1: Dependencies, env y gitignore

**Files:**

- Modify: `packages/card-data/package.json`
- Modify: `.gitignore`
- Modify: `package.json` (root)
- Create: `apps/web/public/cards/.gitkeep`

**Step 1: Añadir deps runtime a `packages/card-data`**

Editar `packages/card-data/package.json`, sección `dependencies` (añadir `sharp` y `zod`):

```json
"dependencies": {
  "@prisma/client": "^5.14.0",
  "sharp": "^0.33.0",
  "zod": "^3.23.0"
}
```

Sección `devDependencies` (añadir `tsx`, `vitest`):

```json
"devDependencies": {
  "@types/node": "^20.12.0",
  "prisma": "^5.14.0",
  "tsx": "^4.19.0",
  "vitest": "^1.6.0"
}
```

**Step 2: Instalar**

Run: `pnpm install`
Expected: install OK, `pnpm-lock.yaml` actualizado con `sharp`, `zod`, `tsx`, `vitest`.

**Step 3: Actualizar `.gitignore`**

Añadir al final del `.gitignore`:

```
# Fase 1 — imágenes descargadas por pnpm cards:sync (cada dev genera las suyas)
apps/web/public/cards/**
!apps/web/public/cards/.gitkeep
```

(No añadir patrones `*.db` — ya están.)

**Step 4: Crear `.gitkeep` para el directorio**

Run: `mkdir -p apps/web/public/cards && touch apps/web/public/cards/.gitkeep`

**Step 5: Añadir alias `cards:sync` al root**

Editar `package.json` (root), sección `scripts`, añadir antes de `"format"`:

```json
"cards:sync": "pnpm --filter @optcg/card-data sync",
```

**Step 6: Verificar que el workspace se instaló sin warnings de peer deps raros**

Run: `pnpm install`
Expected: "Lockfile is up to date" o resolviendo sin errores nuevos.

**Step 7: Commit**

```bash
git add packages/card-data/package.json package.json pnpm-lock.yaml .gitignore apps/web/public/cards/.gitkeep
git commit -m "chore(card-data): add sharp, zod, tsx, vitest deps and gitignore image cache"
```

---

## Task 2: Prisma schema real (Card model) + migración

**Files:**

- Modify: `packages/card-data/prisma/schema.prisma`
- Create: `packages/card-data/prisma/migrations/YYYYMMDDHHMMSS_cards_v1/migration.sql` (Prisma la genera)

**Step 1: Reemplazar el schema placeholder**

Sobrescribir `packages/card-data/prisma/schema.prisma` con:

```prisma
// Card model real — Fase 1.
// Campos multi-valor (colors, attributes) se guardan como string comma-separated
// porque SQLite no soporta arrays. Filtros usan "contains".

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Card {
  id          String   @id
  setId       String
  setName     String
  name        String
  rarity      String
  type        String
  cost        Int?
  power       Int?
  counter     Int?
  life        Int?
  colors      String
  attributes  String
  effectText  String
  triggerText String?
  imagePath   String
  sourceUrl   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([setId])
  @@index([type])
  @@index([cost])
}
```

**Step 2: Preparar `.env` local (si no existe)**

Run: `cp -n packages/card-data/.env.example packages/card-data/.env`
Expected: crea `packages/card-data/.env` con `DATABASE_URL="file:./dev.db"` si no existía.

**Step 3: Generar migración**

Run: `pnpm --filter @optcg/card-data exec prisma migrate dev --name cards_v1`
Expected: Prisma crea `prisma/migrations/YYYYMMDDHHMMSS_cards_v1/migration.sql` con los `ALTER TABLE` o `DROP+CREATE` necesarios. Al no haber datos reales, la migración aplica sin interacción extra. Al final genera el cliente Prisma.

**Step 4: Verificar que la migración existe y el cliente compila**

Run: `ls packages/card-data/prisma/migrations/`
Expected: dos subdirectorios — `20260417111223_init` y `*_cards_v1`.

Run: `pnpm --filter @optcg/card-data typecheck`
Expected: sin errores. (Aún no hay código que use los nuevos campos, solo el schema; el cliente regenerado tiene los tipos.)

**Step 5: Commit**

```bash
git add packages/card-data/prisma/schema.prisma packages/card-data/prisma/migrations/
git commit -m "feat(card-data): replace placeholder with real Card model and migration"
```

_Nota: el `.env` y `dev.db` quedan fuera del commit (ya gitignored)._

---

## Task 3: Vitest en `packages/card-data`

**Files:**

- Create: `packages/card-data/vitest.config.ts`
- Modify: `packages/card-data/package.json`
- Modify: `packages/card-data/tsconfig.json`

**Step 1: Crear `vitest.config.ts`**

Crear `packages/card-data/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
    },
  },
});
```

(Sin threshold: Fase 1 no tiene gate de cobertura, spec §8.)

**Step 2: Actualizar scripts en `package.json`**

Editar `packages/card-data/package.json`, sección `scripts`:

```json
"scripts": {
  "lint": "eslint src tests",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "sync": "tsx scripts/sync.ts",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:reset": "prisma migrate reset --force"
}
```

**Step 3: Incluir `tests/` en tsconfig**

Editar `packages/card-data/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*", "scripts/**/*"]
}
```

**Step 4: Verificar que `pnpm test` sigue pasando (sin tests todavía)**

Run: `pnpm --filter @optcg/card-data test`
Expected: vitest corre sin archivos (`No test files found`) o sale 0 con aviso. Si vitest retorna exit 1 cuando no encuentra tests, añadir `passWithNoTests: true` a `vitest.config.ts` — verificar comportamiento.

_Ajuste si vitest falla:_ añadir a `vitest.config.ts` dentro de `test`:

```ts
passWithNoTests: true,
```

Re-ejecutar hasta que `pnpm --filter @optcg/card-data test` salga con exit 0.

**Step 5: Commit**

```bash
git add packages/card-data/vitest.config.ts packages/card-data/package.json packages/card-data/tsconfig.json
git commit -m "chore(card-data): add vitest config and sync/test scripts"
```

---

## Task 4: Tipos + zod schema (TDD)

**Files:**

- Create: `packages/card-data/src/types.ts`
- Create: `packages/card-data/tests/types.test.ts`

**Step 1: Test rojo para `RawCardSchema` y tipos**

Crear `packages/card-data/tests/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CARD_TYPES, RawCardSchema } from '../src/types';

const validRaw = {
  id: 'OP01-001',
  name: 'Roronoa Zoro',
  rarity: 'L',
  type: 'LEADER',
  cost: undefined,
  power: 5000,
  counter: undefined,
  life: 4,
  color: 'Green',
  family: 'Straw Hat Crew',
  ability: '[Activate: Main] You may rest this Leader: ...',
  trigger: undefined,
  set: { id: 'OP01', name: 'Romance Dawn' },
  images: { large: 'https://example.com/op01-001.webp' },
};

describe('RawCardSchema', () => {
  it('accepts a valid leader payload', () => {
    expect(() => RawCardSchema.parse(validRaw)).not.toThrow();
  });

  it('rejects when set.id is missing', () => {
    const bad = { ...validRaw, set: { name: 'Romance Dawn' } as { id?: string; name: string } };
    expect(() => RawCardSchema.parse(bad)).toThrow();
  });

  it('rejects when type is an unexpected string', () => {
    const bad = { ...validRaw, type: 'NOT_A_TYPE' };
    expect(() => RawCardSchema.parse(bad)).toThrow();
  });

  it('rejects when cost is a string instead of number', () => {
    const bad = { ...validRaw, cost: '3' as unknown as number };
    expect(() => RawCardSchema.parse(bad)).toThrow();
  });
});

describe('CARD_TYPES', () => {
  it('lists all 5 card types', () => {
    expect(CARD_TYPES).toEqual(['LEADER', 'CHARACTER', 'EVENT', 'STAGE', 'DON']);
  });
});
```

**Step 2: Ejecutar el test — debe fallar**

Run: `pnpm --filter @optcg/card-data test -- types`
Expected: FAIL — `Cannot find module '../src/types'`.

**Step 3: Implementar `src/types.ts`**

Crear `packages/card-data/src/types.ts`:

```ts
import { z } from 'zod';

export const CARD_TYPES = ['LEADER', 'CHARACTER', 'EVENT', 'STAGE', 'DON'] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const RawCardSchema = z.object({
  id: z.string().min(1),
  code: z.string().optional(),
  name: z.string().min(1),
  rarity: z.string().min(1),
  type: z.enum(CARD_TYPES),
  cost: z.number().int().nonnegative().optional(),
  power: z.number().int().optional(),
  counter: z.number().int().optional(),
  life: z.number().int().optional(),
  color: z.string().min(1),
  family: z.string().optional(),
  ability: z.string().optional(),
  trigger: z.string().optional(),
  set: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  images: z.object({
    small: z.string().url().optional(),
    large: z.string().url(),
  }),
});

export type RawCard = z.infer<typeof RawCardSchema>;

export interface DomainCard {
  id: string;
  setId: string;
  setName: string;
  name: string;
  rarity: string;
  type: CardType;
  cost: number | null;
  power: number | null;
  counter: number | null;
  life: number | null;
  colors: string[];
  attributes: string[];
  effectText: string;
  triggerText: string | null;
  sourceImageUrl: string;
}
```

**Step 4: Ejecutar el test — debe pasar**

Run: `pnpm --filter @optcg/card-data test -- types`
Expected: PASS (5 tests).

**Step 5: Typecheck + lint**

Run: `pnpm --filter @optcg/card-data typecheck && pnpm --filter @optcg/card-data lint`
Expected: sin errores.

**Step 6: Commit**

```bash
git add packages/card-data/src/types.ts packages/card-data/tests/types.test.ts
git commit -m "feat(card-data): add CardType, RawCard schema and DomainCard types"
```

---

## Task 5: Helpers de normalización (TDD)

**Files:**

- Create: `packages/card-data/src/helpers.ts`
- Create: `packages/card-data/tests/helpers.test.ts`

**Step 1: Test rojo**

Crear `packages/card-data/tests/helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { splitMultiValue, rawToDomain } from '../src/helpers';
import type { RawCard } from '../src/types';

describe('splitMultiValue', () => {
  it('splits by "/"', () => {
    expect(splitMultiValue('Red/Green')).toEqual(['Red', 'Green']);
  });

  it('splits by ","', () => {
    expect(splitMultiValue('Straw Hat Crew,Supernovas')).toEqual(['Straw Hat Crew', 'Supernovas']);
  });

  it('trims whitespace', () => {
    expect(splitMultiValue('Red / Green')).toEqual(['Red', 'Green']);
  });

  it('returns empty array for empty string', () => {
    expect(splitMultiValue('')).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(splitMultiValue(undefined)).toEqual([]);
  });

  it('returns single element for single value', () => {
    expect(splitMultiValue('Red')).toEqual(['Red']);
  });
});

describe('rawToDomain', () => {
  const raw: RawCard = {
    id: 'OP01-001',
    name: 'Roronoa Zoro',
    rarity: 'L',
    type: 'LEADER',
    power: 5000,
    life: 4,
    color: 'Green',
    family: 'Straw Hat Crew',
    ability: '[Activate: Main] ...',
    set: { id: 'OP01', name: 'Romance Dawn' },
    images: { large: 'https://example.com/op01-001.webp' },
  };

  it('maps scalar fields 1:1', () => {
    const d = rawToDomain(raw);
    expect(d.id).toBe('OP01-001');
    expect(d.setId).toBe('OP01');
    expect(d.setName).toBe('Romance Dawn');
    expect(d.name).toBe('Roronoa Zoro');
    expect(d.rarity).toBe('L');
    expect(d.type).toBe('LEADER');
    expect(d.power).toBe(5000);
    expect(d.life).toBe(4);
  });

  it('converts optional undefined to null', () => {
    const d = rawToDomain(raw);
    expect(d.cost).toBeNull();
    expect(d.counter).toBeNull();
    expect(d.triggerText).toBeNull();
  });

  it('splits color into colors array', () => {
    expect(rawToDomain({ ...raw, color: 'Red/Green' }).colors).toEqual(['Red', 'Green']);
  });

  it('splits family into attributes array', () => {
    expect(rawToDomain({ ...raw, family: 'Straw Hat Crew,Supernovas' }).attributes).toEqual([
      'Straw Hat Crew',
      'Supernovas',
    ]);
  });

  it('handles missing family/ability/trigger', () => {
    const minimal: RawCard = {
      ...raw,
      family: undefined,
      ability: undefined,
      trigger: undefined,
    };
    const d = rawToDomain(minimal);
    expect(d.attributes).toEqual([]);
    expect(d.effectText).toBe('');
    expect(d.triggerText).toBeNull();
  });

  it('uses images.large as sourceImageUrl', () => {
    expect(rawToDomain(raw).sourceImageUrl).toBe('https://example.com/op01-001.webp');
  });
});
```

**Step 2: Verificar que falla**

Run: `pnpm --filter @optcg/card-data test -- helpers`
Expected: FAIL — `Cannot find module '../src/helpers'`.

**Step 3: Implementar**

Crear `packages/card-data/src/helpers.ts`:

```ts
import type { DomainCard, RawCard } from './types';

export function splitMultiValue(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function rawToDomain(raw: RawCard): DomainCard {
  return {
    id: raw.id,
    setId: raw.set.id,
    setName: raw.set.name,
    name: raw.name,
    rarity: raw.rarity,
    type: raw.type,
    cost: raw.cost ?? null,
    power: raw.power ?? null,
    counter: raw.counter ?? null,
    life: raw.life ?? null,
    colors: splitMultiValue(raw.color),
    attributes: splitMultiValue(raw.family),
    effectText: raw.ability ?? '',
    triggerText: raw.trigger ?? null,
    sourceImageUrl: raw.images.large,
  };
}
```

**Step 4: Verificar que pasa**

Run: `pnpm --filter @optcg/card-data test -- helpers`
Expected: PASS (todos los tests de `helpers`).

**Step 5: Commit**

```bash
git add packages/card-data/src/helpers.ts packages/card-data/tests/helpers.test.ts
git commit -m "feat(card-data): add splitMultiValue and rawToDomain normalizers"
```

---

## Task 6: Fixture de apitcg + `ApitcgAdapter` (TDD)

**Files:**

- Create: `packages/card-data/tests/fixtures/apitcg-op01-sample.json`
- Create: `packages/card-data/src/service.ts`
- Create: `packages/card-data/src/adapters/apitcg.ts`
- Create: `packages/card-data/tests/apitcg-adapter.test.ts`

**Step 1: Crear fixture con 5 cartas representativas**

Crear `packages/card-data/tests/fixtures/apitcg-op01-sample.json`. La estructura esperada del listing de apitcg es `{ data: RawCard[] }` (o equivalente — el adapter la tolera). Usar este contenido de ejemplo:

```json
{
  "data": [
    {
      "id": "OP01-001",
      "name": "Roronoa Zoro",
      "rarity": "L",
      "type": "LEADER",
      "power": 5000,
      "life": 4,
      "color": "Green",
      "family": "Supernovas/Straw Hat Crew",
      "ability": "[Activate: Main] You may rest this Leader: Your Character gains [Rush] during this turn.",
      "set": { "id": "OP01", "name": "Romance Dawn" },
      "images": { "large": "https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png" }
    },
    {
      "id": "OP01-013",
      "name": "Usopp",
      "rarity": "C",
      "type": "CHARACTER",
      "cost": 1,
      "power": 2000,
      "counter": 1000,
      "color": "Green",
      "family": "Straw Hat Crew",
      "ability": "",
      "trigger": "[Trigger] Draw 1 card.",
      "set": { "id": "OP01", "name": "Romance Dawn" },
      "images": { "large": "https://en.onepiece-cardgame.com/images/cardlist/card/OP01-013.png" }
    },
    {
      "id": "OP01-024",
      "name": "Guard Point",
      "rarity": "C",
      "type": "EVENT",
      "cost": 1,
      "color": "Green",
      "family": "Animal/Straw Hat Crew",
      "ability": "[Counter] Up to 1 of your Leader or Character cards gains +3000 power.",
      "set": { "id": "OP01", "name": "Romance Dawn" },
      "images": { "large": "https://en.onepiece-cardgame.com/images/cardlist/card/OP01-024.png" }
    },
    {
      "id": "OP01-089",
      "name": "Thousand Sunny",
      "rarity": "R",
      "type": "STAGE",
      "cost": 2,
      "color": "Red/Green",
      "ability": "[Activate: Main] You may rest this Stage: ...",
      "set": { "id": "OP01", "name": "Romance Dawn" },
      "images": { "large": "https://en.onepiece-cardgame.com/images/cardlist/card/OP01-089.png" }
    },
    {
      "id": "OP01-120",
      "name": "Monkey D. Luffy",
      "rarity": "SR",
      "type": "CHARACTER",
      "cost": 5,
      "power": 6000,
      "counter": 1000,
      "color": "Red",
      "family": "Supernovas/Straw Hat Crew",
      "ability": "[Rush] [When Attacking] Give up to 1 of your opponent's Characters -2000 power during this turn.",
      "set": { "id": "OP01", "name": "Romance Dawn" },
      "images": { "large": "https://en.onepiece-cardgame.com/images/cardlist/card/OP01-120.png" }
    }
  ]
}
```

_Nota: si al correr el sync real se descubre que apitcg devuelve el array envuelto en una clave distinta (p.ej. `cards`, `items`) o sin envoltorio, ajusta el fixture y el parse del adapter en un commit separado. El resto del plan sigue siendo válido._

**Step 2: Test rojo del adapter**

Crear `packages/card-data/tests/apitcg-adapter.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApitcgAdapter } from '../src/adapters/apitcg';

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/apitcg-op01-sample.json'), 'utf8'),
);

describe('ApitcgAdapter.listCardsInSet', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('OP01')) {
          return new Response(JSON.stringify(fixture), { status: 200 });
        }
        return new Response('not found', { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 5 DomainCards for OP01', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    expect(cards).toHaveLength(5);
  });

  it('maps a LEADER correctly', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    const zoro = cards.find((c) => c.id === 'OP01-001');
    expect(zoro).toBeDefined();
    expect(zoro!.type).toBe('LEADER');
    expect(zoro!.life).toBe(4);
    expect(zoro!.cost).toBeNull();
    expect(zoro!.colors).toEqual(['Green']);
    expect(zoro!.attributes).toEqual(['Supernovas', 'Straw Hat Crew']);
  });

  it('maps a multi-color STAGE correctly', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    const sunny = cards.find((c) => c.id === 'OP01-089');
    expect(sunny!.colors).toEqual(['Red', 'Green']);
  });

  it('maps a CHARACTER with trigger', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    const usopp = cards.find((c) => c.id === 'OP01-013');
    expect(usopp!.type).toBe('CHARACTER');
    expect(usopp!.counter).toBe(1000);
    expect(usopp!.triggerText).toContain('Draw 1 card');
  });

  it('throws when the upstream response is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"data":[{"broken":true}]}', { status: 200 })),
    );
    const adapter = new ApitcgAdapter();
    await expect(adapter.listCardsInSet('OP01')).rejects.toThrow();
  });

  it('imageUrlFor returns the DomainCard.sourceImageUrl', async () => {
    const adapter = new ApitcgAdapter();
    const cards = await adapter.listCardsInSet('OP01');
    expect(adapter.imageUrlFor(cards[0])).toBe(cards[0].sourceImageUrl);
  });
});
```

**Step 3: Verificar que falla**

Run: `pnpm --filter @optcg/card-data test -- apitcg-adapter`
Expected: FAIL — module not found.

**Step 4: Crear la interfaz `CardDataService`**

Crear `packages/card-data/src/service.ts`:

```ts
import type { DomainCard } from './types';

export interface CardDataService {
  listCardsInSet(setId: string): Promise<DomainCard[]>;
  imageUrlFor(card: DomainCard): string;
}
```

**Step 5: Implementar `ApitcgAdapter`**

Crear `packages/card-data/src/adapters/apitcg.ts`:

```ts
import { z } from 'zod';
import type { CardDataService } from '../service';
import { rawToDomain } from '../helpers';
import { RawCardSchema, type DomainCard } from '../types';

const DEFAULT_BASE_URL = 'https://www.apitcg.com/api/one-piece';

const ResponseSchema = z.object({
  data: z.array(RawCardSchema),
});

export interface ApitcgAdapterOptions {
  baseUrl?: string;
  apiKey?: string;
}

export class ApitcgAdapter implements CardDataService {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(opts: ApitcgAdapterOptions = {}) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.apiKey = opts.apiKey;
  }

  async listCardsInSet(setId: string): Promise<DomainCard[]> {
    const url = `${this.baseUrl}/cards?set=${encodeURIComponent(setId)}`;
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.apiKey) headers['x-api-key'] = this.apiKey;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`apitcg returned ${res.status} for set ${setId}`);
    }

    const json = (await res.json()) as unknown;
    const parsed = ResponseSchema.parse(json);
    return parsed.data.map(rawToDomain);
  }

  imageUrlFor(card: DomainCard): string {
    return card.sourceImageUrl;
  }
}
```

**Step 6: Verificar que pasa**

Run: `pnpm --filter @optcg/card-data test -- apitcg-adapter`
Expected: PASS.

_Ajuste si el test de "malformed response" no tira:_ significa que `ResponseSchema.parse` no rechaza; inspeccionar qué shape está validando y corregir el schema o el fixture.

**Step 7: Typecheck + lint**

Run: `pnpm --filter @optcg/card-data typecheck && pnpm --filter @optcg/card-data lint`
Expected: sin errores.

**Step 8: Commit**

```bash
git add packages/card-data/src/service.ts packages/card-data/src/adapters/apitcg.ts packages/card-data/tests/apitcg-adapter.test.ts packages/card-data/tests/fixtures/apitcg-op01-sample.json
git commit -m "feat(card-data): add CardDataService interface and ApitcgAdapter with zod validation"
```

---

## Task 7: Image downloader (TDD)

**Files:**

- Create: `packages/card-data/src/images.ts`
- Create: `packages/card-data/tests/images.test.ts`

**Step 1: Test rojo**

Crear `packages/card-data/tests/images.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { downloadAndEncodeWebp } from '../src/images';

const PNG_1x1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c636060606000000005000106a9b8fad00000000049454e44ae426082',
  'hex',
);

describe('downloadAndEncodeWebp', () => {
  let workdir: string;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'card-img-'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(PNG_1x1, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(workdir, { recursive: true, force: true });
  });

  it('writes a webp file at the given path', async () => {
    const out = join(workdir, 'OP01', 'OP01-001.webp');
    await downloadAndEncodeWebp('https://x/op01-001.png', out);
    expect(existsSync(out)).toBe(true);
    const meta = await sharp(readFileSync(out)).metadata();
    expect(meta.format).toBe('webp');
  });

  it('creates intermediate directories', async () => {
    const out = join(workdir, 'nested', 'OP01', 'OP01-001.webp');
    await downloadAndEncodeWebp('https://x/op01-001.png', out);
    expect(existsSync(out)).toBe(true);
  });

  it('throws when fetch returns a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    const out = join(workdir, 'fail.webp');
    await expect(downloadAndEncodeWebp('https://x/fail.png', out)).rejects.toThrow();
  });
});
```

**Step 2: Verificar que falla**

Run: `pnpm --filter @optcg/card-data test -- images`
Expected: FAIL — module not found.

**Step 3: Implementar**

Crear `packages/card-data/src/images.ts`:

```ts
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const WEBP_QUALITY = 85;

export async function downloadAndEncodeWebp(sourceUrl: string, destAbsPath: string): Promise<void> {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`image fetch failed: ${res.status} for ${sourceUrl}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(destAbsPath), { recursive: true });
  await sharp(buf).webp({ quality: WEBP_QUALITY }).toFile(destAbsPath);
}
```

**Step 4: Verificar que pasa**

Run: `pnpm --filter @optcg/card-data test -- images`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/card-data/src/images.ts packages/card-data/tests/images.test.ts
git commit -m "feat(card-data): add downloadAndEncodeWebp with sharp"
```

---

## Task 8: Public re-exports (`src/index.ts`)

**Files:**

- Modify: `packages/card-data/src/index.ts`

**Step 1: Reemplazar el index**

Sobrescribir `packages/card-data/src/index.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { ApitcgAdapter } from './adapters/apitcg';
export type { CardDataService } from './service';
export { CARD_TYPES } from './types';
export type { CardType, DomainCard, RawCard } from './types';
export type { Card } from '@prisma/client';
```

**Step 2: Typecheck + lint**

Run: `pnpm --filter @optcg/card-data typecheck && pnpm --filter @optcg/card-data lint`
Expected: sin errores.

**Step 3: Commit**

```bash
git add packages/card-data/src/index.ts
git commit -m "feat(card-data): export service, adapter and domain types from package root"
```

---

## Task 9: Sync script

**Files:**

- Create: `packages/card-data/scripts/sync.ts`
- Create: `packages/card-data/tests/sync.test.ts`
- Create: `packages/card-data/src/sync-runner.ts` (lógica testable, separada del entrypoint)

**Step 1: Test rojo del runner (lo que es testable en unit)**

Crear `packages/card-data/tests/sync.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CardDataService } from '../src/service';
import type { DomainCard } from '../src/types';
import { runSync } from '../src/sync-runner';

const mockCards: DomainCard[] = [
  {
    id: 'OP01-001',
    setId: 'OP01',
    setName: 'Romance Dawn',
    name: 'Zoro',
    rarity: 'L',
    type: 'LEADER',
    cost: null,
    power: 5000,
    counter: null,
    life: 4,
    colors: ['Green'],
    attributes: ['Straw Hat Crew'],
    effectText: '',
    triggerText: null,
    sourceImageUrl: 'https://x/op01-001.png',
  },
  {
    id: 'OP01-013',
    setId: 'OP01',
    setName: 'Romance Dawn',
    name: 'Usopp',
    rarity: 'C',
    type: 'CHARACTER',
    cost: 1,
    power: 2000,
    counter: 1000,
    life: null,
    colors: ['Green'],
    attributes: ['Straw Hat Crew'],
    effectText: '',
    triggerText: 'Draw 1 card.',
    sourceImageUrl: 'https://x/op01-013.png',
  },
];

class FakeService implements CardDataService {
  constructor(private readonly cards: DomainCard[]) {}
  async listCardsInSet(_setId: string): Promise<DomainCard[]> {
    return this.cards;
  }
  imageUrlFor(card: DomainCard): string {
    return card.sourceImageUrl;
  }
}

describe('runSync', () => {
  let imagesDir: string;
  const writes: Array<{ id: string; imagePath: string }> = [];
  const downloadedUrls: string[] = [];

  const upsert = vi.fn(async (row: { id: string; imagePath: string }) => {
    writes.push(row);
  });

  const downloader = vi.fn(async (url: string, _path: string) => {
    downloadedUrls.push(url);
  });

  beforeEach(() => {
    imagesDir = mkdtempSync(join(tmpdir(), 'sync-'));
    writes.length = 0;
    downloadedUrls.length = 0;
    upsert.mockClear();
    downloader.mockClear();
  });

  afterEach(() => {
    rmSync(imagesDir, { recursive: true, force: true });
  });

  it('upserts every card and downloads every image on first run', async () => {
    const summary = await runSync({
      sets: ['OP01'],
      service: new FakeService(mockCards),
      imagesDir,
      upsertCard: upsert,
      downloadImage: downloader,
      forceImages: false,
    });

    expect(writes).toHaveLength(2);
    expect(downloadedUrls).toHaveLength(2);
    expect(summary.upserted).toBe(2);
    expect(summary.imagesDownloaded).toBe(2);
    expect(summary.imagesSkipped).toBe(0);
    expect(summary.failures).toBe(0);
  });

  it('skips existing images on second run', async () => {
    await runSync({
      sets: ['OP01'],
      service: new FakeService(mockCards),
      imagesDir,
      upsertCard: upsert,
      downloadImage: async (_url, path) => {
        // simulate file existing after first run
        const { writeFileSync } = await import('node:fs');
        const { dirname } = await import('node:path');
        const { mkdirSync } = await import('node:fs');
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, 'pretend-webp');
      },
      forceImages: false,
    });

    const secondRun = await runSync({
      sets: ['OP01'],
      service: new FakeService(mockCards),
      imagesDir,
      upsertCard: upsert,
      downloadImage: downloader,
      forceImages: false,
    });

    expect(secondRun.imagesDownloaded).toBe(0);
    expect(secondRun.imagesSkipped).toBe(2);
    expect(secondRun.upserted).toBe(2);
  });

  it('logs-and-continues when an image download fails', async () => {
    const summary = await runSync({
      sets: ['OP01'],
      service: new FakeService(mockCards),
      imagesDir,
      upsertCard: upsert,
      downloadImage: vi.fn(async () => {
        throw new Error('boom');
      }),
      forceImages: false,
    });

    expect(summary.failures).toBe(2);
    expect(summary.upserted).toBe(0);
  });

  it('writes imagePath relative to /cards', async () => {
    await runSync({
      sets: ['OP01'],
      service: new FakeService(mockCards),
      imagesDir,
      upsertCard: upsert,
      downloadImage: downloader,
      forceImages: false,
    });
    expect(writes[0].imagePath).toBe('/cards/OP01/OP01-001.webp');
  });
});
```

**Step 2: Verificar que falla**

Run: `pnpm --filter @optcg/card-data test -- sync`
Expected: FAIL — `sync-runner` no existe.

**Step 3: Implementar `sync-runner.ts`**

Crear `packages/card-data/src/sync-runner.ts`:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CardDataService } from './service';
import type { DomainCard } from './types';

export interface SyncRow {
  id: string;
  setId: string;
  setName: string;
  name: string;
  rarity: string;
  type: string;
  cost: number | null;
  power: number | null;
  counter: number | null;
  life: number | null;
  colors: string;
  attributes: string;
  effectText: string;
  triggerText: string | null;
  imagePath: string;
  sourceUrl: string;
}

export interface SyncOptions {
  sets: string[];
  service: CardDataService;
  imagesDir: string;
  upsertCard: (row: SyncRow) => Promise<void>;
  downloadImage: (url: string, dest: string) => Promise<void>;
  forceImages: boolean;
}

export interface SyncSummary {
  upserted: number;
  imagesDownloaded: number;
  imagesSkipped: number;
  failures: number;
}

function toRow(card: DomainCard, imagePath: string): SyncRow {
  return {
    id: card.id,
    setId: card.setId,
    setName: card.setName,
    name: card.name,
    rarity: card.rarity,
    type: card.type,
    cost: card.cost,
    power: card.power,
    counter: card.counter,
    life: card.life,
    colors: card.colors.join(','),
    attributes: card.attributes.join(','),
    effectText: card.effectText,
    triggerText: card.triggerText,
    imagePath,
    sourceUrl: card.sourceImageUrl,
  };
}

export async function runSync(opts: SyncOptions): Promise<SyncSummary> {
  const summary: SyncSummary = {
    upserted: 0,
    imagesDownloaded: 0,
    imagesSkipped: 0,
    failures: 0,
  };

  for (const setId of opts.sets) {
    const cards = await opts.service.listCardsInSet(setId);
    for (const card of cards) {
      const imagePath = `/cards/${card.setId}/${card.id}.webp`;
      const absImage = join(opts.imagesDir, card.setId, `${card.id}.webp`);

      if (!existsSync(absImage) || opts.forceImages) {
        try {
          await opts.downloadImage(card.sourceImageUrl, absImage);
          summary.imagesDownloaded += 1;
        } catch (err) {
          console.warn(`[${card.id}] image download failed: ${(err as Error).message}`);
          summary.failures += 1;
          continue;
        }
      } else {
        summary.imagesSkipped += 1;
      }

      await opts.upsertCard(toRow(card, imagePath));
      summary.upserted += 1;
    }
  }

  return summary;
}
```

**Step 4: Verificar que pasa**

Run: `pnpm --filter @optcg/card-data test -- sync`
Expected: PASS.

**Step 5: Escribir el entrypoint del script (incluye retry con backoff)**

Crear `packages/card-data/scripts/sync.ts`:

```ts
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma, ApitcgAdapter } from '../src/index';
import { runSync, type SyncRow } from '../src/sync-runner';
import { downloadAndEncodeWebp } from '../src/images';
import type { CardDataService } from '../src/service';
import type { DomainCard } from '../src/types';

const DEFAULT_SETS = ['OP01', 'OP02'];
const BACKOFF_MS = [1000, 4000, 10000];

function parseArgs(): { sets: string[]; forceImages: boolean } {
  const argv = process.argv.slice(2);
  let sets = DEFAULT_SETS;
  let forceImages = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--sets' && argv[i + 1]) {
      sets = argv[i + 1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i += 1;
    } else if (argv[i] === '--force-images') {
      forceImages = true;
    }
  }
  return { sets, forceImages };
}

function resolvePublicCardsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // packages/card-data/scripts -> apps/web/public/cards
  const candidate = resolve(here, '..', '..', '..', 'apps', 'web', 'public', 'cards');
  if (!existsSync(resolve(candidate, '..'))) {
    throw new Error(`cannot locate apps/web/public (looked at ${candidate})`);
  }
  return candidate;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Wraps a CardDataService so that listCardsInSet retries with backoff.
 * imageUrlFor is a pure function — passed through unchanged.
 */
function withRetry(service: CardDataService): CardDataService {
  return {
    async listCardsInSet(setId: string): Promise<DomainCard[]> {
      let lastErr: unknown;
      for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt += 1) {
        try {
          return await service.listCardsInSet(setId);
        } catch (err) {
          lastErr = err;
          if (attempt === BACKOFF_MS.length) break;
          const wait = BACKOFF_MS[attempt];
          console.warn(
            `[sync] ${setId} attempt ${attempt + 1} failed: ${(err as Error).message} — retrying in ${wait}ms`,
          );
          await sleep(wait);
        }
      }
      throw lastErr;
    },
    imageUrlFor: service.imageUrlFor.bind(service),
  };
}

async function main(): Promise<void> {
  const { sets, forceImages } = parseArgs();
  const imagesDir = resolvePublicCardsDir();
  const service = withRetry(new ApitcgAdapter({ apiKey: process.env.APITCG_KEY }));

  console.log(`[sync] sets=${sets.join(',')} forceImages=${forceImages}`);
  console.log(`[sync] imagesDir=${imagesDir}`);

  const summary = await runSync({
    sets,
    service,
    imagesDir,
    upsertCard: async (row: SyncRow) => {
      await prisma.card.upsert({ where: { id: row.id }, create: row, update: row });
    },
    downloadImage: downloadAndEncodeWebp,
    forceImages,
  });

  console.log(
    `[sync] done — upserted=${summary.upserted} imagesDownloaded=${summary.imagesDownloaded} imagesSkipped=${summary.imagesSkipped} failures=${summary.failures}`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[sync] fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
```

La política de retry solo envuelve el listing (red); los fallos de imagen individual se gestionan en `runSync` (log + continue, cubierto por tests en Task 9 Step 1).

**Step 6: Smoke typecheck + lint**

Run: `pnpm --filter @optcg/card-data typecheck && pnpm --filter @optcg/card-data lint`
Expected: sin errores.

_No corremos el script real de apitcg aquí — eso pasa en la verificación final (Task 15). El test unitario cubre el flujo con mocks._

**Step 7: Commit**

```bash
git add packages/card-data/src/sync-runner.ts packages/card-data/scripts/sync.ts packages/card-data/tests/sync.test.ts
git commit -m "feat(card-data): add runSync orchestrator and scripts/sync.ts entrypoint"
```

---

## Task 10: Añadir `@optcg/card-data` como dependencia de `apps/web` + instalar shadcn components

**Files:**

- Modify: `apps/web/package.json`
- Create: `apps/web/src/components/ui/dialog.tsx` (vía shadcn CLI)
- Create: `apps/web/src/components/ui/input.tsx` (vía shadcn CLI)
- Create: `apps/web/src/components/ui/checkbox.tsx` (vía shadcn CLI)
- Create: `apps/web/src/components/ui/label.tsx` (vía shadcn CLI)
- Create: `apps/web/src/components/ui/separator.tsx` (vía shadcn CLI)

**Step 1: Añadir dep de workspace**

Editar `apps/web/package.json`, sección `dependencies`, añadir:

```json
"@optcg/card-data": "workspace:*",
```

**Step 2: Instalar**

Run: `pnpm install`
Expected: `@optcg/card-data` enlazado como symlink del workspace.

**Step 3: Instalar componentes shadcn**

Run: `pnpm --filter @optcg/web exec shadcn@latest add dialog input checkbox label separator`

Expected: 5 archivos nuevos en `apps/web/src/components/ui/`. El CLI puede pedir confirmación — aceptar defaults. Si añade deps de Radix (`@radix-ui/react-dialog`, `@radix-ui/react-checkbox`, `@radix-ui/react-label`, `@radix-ui/react-separator`), quedan en `apps/web/package.json`.

_Ajuste si el CLI no está disponible globalmente:_ usar `pnpm dlx shadcn@latest add ...`.

**Step 4: Typecheck + lint**

Run: `pnpm --filter @optcg/web typecheck && pnpm --filter @optcg/web lint`
Expected: sin errores.

**Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/components/ui/ pnpm-lock.yaml
git commit -m "chore(web): add @optcg/card-data workspace dep and shadcn dialog/input/checkbox/label/separator"
```

---

## Task 11: Filter parser util (TDD)

**Files:**

- Create: `apps/web/src/lib/card-filters.ts`
- Create: `apps/web/src/lib/card-filters.test.ts`
- Modify: `apps/web/package.json` (añadir script `test` real con vitest) — ver nota

**Step 1: Vitest en apps/web (mínimo para este util)**

Editar `apps/web/package.json`, añadir en `devDependencies`:

```json
"vitest": "^1.6.0"
```

Cambiar script `test`:

```json
"test": "vitest run",
```

Añadir `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Run: `pnpm install`

**Step 2: Test rojo**

Crear `apps/web/src/lib/card-filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseFilters, PAGE_SIZE } from './card-filters';

describe('parseFilters', () => {
  it('returns defaults for empty params', () => {
    const f = parseFilters({});
    expect(f.where).toEqual({});
    expect(f.page).toBe(1);
    expect(f.skip).toBe(0);
  });

  it('parses q into a case-insensitive contains on name', () => {
    const f = parseFilters({ q: 'luffy' });
    expect(f.where).toEqual({ name: { contains: 'luffy' } });
  });

  it('parses a single color', () => {
    const f = parseFilters({ color: 'Red' });
    expect(f.where).toEqual({ colors: { contains: 'Red' } });
  });

  it('parses multiple colors as AND of contains', () => {
    const f = parseFilters({ color: 'Red,Green' });
    expect(f.where).toEqual({
      AND: [{ colors: { contains: 'Red' } }, { colors: { contains: 'Green' } }],
    });
  });

  it('parses a single type', () => {
    const f = parseFilters({ type: 'CHARACTER' });
    expect(f.where).toEqual({ type: 'CHARACTER' });
  });

  it('parses a single cost as exact match', () => {
    const f = parseFilters({ cost: '3' });
    expect(f.where).toEqual({ cost: 3 });
  });

  it('parses multiple costs as IN', () => {
    const f = parseFilters({ cost: '3,4' });
    expect(f.where).toEqual({ cost: { in: [3, 4] } });
  });

  it('combines filters with AND at the top level', () => {
    const f = parseFilters({ q: 'luffy', type: 'LEADER', color: 'Red' });
    expect(f.where).toEqual({
      name: { contains: 'luffy' },
      type: 'LEADER',
      colors: { contains: 'Red' },
    });
  });

  it('computes skip from page', () => {
    const f = parseFilters({ page: '3' });
    expect(f.page).toBe(3);
    expect(f.skip).toBe(2 * PAGE_SIZE);
  });

  it('clamps page to >=1', () => {
    expect(parseFilters({ page: '0' }).page).toBe(1);
    expect(parseFilters({ page: '-5' }).page).toBe(1);
    expect(parseFilters({ page: 'abc' }).page).toBe(1);
  });
});
```

**Step 3: Verificar que falla**

Run: `pnpm --filter @optcg/web test -- card-filters`
Expected: FAIL — module not found.

**Step 4: Implementar**

Crear `apps/web/src/lib/card-filters.ts`:

```ts
export const PAGE_SIZE = 48;

export interface SearchParams {
  q?: string;
  color?: string;
  type?: string;
  cost?: string;
  page?: string;
}

interface Where {
  name?: { contains: string };
  colors?: { contains: string };
  type?: string;
  cost?: number | { in: number[] };
  AND?: Array<{ colors: { contains: string } }>;
}

export interface ParsedFilters {
  where: Where;
  page: number;
  skip: number;
}

function splitCsv(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseFilters(params: SearchParams): ParsedFilters {
  const where: Where = {};

  if (params.q && params.q.length > 0) {
    where.name = { contains: params.q };
  }

  if (params.color) {
    const colors = splitCsv(params.color);
    if (colors.length === 1) {
      where.colors = { contains: colors[0] };
    } else if (colors.length > 1) {
      where.AND = colors.map((c) => ({ colors: { contains: c } }));
    }
  }

  if (params.type) {
    where.type = params.type;
  }

  if (params.cost) {
    const costs = splitCsv(params.cost)
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n));
    if (costs.length === 1) {
      where.cost = costs[0];
    } else if (costs.length > 1) {
      where.cost = { in: costs };
    }
  }

  const parsedPage = Number(params.page);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const skip = (page - 1) * PAGE_SIZE;

  return { where, page, skip };
}
```

**Step 5: Verificar que pasa**

Run: `pnpm --filter @optcg/web test -- card-filters`
Expected: PASS (todos los tests).

**Step 6: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/lib/card-filters.ts apps/web/src/lib/card-filters.test.ts pnpm-lock.yaml
git commit -m "feat(web): add parseFilters util with searchParams to Prisma translation"
```

---

## Task 12: `CardTile` + `CardDetailDialog`

**Files:**

- Create: `apps/web/src/app/cards/_components/card-tile.tsx`
- Create: `apps/web/src/app/cards/_components/card-detail-dialog.tsx`

**Step 1: `CardDetailDialog`**

Crear `apps/web/src/app/cards/_components/card-detail-dialog.tsx`:

```tsx
'use client';

import Image from 'next/image';
import type { Card } from '@optcg/card-data';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface Props {
  card: Card | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CardDetailDialog({ card, open, onOpenChange }: Props) {
  if (!card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{card.name}</DialogTitle>
          <DialogDescription>
            {card.id} · {card.setName} · {card.rarity}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <div className="relative aspect-[5/7] w-full overflow-hidden rounded-md">
            <Image
              src={card.imagePath}
              alt={card.name}
              fill
              sizes="280px"
              className="object-contain"
            />
          </div>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Field label="Type" value={card.type} />
              <Field label="Colors" value={card.colors.split(',').filter(Boolean).join(' / ')} />
              {card.cost !== null && <Field label="Cost" value={String(card.cost)} />}
              {card.power !== null && <Field label="Power" value={String(card.power)} />}
              {card.counter !== null && <Field label="Counter" value={String(card.counter)} />}
              {card.life !== null && <Field label="Life" value={String(card.life)} />}
              {card.attributes && (
                <Field
                  label="Attributes"
                  value={card.attributes.split(',').filter(Boolean).join(' / ')}
                />
              )}
            </div>
            <Separator />
            {card.effectText && (
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Effect</div>
                <p className="whitespace-pre-wrap">{card.effectText}</p>
              </div>
            )}
            {card.triggerText && (
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Trigger</div>
                <p className="whitespace-pre-wrap">{card.triggerText}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
```

**Step 2: `CardTile`**

Crear `apps/web/src/app/cards/_components/card-tile.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Card } from '@optcg/card-data';
import { CardDetailDialog } from './card-detail-dialog';

export function CardTile({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative aspect-[5/7] w-full overflow-hidden rounded-md border bg-muted transition hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={`Open details for ${card.name}`}
      >
        <Image
          src={card.imagePath}
          alt={card.name}
          fill
          sizes="(min-width:1024px) 16vw, (min-width:768px) 25vw, 50vw"
          className="object-cover"
        />
      </button>
      <CardDetailDialog card={card} open={open} onOpenChange={setOpen} />
    </>
  );
}
```

**Step 3: Typecheck + lint**

Run: `pnpm --filter @optcg/web typecheck && pnpm --filter @optcg/web lint`
Expected: sin errores.

**Step 4: Commit**

```bash
git add apps/web/src/app/cards/_components/card-tile.tsx apps/web/src/app/cards/_components/card-detail-dialog.tsx
git commit -m "feat(web): add CardTile and CardDetailDialog components"
```

---

## Task 13: `CardGrid`

**Files:**

- Create: `apps/web/src/app/cards/_components/card-grid.tsx`

**Step 1: Implementar**

Crear `apps/web/src/app/cards/_components/card-grid.tsx`:

```tsx
import type { Card } from '@optcg/card-data';
import { CardTile } from './card-tile';

export function CardGrid({ cards }: { cards: Card[] }) {
  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">No cards match the current filters.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
      {cards.map((card) => (
        <CardTile key={card.id} card={card} />
      ))}
    </div>
  );
}
```

**Step 2: Typecheck**

Run: `pnpm --filter @optcg/web typecheck`
Expected: sin errores.

**Step 3: Commit**

```bash
git add apps/web/src/app/cards/_components/card-grid.tsx
git commit -m "feat(web): add CardGrid component"
```

---

## Task 14: `FilterSidebar`

**Files:**

- Create: `apps/web/src/app/cards/_components/filter-sidebar.tsx`

**Step 1: Implementar**

Crear `apps/web/src/app/cards/_components/filter-sidebar.tsx`:

```tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CARD_TYPES } from '@optcg/card-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const COLORS = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'] as const;
const COSTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
const DEBOUNCE_MS = 250;

type CsvKey = 'color' | 'type' | 'cost';

export function FilterSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get('q') ?? '');

  // Debounced q → URL
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (q) next.set('q', q);
      else next.delete('q');
      next.delete('page');
      startTransition(() => {
        router.replace(`/cards?${next.toString()}`);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggleCsv(key: CsvKey, value: string) {
    const current = new Set((searchParams.get(key) ?? '').split(',').filter(Boolean));
    if (current.has(value)) current.delete(value);
    else current.add(value);
    const next = new URLSearchParams(searchParams.toString());
    if (current.size === 0) next.delete(key);
    else next.set(key, [...current].join(','));
    next.delete('page');
    startTransition(() => {
      router.replace(`/cards?${next.toString()}`);
    });
  }

  function isChecked(key: CsvKey, value: string): boolean {
    return (searchParams.get(key) ?? '').split(',').includes(value);
  }

  return (
    <aside
      className={`w-56 shrink-0 space-y-6 ${isPending ? 'opacity-70' : ''}`}
      aria-busy={isPending}
    >
      <div>
        <Label htmlFor="q" className="text-xs font-semibold uppercase">
          Search
        </Label>
        <Input
          id="q"
          type="search"
          placeholder="Name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-2"
        />
      </div>
      <Separator />
      <FilterGroup title="Color">
        {COLORS.map((c) => (
          <FilterCheckbox
            key={c}
            id={`color-${c}`}
            label={c}
            checked={isChecked('color', c)}
            onChange={() => toggleCsv('color', c)}
          />
        ))}
      </FilterGroup>
      <Separator />
      <FilterGroup title="Type">
        {CARD_TYPES.map((t) => (
          <FilterCheckbox
            key={t}
            id={`type-${t}`}
            label={t}
            checked={isChecked('type', t)}
            onChange={() => toggleCsv('type', t)}
          />
        ))}
      </FilterGroup>
      <Separator />
      <FilterGroup title="Cost">
        {COSTS.map((c) => (
          <FilterCheckbox
            key={c}
            id={`cost-${c}`}
            label={c}
            checked={isChecked('cost', c)}
            onChange={() => toggleCsv('cost', c)}
          />
        ))}
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FilterCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}
```

**Step 2: Typecheck + lint**

Run: `pnpm --filter @optcg/web typecheck && pnpm --filter @optcg/web lint`
Expected: sin errores.

**Step 3: Commit**

```bash
git add apps/web/src/app/cards/_components/filter-sidebar.tsx
git commit -m "feat(web): add FilterSidebar with debounced search and checkbox groups"
```

---

## Task 15: `Pagination`

**Files:**

- Create: `apps/web/src/app/cards/_components/pagination.tsx`

**Step 1: Implementar**

Crear `apps/web/src/app/cards/_components/pagination.tsx`:

```tsx
import Link from 'next/link';

interface Props {
  page: number;
  total: number;
  pageSize: number;
  searchParams: Record<string, string | string[] | undefined>;
}

function buildHref(base: Record<string, string | string[] | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === 'string' && v.length > 0 && k !== 'page') params.set(k, v);
  }
  params.set('page', String(page));
  return `/cards?${params.toString()}`;
}

export function Pagination({ page, total, pageSize, searchParams }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
      <Link
        href={buildHref(searchParams, prev)}
        aria-disabled={page === 1}
        className={`rounded border px-3 py-1 ${page === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-accent'}`}
      >
        ← Prev
      </Link>
      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Link
        href={buildHref(searchParams, next)}
        aria-disabled={page === totalPages}
        className={`rounded border px-3 py-1 ${page === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-accent'}`}
      >
        Next →
      </Link>
    </nav>
  );
}
```

**Step 2: Typecheck + lint**

Run: `pnpm --filter @optcg/web typecheck && pnpm --filter @optcg/web lint`
Expected: sin errores.

**Step 3: Commit**

```bash
git add apps/web/src/app/cards/_components/pagination.tsx
git commit -m "feat(web): add Pagination component preserving searchParams"
```

---

## Task 16: Página `/cards` + loading

**Files:**

- Create: `apps/web/src/app/cards/page.tsx`
- Create: `apps/web/src/app/cards/loading.tsx`

**Step 1: `loading.tsx`**

Crear `apps/web/src/app/cards/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="flex gap-6 p-6">
      <div className="h-[600px] w-56 shrink-0 animate-pulse rounded-md bg-muted" />
      <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="aspect-[5/7] animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: `page.tsx`**

Crear `apps/web/src/app/cards/page.tsx`:

```tsx
import { prisma } from '@optcg/card-data';
import { PAGE_SIZE, parseFilters, type SearchParams } from '@/lib/card-filters';
import { CardGrid } from './_components/card-grid';
import { FilterSidebar } from './_components/filter-sidebar';
import { Pagination } from './_components/pagination';

export const dynamic = 'force-dynamic';

export default async function CardsPage({ searchParams }: { searchParams: SearchParams }) {
  const { where, page, skip } = parseFilters(searchParams);

  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy: { id: 'asc' },
    }),
    prisma.card.count({ where }),
  ]);

  return (
    <div className="flex gap-6 p-6">
      <FilterSidebar />
      <main className="flex-1">
        <div className="mb-4 text-sm text-muted-foreground">
          {total} cards · page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </div>
        <CardGrid cards={cards} />
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} searchParams={searchParams} />
      </main>
    </div>
  );
}
```

**Step 3: Typecheck**

Run: `pnpm --filter @optcg/web typecheck`
Expected: sin errores.

_Si TS se queja de `SearchParams` por tipos strict de Next (indexed access con `undefined`), añadir `as SearchParams` en el cast del prop o redefinir el `SearchParams` del util para aceptar `string | string[] | undefined` y normalizar dentro._

**Step 4: Commit**

```bash
git add apps/web/src/app/cards/page.tsx apps/web/src/app/cards/loading.tsx
git commit -m "feat(web): add /cards gallery page as RSC with filters and pagination"
```

---

## Task 17: Link desde la home a `/cards`

**Files:**

- Modify: `apps/web/src/app/page.tsx`

**Step 1: Modificar la home**

Sobrescribir `apps/web/src/app/page.tsx`:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">Simulador One Piece TCG</h1>
      <p className="text-muted-foreground">Fase 1 · card data pipeline.</p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/cards">Explore cards</Link>
        </Button>
      </div>
    </main>
  );
}
```

**Step 2: Typecheck + lint**

Run: `pnpm --filter @optcg/web typecheck && pnpm --filter @optcg/web lint`
Expected: sin errores.

**Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(web): link home to /cards gallery"
```

---

## Task 18: Verificación completa (exit criteria)

**Files:** ninguno nuevo; esta task es de verificación y commit de ajustes si hiciera falta.

**Step 1: Todos los gates automáticos**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
Expected: los 4 verdes. Si alguno falla, **no continuar**: arreglar y reintentar.

**Step 2: Ejecución real del sync (OP01+OP02 contra apitcg)**

Run: `pnpm cards:sync`
Expected: log `[sync] done — upserted=N imagesDownloaded=M imagesSkipped=0 failures=0` con `N` ≥ 240 aprox (total OP01+OP02). Duración: ~1–3 min.

_Si apitcg devuelve 429/timeout_: re-ejecutar (es idempotente).
_Si apitcg devuelve shape distinto a la asumida en `ResponseSchema`_: zod revienta con mensaje claro. En ese caso: inspeccionar `console.error`, ajustar `ResponseSchema` y `ApitcgAdapter` en un commit separado `fix(card-data): adapt ApitcgAdapter to actual response shape`, re-ejecutar sync, continuar plan.

**Step 3: Verificar DB y archivos**

Run desde el root:

```bash
pnpm --filter @optcg/card-data exec prisma studio
```

Abrir `Card` table en el navegador y confirmar al menos:

- Hay filas con `setId='OP01'` y `setId='OP02'`.
- `imagePath` empieza por `/cards/OP01/` o `/cards/OP02/`.
- Algunas filas tienen `triggerText` no nulo.
- Algunas filas tienen `colors` con coma (p.ej. `Red,Green`).

Cerrar Prisma Studio.

**Step 4: Verificar imágenes en disco**

Run: `ls apps/web/public/cards/OP01 | head -5 && ls apps/web/public/cards/OP02 | head -5`
Expected: archivos `OP01-XXX.webp` y `OP02-XXX.webp` presentes. Un `wc -l` rápido confirma volumen (~240 archivos totales).

**Step 5: Smoke manual en el navegador**

Run: `pnpm dev` (levanta Next.js en `http://localhost:3000`).
Acciones manuales (marcar mentalmente como OK):

- Home carga; botón "Explore cards" navega a `/cards`.
- Galería muestra grid 6 columnas desktop, 2 móvil.
- Aplicar `color=Red` → solo cartas rojas.
- Aplicar `type=LEADER` → solo leaders.
- Aplicar `cost=3` → solo coste 3.
- Buscar "luffy" → resultados filtrados.
- Clic en una carta → modal con todos los campos.
- Paginación Next/Prev funciona y preserva filtros.
- URL es compartible (copiar con filtros aplicados, pegar en nueva pestaña → mismo estado).

Parar dev server con `Ctrl+C`.

**Step 6: Verificar que `apps/web` runtime no llama a apitcg**

Run: `grep -r "apitcg" apps/web/src || echo "OK: no hits"`
Expected: `OK: no hits`.

**Step 7: Segunda corrida de sync (idempotencia)**

Run: `pnpm cards:sync`
Expected: `upserted=N imagesDownloaded=0 imagesSkipped=N failures=0`. Las imágenes ya están; `upsert` actualiza pero no duplica.

**Step 8: Commit final (si hubo ajustes) y cierre**

Si hubo commits de ajuste a `ResponseSchema` u otros, verificar que todo está pusheable:

```bash
git status
git log --oneline main..HEAD
```

No hacer push ni PR aquí — eso va según el protocolo del usuario (ver `CLAUDE.md` §cierre de fase): resumen al usuario, esperar aprobación, luego push + PR.

---

## Exit criteria (copia del spec §9, para ticking)

- [ ] `pnpm cards:sync` termina exit 0 con OP01+OP02
- [ ] ≥ total oficial de cartas en DB (verificado en Prisma Studio)
- [ ] Cada fila tiene imagen en disco
- [ ] Galería `/cards` abre en `pnpm dev` sin errores
- [ ] Filtros funcionan (color, type, cost, q)
- [ ] Segunda corrida de sync = idempotente
- [ ] `grep -r "apitcg" apps/web/src` = 0 hits
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` verdes

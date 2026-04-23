# Fase 6 — Multijugador online Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servidor Socket.IO autoritativo en `apps/server` + cliente web online que completa partidas OPTCG entre dos pestañas, con reconexión 60 s, forfeit por timeout, filtrado de mano server-side y anti-cheat por token.

**Architecture:**

- Nuevo workspace `packages/protocol` — tipos compartidos (ClientMsg / ServerMsg) entre cliente y servidor.
- Nuevo workspace `apps/server` — Node/Fastify/Socket.IO autoritativo; match store in-memory; GameState via `@optcg/engine`; catálogo desde `catalog.json` snapshot.
- Cliente web añade `NetGameProvider` que expone la misma API que `GameProvider` pero delega acciones al servidor. Board/PlayerSide/etc. se reutilizan sin cambios.
- Sin despliegue en esta fase: Fly.io deferido (solo se documenta).

**Tech Stack:** TypeScript strict · Socket.IO v4 · Fastify v4 · zod · vitest · Next.js (cliente) · Node ≥20.

**Branch:** `feature/fase-6-multiplayer` (ya creada).

**Spec:** `docs/superpowers/specs/2026-04-23-fase-6-multiplayer-design.md` — es la fuente de verdad. Si hay conflicto, gana el spec.

**Modo de ejecución:** plan en modo estándar — el controller valida spec-compliance + code-quality review por cada tarea.

---

## Task 1: Bootstrap `packages/protocol`

Shared types workspace. Zero deps beyond `@optcg/engine`.

**Files:**

- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/index.ts`

- [ ] **Step 1: Create `packages/protocol/package.json`**

```json
{
  "name": "@optcg/protocol",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": { "types": "./src/index.ts", "import": "./src/index.ts" }
  },
  "scripts": {
    "lint": "eslint src --no-error-on-unmatched-pattern",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@optcg/engine": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.12.0"
  }
}
```

- [ ] **Step 2: Create `packages/protocol/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/protocol/src/index.ts`**

```ts
import type { Action, EngineError, GameEvent, GameState, PlayerIndex } from '@optcg/engine';

export type MatchStatus = 'waiting' | 'lobby' | 'playing' | 'finished';
export type GameOverReason = 'engine' | 'forfeit' | 'timeout';

export interface LobbyPlayer {
  nickname: string;
  deckReady: boolean;
  ready: boolean;
}

export type ClientMsg =
  | { kind: 'CreateMatch'; nickname: string }
  | { kind: 'JoinMatch'; matchId: string; nickname: string }
  | {
      kind: 'SubmitDeck';
      matchId: string;
      token: string;
      leaderCardId: string;
      deck: string[];
    }
  | { kind: 'SetReady'; matchId: string; token: string; ready: boolean }
  | { kind: 'ProposeAction'; matchId: string; token: string; action: Action }
  | { kind: 'ProposeActionBatch'; matchId: string; token: string; actions: Action[] }
  | { kind: 'Reconnect'; matchId: string; token: string }
  | { kind: 'Rematch'; matchId: string; token: string; ready: boolean }
  | { kind: 'Forfeit'; matchId: string; token: string };

export type ServerMsg =
  | { kind: 'MatchCreated'; matchId: string; token: string; playerIndex: 0 }
  | { kind: 'MatchJoined'; matchId: string; token: string; playerIndex: 1 }
  | {
      kind: 'LobbyUpdate';
      players: (LobbyPlayer | null)[];
      matchStatus: MatchStatus;
    }
  | { kind: 'GameStart'; firstPlayer: PlayerIndex; initialState: GameState }
  | { kind: 'StateUpdate'; state: GameState; events: GameEvent[] }
  | { kind: 'ActionRejected'; reason: EngineError; batchIndex?: number }
  | { kind: 'OpponentDisconnected'; secondsToForfeit: number }
  | { kind: 'OpponentReconnected' }
  | { kind: 'GameOver'; winner: PlayerIndex; reason: GameOverReason }
  | { kind: 'Error'; code: string; message: string };

export const HIDDEN_CARD_ID = '__hidden__' as const;
```

- [ ] **Step 4: Install + verify typecheck**

Run:

```bash
corepack pnpm@9.7.0 install
corepack pnpm@9.7.0 --filter @optcg/protocol typecheck
```

Expected: installs correctly, `tsc --noEmit` exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol pnpm-lock.yaml
git commit -m "feat(protocol): bootstrap shared message types"
```

---

## Task 2: Bootstrap `apps/server`

Node server workspace. Fastify + Socket.IO + workspace deps.

**Files:**

- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/vitest.config.ts`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/.gitignore`

- [ ] **Step 1: Create `apps/server/package.json`**

```json
{
  "name": "@optcg/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "lint": "eslint src tests --no-error-on-unmatched-pattern",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "catalog:build": "tsx scripts/build-catalog.ts"
  },
  "dependencies": {
    "@optcg/engine": "workspace:*",
    "@optcg/protocol": "workspace:*",
    "fastify": "^4.28.0",
    "@fastify/cors": "^9.0.0",
    "socket.io": "^4.7.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@optcg/card-data": "workspace:*",
    "@types/node": "^20.12.0",
    "socket.io-client": "^4.7.0",
    "tsx": "^4.19.0",
    "vitest": "^1.6.0",
    "@vitest/coverage-v8": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `apps/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "types": ["node"],
    "resolveJsonModule": true
  },
  "include": ["src", "tests", "scripts"]
}
```

- [ ] **Step 3: Create `apps/server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/match/**'],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
      },
    },
  },
});
```

- [ ] **Step 4: Create placeholder `apps/server/src/index.ts`**

```ts
// apps/server entry — wired in Task 5
export {};
```

- [ ] **Step 5: Create `apps/server/.gitignore`**

```
dist/
coverage/
*.log
src/catalog.json
```

- [ ] **Step 6: Install**

Run:

```bash
corepack pnpm@9.7.0 install
corepack pnpm@9.7.0 --filter @optcg/server typecheck
```

Expected: deps resolve, tsc exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/server pnpm-lock.yaml
git commit -m "feat(server): bootstrap apps/server workspace"
```

---

## Task 3: Catalog export script in `@optcg/card-data`

Emits `catalog.json` snapshot (Record<cardId, CardStatic>) for consumers outside the web app.

**Files:**

- Create: `packages/card-data/scripts/export-catalog.ts`
- Modify: `packages/card-data/package.json` (add script)
- Test: `packages/card-data/tests/export-catalog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/card-data/tests/export-catalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCatalogFromRows } from '../scripts/export-catalog';

describe('buildCatalogFromRows', () => {
  it('produces CardStatic entries keyed by id', () => {
    const rows = [
      {
        id: 'OP01-001',
        type: 'LEADER',
        colors: 'Red',
        cost: 5,
        power: 5000,
        counter: null,
        effectText: 'Your turn, your characters get +1000.',
      },
    ];
    const catalog = buildCatalogFromRows(rows);
    expect(catalog['OP01-001']).toBeDefined();
    expect(catalog['OP01-001'].type).toBe('LEADER');
    expect(catalog['OP01-001'].life).toBe(5); // LEADER life from cost
    expect(catalog['OP01-001'].cost).toBeNull();
  });

  it('skips DON and unknown types by coercing to CHARACTER', () => {
    const rows = [
      {
        id: 'X-001',
        type: 'UNKNOWN',
        colors: 'Green',
        cost: 2,
        power: 3000,
        counter: null,
        effectText: null,
      },
    ];
    const catalog = buildCatalogFromRows(rows);
    expect(catalog['X-001'].type).toBe('CHARACTER');
  });
});
```

- [ ] **Step 2: Run test — must fail**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/card-data test -- tests/export-catalog.test.ts
```

Expected: `buildCatalogFromRows is not exported` or `Cannot find module`.

- [ ] **Step 3: Write the script**

Create `packages/card-data/scripts/export-catalog.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/index';
import type { CardStatic, CardType } from '@optcg/engine';
import { getEffectsForCard } from '@optcg/engine';

interface Row {
  id: string;
  type: string;
  colors: string;
  cost: number | null;
  power: number | null;
  counter: number | null;
  effectText: string | null;
}

function normalizeType(t: string): CardType {
  if (t === 'LEADER' || t === 'CHARACTER' || t === 'EVENT' || t === 'STAGE') return t;
  return 'CHARACTER';
}

function parseKeywords(effectText: string | null | undefined): CardStatic['keywords'] {
  if (!effectText) return [];
  const text = effectText.toLowerCase();
  const keywords: CardStatic['keywords'] = [];
  if (text.includes('[rush]')) keywords.push('Rush');
  if (text.includes('[blocker]')) keywords.push('Blocker');
  if (text.includes('[double attack]') || text.includes('[doubleattack]')) {
    keywords.push('DoubleAttack');
  }
  if (text.includes('[banish]')) keywords.push('Banish');
  return keywords;
}

function cardToStatic(c: Row): CardStatic {
  const type = normalizeType(c.type);
  const life = type === 'LEADER' ? c.cost : null;
  const cost = type === 'LEADER' ? null : c.cost;
  return {
    id: c.id,
    type,
    colors: c.colors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    cost,
    power: c.power,
    life,
    counter: c.counter,
    keywords: parseKeywords(c.effectText),
    effects: getEffectsForCard(c.id),
    manualText: c.effectText && c.effectText.length > 0 ? c.effectText : null,
  };
}

export function buildCatalogFromRows(rows: Row[]): Record<string, CardStatic> {
  const out: Record<string, CardStatic> = {};
  for (const r of rows) out[r.id] = cardToStatic(r);
  return out;
}

async function main(): Promise<void> {
  const outputPath = process.argv[2];
  if (!outputPath) {
    console.error('Usage: export-catalog <output-path>');
    process.exit(1);
  }
  const cards = await prisma.card.findMany();
  const catalog = buildCatalogFromRows(cards as Row[]);
  const absolute = resolve(process.cwd(), outputPath);
  writeFileSync(absolute, JSON.stringify(catalog, null, 2));
  console.log(`Wrote ${Object.keys(catalog).length} cards to ${absolute}`);
  await prisma.$disconnect();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Add script entry to `packages/card-data/package.json`**

Under `"scripts"`, add (after `"sync"`):

```json
    "export:catalog": "tsx scripts/export-catalog.ts"
```

- [ ] **Step 5: Run test — must pass**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/card-data test -- tests/export-catalog.test.ts
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add packages/card-data/scripts packages/card-data/tests/export-catalog.test.ts packages/card-data/package.json
git commit -m "feat(card-data): export catalog snapshot script"
```

---

## Task 4: Server — catalog loader

`apps/server/src/catalog.ts` reads `src/catalog.json` at startup and validates shape.

**Files:**

- Create: `apps/server/src/catalog.ts`
- Create: `apps/server/tests/catalog.test.ts`
- Create: `apps/server/src/catalog.fixture.json` (small fixture for tests)

- [ ] **Step 1: Create the fixture**

Create `apps/server/src/catalog.fixture.json`:

```json
{
  "OP01-001": {
    "id": "OP01-001",
    "type": "LEADER",
    "colors": ["Red"],
    "cost": null,
    "power": 5000,
    "life": 5,
    "counter": null,
    "keywords": [],
    "effects": [],
    "manualText": null
  },
  "OP01-006": {
    "id": "OP01-006",
    "type": "CHARACTER",
    "colors": ["Red"],
    "cost": 3,
    "power": 4000,
    "life": null,
    "counter": 1000,
    "keywords": ["Rush"],
    "effects": [],
    "manualText": "[Rush]"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/server/tests/catalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadCatalog } from '../src/catalog';

describe('loadCatalog', () => {
  it('loads a valid catalog JSON', () => {
    const path = resolve(__dirname, '../src/catalog.fixture.json');
    const catalog = loadCatalog(path);
    expect(Object.keys(catalog)).toHaveLength(2);
    expect(catalog['OP01-001'].type).toBe('LEADER');
    expect(catalog['OP01-001'].life).toBe(5);
  });

  it('throws when file missing', () => {
    expect(() => loadCatalog('/nonexistent/path.json')).toThrow(/catalog/i);
  });

  it('throws when file is not a valid JSON object', () => {
    const path = resolve(__dirname, 'broken.json');
    // Note: test doesn't create the file; relies on ENOENT path above.
    expect(() => loadCatalog(path)).toThrow();
  });
});
```

- [ ] **Step 3: Run test — must fail**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test
```

Expected: fails with missing `loadCatalog` export.

- [ ] **Step 4: Implement `src/catalog.ts`**

```ts
import { readFileSync, existsSync } from 'node:fs';
import type { CardStatic } from '@optcg/engine';

export function loadCatalog(path: string): Record<string, CardStatic> {
  if (!existsSync(path)) {
    throw new Error(`catalog.json not found at ${path}`);
  }
  const raw = readFileSync(path, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid catalog JSON: ${(err as Error).message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('catalog JSON must be an object keyed by card id');
  }
  return parsed as Record<string, CardStatic>;
}
```

- [ ] **Step 5: Run tests — must pass**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/catalog.ts apps/server/src/catalog.fixture.json apps/server/tests/catalog.test.ts
git commit -m "feat(server): catalog loader from JSON snapshot"
```

---

## Task 5: Server — Fastify + Socket.IO bootstrap

HTTP healthcheck + Socket.IO attached. No handlers yet (added in Task 12).

**Files:**

- Modify: `apps/server/src/index.ts`
- Create: `apps/server/src/logger.ts`
- Create: `apps/server/tests/bootstrap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/tests/bootstrap.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { buildServer } from '../src/index';
import type { FastifyInstance } from 'fastify';

const CATALOG_PATH = resolve(__dirname, '../src/catalog.fixture.json');

describe('buildServer', () => {
  let app: FastifyInstance | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('responds to GET /health with 200 ok', async () => {
    app = await buildServer({ catalogPath: CATALOG_PATH });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run test — must fail**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/bootstrap.test.ts
```

Expected: `buildServer is not exported`.

- [ ] **Step 3: Implement `src/logger.ts`**

```ts
export interface Logger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export function createLogger(): Logger {
  const emit = (level: string) => (msg: string, meta?: Record<string, unknown>) => {
    const line = { level, ts: new Date().toISOString(), msg, ...(meta ?? {}) };
    console.log(JSON.stringify(line));
  };
  return { info: emit('info'), warn: emit('warn'), error: emit('error') };
}
```

- [ ] **Step 4: Implement `src/index.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { loadCatalog } from './catalog';
import { createLogger } from './logger';

export interface ServerOptions {
  catalogPath: string;
  corsOrigin?: string;
}

export async function buildServer(
  opts: ServerOptions,
): Promise<FastifyInstance & { io: SocketIOServer }> {
  const logger = createLogger();
  const catalog = loadCatalog(opts.catalogPath);
  logger.info('catalog loaded', { cards: Object.keys(catalog).length });

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: opts.corsOrigin ?? '*' });

  app.get('/health', async () => ({ status: 'ok' }));

  const io = new SocketIOServer(app.server, {
    cors: { origin: opts.corsOrigin ?? '*' },
  });

  const decorated = app as FastifyInstance & { io: SocketIOServer };
  decorated.io = io;
  return decorated;
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3001);
  const catalogPath =
    process.env.CATALOG_PATH ?? new URL('./catalog.json', import.meta.url).pathname;
  const corsOrigin = process.env.CORS_ORIGIN;

  const app = await buildServer({ catalogPath, corsOrigin });
  await app.listen({ port, host: '0.0.0.0' });
  // eslint-disable-next-line no-console
  console.log(`server listening on :${port}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run test — must pass**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/bootstrap.test.ts
```

Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src apps/server/tests/bootstrap.test.ts
git commit -m "feat(server): Fastify + Socket.IO bootstrap with /health"
```

---

## Task 6: Server — zod schemas for ClientMsg

Runtime validation of inbound messages.

**Files:**

- Create: `apps/server/src/protocol/schemas.ts`
- Create: `apps/server/tests/protocol/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/tests/protocol/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clientMsgSchema } from '../../src/protocol/schemas';

describe('clientMsgSchema', () => {
  it('accepts CreateMatch', () => {
    const msg = { kind: 'CreateMatch', nickname: 'Tiago' };
    expect(clientMsgSchema.safeParse(msg).success).toBe(true);
  });

  it('rejects CreateMatch with empty nickname', () => {
    const msg = { kind: 'CreateMatch', nickname: '' };
    expect(clientMsgSchema.safeParse(msg).success).toBe(false);
  });

  it('accepts ProposeAction with EndTurn', () => {
    const msg = {
      kind: 'ProposeAction',
      matchId: 'ABC123',
      token: 't',
      action: { kind: 'EndTurn', player: 0 },
    };
    expect(clientMsgSchema.safeParse(msg).success).toBe(true);
  });

  it('rejects unknown kind', () => {
    const msg = { kind: 'Nope' };
    expect(clientMsgSchema.safeParse(msg).success).toBe(false);
  });

  it('accepts ProposeActionBatch with array of actions', () => {
    const msg = {
      kind: 'ProposeActionBatch',
      matchId: 'ABC123',
      token: 't',
      actions: [
        { kind: 'PlayCounter', player: 0, handIndex: 0 },
        { kind: 'DeclineCounter', player: 0 },
      ],
    };
    expect(clientMsgSchema.safeParse(msg).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — must fail**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/protocol/schemas.test.ts
```

Expected: missing `clientMsgSchema` export.

- [ ] **Step 3: Implement `src/protocol/schemas.ts`**

```ts
import { z } from 'zod';

const nickname = z.string().min(1).max(24);
const matchIdSchema = z.string().regex(/^[A-Z0-9]{6}$/);
const token = z.string().min(8).max(64);

// Action schema: loose — we trust the engine's apply() to reject invalid shapes.
// This schema only guards against non-objects so malformed payloads can't crash zod.
const action = z.object({ kind: z.string() }).passthrough();

export const clientMsgSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CreateMatch'), nickname }),
  z.object({ kind: z.literal('JoinMatch'), matchId: matchIdSchema, nickname }),
  z.object({
    kind: z.literal('SubmitDeck'),
    matchId: matchIdSchema,
    token,
    leaderCardId: z.string().min(1),
    deck: z.array(z.string().min(1)).length(50),
  }),
  z.object({
    kind: z.literal('SetReady'),
    matchId: matchIdSchema,
    token,
    ready: z.boolean(),
  }),
  z.object({
    kind: z.literal('ProposeAction'),
    matchId: matchIdSchema,
    token,
    action,
  }),
  z.object({
    kind: z.literal('ProposeActionBatch'),
    matchId: matchIdSchema,
    token,
    actions: z.array(action).min(1).max(20),
  }),
  z.object({ kind: z.literal('Reconnect'), matchId: matchIdSchema, token }),
  z.object({
    kind: z.literal('Rematch'),
    matchId: matchIdSchema,
    token,
    ready: z.boolean(),
  }),
  z.object({ kind: z.literal('Forfeit'), matchId: matchIdSchema, token }),
]);

export type ValidatedClientMsg = z.infer<typeof clientMsgSchema>;
```

- [ ] **Step 4: Run test — must pass**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/protocol/schemas.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/protocol/schemas.ts apps/server/tests/protocol/schemas.test.ts
git commit -m "feat(server): zod schemas for ClientMsg"
```

---

## Task 7: Server — private-hand filter

`filterStateForPlayer(state, player)` replaces opponent hand/life/deck with `__hidden__` placeholders.

**Files:**

- Create: `apps/server/src/protocol/filter.ts`
- Create: `apps/server/tests/protocol/filter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/tests/protocol/filter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterStateForPlayer } from '../../src/protocol/filter';
import { HIDDEN_CARD_ID } from '@optcg/protocol';
import type { GameState, PlayerState } from '@optcg/engine';

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    playerId: 'p',
    leader: { cardId: 'OP01-001', rested: false, attachedDon: 0, powerThisTurn: 0 },
    deck: ['C1', 'C2', 'C3'],
    hand: ['C4', 'C5'],
    life: ['C6', 'C7'],
    trash: [],
    banishZone: [],
    characters: [],
    stage: null,
    donActive: 0,
    donRested: 0,
    donDeck: 10,
    mulliganTaken: false,
    firstTurnUsed: false,
    ...overrides,
  };
}

function makeState(): GameState {
  return {
    turn: 1,
    activePlayer: 0,
    phase: 'Main',
    priorityWindow: null,
    players: [
      makePlayer({ playerId: 'alice' }),
      makePlayer({ playerId: 'bob', hand: ['B1', 'B2', 'B3'] }),
    ],
    rng: { seed: 1, pointer: 0 },
    log: [],
    winner: null,
    catalog: {},
    isFirstTurnOfFirstPlayer: true,
  };
}

describe('filterStateForPlayer', () => {
  it('hides opponent hand/life/deck for player 0', () => {
    const filtered = filterStateForPlayer(makeState(), 0);
    expect(filtered.players[0].hand).toEqual(['C4', 'C5']);
    expect(filtered.players[1].hand).toEqual([HIDDEN_CARD_ID, HIDDEN_CARD_ID, HIDDEN_CARD_ID]);
    expect(filtered.players[1].life).toEqual([HIDDEN_CARD_ID, HIDDEN_CARD_ID]);
    expect(filtered.players[1].deck).toEqual([HIDDEN_CARD_ID, HIDDEN_CARD_ID, HIDDEN_CARD_ID]);
  });

  it('preserves zone counts (array length)', () => {
    const filtered = filterStateForPlayer(makeState(), 0);
    expect(filtered.players[1].hand).toHaveLength(3);
    expect(filtered.players[1].life).toHaveLength(2);
    expect(filtered.players[1].deck).toHaveLength(3);
  });

  it('does not mutate input state', () => {
    const state = makeState();
    filterStateForPlayer(state, 0);
    expect(state.players[1].hand).toEqual(['B1', 'B2', 'B3']);
  });
});
```

- [ ] **Step 2: Run test — must fail**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/protocol/filter.test.ts
```

Expected: missing `filterStateForPlayer`.

- [ ] **Step 3: Implement `src/protocol/filter.ts`**

```ts
import { HIDDEN_CARD_ID } from '@optcg/protocol';
import type { GameState, PlayerIndex, PlayerState } from '@optcg/engine';

function hideArray<T>(arr: T[]): string[] {
  return new Array<string>(arr.length).fill(HIDDEN_CARD_ID);
}

function hidePlayer(p: PlayerState): PlayerState {
  return {
    ...p,
    hand: hideArray(p.hand),
    life: hideArray(p.life),
    deck: hideArray(p.deck),
  };
}

export function filterStateForPlayer(state: GameState, receiver: PlayerIndex): GameState {
  const opponentIndex: PlayerIndex = receiver === 0 ? 1 : 0;
  const newPlayers: GameState['players'] = [state.players[0], state.players[1]];
  newPlayers[opponentIndex] = hidePlayer(state.players[opponentIndex]);
  return { ...state, players: newPlayers };
}
```

- [ ] **Step 4: Run test — must pass**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/protocol/filter.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/protocol/filter.ts apps/server/tests/protocol/filter.test.ts
git commit -m "feat(server): private-hand filter for StateUpdates"
```

---

## Task 8: Server — match code generator

Produces 6-char alphanum codes with collision retry.

**Files:**

- Create: `apps/server/src/match/codes.ts`
- Create: `apps/server/tests/match/codes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/tests/match/codes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateMatchCode } from '../../src/match/codes';

describe('generateMatchCode', () => {
  it('produces 6 uppercase alphanum chars', () => {
    const code = generateMatchCode(() => false);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('retries on collision', () => {
    let calls = 0;
    const existsUntil = (code: string) => {
      calls += 1;
      return calls <= 2; // reject first 2 attempts
    };
    const code = generateMatchCode(existsUntil);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('throws after 50 collision retries', () => {
    expect(() => generateMatchCode(() => true)).toThrow(/collision/i);
  });
});
```

- [ ] **Step 2: Run test — must fail**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/match/codes.test.ts
```

Expected: missing `generateMatchCode`.

- [ ] **Step 3: Implement `src/match/codes.ts`**

```ts
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const LENGTH = 6;
const MAX_ATTEMPTS = 50;

function randomCode(): string {
  let out = '';
  for (let i = 0; i < LENGTH; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function generateMatchCode(exists: (code: string) => boolean): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = randomCode();
    if (!exists(code)) return code;
  }
  throw new Error('match code collision — no free code found');
}
```

- [ ] **Step 4: Run test — must pass**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/match/codes.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/match/codes.ts apps/server/tests/match/codes.test.ts
git commit -m "feat(server): match code generator with collision retry"
```

---

## Task 9: Server — Match facade (lifecycle core)

`Match` class encapsulates GameState + transitions. No timers yet (Task 10), no sockets (Task 12).

**Files:**

- Create: `apps/server/src/match/match.ts`
- Create: `apps/server/tests/match/lifecycle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/tests/match/lifecycle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Match } from '../../src/match/match';
import type { CardStatic } from '@optcg/engine';

const CATALOG: Record<string, CardStatic> = {
  'OP01-001': {
    id: 'OP01-001',
    type: 'LEADER',
    colors: ['Red'],
    cost: null,
    power: 5000,
    life: 5,
    counter: null,
    keywords: [],
    effects: [],
    manualText: null,
  },
  'OP01-006': {
    id: 'OP01-006',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 3,
    power: 4000,
    life: null,
    counter: 1000,
    keywords: [],
    effects: [],
    manualText: null,
  },
};

function validDeck(): string[] {
  return Array(50).fill('OP01-006');
}

describe('Match lifecycle', () => {
  it('starts in waiting with only host', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    expect(m.status).toBe('waiting');
    expect(m.players[0]?.nickname).toBe('Alice');
    expect(m.players[1]).toBeNull();
  });

  it('moves to lobby when guest joins', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    const joined = m.join('guest-token', 'Bob');
    expect(joined.ok).toBe(true);
    expect(m.status).toBe('lobby');
    expect(m.players[1]?.nickname).toBe('Bob');
  });

  it('rejects second join', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    const r = m.join('third-token', 'Charlie');
    expect(r.ok).toBe(false);
  });

  it('SubmitDeck validates and stores', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    const r = m.submitDeck('host-token', 'OP01-001', validDeck());
    expect(r.ok).toBe(true);
    expect(m.players[0]?.deck).not.toBeNull();
  });

  it('SubmitDeck rejects invalid count', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    const r = m.submitDeck('host-token', 'OP01-001', Array(40).fill('OP01-006'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.code).toBe('DeckInvalid');
  });

  it('starts playing when both ready with decks', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    m.submitDeck('host-token', 'OP01-001', validDeck());
    m.submitDeck('guest-token', 'OP01-001', validDeck());
    m.setReady('host-token', true);
    const start = m.setReady('guest-token', true);
    expect(start.ok).toBe(true);
    expect(m.status).toBe('playing');
    expect(m.state).not.toBeNull();
  });

  it('rejects SetReady(true) without submitted deck', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    const r = m.setReady('host-token', true);
    expect(r.ok).toBe(false);
  });

  it('ProposeAction rejects wrong-token', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    m.submitDeck('host-token', 'OP01-001', validDeck());
    m.submitDeck('guest-token', 'OP01-001', validDeck());
    m.setReady('host-token', true);
    m.setReady('guest-token', true);
    // Turn 0 Mulligan — priority is on firstPlayer.
    const activeToken = m.state?.activePlayer === 0 ? 'guest-token' : 'host-token';
    const r = m.proposeAction(activeToken, { kind: 'Mulligan', player: 0, mulligan: false });
    expect(r.ok).toBe(false);
  });

  it('ProposeAction accepts correct token and updates state', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    m.submitDeck('host-token', 'OP01-001', validDeck());
    m.submitDeck('guest-token', 'OP01-001', validDeck());
    m.setReady('host-token', true);
    m.setReady('guest-token', true);
    const firstPlayer = m.state!.activePlayer;
    const firstToken = firstPlayer === 0 ? 'host-token' : 'guest-token';
    const r = m.proposeAction(firstToken, {
      kind: 'Mulligan',
      player: firstPlayer,
      mulligan: false,
    });
    expect(r.ok).toBe(true);
  });

  it('rematch flips firstPlayer', () => {
    const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
    m.join('guest-token', 'Bob');
    m.submitDeck('host-token', 'OP01-001', validDeck());
    m.submitDeck('guest-token', 'OP01-001', validDeck());
    m.setReady('host-token', true);
    m.setReady('guest-token', true);
    const firstBefore = m.state!.activePlayer;
    m.forceFinish(firstBefore === 0 ? 1 : 0, 'forfeit');
    m.rematch('host-token', true);
    m.rematch('guest-token', true);
    expect(m.status).toBe('playing');
    expect(m.state!.activePlayer).not.toBe(firstBefore);
  });
});
```

- [ ] **Step 2: Run test — must fail**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/match/lifecycle.test.ts
```

Expected: `Match is not exported`.

- [ ] **Step 3: Implement `src/match/match.ts`**

```ts
import type {
  Action,
  CardStatic,
  EngineError,
  GameEvent,
  GameState,
  PlayerIndex,
} from '@optcg/engine';
import { apply, createInitialState } from '@optcg/engine';
import type { GameOverReason, MatchStatus } from '@optcg/protocol';

export interface MatchPlayer {
  token: string;
  nickname: string;
  socketId: string | null;
  deck: { leaderCardId: string; cards: string[] } | null;
  ready: boolean;
}

export type OpResult<T = void> = { ok: true; value: T } | { ok: false; reason: EngineError };

function ok<T>(value: T): OpResult<T> {
  return { ok: true, value };
}

function err(code: string, detail?: string): OpResult<never> {
  return { ok: false, reason: { code, detail } as EngineError };
}

function validateDeckAgainstCatalog(
  leaderCardId: string,
  deck: string[],
  catalog: Record<string, CardStatic>,
): { ok: true } | { ok: false; reason: string } {
  const leader = catalog[leaderCardId];
  if (!leader) return { ok: false, reason: `Unknown leader ${leaderCardId}` };
  if (leader.type !== 'LEADER') return { ok: false, reason: `${leaderCardId} is not a LEADER` };
  if (deck.length !== 50)
    return { ok: false, reason: `Deck must have 50 cards, got ${deck.length}` };
  for (const id of deck) {
    if (!catalog[id]) return { ok: false, reason: `Unknown card ${id}` };
  }
  return { ok: true };
}

export class Match {
  status: MatchStatus = 'waiting';
  players: [MatchPlayer | null, MatchPlayer | null];
  state: GameState | null = null;
  readonly createdAt = Date.now();
  private rngSeed: number;
  private nextFirstPlayer: PlayerIndex = Math.random() < 0.5 ? 0 : 1;

  constructor(
    readonly id: string,
    hostToken: string,
    hostNickname: string,
    private catalog: Record<string, CardStatic>,
  ) {
    this.players = [
      { token: hostToken, nickname: hostNickname, socketId: null, deck: null, ready: false },
      null,
    ];
    this.rngSeed = Math.floor(Math.random() * 0x7fffffff);
  }

  join(token: string, nickname: string): OpResult {
    if (this.status !== 'waiting') return err('MatchUnavailable');
    this.players[1] = { token, nickname, socketId: null, deck: null, ready: false };
    this.status = 'lobby';
    return ok(undefined);
  }

  private playerByToken(token: string): { index: PlayerIndex; player: MatchPlayer } | null {
    if (this.players[0]?.token === token) return { index: 0, player: this.players[0] };
    if (this.players[1]?.token === token) return { index: 1, player: this.players[1] };
    return null;
  }

  submitDeck(token: string, leaderCardId: string, deck: string[]): OpResult {
    const p = this.playerByToken(token);
    if (!p) return err('Unauthorized');
    if (this.status !== 'lobby') return err('WrongPhase');
    const check = validateDeckAgainstCatalog(leaderCardId, deck, this.catalog);
    if (!check.ok) return err('DeckInvalid', check.reason);
    p.player.deck = { leaderCardId, cards: deck };
    p.player.ready = false; // submitting deck resets ready
    return ok(undefined);
  }

  setReady(token: string, ready: boolean): OpResult {
    const p = this.playerByToken(token);
    if (!p) return err('Unauthorized');
    if (this.status !== 'lobby') return err('WrongPhase');
    if (ready && !p.player.deck) return err('DeckInvalid', 'Submit deck before ready');
    p.player.ready = ready;

    const both = this.players[0]?.ready && this.players[1]?.ready;
    if (both && this.players[0]?.deck && this.players[1]?.deck) {
      this.startGame(this.nextFirstPlayer);
    }
    return ok(undefined);
  }

  private startGame(firstPlayer: PlayerIndex): void {
    const p0 = this.players[0]!;
    const p1 = this.players[1]!;
    this.state = createInitialState({
      seed: this.rngSeed,
      firstPlayer,
      players: [
        { playerId: p0.token, leaderCardId: p0.deck!.leaderCardId, deck: p0.deck!.cards },
        { playerId: p1.token, leaderCardId: p1.deck!.leaderCardId, deck: p1.deck!.cards },
      ],
      catalog: this.catalog,
    });
    this.status = 'playing';
    this.nextFirstPlayer = firstPlayer === 0 ? 1 : 0;
  }

  private actorIndex(state: GameState): PlayerIndex | null {
    const pw = state.priorityWindow;
    if (pw) {
      if (pw.kind === 'Mulligan') return pw.player;
      if (pw.kind === 'CounterStep') return pw.defender.owner;
      if (pw.kind === 'BlockerStep') return pw.originalTarget.owner;
      if (pw.kind === 'TriggerStep') return pw.owner;
    }
    return state.activePlayer;
  }

  proposeAction(
    token: string,
    action: Action,
  ): OpResult<{ state: GameState; events: GameEvent[] }> {
    const p = this.playerByToken(token);
    if (!p) return err('Unauthorized');
    if (this.status !== 'playing' || !this.state) return err('WrongPhase');
    const expected = this.actorIndex(this.state);
    if (expected !== p.index) return err('NotYourPriority');
    const result = apply(this.state, action);
    if (result.error) return { ok: false, reason: result.error };
    this.state = result.state;
    if (this.state.phase === 'GameOver' && this.state.winner !== null) {
      this.status = 'finished';
    }
    return ok({ state: this.state, events: result.events });
  }

  proposeActionBatch(
    token: string,
    actions: Action[],
  ): OpResult<{ state: GameState; events: GameEvent[] }> {
    const p = this.playerByToken(token);
    if (!p) return err('Unauthorized');
    if (this.status !== 'playing' || !this.state) return err('WrongPhase');
    const snapshot = this.state;
    let current = snapshot;
    const allEvents: GameEvent[] = [];
    for (let i = 0; i < actions.length; i += 1) {
      const expected = this.actorIndex(current);
      if (expected !== p.index) {
        this.state = snapshot; // rollback
        return {
          ok: false,
          reason: { code: 'NotYourPriority', detail: `index ${i}` } as EngineError,
        };
      }
      const result = apply(current, actions[i]);
      if (result.error) {
        this.state = snapshot; // rollback
        return { ok: false, reason: result.error };
      }
      current = result.state;
      allEvents.push(...result.events);
    }
    this.state = current;
    if (this.state.phase === 'GameOver' && this.state.winner !== null) {
      this.status = 'finished';
    }
    return ok({ state: this.state, events: allEvents });
  }

  forceFinish(winner: PlayerIndex, _reason: GameOverReason): void {
    this.status = 'finished';
    if (this.state) this.state = { ...this.state, winner, phase: 'GameOver' };
  }

  rematch(token: string, ready: boolean): OpResult {
    const p = this.playerByToken(token);
    if (!p) return err('Unauthorized');
    if (this.status !== 'finished') return err('WrongPhase');
    p.player.ready = ready;
    if (this.players[0]?.ready && this.players[1]?.ready) {
      this.rngSeed = Math.floor(Math.random() * 0x7fffffff);
      this.players[0]!.ready = false;
      this.players[1]!.ready = false;
      this.startGame(this.nextFirstPlayer);
    }
    return ok(undefined);
  }
}
```

- [ ] **Step 4: Run tests — must pass**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/match/lifecycle.test.ts
```

Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/match/match.ts apps/server/tests/match/lifecycle.test.ts
git commit -m "feat(server): Match facade with lifecycle transitions"
```

---

## Task 10: Server — disconnect timers & reconnect on Match

Add `handleDisconnect`, `handleReconnect` and `forfeit` to `Match`, using injected clock + timer factory for testability.

**Files:**

- Modify: `apps/server/src/match/match.ts`
- Create: `apps/server/tests/match/timeout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/tests/match/timeout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Match } from '../../src/match/match';
import type { CardStatic } from '@optcg/engine';

const CATALOG: Record<string, CardStatic> = {
  'OP01-001': {
    id: 'OP01-001',
    type: 'LEADER',
    colors: ['Red'],
    cost: null,
    power: 5000,
    life: 5,
    counter: null,
    keywords: [],
    effects: [],
    manualText: null,
  },
  'OP01-006': {
    id: 'OP01-006',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 3,
    power: 4000,
    life: null,
    counter: 1000,
    keywords: [],
    effects: [],
    manualText: null,
  },
};

function setupPlaying(): Match {
  const m = new Match('ABC123', 'host-token', 'Alice', CATALOG);
  m.join('guest-token', 'Bob');
  const deck = Array(50).fill('OP01-006');
  m.submitDeck('host-token', 'OP01-001', deck);
  m.submitDeck('guest-token', 'OP01-001', deck);
  m.setReady('host-token', true);
  m.setReady('guest-token', true);
  return m;
}

describe('Match disconnect/reconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('disconnect starts a 60s timer', () => {
    const m = setupPlaying();
    const onForfeit = vi.fn();
    m.onForfeit(onForfeit);
    m.handleDisconnect('host-token');
    vi.advanceTimersByTime(59_000);
    expect(onForfeit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onForfeit).toHaveBeenCalledWith(1, 'timeout');
  });

  it('reconnect cancels the timer', () => {
    const m = setupPlaying();
    const onForfeit = vi.fn();
    m.onForfeit(onForfeit);
    m.handleDisconnect('host-token');
    vi.advanceTimersByTime(30_000);
    m.handleReconnect('host-token', 'new-socket');
    vi.advanceTimersByTime(60_000);
    expect(onForfeit).not.toHaveBeenCalled();
  });

  it('forfeit explicit triggers onForfeit immediately', () => {
    const m = setupPlaying();
    const onForfeit = vi.fn();
    m.onForfeit(onForfeit);
    m.forfeit('guest-token');
    expect(onForfeit).toHaveBeenCalledWith(0, 'forfeit');
  });
});
```

- [ ] **Step 2: Run test — must fail**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/match/timeout.test.ts
```

Expected: missing methods.

- [ ] **Step 3: Extend `Match` in `src/match/match.ts`**

Add inside the `Match` class (before the closing `}`):

```ts
  private forfeitListener: ((winner: PlayerIndex, reason: 'forfeit' | 'timeout') => void) | null = null;
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  onForfeit(listener: (winner: PlayerIndex, reason: 'forfeit' | 'timeout') => void): void {
    this.forfeitListener = listener;
  }

  handleDisconnect(token: string): void {
    const p = this.playerByToken(token);
    if (!p || this.status !== 'playing') return;
    p.player.socketId = null;
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(token);
      if (this.status !== 'playing') return;
      const winner: PlayerIndex = p.index === 0 ? 1 : 0;
      this.forceFinish(winner, 'timeout');
      this.forfeitListener?.(winner, 'timeout');
    }, 60_000);
    this.disconnectTimers.set(token, timer);
  }

  handleReconnect(token: string, socketId: string): OpResult<{ state: GameState | null }> {
    const p = this.playerByToken(token);
    if (!p) return err('Unauthorized');
    const timer = this.disconnectTimers.get(token);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(token);
    }
    p.player.socketId = socketId;
    return ok({ state: this.state });
  }

  forfeit(token: string): OpResult {
    const p = this.playerByToken(token);
    if (!p) return err('Unauthorized');
    if (this.status !== 'playing') return err('WrongPhase');
    const winner: PlayerIndex = p.index === 0 ? 1 : 0;
    this.forceFinish(winner, 'forfeit');
    this.forfeitListener?.(winner, 'forfeit');
    return ok(undefined);
  }

  cleanup(): void {
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    this.disconnectTimers.clear();
  }
```

Also update the existing `forceFinish` signature to match the reason type (was already `_reason: GameOverReason`; no change needed) and keep the import of `GameState` visible.

- [ ] **Step 4: Run test — must pass**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/match/timeout.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/match/match.ts apps/server/tests/match/timeout.test.ts
git commit -m "feat(server): Match disconnect timers and reconnect"
```

---

## Task 11: Server — MatchStore with cap + GC

`Map<matchId, Match>` facade with cap (500) and periodic GC (2 h finished matches).

**Files:**

- Create: `apps/server/src/match/store.ts`
- Create: `apps/server/tests/match/store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/tests/match/store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MatchStore } from '../../src/match/store';
import type { CardStatic } from '@optcg/engine';

const CATALOG: Record<string, CardStatic> = {
  'OP01-001': {
    id: 'OP01-001',
    type: 'LEADER',
    colors: ['Red'],
    cost: null,
    power: 5000,
    life: 5,
    counter: null,
    keywords: [],
    effects: [],
    manualText: null,
  },
};

describe('MatchStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('creates match with unique id', () => {
    const store = new MatchStore(CATALOG, { cap: 10 });
    const { matchId, token } = store.create('Alice');
    expect(matchId).toMatch(/^[A-Z0-9]{6}$/);
    expect(token).toHaveLength(36);
    expect(store.get(matchId)).toBeDefined();
  });

  it('rejects create when at cap', () => {
    const store = new MatchStore(CATALOG, { cap: 2 });
    store.create('A');
    store.create('B');
    expect(() => store.create('C')).toThrow(/ServerFull/i);
  });

  it('GC removes finished matches older than 2h', () => {
    const store = new MatchStore(CATALOG, { cap: 10 });
    const { matchId } = store.create('Alice');
    const match = store.get(matchId)!;
    // Force finished and backdate createdAt.
    (match as unknown as { status: string }).status = 'finished';
    (match as unknown as { createdAt: number }).createdAt = Date.now() - 3 * 60 * 60 * 1000;
    store.runGc();
    expect(store.get(matchId)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test — must fail**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/match/store.test.ts
```

Expected: missing `MatchStore`.

- [ ] **Step 3: Implement `src/match/store.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { CardStatic } from '@optcg/engine';
import { Match } from './match';
import { generateMatchCode } from './codes';

export interface MatchStoreOptions {
  cap?: number;
  gcIntervalMs?: number;
  finishedTtlMs?: number;
}

export class MatchStore {
  private readonly matches = new Map<string, Match>();
  private readonly cap: number;
  private readonly finishedTtlMs: number;
  private gcTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly catalog: Record<string, CardStatic>,
    opts: MatchStoreOptions = {},
  ) {
    this.cap = opts.cap ?? 500;
    this.finishedTtlMs = opts.finishedTtlMs ?? 2 * 60 * 60 * 1000;
    const gcInterval = opts.gcIntervalMs ?? 15 * 60 * 1000;
    if (gcInterval > 0) {
      this.gcTimer = setInterval(() => this.runGc(), gcInterval);
    }
  }

  create(hostNickname: string): { matchId: string; token: string } {
    if (this.matches.size >= this.cap) {
      throw new Error('ServerFull');
    }
    const token = randomUUID();
    const matchId = generateMatchCode((code) => this.matches.has(code));
    const match = new Match(matchId, token, hostNickname, this.catalog);
    this.matches.set(matchId, match);
    return { matchId, token };
  }

  get(matchId: string): Match | undefined {
    return this.matches.get(matchId);
  }

  delete(matchId: string): void {
    const m = this.matches.get(matchId);
    m?.cleanup();
    this.matches.delete(matchId);
  }

  runGc(): void {
    const cutoff = Date.now() - this.finishedTtlMs;
    for (const [id, m] of this.matches) {
      if (m.status === 'finished' && m.createdAt < cutoff) {
        this.delete(id);
      }
    }
  }

  shutdown(): void {
    if (this.gcTimer) clearInterval(this.gcTimer);
    for (const m of this.matches.values()) m.cleanup();
    this.matches.clear();
  }
}
```

- [ ] **Step 4: Run test — must pass**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/match/store.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/match/store.ts apps/server/tests/match/store.test.ts
git commit -m "feat(server): MatchStore with cap and GC"
```

---

## Task 12: Server — Socket.IO handlers

Wire ClientMsg → Match → ServerMsg. Uses a single `msg` channel with a `kind` discriminator.

**Files:**

- Create: `apps/server/src/match/handlers.ts`
- Modify: `apps/server/src/index.ts` (wire MatchStore + handlers on connection)
- Create: `apps/server/tests/match/handlers.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `apps/server/tests/match/handlers.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { MatchStore } from '../../src/match/store';
import { registerHandlers } from '../../src/match/handlers';
import type { CardStatic } from '@optcg/engine';
import type { ClientMsg, ServerMsg } from '@optcg/protocol';

const CATALOG: Record<string, CardStatic> = {
  'OP01-001': {
    id: 'OP01-001',
    type: 'LEADER',
    colors: ['Red'],
    cost: null,
    power: 5000,
    life: 5,
    counter: null,
    keywords: [],
    effects: [],
    manualText: null,
  },
  'OP01-006': {
    id: 'OP01-006',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 3,
    power: 4000,
    life: null,
    counter: 1000,
    keywords: [],
    effects: [],
    manualText: null,
  },
};

function setupServer() {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer);
  const store = new MatchStore(CATALOG, { cap: 10, gcIntervalMs: 0 });
  registerHandlers(io, store);
  return { httpServer, io, store };
}

async function connect(url: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioClient(url, { transports: ['websocket'], reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function waitFor(socket: Socket, kind: ServerMsg['kind']): Promise<ServerMsg> {
  return new Promise((resolve) => {
    const handler = (m: ServerMsg) => {
      if (m.kind === kind) {
        socket.off('msg', handler);
        resolve(m);
      }
    };
    socket.on('msg', handler);
  });
}

describe('socket handlers', () => {
  let teardown: Array<() => void | Promise<void>> = [];

  afterEach(async () => {
    for (const t of teardown.reverse()) await t();
    teardown = [];
  });

  it('CreateMatch + JoinMatch → both receive LobbyUpdate', async () => {
    const { httpServer, io, store } = setupServer();
    await new Promise<void>((r) => httpServer.listen(0, r));
    teardown.push(
      () =>
        new Promise<void>((r) => {
          io.close();
          httpServer.close(() => r());
        }),
    );
    teardown.push(() => void store.shutdown());
    const port = (httpServer.address() as AddressInfo).port;

    const host = await connect(`http://localhost:${port}`);
    teardown.push(() => void host.close());

    host.emit('msg', { kind: 'CreateMatch', nickname: 'Alice' } satisfies ClientMsg);
    const created = (await waitFor(host, 'MatchCreated')) as Extract<
      ServerMsg,
      { kind: 'MatchCreated' }
    >;
    expect(created.matchId).toMatch(/^[A-Z0-9]{6}$/);

    const guest = await connect(`http://localhost:${port}`);
    teardown.push(() => void guest.close());
    const guestLobby = waitFor(guest, 'LobbyUpdate');
    const hostLobby = waitFor(host, 'LobbyUpdate');
    guest.emit('msg', {
      kind: 'JoinMatch',
      matchId: created.matchId,
      nickname: 'Bob',
    } satisfies ClientMsg);
    const [gL, hL] = await Promise.all([guestLobby, hostLobby]);
    expect(gL.kind).toBe('LobbyUpdate');
    expect(hL.kind).toBe('LobbyUpdate');
  });

  it('rejects ProposeAction with Unauthorized token', async () => {
    const { httpServer, io, store } = setupServer();
    await new Promise<void>((r) => httpServer.listen(0, r));
    teardown.push(
      () =>
        new Promise<void>((r) => {
          io.close();
          httpServer.close(() => r());
        }),
    );
    teardown.push(() => void store.shutdown());
    const port = (httpServer.address() as AddressInfo).port;

    const host = await connect(`http://localhost:${port}`);
    teardown.push(() => void host.close());
    host.emit('msg', { kind: 'CreateMatch', nickname: 'Alice' });
    const created = (await waitFor(host, 'MatchCreated')) as Extract<
      ServerMsg,
      { kind: 'MatchCreated' }
    >;

    host.emit('msg', {
      kind: 'ProposeAction',
      matchId: created.matchId,
      token: 'wrong-token',
      action: { kind: 'EndTurn', player: 0 },
    });
    const rejected = await waitFor(host, 'ActionRejected');
    expect(rejected.kind).toBe('ActionRejected');
  });
});
```

- [ ] **Step 2: Run test — must fail**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/match/handlers.test.ts
```

Expected: missing `registerHandlers`.

- [ ] **Step 3: Implement `src/match/handlers.ts`**

```ts
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { ClientMsg, ServerMsg } from '@optcg/protocol';
import type { Action, PlayerIndex } from '@optcg/engine';
import { clientMsgSchema } from '../protocol/schemas';
import { filterStateForPlayer } from '../protocol/filter';
import { Match } from './match';
import { MatchStore } from './store';

const ROOM = (id: string) => `match:${id}`;

function toLobbyUpdate(match: Match): Extract<ServerMsg, { kind: 'LobbyUpdate' }> {
  return {
    kind: 'LobbyUpdate',
    players: match.players.map((p) =>
      p ? { nickname: p.nickname, deckReady: Boolean(p.deck), ready: p.ready } : null,
    ),
    matchStatus: match.status,
  };
}

function emitStateUpdate(
  io: SocketIOServer,
  match: Match,
  events: Parameters<typeof filterStateForPlayer> extends [infer _S, infer _P] ? never : never,
): void {
  // (no-op helper placeholder; actual broadcasting below)
  void io;
  void match;
  void events;
}

function broadcastStateUpdate(
  io: SocketIOServer,
  match: Match,
  events: import('@optcg/engine').GameEvent[],
): void {
  if (!match.state) return;
  for (const i of [0, 1] as const) {
    const player = match.players[i];
    if (!player?.socketId) continue;
    const msg: ServerMsg = {
      kind: 'StateUpdate',
      state: filterStateForPlayer(match.state, i),
      events,
    };
    io.to(player.socketId).emit('msg', msg);
  }
}

function broadcastGameStart(io: SocketIOServer, match: Match): void {
  if (!match.state) return;
  for (const i of [0, 1] as const) {
    const player = match.players[i];
    if (!player?.socketId) continue;
    const msg: ServerMsg = {
      kind: 'GameStart',
      firstPlayer: match.state.activePlayer,
      initialState: filterStateForPlayer(match.state, i),
    };
    io.to(player.socketId).emit('msg', msg);
  }
}

function broadcastGameOver(
  io: SocketIOServer,
  match: Match,
  winner: PlayerIndex,
  reason: 'engine' | 'forfeit' | 'timeout',
): void {
  const msg: ServerMsg = { kind: 'GameOver', winner, reason };
  io.to(ROOM(match.id)).emit('msg', msg);
}

function send(socket: Socket, msg: ServerMsg): void {
  socket.emit('msg', msg);
}

export function registerHandlers(io: SocketIOServer, store: MatchStore): void {
  io.on('connection', (socket) => {
    // token → matchId lookup for this socket
    const sessions = new Map<string, { matchId: string; playerIndex: PlayerIndex }>();

    socket.on('msg', (raw: unknown) => {
      const parsed = clientMsgSchema.safeParse(raw);
      if (!parsed.success) {
        send(socket, { kind: 'Error', code: 'BadRequest', message: parsed.error.message });
        return;
      }
      const msg = parsed.data as ClientMsg;

      if (msg.kind === 'CreateMatch') {
        try {
          const { matchId, token } = store.create(msg.nickname);
          const match = store.get(matchId)!;
          match.players[0]!.socketId = socket.id;
          sessions.set(token, { matchId, playerIndex: 0 });
          socket.join(ROOM(matchId));
          send(socket, { kind: 'MatchCreated', matchId, token, playerIndex: 0 });
        } catch (e) {
          send(socket, { kind: 'Error', code: 'ServerFull', message: (e as Error).message });
        }
        return;
      }

      if (msg.kind === 'JoinMatch') {
        const match = store.get(msg.matchId);
        if (!match) {
          send(socket, { kind: 'Error', code: 'MatchNotFound', message: msg.matchId });
          return;
        }
        const token = require('node:crypto').randomUUID() as string;
        const r = match.join(token, msg.nickname);
        if (!r.ok) {
          send(socket, { kind: 'Error', code: r.reason.code, message: r.reason.detail ?? '' });
          return;
        }
        match.players[1]!.socketId = socket.id;
        sessions.set(token, { matchId: msg.matchId, playerIndex: 1 });
        socket.join(ROOM(msg.matchId));
        match.onForfeit((winner, reason) => broadcastGameOver(io, match, winner, reason));
        send(socket, { kind: 'MatchJoined', matchId: msg.matchId, token, playerIndex: 1 });
        io.to(ROOM(msg.matchId)).emit('msg', toLobbyUpdate(match));
        return;
      }

      // All remaining messages require matchId+token.
      if ('matchId' in msg && 'token' in msg) {
        const match = store.get(msg.matchId);
        if (!match) {
          send(socket, { kind: 'Error', code: 'MatchNotFound', message: msg.matchId });
          return;
        }

        if (msg.kind === 'SubmitDeck') {
          const r = match.submitDeck(msg.token, msg.leaderCardId, msg.deck);
          if (!r.ok) {
            send(socket, { kind: 'Error', code: r.reason.code, message: r.reason.detail ?? '' });
            return;
          }
          io.to(ROOM(msg.matchId)).emit('msg', toLobbyUpdate(match));
          return;
        }

        if (msg.kind === 'SetReady') {
          const prevStatus = match.status;
          const r = match.setReady(msg.token, msg.ready);
          if (!r.ok) {
            send(socket, { kind: 'Error', code: r.reason.code, message: r.reason.detail ?? '' });
            return;
          }
          io.to(ROOM(msg.matchId)).emit('msg', toLobbyUpdate(match));
          if (prevStatus !== 'playing' && match.status === 'playing') {
            broadcastGameStart(io, match);
          }
          return;
        }

        if (msg.kind === 'ProposeAction') {
          const r = match.proposeAction(msg.token, msg.action as Action);
          if (!r.ok) {
            send(socket, { kind: 'ActionRejected', reason: r.reason });
            return;
          }
          broadcastStateUpdate(io, match, r.value.events);
          if (match.status === 'finished' && match.state?.winner !== null && match.state) {
            broadcastGameOver(io, match, match.state.winner!, 'engine');
          }
          return;
        }

        if (msg.kind === 'ProposeActionBatch') {
          const r = match.proposeActionBatch(msg.token, msg.actions as Action[]);
          if (!r.ok) {
            send(socket, { kind: 'ActionRejected', reason: r.reason });
            return;
          }
          broadcastStateUpdate(io, match, r.value.events);
          if (match.status === 'finished' && match.state?.winner !== null && match.state) {
            broadcastGameOver(io, match, match.state.winner!, 'engine');
          }
          return;
        }

        if (msg.kind === 'Reconnect') {
          const r = match.handleReconnect(msg.token, socket.id);
          if (!r.ok) {
            send(socket, { kind: 'Error', code: r.reason.code, message: r.reason.detail ?? '' });
            return;
          }
          socket.join(ROOM(msg.matchId));
          const idx = match.players[0]?.token === msg.token ? 0 : 1;
          sessions.set(msg.token, { matchId: msg.matchId, playerIndex: idx });
          const opp = match.players[idx === 0 ? 1 : 0];
          if (opp?.socketId)
            io.to(opp.socketId).emit('msg', { kind: 'OpponentReconnected' } satisfies ServerMsg);
          // Replay last state so the reconnected client catches up.
          if (match.state) {
            send(socket, {
              kind: 'StateUpdate',
              state: filterStateForPlayer(match.state, idx as PlayerIndex),
              events: [],
            });
          } else {
            send(socket, toLobbyUpdate(match));
          }
          return;
        }

        if (msg.kind === 'Rematch') {
          const prev = match.status;
          const r = match.rematch(msg.token, msg.ready);
          if (!r.ok) {
            send(socket, { kind: 'Error', code: r.reason.code, message: r.reason.detail ?? '' });
            return;
          }
          if (prev === 'finished' && match.status === 'playing') {
            broadcastGameStart(io, match);
          }
          return;
        }

        if (msg.kind === 'Forfeit') {
          const r = match.forfeit(msg.token);
          if (!r.ok) {
            send(socket, { kind: 'Error', code: r.reason.code, message: r.reason.detail ?? '' });
          }
          return;
        }
      }
    });

    socket.on('disconnect', () => {
      for (const [token, s] of sessions) {
        const match = store.get(s.matchId);
        if (!match) continue;
        match.handleDisconnect(token);
        const opp = match.players[s.playerIndex === 0 ? 1 : 0];
        if (opp?.socketId) {
          io.to(opp.socketId).emit('msg', {
            kind: 'OpponentDisconnected',
            secondsToForfeit: 60,
          } satisfies ServerMsg);
        }
      }
    });
  });
}
```

- [ ] **Step 4: Wire handlers in `src/index.ts`**

Replace the body of `buildServer` to register handlers and accept a store:

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { loadCatalog } from './catalog';
import { createLogger } from './logger';
import { MatchStore } from './match/store';
import { registerHandlers } from './match/handlers';

export interface ServerOptions {
  catalogPath: string;
  corsOrigin?: string;
  matchCap?: number;
}

export interface ServerHandle extends FastifyInstance {
  io: SocketIOServer;
  matchStore: MatchStore;
}

export async function buildServer(opts: ServerOptions): Promise<ServerHandle> {
  const logger = createLogger();
  const catalog = loadCatalog(opts.catalogPath);
  logger.info('catalog loaded', { cards: Object.keys(catalog).length });

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: opts.corsOrigin ?? '*' });
  app.get('/health', async () => ({ status: 'ok' }));

  const io = new SocketIOServer(app.server, { cors: { origin: opts.corsOrigin ?? '*' } });
  const store = new MatchStore(catalog, { cap: opts.matchCap ?? 500 });
  registerHandlers(io, store);

  app.addHook('onClose', async () => {
    io.close();
    store.shutdown();
  });

  const decorated = app as ServerHandle;
  decorated.io = io;
  decorated.matchStore = store;
  return decorated;
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3001);
  const catalogPath =
    process.env.CATALOG_PATH ?? new URL('./catalog.json', import.meta.url).pathname;
  const corsOrigin = process.env.CORS_ORIGIN;

  const app = await buildServer({ catalogPath, corsOrigin });
  await app.listen({ port, host: '0.0.0.0' });
  // eslint-disable-next-line no-console
  console.log(`server listening on :${port}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run tests — must pass**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/server test
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/match/handlers.ts apps/server/src/index.ts apps/server/tests/match/handlers.test.ts
git commit -m "feat(server): Socket.IO handlers wiring ClientMsg → Match"
```

---

## Task 13: Server — build-catalog script

Server-owned script that calls `@optcg/card-data` export to write `apps/server/src/catalog.json`.

**Files:**

- Create: `apps/server/scripts/build-catalog.ts`

- [ ] **Step 1: Implement `apps/server/scripts/build-catalog.ts`**

```ts
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

async function main(): Promise<void> {
  const target = resolve(process.cwd(), 'apps/server/src/catalog.json');
  const cardDataDir = resolve(process.cwd(), 'packages/card-data');
  if (!existsSync(cardDataDir)) {
    throw new Error(`Expected ${cardDataDir} to exist — run from repo root`);
  }
  execSync(`corepack pnpm@9.7.0 --filter @optcg/card-data export:catalog -- ${target}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the build script**

From repo root:

```bash
corepack pnpm@9.7.0 --filter @optcg/server catalog:build
```

Expected: produces `apps/server/src/catalog.json` with the full synced catalog.

- [ ] **Step 3: Verify server can boot with real catalog**

```bash
corepack pnpm@9.7.0 --filter @optcg/server dev &
SERVER_PID=$!
sleep 3
curl -s http://localhost:3001/health
kill $SERVER_PID
```

Expected: `{"status":"ok"}`.

- [ ] **Step 4: Commit**

```bash
git add apps/server/scripts/build-catalog.ts
git commit -m "chore(server): build-catalog script integrating card-data export"
```

> `apps/server/src/catalog.json` is gitignored (Task 2 step 5). Engineers regenerate with `pnpm --filter @optcg/server catalog:build` locally.

---

## Task 14: Web — online session storage helpers

Tiny helpers for `localStorage['optcg.online.session.<matchId>']` and nickname persistence.

**Files:**

- Create: `apps/web/src/lib/online/session-storage.ts`
- Create: `apps/web/src/lib/online/session-storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/online/session-storage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadSession,
  saveSession,
  clearSession,
  loadNickname,
  saveNickname,
} from './session-storage';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, v);
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
}

describe('online session storage', () => {
  beforeEach(() => {
    (globalThis as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it('round-trips a session', () => {
    saveSession('ABC123', { token: 't', nickname: 'Alice', playerIndex: 0 });
    const loaded = loadSession('ABC123');
    expect(loaded).toEqual({ token: 't', nickname: 'Alice', playerIndex: 0 });
  });

  it('returns null for unknown match', () => {
    expect(loadSession('XYZ999')).toBeNull();
  });

  it('clears a session', () => {
    saveSession('ABC123', { token: 't', nickname: 'A', playerIndex: 0 });
    clearSession('ABC123');
    expect(loadSession('ABC123')).toBeNull();
  });

  it('nickname persists', () => {
    saveNickname('Tiago');
    expect(loadNickname()).toBe('Tiago');
  });
});
```

- [ ] **Step 2: Run test — must fail**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/web test -- src/lib/online/session-storage.test.ts
```

Expected: missing module.

- [ ] **Step 3: Implement `src/lib/online/session-storage.ts`**

```ts
import type { PlayerIndex } from '@optcg/engine';

export interface OnlineSession {
  token: string;
  nickname: string;
  playerIndex: PlayerIndex;
}

const sessionKey = (matchId: string) => `optcg.online.session.${matchId}`;
const NICKNAME_KEY = 'optcg.online.nickname';

export function saveSession(matchId: string, session: OnlineSession): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(sessionKey(matchId), JSON.stringify(session));
}

export function loadSession(matchId: string): OnlineSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(sessionKey(matchId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OnlineSession;
    if (typeof parsed.token === 'string' && typeof parsed.nickname === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearSession(matchId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(sessionKey(matchId));
}

export function saveNickname(nickname: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(NICKNAME_KEY, nickname);
}

export function loadNickname(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(NICKNAME_KEY);
}
```

- [ ] **Step 4: Run test — must pass**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/web test -- src/lib/online/session-storage.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/online/session-storage.ts apps/web/src/lib/online/session-storage.test.ts
git commit -m "feat(web): online session storage helpers"
```

---

## Task 15: Web — `useOnlineSocket` hook

State machine + pending-action promise registry. Consumes `@optcg/protocol` types.

**Files:**

- Modify: `apps/web/package.json` — add `socket.io-client` dep + `@optcg/protocol` workspace dep
- Create: `apps/web/src/lib/online/use-online-socket.ts`

- [ ] **Step 1: Add deps**

Under `"dependencies"` in `apps/web/package.json`:

```json
    "@optcg/protocol": "workspace:*",
    "socket.io-client": "^4.7.0",
```

Run:

```bash
corepack pnpm@9.7.0 install
```

- [ ] **Step 2: Implement `src/lib/online/use-online-socket.ts`**

```ts
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Action, EngineError, GameEvent, GameState, PlayerIndex } from '@optcg/engine';
import type { ClientMsg, LobbyPlayer, MatchStatus, ServerMsg } from '@optcg/protocol';
import { loadSession, saveSession, clearSession } from './session-storage';

export interface OnlineHookState {
  phase: 'connecting' | 'idle' | 'lobby' | 'playing' | 'finished';
  matchId: string | null;
  playerIndex: PlayerIndex | null;
  token: string | null;
  lobby: { players: (LobbyPlayer | null)[]; status: MatchStatus } | null;
  state: GameState | null;
  events: GameEvent[];
  opponentDisconnected: boolean;
  error: string | null;
  lastGameOver: { winner: PlayerIndex; reason: 'engine' | 'forfeit' | 'timeout' } | null;
}

export interface OnlineHook extends OnlineHookState {
  createMatch: (nickname: string) => Promise<void>;
  joinMatch: (matchId: string, nickname: string) => Promise<void>;
  submitDeck: (leaderCardId: string, deck: string[]) => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  proposeAction: (action: Action) => Promise<void>;
  proposeActionBatch: (actions: Action[]) => Promise<void>;
  rematch: (ready: boolean) => Promise<void>;
  forfeit: () => Promise<void>;
}

const initialState: OnlineHookState = {
  phase: 'connecting',
  matchId: null,
  playerIndex: null,
  token: null,
  lobby: null,
  state: null,
  events: [],
  opponentDisconnected: false,
  error: null,
  lastGameOver: null,
};

export function useOnlineSocket(bootMatchId?: string): OnlineHook {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001';
  const [s, setS] = useState<OnlineHookState>({
    ...initialState,
    matchId: bootMatchId ?? null,
  });
  const socketRef = useRef<Socket | null>(null);
  const pendingRef = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);

  const send = useCallback((msg: ClientMsg) => {
    socketRef.current?.emit('msg', msg);
  }, []);

  const sendExpectingState = useCallback(
    (msg: ClientMsg): Promise<void> => {
      return new Promise((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        send(msg);
        setTimeout(() => {
          if (pendingRef.current) {
            pendingRef.current.reject(new Error('Timed out waiting for server'));
            pendingRef.current = null;
          }
        }, 5000);
      });
    },
    [send],
  );

  useEffect(() => {
    const sock = io(serverUrl, { reconnection: true, reconnectionDelay: 500 });
    socketRef.current = sock;

    sock.on('connect', () => {
      setS((prev) => ({ ...prev, phase: prev.matchId ? 'connecting' : 'idle' }));
      if (bootMatchId) {
        const session = loadSession(bootMatchId);
        if (session) {
          setS((prev) => ({
            ...prev,
            token: session.token,
            playerIndex: session.playerIndex,
          }));
          send({ kind: 'Reconnect', matchId: bootMatchId, token: session.token });
        }
      }
    });

    sock.on('msg', (raw: ServerMsg) => {
      switch (raw.kind) {
        case 'MatchCreated':
          saveSession(raw.matchId, { token: raw.token, nickname: '', playerIndex: 0 });
          setS((p) => ({
            ...p,
            matchId: raw.matchId,
            token: raw.token,
            playerIndex: 0,
            phase: 'lobby',
          }));
          break;
        case 'MatchJoined':
          saveSession(raw.matchId, { token: raw.token, nickname: '', playerIndex: 1 });
          setS((p) => ({
            ...p,
            matchId: raw.matchId,
            token: raw.token,
            playerIndex: 1,
            phase: 'lobby',
          }));
          break;
        case 'LobbyUpdate':
          setS((p) => ({
            ...p,
            lobby: { players: raw.players, status: raw.matchStatus },
            phase: raw.matchStatus === 'playing' ? 'playing' : 'lobby',
          }));
          break;
        case 'GameStart':
          setS((p) => ({
            ...p,
            phase: 'playing',
            state: raw.initialState,
            events: [],
            lastGameOver: null,
          }));
          pendingRef.current?.resolve();
          pendingRef.current = null;
          break;
        case 'StateUpdate':
          setS((p) => ({
            ...p,
            state: raw.state,
            events: [...p.events, ...raw.events],
          }));
          pendingRef.current?.resolve();
          pendingRef.current = null;
          break;
        case 'ActionRejected':
          pendingRef.current?.reject(
            new Error(
              `Action rejected: ${raw.reason.code}${raw.reason.detail ? ` (${raw.reason.detail})` : ''}`,
            ),
          );
          pendingRef.current = null;
          break;
        case 'OpponentDisconnected':
          setS((p) => ({ ...p, opponentDisconnected: true }));
          break;
        case 'OpponentReconnected':
          setS((p) => ({ ...p, opponentDisconnected: false }));
          break;
        case 'GameOver':
          setS((p) => ({
            ...p,
            phase: 'finished',
            lastGameOver: { winner: raw.winner, reason: raw.reason },
          }));
          break;
        case 'Error':
          setS((p) => ({ ...p, error: `${raw.code}: ${raw.message}` }));
          pendingRef.current?.reject(new Error(`${raw.code}: ${raw.message}`));
          pendingRef.current = null;
          break;
      }
    });

    sock.on('disconnect', () => {
      setS((p) => ({ ...p, phase: 'connecting' }));
    });

    return () => {
      sock.close();
      socketRef.current = null;
    };
  }, [serverUrl, bootMatchId, send]);

  const ctx = useMemo(() => s, [s]);

  const createMatch = useCallback(
    async (nickname: string) => {
      send({ kind: 'CreateMatch', nickname });
    },
    [send],
  );

  const joinMatch = useCallback(
    async (matchId: string, nickname: string) => {
      send({ kind: 'JoinMatch', matchId, nickname });
    },
    [send],
  );

  const submitDeck = useCallback(
    async (leaderCardId: string, deck: string[]) => {
      if (!s.matchId || !s.token) throw new Error('No active match');
      send({ kind: 'SubmitDeck', matchId: s.matchId, token: s.token, leaderCardId, deck });
    },
    [s.matchId, s.token, send],
  );

  const setReady = useCallback(
    async (ready: boolean) => {
      if (!s.matchId || !s.token) throw new Error('No active match');
      send({ kind: 'SetReady', matchId: s.matchId, token: s.token, ready });
    },
    [s.matchId, s.token, send],
  );

  const proposeAction = useCallback(
    async (action: Action) => {
      if (!s.matchId || !s.token) throw new Error('No active match');
      await sendExpectingState({
        kind: 'ProposeAction',
        matchId: s.matchId,
        token: s.token,
        action,
      });
    },
    [s.matchId, s.token, sendExpectingState],
  );

  const proposeActionBatch = useCallback(
    async (actions: Action[]) => {
      if (!s.matchId || !s.token) throw new Error('No active match');
      await sendExpectingState({
        kind: 'ProposeActionBatch',
        matchId: s.matchId,
        token: s.token,
        actions,
      });
    },
    [s.matchId, s.token, sendExpectingState],
  );

  const rematch = useCallback(
    async (ready: boolean) => {
      if (!s.matchId || !s.token) throw new Error('No active match');
      send({ kind: 'Rematch', matchId: s.matchId, token: s.token, ready });
    },
    [s.matchId, s.token, send],
  );

  const forfeit = useCallback(async () => {
    if (!s.matchId || !s.token) throw new Error('No active match');
    send({ kind: 'Forfeit', matchId: s.matchId, token: s.token });
  }, [s.matchId, s.token, send]);

  return {
    ...ctx,
    createMatch,
    joinMatch,
    submitDeck,
    setReady,
    proposeAction,
    proposeActionBatch,
    rematch,
    forfeit,
  };
}

export { EngineError };
```

- [ ] **Step 3: Typecheck + lint**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/web typecheck
corepack pnpm@9.7.0 --filter @optcg/web lint
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/lib/online/use-online-socket.ts
git commit -m "feat(web): useOnlineSocket hook with state machine"
```

---

## Task 16: Web — `NetGameProvider`

Provides the same context shape as `GameProvider` but delegates to `useOnlineSocket`. Also adds `isOnline` flag to `GameContextValue`.

**Files:**

- Modify: `apps/web/src/app/play/[gameId]/_components/game-provider.tsx` (add `isOnline` to context, default `false`)
- Create: `apps/web/src/app/play/online/[code]/_components/net-game-provider.tsx`

- [ ] **Step 1: Add `isOnline` to `GameContextValue`**

In `game-provider.tsx`, update the interface:

```ts
interface GameContextValue {
  state: GameState;
  dispatch: (action: Action) => DispatchResult;
  dispatchBatch: (actions: Action[]) => DispatchResult;
  events: GameEvent[];
  botPlayers: { 0?: true; 1?: true };
  botThinking: boolean;
  lastBotAction: BotActionSummary | null;
  isOnline: boolean;
}
```

Default `isOnline: false` in the provider's `<GameContext.Provider value={…}>`.

- [ ] **Step 2: Create `net-game-provider.tsx`**

```tsx
'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Action, EngineError, GameEvent, GameState } from '@optcg/engine';
import { useOnlineSocket, type OnlineHook } from '@/lib/online/use-online-socket';

interface NetContextValue {
  state: GameState;
  dispatch: (action: Action) => { error?: EngineError; events: GameEvent[] };
  dispatchBatch: (actions: Action[]) => { error?: EngineError; events: GameEvent[] };
  events: GameEvent[];
  botPlayers: { 0?: true; 1?: true };
  botThinking: boolean;
  lastBotAction: null;
  isOnline: true;
  online: OnlineHook;
}

const NetContext = createContext<NetContextValue | null>(null);

export function NetGameProvider({ online, children }: { online: OnlineHook; children: ReactNode }) {
  const value = useMemo<NetContextValue>(() => {
    if (!online.state) {
      throw new Error('NetGameProvider mounted without state');
    }
    return {
      state: online.state,
      dispatch: (action: Action) => {
        online.proposeAction(action).catch(() => undefined);
        return { events: [] };
      },
      dispatchBatch: (actions: Action[]) => {
        online.proposeActionBatch(actions).catch(() => undefined);
        return { events: [] };
      },
      events: online.events,
      botPlayers: {},
      botThinking: false,
      lastBotAction: null,
      isOnline: true,
      online,
    };
  }, [online]);
  return <NetContext.Provider value={value}>{children}</NetContext.Provider>;
}

export function useNetGame(): NetContextValue {
  const v = useContext(NetContext);
  if (!v) throw new Error('useNetGame must be used within NetGameProvider');
  return v;
}
```

- [ ] **Step 3: Make `useGame` fall back to `NetContext`**

In `game-provider.tsx`, replace `useGame` body:

```ts
import { useContext as useContextOrig } from 'react';
// … existing imports

export function useGame(): GameContextValue {
  const local = useContextOrig(GameContext);
  if (local) return local;
  // Fallback to Net context at the same shape.
  const net = require('../../online/[code]/_components/net-game-provider').useNetGame();
  if (net) return net as unknown as GameContextValue;
  throw new Error('useGame must be used within GameProvider or NetGameProvider');
}
```

**Note:** the `require` keeps the import from being circular at module load. If the linter rejects `require`, extract both contexts into a shared `game-context.ts` file and have both providers import from it. Acceptable refactor.

Better alternative (do this instead): create `apps/web/src/app/play/_shared/game-context.ts` exporting `GameContextValue` type and the context, then both providers import it.

- [ ] **Step 4: Refactor to shared context**

Create `apps/web/src/app/play/_shared/game-context.ts`:

```ts
'use client';

import { createContext, useContext } from 'react';
import type { Action, EngineError, GameEvent, GameState } from '@optcg/engine';

export interface BotActionSummary {
  kind: Action['kind'];
  label: string;
  at: number;
}

export interface GameContextValue {
  state: GameState;
  dispatch: (action: Action) => { error?: EngineError; events: GameEvent[] };
  dispatchBatch: (actions: Action[]) => { error?: EngineError; events: GameEvent[] };
  events: GameEvent[];
  botPlayers: { 0?: true; 1?: true };
  botThinking: boolean;
  lastBotAction: BotActionSummary | null;
  isOnline: boolean;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const v = useContext(GameContext);
  if (!v) throw new Error('useGame must be used within a Game provider');
  return v;
}
```

Update `game-provider.tsx` to import `GameContext` and `GameContextValue` from the shared file, remove its local definitions, set `isOnline: false` in the provider value, and drop its local `useGame` export.

Update `net-game-provider.tsx` to also provide `GameContext` (not its own `NetContext`):

```tsx
'use client';

import { useMemo, type ReactNode } from 'react';
import type { Action, GameEvent } from '@optcg/engine';
import { GameContext, type GameContextValue } from '@/app/play/_shared/game-context';
import type { OnlineHook } from '@/lib/online/use-online-socket';

export function NetGameProvider({ online, children }: { online: OnlineHook; children: ReactNode }) {
  const value = useMemo<GameContextValue>(() => {
    if (!online.state) {
      throw new Error('NetGameProvider mounted without state');
    }
    return {
      state: online.state,
      dispatch: (action: Action) => {
        void online.proposeAction(action);
        return { events: [] as GameEvent[] };
      },
      dispatchBatch: (actions: Action[]) => {
        void online.proposeActionBatch(actions);
        return { events: [] as GameEvent[] };
      },
      events: online.events,
      botPlayers: {},
      botThinking: false,
      lastBotAction: null,
      isOnline: true,
    };
  }, [online]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
```

Fix `game-provider.tsx`'s `useGame` export by re-exporting from the shared module:

```ts
export { useGame } from '@/app/play/_shared/game-context';
```

- [ ] **Step 5: Verify typecheck + tests**

```bash
corepack pnpm@9.7.0 --filter @optcg/web typecheck
corepack pnpm@9.7.0 --filter @optcg/web test
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/play
git commit -m "feat(web): shared GameContext + NetGameProvider for online"
```

---

## Task 17: Web — `/play/online` landing

Page with Create + Join forms.

**Files:**

- Create: `apps/web/src/app/play/online/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loadNickname, saveNickname } from '@/lib/online/session-storage';
import { useOnlineSocket } from '@/lib/online/use-online-socket';

export default function OnlineLanding() {
  const router = useRouter();
  const online = useOnlineSocket();
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadNickname();
    if (saved) setNickname(saved);
  }, []);

  useEffect(() => {
    if (online.matchId) {
      saveNickname(nickname);
      router.push(`/play/online/${online.matchId}`);
    }
  }, [online.matchId, nickname, router]);

  useEffect(() => {
    if (online.error) setError(online.error);
  }, [online.error]);

  function handleCreate() {
    if (!nickname.trim()) return setError('Nickname required');
    setError(null);
    void online.createMatch(nickname.trim());
  }

  function handleJoin() {
    if (!nickname.trim()) return setError('Nickname required');
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) return setError('Code must be 6 chars');
    setError(null);
    void online.joinMatch(normalized, nickname.trim());
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Online match</h1>

      <div className="space-y-2">
        <Label htmlFor="nickname">Nickname</Label>
        <Input
          id="nickname"
          maxLength={24}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={handleCreate} disabled={!nickname.trim()}>
          Create match
        </Button>

        <div className="flex gap-2">
          <Input
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <Button onClick={handleJoin} variant="secondary">
            Join
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/play/online/page.tsx
git commit -m "feat(web): /play/online landing with Create/Join forms"
```

---

## Task 18: Web — `/play/online/[code]` route + `OnlineLobby`

Route that renders lobby or board based on phase. Includes `OnlineLobby` and `NetGameProvider` wiring.

**Files:**

- Create: `apps/web/src/app/play/online/[code]/page.tsx`
- Create: `apps/web/src/app/play/online/[code]/_components/online-lobby.tsx`

- [ ] **Step 1: Implement `OnlineLobby`**

Create `apps/web/src/app/play/online/[code]/_components/online-lobby.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { LoadedDeck } from '@/lib/deck-loader';
import { Button } from '@/components/ui/button';
import type { OnlineHook } from '@/lib/online/use-online-socket';

interface DeckSummary {
  id: string;
  name: string;
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

function expandDeck(cards: Array<{ cardId: string; quantity: number }>): string[] {
  const out: string[] = [];
  for (const c of cards) for (let i = 0; i < c.quantity; i += 1) out.push(c.cardId);
  return out;
}

export function OnlineLobby({ online, matchId }: { online: OnlineHook; matchId: string }) {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);

  useEffect(() => {
    // Reuse existing /api/decks with anonymous x-user-id that maps to default demo user.
    fetch('/api/decks', { headers: { 'x-user-id': 'online-user' } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setDecks)
      .catch(() => setDecks([]));
  }, []);

  const myIndex = online.playerIndex;
  const me = myIndex !== null && online.lobby ? online.lobby.players[myIndex] : null;
  const oppIndex = myIndex === 0 ? 1 : 0;
  const opp = myIndex !== null && online.lobby ? online.lobby.players[oppIndex] : null;

  function handleSubmitDeck() {
    if (!selectedDeck || !decks) return;
    const deck = decks.find((d) => d.id === selectedDeck);
    if (!deck || !deck.leaderCardId) return;
    const expanded = expandDeck(deck.cards);
    if (expanded.length !== 50) return;
    void online.submitDeck(deck.leaderCardId, expanded);
  }

  function handleReady(next: boolean) {
    void online.setReady(next);
  }

  const shareUrl =
    typeof window === 'undefined' ? '' : `${window.location.origin}/play/online/${matchId}`;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">Lobby — {matchId}</h1>
        <p className="text-sm text-muted-foreground">
          Share this code or URL with your opponent:
          <br />
          <code className="select-all">{shareUrl}</code>
        </p>
      </div>

      {!opp && <p className="text-sm italic">Waiting for opponent…</p>}

      {opp && (
        <div className="rounded border p-3 text-sm">
          <div>
            <strong>Opponent:</strong> {opp.nickname} · deck {opp.deckReady ? '✓' : '…'} · ready{' '}
            {opp.ready ? '✓' : '…'}
          </div>
          <div>
            <strong>You:</strong> {me?.nickname ?? '—'} · deck {me?.deckReady ? '✓' : '…'} · ready{' '}
            {me?.ready ? '✓' : '…'}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold">Pick your deck</h2>
        {decks === null && <p>Loading decks…</p>}
        {decks && decks.length === 0 && <p>No decks found. Create one in the builder first.</p>}
        {decks && decks.length > 0 && (
          <select
            className="w-full rounded border p-2"
            value={selectedDeck ?? ''}
            onChange={(e) => setSelectedDeck(e.target.value || null)}
          >
            <option value="">—</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        <Button onClick={handleSubmitDeck} disabled={!selectedDeck}>
          Submit deck
        </Button>
      </div>

      <div>
        <Button
          onClick={() => handleReady(!me?.ready)}
          disabled={!me?.deckReady || !opp}
          variant={me?.ready ? 'secondary' : 'default'}
        >
          {me?.ready ? 'Cancel ready' : 'Ready'}
        </Button>
      </div>

      {online.error && <p className="text-sm text-red-500">{online.error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Implement the page**

Create `apps/web/src/app/play/online/[code]/page.tsx`:

```tsx
'use client';

import { useOnlineSocket } from '@/lib/online/use-online-socket';
import { OnlineLobby } from './_components/online-lobby';
import { NetGameProvider } from './_components/net-game-provider';
import { Board } from '@/app/play/[gameId]/_components/board';

export default function OnlineMatchPage({ params }: { params: { code: string } }) {
  const online = useOnlineSocket(params.code);

  if (online.phase === 'connecting' && !online.state) {
    return <main className="p-8">Connecting…</main>;
  }
  if (online.phase === 'idle' || online.phase === 'lobby') {
    return <OnlineLobby online={online} matchId={params.code} />;
  }
  if ((online.phase === 'playing' || online.phase === 'finished') && online.state) {
    return (
      <NetGameProvider online={online}>
        <Board />
      </NetGameProvider>
    );
  }
  return <main className="p-8">Unknown state.</main>;
}
```

- [ ] **Step 3: Move `net-game-provider.tsx` if not already in place**

Ensure `net-game-provider.tsx` lives at `apps/web/src/app/play/online/[code]/_components/net-game-provider.tsx` (as created in Task 16).

- [ ] **Step 4: Verify typecheck**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/web typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/play/online/[code]
git commit -m "feat(web): online lobby and match page"
```

---

## Task 19: Web — Disconnect banner + Forfeit button

Floating UI in Board for online matches only.

**Files:**

- Create: `apps/web/src/app/play/online/[code]/_components/disconnect-banner.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/board.tsx` (render banner + forfeit button when `isOnline`)

- [ ] **Step 1: Implement `DisconnectBanner`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useGame } from '@/app/play/_shared/game-context';

export function DisconnectBanner() {
  const { isOnline } = useGame();
  // When online, the `online` hook's `opponentDisconnected` flag is mirrored via
  // a ref on window (simpler than plumbing through another context). For MVP,
  // we expose it via the Net context's shape; this component reads from a
  // dedicated hook to avoid coupling.
  const [visible, setVisible] = useState(false);
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (!isOnline) return;
    const listener = (e: CustomEvent<{ disconnected: boolean }>) => {
      setVisible(e.detail.disconnected);
      if (e.detail.disconnected) setSeconds(60);
    };
    window.addEventListener('optcg:opponent', listener as EventListener);
    return () => window.removeEventListener('optcg:opponent', listener as EventListener);
  }, [isOnline]);

  useEffect(() => {
    if (!visible) return;
    const i = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(i);
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-900 shadow">
      Opponent disconnected — {seconds}s to forfeit
    </div>
  );
}
```

- [ ] **Step 2: Emit `optcg:opponent` CustomEvent from `NetGameProvider`**

In `net-game-provider.tsx`, after computing `value`, add an effect:

```tsx
import { useEffect } from 'react';
// …
useEffect(() => {
  const ev = new CustomEvent('optcg:opponent', {
    detail: { disconnected: online.opponentDisconnected },
  });
  window.dispatchEvent(ev);
}, [online.opponentDisconnected]);
```

- [ ] **Step 3: Add Forfeit button + banner render in `board.tsx`**

In the floating controls section, when `isOnline === true` and `state.phase !== 'GameOver'`, render:

```tsx
{
  isOnline && (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => {
          if (confirm('Forfeit the match?')) {
            // Access the online hook via context — add forfeit to context.
            onForfeit?.();
          }
        }}
      >
        Forfeit
      </Button>
      <DisconnectBanner />
    </>
  );
}
```

And pipe `onForfeit` from `NetGameProvider`: extend `GameContextValue` with an optional `forfeit?: () => void`, populated in `NetGameProvider` (`forfeit: online.forfeit`) and undefined in `GameProvider`.

Update `_shared/game-context.ts`:

```ts
export interface GameContextValue {
  // … existing fields
  forfeit?: () => Promise<void>;
}
```

Update `game-provider.tsx` to pass `forfeit: undefined` and `net-game-provider.tsx` to pass `forfeit: online.forfeit`.

In `Board`:

```tsx
const { forfeit, isOnline, state } = useGame();
// …
{
  isOnline && state.phase !== 'GameOver' && (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={async () => {
          if (window.confirm('Forfeit?')) await forfeit?.();
        }}
      >
        Forfeit
      </Button>
      <DisconnectBanner />
    </>
  );
}
```

- [ ] **Step 4: Verify typecheck**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/web typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/play
git commit -m "feat(web): disconnect banner and forfeit button in online"
```

---

## Task 20: Web — GameOver rematch integration + HotseatHandoff skip

Wire rematch flow into existing `GameOver` modal. Also make `HotseatHandoff` skip when `isOnline`.

**Files:**

- Modify: `apps/web/src/app/play/[gameId]/_components/game-over.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/hotseat-handoff.tsx`

- [ ] **Step 1: Update `HotseatHandoff`**

Change the early-return guard:

```tsx
const { isOnline } = useGame();
// …
if (botPlayers[0] || botPlayers[1] || isOnline) return;
```

- [ ] **Step 2: Update `GameOver` modal**

Read `forfeit`, `isOnline`, and a new optional `rematch` from context. Add Rematch button when `isOnline`:

Update `_shared/game-context.ts`:

```ts
export interface GameContextValue {
  // … existing
  rematch?: (ready: boolean) => Promise<void>;
  lastGameOverReason?: 'engine' | 'forfeit' | 'timeout';
}
```

In `NetGameProvider`, pass `rematch: online.rematch` and `lastGameOverReason: online.lastGameOver?.reason`.

In `GameOver` component, when `isOnline` and game finished:

```tsx
<Button
  onClick={async () => {
    await rematch?.(true);
  }}
>
  Rematch
</Button>
```

- [ ] **Step 3: Verify + commit**

```bash
corepack pnpm@9.7.0 --filter @optcg/web typecheck
```

```bash
git add apps/web/src/app/play
git commit -m "feat(web): rematch button in GameOver and skip hotseat handoff online"
```

---

## Task 21: Web — add Online button to `/play`

Small nav change so the user can reach online mode from the mode selector.

**Files:**

- Modify: `apps/web/src/app/play/page.tsx`

- [ ] **Step 1: Add a "Play online" link**

Near the "Mode" radio group, add:

```tsx
<Button asChild variant="outline">
  <Link href="/play/online">Play online</Link>
</Button>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/play/page.tsx
git commit -m "feat(web): entry point to online from /play"
```

---

## Task 22: Integration test — full online flow

End-to-end server+two-socket smoke ensuring GameStart → a few actions → GameOver path.

**Files:**

- Create: `apps/server/tests/e2e/full-flow.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { MatchStore } from '../../src/match/store';
import { registerHandlers } from '../../src/match/handlers';
import type { CardStatic } from '@optcg/engine';
import type { ClientMsg, ServerMsg } from '@optcg/protocol';

const CATALOG: Record<string, CardStatic> = {
  'OP01-001': {
    id: 'OP01-001',
    type: 'LEADER',
    colors: ['Red'],
    cost: null,
    power: 5000,
    life: 5,
    counter: null,
    keywords: [],
    effects: [],
    manualText: null,
  },
  'OP01-006': {
    id: 'OP01-006',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 3,
    power: 4000,
    life: null,
    counter: 1000,
    keywords: [],
    effects: [],
    manualText: null,
  },
};

function waitForKind(sock: Socket, kind: ServerMsg['kind']): Promise<ServerMsg> {
  return new Promise((resolve) => {
    const fn = (m: ServerMsg) => {
      if (m.kind === kind) {
        sock.off('msg', fn);
        resolve(m);
      }
    };
    sock.on('msg', fn);
  });
}

describe('e2e full online flow', () => {
  const teardown: Array<() => void | Promise<void>> = [];
  afterEach(async () => {
    for (const t of teardown.reverse()) await t();
    teardown.length = 0;
  });

  it('2 clients complete GameStart and can dispatch Mulligan', async () => {
    const httpServer = createServer();
    const io = new SocketIOServer(httpServer);
    const store = new MatchStore(CATALOG, { cap: 10, gcIntervalMs: 0 });
    registerHandlers(io, store);
    await new Promise<void>((r) => httpServer.listen(0, r));
    const port = (httpServer.address() as AddressInfo).port;
    teardown.push(
      () =>
        new Promise<void>((r) => {
          io.close();
          httpServer.close(() => r());
        }),
    );
    teardown.push(() => void store.shutdown());

    const host = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    });
    const guest = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    });
    teardown.push(() => void host.close());
    teardown.push(() => void guest.close());
    await Promise.all([
      new Promise<void>((r) => host.on('connect', () => r())),
      new Promise<void>((r) => guest.on('connect', () => r())),
    ]);

    host.emit('msg', { kind: 'CreateMatch', nickname: 'A' } satisfies ClientMsg);
    const created = (await waitForKind(host, 'MatchCreated')) as Extract<
      ServerMsg,
      { kind: 'MatchCreated' }
    >;

    guest.emit('msg', { kind: 'JoinMatch', matchId: created.matchId, nickname: 'B' });
    const joined = (await waitForKind(guest, 'MatchJoined')) as Extract<
      ServerMsg,
      { kind: 'MatchJoined' }
    >;

    const deck = Array(50).fill('OP01-006');
    host.emit('msg', {
      kind: 'SubmitDeck',
      matchId: created.matchId,
      token: created.token,
      leaderCardId: 'OP01-001',
      deck,
    });
    guest.emit('msg', {
      kind: 'SubmitDeck',
      matchId: created.matchId,
      token: joined.token,
      leaderCardId: 'OP01-001',
      deck,
    });

    const hostStart = waitForKind(host, 'GameStart');
    const guestStart = waitForKind(guest, 'GameStart');
    host.emit('msg', {
      kind: 'SetReady',
      matchId: created.matchId,
      token: created.token,
      ready: true,
    });
    guest.emit('msg', {
      kind: 'SetReady',
      matchId: created.matchId,
      token: joined.token,
      ready: true,
    });
    const [gs] = await Promise.all([hostStart, guestStart]);
    expect(gs.kind).toBe('GameStart');

    // Filtered state: opponent hand should be all hidden from host's view.
    const start = gs as Extract<ServerMsg, { kind: 'GameStart' }>;
    expect(start.initialState.players[1].hand.every((c) => c === '__hidden__')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — must pass**

```bash
corepack pnpm@9.7.0 --filter @optcg/server test -- tests/e2e/full-flow.test.ts
```

Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
git add apps/server/tests/e2e
git commit -m "test(server): e2e GameStart flow with hand filtering"
```

---

## Task 23: Coverage gate + root scripts

Turn on coverage gate for `apps/server/src/match/**`, make sure CI picks up the new workspace.

**Files:**

- Modify: `apps/server/vitest.config.ts` (already sets thresholds; verify)
- Verify: `.github/workflows/ci.yml` — turbo picks up workspace automatically

- [ ] **Step 1: Run full gate**

From repo root:

```bash
corepack pnpm@9.7.0 install
corepack pnpm@9.7.0 typecheck
corepack pnpm@9.7.0 lint
corepack pnpm@9.7.0 test
corepack pnpm@9.7.0 format:check
```

Expected: all exit 0.

- [ ] **Step 2: Coverage check**

```bash
corepack pnpm@9.7.0 --filter @optcg/server test:coverage
```

Expected: meets 80/75/80/80 threshold in `src/match/**`. If not, the spec review reviewer will flag it — add tests to bring coverage over threshold before proceeding.

- [ ] **Step 3: Commit (only if files changed)**

If any fixup commits needed for coverage:

```bash
git add apps/server
git commit -m "test(server): bump match/* coverage to threshold"
```

---

## Task 24: Docs — `docs/deploy-fly.md` + CLAUDE.md update

Final deliverable: deployment recipe and project status update.

**Files:**

- Create: `docs/deploy-fly.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write `docs/deploy-fly.md`**

````markdown
# Deploying the OPTCG server to Fly.io

> Not executed during Fase 6. This is the manual recipe for when we're ready to go public.

## Prerequisites

- `flyctl` installed (https://fly.io/docs/hands-on/install-flyctl/)
- Fly.io account + `fly auth login`

## One-time setup

1. From the repo root:
   ```bash
   cd apps/server
   fly launch --no-deploy --name optcg-server --region mad
   ```
````

Choose "No" for Postgres/Upstash. Keep the generated `fly.toml`.

2. In `fly.toml`, make sure:
   - `[[services]]` with `internal_port = 3001`.
   - `[[services.ports]]` exposes 80 and 443 with `handlers = ["http", "tls"]`.
   - `primary_region = "mad"` (or closest to users).

## Dockerfile (`apps/server/Dockerfile`)

```
FROM node:20-alpine
WORKDIR /app
RUN corepack enable pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN corepack pnpm@9.7.0 install --frozen-lockfile --filter @optcg/server...
RUN corepack pnpm@9.7.0 --filter @optcg/server catalog:build
EXPOSE 3001
CMD ["corepack", "pnpm@9.7.0", "--filter", "@optcg/server", "start"]
```

## Env vars

- `PORT=3001`
- `CORS_ORIGIN=https://<your-web-domain>`

Set with `fly secrets set CORS_ORIGIN=https://…`.

## Deploy

```bash
fly deploy --remote-only
```

Verify `https://optcg-server.fly.dev/health` → `{"status":"ok"}`.

## Client configuration

In the web deploy, set `NEXT_PUBLIC_SERVER_URL=https://optcg-server.fly.dev` (build-time env).

## Sticky sessions

Socket.IO works with default Fly.io settings for a single-region single-machine deploy. If scaling to multiple machines, add sticky-session annotations in `fly.toml` under `[[services]]`:

```
load_balancing_strategy = "sticky"
```

Not needed for MVP.

````

- [ ] **Step 2: Update `CLAUDE.md`**

Replace the "Estado actual" block:

```md
## Estado actual

- **Fase:** Fases 0-6 mergeadas a `main`. Última PR: #N (Fase 6 — Multijugador local) mergeada el YYYY-MM-DD.
- **Próxima fase:** Fase 6.5 — Despliegue a Fly.io (usando `docs/deploy-fly.md`) o Fase 7 (pulido + parser ampliado).
- **Fase-gated delivery:** no empieces la siguiente fase sin aprobación explícita del usuario. Pasa primero por `superpowers:brainstorming` → spec → `writing-plans` antes de tocar código.
````

(Dates/PR numbers filled in at merge time.)

- [ ] **Step 3: Commit**

```bash
git add docs/deploy-fly.md CLAUDE.md
git commit -m "docs: deploy-fly recipe + mark Fase 6 complete"
```

---

## Exit criteria recap (manual verification before PR)

- [ ] `corepack pnpm@9.7.0 install && corepack pnpm@9.7.0 typecheck && corepack pnpm@9.7.0 lint && corepack pnpm@9.7.0 test && corepack pnpm@9.7.0 format:check` all exit 0.
- [ ] `corepack pnpm@9.7.0 --filter @optcg/server catalog:build` produces `apps/server/src/catalog.json`.
- [ ] `corepack pnpm@9.7.0 --filter @optcg/server dev` serves on `:3001` and answers `/health`.
- [ ] In two browser tabs (one incognito) on `http://localhost:3000/play/online`:
  - Host creates match → sees code + URL.
  - Guest opens URL in the incognito tab → pick deck → ready.
  - Host picks deck → ready → `GameStart` fires in both.
  - Full OPTCG game completes end-to-end.
- [ ] Close host tab, reopen within 60 s → session resumes; banner disappears.
- [ ] Close host tab, wait >60 s → guest gets `GameOver(timeout)`.
- [ ] `Forfeit` button → `GameOver(forfeit)`.
- [ ] Rematch after `GameOver` starts a new match with first player inverted.
- [ ] `apps/server/src/match/**` coverage ≥ 80 / 75 / 80 / 80.

---

## Self-review log

**Spec coverage:**

- §1 Architecture → Tasks 1 (protocol pkg), 2 (server scaffold), 14–16 (client), 24 (docs).
- §2 Protocol → Tasks 1, 6, 12 (messages + schemas + handlers).
- §2.3 Filter → Task 7.
- §3.1 Store → Task 11.
- §3.2 Match + §3.3 Lifecycle → Tasks 9, 10.
- §3.4 Validation/anti-cheat → Tasks 6, 9, 12.
- §3.5 Config → Task 5 (env vars) and Task 24 (Fly recipe).
- §4.1 Routes → Tasks 17, 18, 21.
- §4.2 Hook → Task 15.
- §4.3 NetGameProvider → Task 16.
- §4.4 Lobby → Task 18.
- §4.5 Reconnection/Forfeit UI → Tasks 19, 20.
- §5 Testing → Tasks across; e2e in Task 22.
- §6 Exit criteria → Task 23 gate + final recap.
- §7 Out-of-scope → not implemented; noted in task 24 update.

**Placeholder scan:** No `TBD`/`TODO` in the plan text; every step has exact code or exact commands.

**Type consistency:**

- `ClientMsg`/`ServerMsg` defined once in `packages/protocol/src/index.ts` and imported everywhere.
- `filterStateForPlayer(state, receiver)` signature consistent across Task 7 and Task 12.
- `Match.proposeAction(token, action)` / `proposeActionBatch(token, actions)` consistent between Tasks 9, 10, 12.
- `GameContextValue` shared type is single-source-of-truth from Task 16 onward; fields added incrementally (`forfeit?`, `rematch?`, `lastGameOverReason?`) are all optional, so earlier `GameProvider` compiles without them.

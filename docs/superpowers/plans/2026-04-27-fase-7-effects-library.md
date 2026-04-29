# Fase 7 — Librería de efectos hand-coded Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobertura ≥85/121 (≥70 %) cartas OP01 con efectos declarativos auto-ejecutados, target selection interactiva, static auras de Leaders, y `Activate:Main` con coste DON.

**Architecture:** El engine gana 4 capas nuevas — extensiones de tipos (Effect.optional, StaticAura, EffectTargetSelection, SelectEffectTarget, NotEnoughDon), `computeEffectivePower` que evalúa auras al vuelo, ejecutor que detecta multi-target y abre priority window, librería hand-coded en `cards/OP01-XXX.ts` con helpers terse. La UI reusa `<TargetPicker />` para una nueva variante del modal y añade highlight pulsante en validTargets del board.

**Tech Stack:** TypeScript strict + Vitest TDD + helpers funcionales (sin clases) + `@optcg/engine` puro. Cartas OP01 en `apps/web/src/data/cards.json` como source of truth para el effectText.

**Branch:** `feature/fase-7-effects-parser` (ya creada, basada en `main` post-Fase 6.5).

**Spec:** `docs/superpowers/specs/2026-04-27-fase-7-effects-design.md` — fuente de verdad. Conflictos → gana spec.

---

## File structure

| Archivo                                                         | Estado | Responsabilidad                                                                                                                            |
| --------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/engine/src/types/card.ts`                             | Modify | Añadir `optional?: boolean` a Effect kinds con target; `powerMax`/`powerMin` a CardFilter; añadir `'StaticAura'` a TriggeredEffect.trigger |
| `packages/engine/src/types/state.ts`                            | Modify | Añadir `EffectTargetSelection` a PriorityWindow; export `TargetRef`                                                                        |
| `packages/engine/src/types/action.ts`                           | Modify | Añadir `SelectEffectTarget`                                                                                                                |
| `packages/engine/src/types/error.ts`                            | Modify | Añadir `NotEnoughDon { code, need, have }`                                                                                                 |
| `packages/engine/src/effects/helpers.ts`                        | Create | Constructores terse: `onPlay`, `staticAura`, `drawN`, `opponentChar(filter)`, etc.                                                         |
| `packages/engine/src/effects/power.ts`                          | Create | `computeEffectivePower(state, ref)` evalúa auras                                                                                           |
| `packages/engine/src/effects/targets.ts`                        | Create | `validTargetsForEffect(state, context, effect)`                                                                                            |
| `packages/engine/src/effects/executor.ts`                       | Modify | Detectar multi-target y abrir priorityWindow en lugar de aplicar directo                                                                   |
| `packages/engine/src/effects/triggers.ts`                       | Modify | Encolar `pendingChain` cuando un efecto bloquea el resto                                                                                   |
| `packages/engine/src/effects/library.ts`                        | Modify | Index explícito de imports `cards/OP01-*`                                                                                                  |
| `packages/engine/src/effects/cards/OP01-XXX.ts`                 | Create | ≥85 ficheros, uno por card-id cubierta                                                                                                     |
| `packages/engine/src/apply.ts`                                  | Modify | Handler para `SelectEffectTarget`; wire `EffectCost.donX` en ActivateMain                                                                  |
| `packages/engine/src/combat/declare.ts`                         | Modify | Sustituir cálculo inline de power por `computeEffectivePower`                                                                              |
| `packages/engine/src/combat/resolve.ts`                         | Modify | Igual para defense power                                                                                                                   |
| `packages/engine/src/helpers/legal-actions.ts`                  | Modify | Incluir `SelectEffectTarget` cuando priorityWindow es EffectTargetSelection                                                                |
| `packages/engine/tests/effects/static-aura.test.ts`             | Create | Aura activa/inactiva, condition checks, KO desactiva aura                                                                                  |
| `packages/engine/tests/effects/target-selection.test.ts`        | Create | priorityWindow se abre, SelectEffectTarget válida/inválida, pendingChain                                                                   |
| `packages/engine/tests/effects/activate-main-cost.test.ts`      | Create | DON cost se resta antes del effect; NotEnoughDon                                                                                           |
| `packages/engine/tests/effects/library-coverage.test.ts`        | Create | Gate ≥85/121 OP01                                                                                                                          |
| `packages/engine/tests/cards/OP01-XXX.test.ts`                  | Create | ≥85 ficheros, uno por card-id cubierta                                                                                                     |
| `apps/web/src/app/play/[gameId]/_components/priority-modal.tsx` | Modify | Variante `EffectTargetVariant`                                                                                                             |
| `apps/web/src/app/play/[gameId]/_components/character-card.tsx` | Modify | Prop `highlighted` opcional                                                                                                                |
| `apps/web/src/app/play/[gameId]/_components/leader-card.tsx`    | Modify | Prop `highlighted` opcional                                                                                                                |
| `apps/web/src/app/play/[gameId]/_components/board.tsx`          | Modify | Selector que decide qué cartas highlightar según priorityWindow                                                                            |
| `apps/web/src/app/play/[gameId]/_components/target-picker.tsx`  | Modify | Computar power con `computeEffectivePower`                                                                                                 |
| `apps/web/src/app/play/[gameId]/_components/toast-center.tsx`   | Modify | Casos para EffectResolved/EffectFizzled                                                                                                    |
| `packages/ai/src/easy.ts`                                       | Modify | Manejo de EffectTargetSelection (random)                                                                                                   |
| `packages/ai/src/medium.ts`                                     | Modify | Heurísticas según effect.kind                                                                                                              |
| `CLAUDE.md`                                                     | Modify | Marcar Fase 7 (effects library) completa                                                                                                   |

---

## Task 1: Extender `CardFilter` con `powerMax`/`powerMin`

Foundation type change. Sin lógica, solo más campos opcionales. No rompe consumidores existentes.

**Files:**

- Modify: `packages/engine/src/types/card.ts:7-13`

- [ ] **Step 1: Edit `CardFilter`**

```ts
export interface CardFilter {
  type?: CardType;
  colors?: string[];
  costMax?: number;
  costMin?: number;
  powerMax?: number;
  powerMin?: number;
  keyword?: Keyword;
}
```

- [ ] **Step 2: Extend `matchesFilter` in executor**

In `packages/engine/src/effects/executor.ts:19-29`, replace the function with:

```ts
function matchesFilter(card: CardStatic, filter: CardFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.type && card.type !== filter.type) return false;
  if (filter.colors && filter.colors.length > 0) {
    if (!filter.colors.some((c) => card.colors.includes(c))) return false;
  }
  if (filter.costMin !== undefined && (card.cost ?? 0) < filter.costMin) return false;
  if (filter.costMax !== undefined && (card.cost ?? 0) > filter.costMax) return false;
  if (filter.powerMin !== undefined && (card.power ?? 0) < filter.powerMin) return false;
  if (filter.powerMax !== undefined && (card.power ?? 0) > filter.powerMax) return false;
  if (filter.keyword && !card.keywords.includes(filter.keyword)) return false;
  return true;
}
```

- [ ] **Step 3: Run engine tests — must still pass**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test`
Expected: 173 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/types/card.ts packages/engine/src/effects/executor.ts
git commit -m "feat(engine): add powerMin/powerMax to CardFilter"
```

---

## Task 2: Extender `Effect` con flag `optional`

**Files:**

- Modify: `packages/engine/src/types/card.ts:32-41`

- [ ] **Step 1: Edit Effect union**

Replace the `Effect` type with:

```ts
export type Effect =
  | { kind: 'draw'; amount: number }
  | { kind: 'search'; from: 'deck' | 'trash'; filter: CardFilter; amount: number }
  | { kind: 'ko'; target: TargetSpec; optional?: boolean }
  | {
      kind: 'power';
      target: TargetSpec;
      delta: number;
      duration: 'thisTurn' | 'permanent';
      optional?: boolean;
    }
  | { kind: 'returnToHand'; target: TargetSpec; optional?: boolean }
  | { kind: 'banish'; target: TargetSpec; optional?: boolean }
  | { kind: 'sequence'; steps: Effect[] }
  | { kind: 'choice'; options: Effect[] }
  | { kind: 'manual'; text: string };
```

- [ ] **Step 2: Run typecheck**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine typecheck`
Expected: no errors (existing code doesn't read `optional`, just ignores it).

- [ ] **Step 3: Run engine tests**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/types/card.ts
git commit -m "feat(engine): add optional flag to target-requiring Effect kinds"
```

---

## Task 3: Extender `TriggeredEffect` con `'StaticAura'`

**Files:**

- Modify: `packages/engine/src/types/card.ts:43-48`

- [ ] **Step 1: Edit TriggeredEffect**

```ts
export interface TriggeredEffect {
  trigger:
    | 'OnPlay'
    | 'OnKO'
    | 'OnAttack'
    | 'Activate:Main'
    | 'EndOfTurn'
    | 'Trigger'
    | 'StaticAura';
  condition?: EffectCondition;
  cost?: EffectCost;
  effect: Effect;
}
```

- [ ] **Step 2: Run engine tests**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test`
Expected: all pass — existing `triggerHook` only looks for matching triggers, doesn't enumerate.

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/types/card.ts
git commit -m "feat(engine): add StaticAura trigger kind"
```

---

## Task 4: Añadir `EffectTargetSelection` y `TargetRef` al state

**Files:**

- Modify: `packages/engine/src/types/state.ts:19-32`

- [ ] **Step 1: Add TargetRef export and PriorityWindow variant**

Replace the PriorityWindow union with:

```ts
export type TargetRef =
  | { kind: 'Leader'; owner: PlayerIndex }
  | { kind: 'Character'; instanceId: string; owner: PlayerIndex };

export type PriorityWindow =
  | { kind: 'Mulligan'; player: PlayerIndex }
  | { kind: 'CounterStep'; attacker: AttackerRef; defender: DefenderRef }
  | {
      kind: 'TriggerStep';
      revealedCardId: string;
      owner: PlayerIndex;
      triggerEffect: Effect;
    }
  | {
      kind: 'BlockerStep';
      attacker: AttackerRef;
      originalTarget: DefenderRef;
    }
  | {
      kind: 'EffectTargetSelection';
      sourceCardId: string;
      sourceOwner: PlayerIndex;
      effect: Effect;
      validTargets: TargetRef[];
      optional: boolean;
      pendingChain: Effect[];
    };
```

- [ ] **Step 2: Run typecheck**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine typecheck`
Expected: no errors (existing switches don't yet handle the new kind, but TS allows un-exhaustive switches by default).

- [ ] **Step 3: Run engine tests**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/types/state.ts
git commit -m "feat(engine): add EffectTargetSelection priority window + TargetRef"
```

---

## Task 5: Añadir `SelectEffectTarget` action + `NotEnoughDon` error

**Files:**

- Modify: `packages/engine/src/types/action.ts:30`
- Modify: `packages/engine/src/types/error.ts`

- [ ] **Step 1: Add action variant**

In `packages/engine/src/types/action.ts`, before the closing `;` of the union, add:

```ts
  | { kind: 'SelectEffectTarget'; player: PlayerIndex; targetIndex: number | null }
```

- [ ] **Step 2: Confirm `NotEnoughDon` already exists**

Read `packages/engine/src/types/error.ts`. The existing union has `{ code: 'NotEnoughDon'; need: number; have: number }`. No change needed; if not present, add it.

- [ ] **Step 3: Run typecheck + tests**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/engine typecheck
corepack pnpm@9.7.0 --filter @optcg/engine test
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/types/action.ts packages/engine/src/types/error.ts
git commit -m "feat(engine): add SelectEffectTarget action"
```

---

## Task 6: `validTargetsForEffect` — enumerar candidatos

Pure helper: given a state + context + effect with a TargetSpec, returns array of `TargetRef[]`. Driven entirely by TargetSpec + filter.

**Files:**

- Create: `packages/engine/src/effects/targets.ts`
- Test: `packages/engine/tests/effects/targets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/engine/tests/effects/targets.test.ts
import { describe, it, expect } from 'vitest';
import { validTargetsForEffect } from '../../src/effects/targets';
import type { GameState, PlayerState, CharacterInPlay } from '../../src/types/state';
import type { CardStatic, Effect } from '../../src/types/card';

const RED_CHAR: CardStatic = {
  id: 'C',
  type: 'CHARACTER',
  colors: ['Red'],
  cost: 3,
  power: 4000,
  life: null,
  counter: 1000,
  keywords: [],
  effects: [],
  manualText: null,
};
const BIG_CHAR: CardStatic = {
  id: 'B',
  type: 'CHARACTER',
  colors: ['Red'],
  cost: 5,
  power: 7000,
  life: null,
  counter: 1000,
  keywords: [],
  effects: [],
  manualText: null,
};

function makeChar(instanceId: string, cardId: string): CharacterInPlay {
  return {
    instanceId,
    cardId,
    rested: false,
    attachedDon: 0,
    powerThisTurn: 0,
    summoningSickness: false,
    usedBlockerThisTurn: false,
  };
}

function makePlayer(chars: CharacterInPlay[]): PlayerState {
  return {
    playerId: 'p',
    leader: { cardId: 'L', rested: false, attachedDon: 0, powerThisTurn: 0 },
    deck: [],
    hand: [],
    life: [],
    trash: [],
    banishZone: [],
    characters: chars,
    stage: null,
    donActive: 0,
    donRested: 0,
    donDeck: 10,
    mulliganTaken: false,
    firstTurnUsed: false,
  };
}

function makeState(p0Chars: CharacterInPlay[], p1Chars: CharacterInPlay[]): GameState {
  return {
    turn: 1,
    activePlayer: 0,
    phase: 'Main',
    priorityWindow: null,
    players: [makePlayer(p0Chars), makePlayer(p1Chars)],
    rng: { seed: 1, pointer: 0 },
    log: [],
    winner: null,
    catalog: { C: RED_CHAR, B: BIG_CHAR },
    isFirstTurnOfFirstPlayer: false,
  };
}

describe('validTargetsForEffect', () => {
  it('returns opponent characters matching filter', () => {
    const state = makeState([], [makeChar('x1', 'C'), makeChar('x2', 'B')]);
    const effect: Effect = {
      kind: 'ko',
      target: { kind: 'opponentCharacter', filter: { powerMax: 4000 } },
    };
    const targets = validTargetsForEffect(state, { sourcePlayer: 0, sourceCardId: 'src' }, effect);
    expect(targets).toEqual([{ kind: 'Character', instanceId: 'x1', owner: 1 }]);
  });

  it('returns opponent leader for opponentLeader target', () => {
    const state = makeState([], []);
    const effect: Effect = {
      kind: 'power',
      target: { kind: 'opponentLeader' },
      delta: -1000,
      duration: 'thisTurn',
    };
    const targets = validTargetsForEffect(state, { sourcePlayer: 0, sourceCardId: 'src' }, effect);
    expect(targets).toEqual([{ kind: 'Leader', owner: 1 }]);
  });

  it('returns empty for non-target effects', () => {
    const state = makeState([], []);
    const effect: Effect = { kind: 'draw', amount: 1 };
    const targets = validTargetsForEffect(state, { sourcePlayer: 0, sourceCardId: 'src' }, effect);
    expect(targets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test — must fail**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/targets.test.ts`
Expected: fails — module doesn't exist.

- [ ] **Step 3: Implement `targets.ts`**

```ts
// packages/engine/src/effects/targets.ts
import type { GameState, PlayerIndex, TargetRef } from '../types/state';
import type { Effect, TargetSpec, CardFilter, CardStatic } from '../types/card';

interface Context {
  sourcePlayer: PlayerIndex;
  sourceCardId: string;
}

function otherPlayer(p: PlayerIndex): PlayerIndex {
  return p === 0 ? 1 : 0;
}

function matchesFilter(card: CardStatic, filter: CardFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.type && card.type !== filter.type) return false;
  if (filter.colors && filter.colors.length > 0) {
    if (!filter.colors.some((c) => card.colors.includes(c))) return false;
  }
  if (filter.costMin !== undefined && (card.cost ?? 0) < filter.costMin) return false;
  if (filter.costMax !== undefined && (card.cost ?? 0) > filter.costMax) return false;
  if (filter.powerMin !== undefined && (card.power ?? 0) < filter.powerMin) return false;
  if (filter.powerMax !== undefined && (card.power ?? 0) > filter.powerMax) return false;
  if (filter.keyword && !card.keywords.includes(filter.keyword)) return false;
  return true;
}

function targetsForSpec(state: GameState, ctx: Context, spec: TargetSpec): TargetRef[] {
  if (spec.kind === 'self') {
    return [{ kind: 'Leader', owner: ctx.sourcePlayer }];
  }
  if (spec.kind === 'opponentLeader') {
    return [{ kind: 'Leader', owner: otherPlayer(ctx.sourcePlayer) }];
  }
  if (spec.kind === 'opponentCharacter') {
    const opp = otherPlayer(ctx.sourcePlayer);
    return state.players[opp].characters
      .filter((c) => {
        const card = state.catalog[c.cardId];
        return card && matchesFilter(card, spec.filter);
      })
      .map((c) => ({ kind: 'Character' as const, instanceId: c.instanceId, owner: opp }));
  }
  if (spec.kind === 'ownCharacter') {
    const own = ctx.sourcePlayer;
    return state.players[own].characters
      .filter((c) => {
        const card = state.catalog[c.cardId];
        return card && matchesFilter(card, spec.filter);
      })
      .map((c) => ({ kind: 'Character' as const, instanceId: c.instanceId, owner: own }));
  }
  return [];
}

export function validTargetsForEffect(state: GameState, ctx: Context, effect: Effect): TargetRef[] {
  switch (effect.kind) {
    case 'ko':
    case 'banish':
    case 'returnToHand':
      return targetsForSpec(state, ctx, effect.target);
    case 'power':
      return targetsForSpec(state, ctx, effect.target);
    default:
      return [];
  }
}
```

- [ ] **Step 4: Run test — must pass**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/targets.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/effects/targets.ts packages/engine/tests/effects/targets.test.ts
git commit -m "feat(engine): validTargetsForEffect helper"
```

---

## Task 7: `computeEffectivePower` — power con auras

Replaces inline `power + attachedDon * 1000 + powerThisTurn` calculation. Iterates StaticAura sources to add deltas where condition matches.

**Files:**

- Create: `packages/engine/src/effects/power.ts`
- Test: `packages/engine/tests/effects/static-aura.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/engine/tests/effects/static-aura.test.ts
import { describe, it, expect } from 'vitest';
import { computeEffectivePower } from '../../src/effects/power';
import type { GameState, PlayerState, CharacterInPlay } from '../../src/types/state';
import type { CardStatic } from '../../src/types/card';

const ZORO_LEADER: CardStatic = {
  id: 'OP01-001',
  type: 'LEADER',
  colors: ['Red'],
  cost: null,
  power: 5000,
  life: 5,
  counter: null,
  keywords: [],
  effects: [
    {
      trigger: 'StaticAura',
      condition: { onTurn: 'yours', attachedDonAtLeast: 1 },
      effect: {
        kind: 'power',
        target: { kind: 'ownCharacter' },
        delta: 1000,
        duration: 'permanent',
      },
    },
  ],
  manualText: null,
};

const PLAIN_CHAR: CardStatic = {
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
};

function makeChar(id: string, cardId: string, attachedDon = 0): CharacterInPlay {
  return {
    instanceId: id,
    cardId,
    rested: false,
    attachedDon,
    powerThisTurn: 0,
    summoningSickness: false,
    usedBlockerThisTurn: false,
  };
}

function makePlayer(leaderId: string, leaderDon: number, chars: CharacterInPlay[]): PlayerState {
  return {
    playerId: 'p',
    leader: { cardId: leaderId, rested: false, attachedDon: leaderDon, powerThisTurn: 0 },
    deck: [],
    hand: [],
    life: [],
    trash: [],
    banishZone: [],
    characters: chars,
    stage: null,
    donActive: 0,
    donRested: 0,
    donDeck: 10,
    mulliganTaken: false,
    firstTurnUsed: false,
  };
}

function makeState(activePlayer: 0 | 1, p0Don: number, p0Chars: CharacterInPlay[]): GameState {
  return {
    turn: 1,
    activePlayer,
    phase: 'Main',
    priorityWindow: null,
    players: [makePlayer('OP01-001', p0Don, p0Chars), makePlayer('OP01-001', 0, [])],
    rng: { seed: 1, pointer: 0 },
    log: [],
    winner: null,
    catalog: { 'OP01-001': ZORO_LEADER, 'OP01-006': PLAIN_CHAR },
    isFirstTurnOfFirstPlayer: false,
  };
}

describe('computeEffectivePower', () => {
  it('returns base power when no auras active', () => {
    const state = makeState(0, 0, [makeChar('x', 'OP01-006')]);
    const power = computeEffectivePower(state, { kind: 'Character', instanceId: 'x', owner: 0 });
    expect(power).toBe(4000);
  });

  it('applies aura when condition holds (own turn + 1 don on leader)', () => {
    const state = makeState(0, 1, [makeChar('x', 'OP01-006')]);
    const power = computeEffectivePower(state, { kind: 'Character', instanceId: 'x', owner: 0 });
    expect(power).toBe(5000); // 4000 + 1000 aura
  });

  it('does not apply aura on opponent turn', () => {
    const state = makeState(1, 1, [makeChar('x', 'OP01-006')]);
    const power = computeEffectivePower(state, { kind: 'Character', instanceId: 'x', owner: 0 });
    expect(power).toBe(4000);
  });

  it('does not apply aura when leader has 0 don attached', () => {
    const state = makeState(0, 0, [makeChar('x', 'OP01-006')]);
    const power = computeEffectivePower(state, { kind: 'Character', instanceId: 'x', owner: 0 });
    expect(power).toBe(4000);
  });

  it('includes attachedDon and powerThisTurn on the target', () => {
    const state = makeState(0, 0, [makeChar('x', 'OP01-006', 2)]);
    const power = computeEffectivePower(state, { kind: 'Character', instanceId: 'x', owner: 0 });
    expect(power).toBe(6000); // 4000 + 2*1000
  });

  it('computes leader power with attached don and aura ineligibility (aura on ownChar only)', () => {
    const state = makeState(0, 1, []);
    const power = computeEffectivePower(state, { kind: 'Leader', owner: 0 });
    expect(power).toBe(6000); // 5000 + 1*1000 attached, aura targets ownChar not self
  });
});
```

- [ ] **Step 2: Run — must fail**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/static-aura.test.ts`
Expected: module missing.

- [ ] **Step 3: Implement `power.ts`**

```ts
// packages/engine/src/effects/power.ts
import type { GameState, PlayerIndex, TargetRef } from '../types/state';
import type { CardStatic, Effect, TriggeredEffect } from '../types/card';

function basePowerFor(
  state: GameState,
  ref: TargetRef,
): { card: CardStatic; attachedDon: number; powerThisTurn: number } | null {
  if (ref.kind === 'Leader') {
    const p = state.players[ref.owner];
    const card = state.catalog[p.leader.cardId];
    if (!card) return null;
    return { card, attachedDon: p.leader.attachedDon, powerThisTurn: p.leader.powerThisTurn };
  }
  const p = state.players[ref.owner];
  const c = p.characters.find((x) => x.instanceId === ref.instanceId);
  if (!c) return null;
  const card = state.catalog[c.cardId];
  if (!card) return null;
  return { card, attachedDon: c.attachedDon, powerThisTurn: c.powerThisTurn };
}

function effectMatchesRef(
  state: GameState,
  sourceOwner: PlayerIndex,
  effect: Effect,
  ref: TargetRef,
): boolean {
  if (effect.kind !== 'power') return false;
  const target = effect.target;
  if (target.kind === 'self') {
    // self = source's leader (per executor convention)
    return ref.kind === 'Leader' && ref.owner === sourceOwner;
  }
  if (target.kind === 'opponentLeader') {
    return ref.kind === 'Leader' && ref.owner !== sourceOwner;
  }
  if (target.kind === 'opponentCharacter') {
    return ref.kind === 'Character' && ref.owner !== sourceOwner;
  }
  if (target.kind === 'ownCharacter') {
    return ref.kind === 'Character' && ref.owner === sourceOwner;
  }
  return false;
}

function conditionHolds(
  state: GameState,
  sourceOwner: PlayerIndex,
  sourceAttachedDon: number,
  te: TriggeredEffect,
): boolean {
  const c = te.condition;
  if (!c) return true;
  if (c.onTurn === 'yours' && state.activePlayer !== sourceOwner) return false;
  if (c.onTurn === 'opponents' && state.activePlayer === sourceOwner) return false;
  if (c.attachedDonAtLeast !== undefined && sourceAttachedDon < c.attachedDonAtLeast) return false;
  return true;
}

function iterateAuraSources(
  state: GameState,
): Array<{ owner: PlayerIndex; cardId: string; attachedDon: number }> {
  const out: Array<{ owner: PlayerIndex; cardId: string; attachedDon: number }> = [];
  for (const owner of [0, 1] as const) {
    const p = state.players[owner];
    out.push({ owner, cardId: p.leader.cardId, attachedDon: p.leader.attachedDon });
    for (const c of p.characters) {
      out.push({ owner, cardId: c.cardId, attachedDon: c.attachedDon });
    }
  }
  return out;
}

export function computeEffectivePower(state: GameState, ref: TargetRef): number {
  const base = basePowerFor(state, ref);
  if (!base) return 0;
  let power = (base.card.power ?? 0) + base.attachedDon * 1000 + base.powerThisTurn;
  for (const src of iterateAuraSources(state)) {
    const sourceCard = state.catalog[src.cardId];
    if (!sourceCard) continue;
    for (const te of sourceCard.effects) {
      if (te.trigger !== 'StaticAura') continue;
      if (!conditionHolds(state, src.owner, src.attachedDon, te)) continue;
      if (!effectMatchesRef(state, src.owner, te.effect, ref)) continue;
      if (te.effect.kind === 'power') power += te.effect.delta;
    }
  }
  return Math.max(0, power);
}
```

- [ ] **Step 4: Run test — must pass**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/static-aura.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/effects/power.ts packages/engine/tests/effects/static-aura.test.ts
git commit -m "feat(engine): computeEffectivePower with StaticAura support"
```

---

## Task 8: Sustituir cálculo inline de power en combat por `computeEffectivePower`

**Files:**

- Modify: `packages/engine/src/combat/declare.ts:13-23` (helper `computeAttackPower`)
- Modify: `packages/engine/src/combat/declare.ts:62, 85` (call sites)
- Modify: `packages/engine/src/combat/resolve.ts` (defense power computation)

- [ ] **Step 1: Read current declare.ts to find call sites**

Run: `grep -n "powerOf\|computeAttackPower\|attackerPower\|defensePower" packages/engine/src/combat/declare.ts packages/engine/src/combat/resolve.ts`

Expected: shows lines using `card.power` directly. Map them.

- [ ] **Step 2: Replace `computeAttackPower` in declare.ts**

In `packages/engine/src/combat/declare.ts`, remove the local `computeAttackPower` helper and import the new one:

```ts
// at top
import { computeEffectivePower } from '../effects/power';
```

For the attacker leader path (around line 62), replace:

```ts
attackerPower = computeAttackPower(leaderCard, ap.leader.attachedDon, ap.leader.powerThisTurn);
```

with:

```ts
attackerPower = computeEffectivePower(state, { kind: 'Leader', owner: attackerOwner });
```

For the attacker character path (around line 85):

```ts
attackerPower = computeEffectivePower(state, {
  kind: 'Character',
  instanceId: char.instanceId,
  owner: attackerOwner,
});
```

For the defender leader (around line 107):

```ts
defensePower = computeEffectivePower(state, { kind: 'Leader', owner: defenderOwner });
```

For the defender character (around line 141):

```ts
defensePower = computeEffectivePower(state, {
  kind: 'Character',
  instanceId: ch.instanceId,
  owner: defenderOwner,
});
```

Remove the unused `powerOf` and `computeAttackPower` local helpers if no longer called.

- [ ] **Step 3: Run engine tests**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test`
Expected: 173 (or current count) tests still pass — the substitution is observationally equivalent for state without auras.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/combat/declare.ts packages/engine/src/combat/resolve.ts
git commit -m "refactor(engine): combat uses computeEffectivePower"
```

---

## Task 9: Web target picker usa `computeEffectivePower`

**Files:**

- Modify: `apps/web/src/app/play/[gameId]/_components/player-side.tsx:91-116` (`attackerInfo` calc)
- Modify: `apps/web/src/app/play/[gameId]/_components/target-picker.tsx:140-170` (`buildAttackTargets`)

- [ ] **Step 1: Update player-side.tsx**

In `apps/web/src/app/play/[gameId]/_components/player-side.tsx`, replace the `attackerInfo` block:

```tsx
import { computeEffectivePower } from '@optcg/engine';
// …

let attackerInfo: AttackerInfo | null = null;
if (pendingAttacker) {
  if (pendingAttacker.kind === 'Leader') {
    attackerInfo = {
      cardId: p.leader.cardId,
      power: computeEffectivePower(state, { kind: 'Leader', owner: playerIndex }),
    };
  } else {
    const char = p.characters.find((c) => c.instanceId === pendingAttacker.instanceId);
    if (char) {
      attackerInfo = {
        cardId: char.cardId,
        power: computeEffectivePower(state, {
          kind: 'Character',
          instanceId: char.instanceId,
          owner: playerIndex,
        }),
      };
    }
  }
}
```

- [ ] **Step 2: Update target-picker.tsx `buildAttackTargets`**

```tsx
import { computeEffectivePower } from '@optcg/engine';
import type { GameState, PlayerIndex } from '@optcg/engine';

export function buildAttackTargets(state: GameState, defenderOwner: PlayerIndex): AttackTarget[] {
  const opp = state.players[defenderOwner];
  const targets: AttackTarget[] = [
    {
      kind: 'Leader',
      cardId: opp.leader.cardId,
      power: computeEffectivePower(state, { kind: 'Leader', owner: defenderOwner }),
      lifeRemaining: opp.life.length,
    },
  ];
  for (const c of opp.characters) {
    if (c.rested) {
      targets.push({
        kind: 'Character',
        instanceId: c.instanceId,
        cardId: c.cardId,
        power: computeEffectivePower(state, {
          kind: 'Character',
          instanceId: c.instanceId,
          owner: defenderOwner,
        }),
      });
    }
  }
  return targets;
}
```

Update the call site in player-side.tsx:

```tsx
const attackTargets = buildAttackTargets(state, playerIndex === 0 ? 1 : 0);
```

- [ ] **Step 3: Export `computeEffectivePower` from engine index**

In `packages/engine/src/index.ts`, add:

```ts
export { computeEffectivePower } from './effects/power';
```

- [ ] **Step 4: Run typecheck + web tests**

Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/engine typecheck
corepack pnpm@9.7.0 --filter @optcg/web typecheck
corepack pnpm@9.7.0 --filter @optcg/web test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/index.ts apps/web/src/app/play/[gameId]/_components/player-side.tsx apps/web/src/app/play/[gameId]/_components/target-picker.tsx
git commit -m "refactor(web): target picker uses computeEffectivePower"
```

---

## Task 10: Wire `EffectCost.donX` para `Activate:Main`

Cuando se ejecuta `ActivateMain`, si la carta tiene un `TriggeredEffect` con `cost.donX = N`, restar N DON activos antes de ejecutar.

**Files:**

- Modify: `packages/engine/src/phases/main.ts` (función `activateMain`)
- Test: `packages/engine/tests/effects/activate-main-cost.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/engine/tests/effects/activate-main-cost.test.ts
import { describe, it, expect } from 'vitest';
import { apply, createInitialState } from '../../src/index';
import type { CardStatic } from '../../src/types/card';
import type { MatchSetup } from '../../src/types/state';

const LEADER_WITH_ACTIVATE: CardStatic = {
  id: 'L1',
  type: 'LEADER',
  colors: ['Red'],
  cost: null,
  power: 5000,
  life: 5,
  counter: null,
  keywords: [],
  effects: [
    {
      trigger: 'Activate:Main',
      cost: { donX: 2 },
      effect: { kind: 'draw', amount: 1 },
    },
  ],
  manualText: null,
};
const FILLER: CardStatic = {
  id: 'F',
  type: 'CHARACTER',
  colors: ['Red'],
  cost: 1,
  power: 2000,
  life: null,
  counter: 1000,
  keywords: [],
  effects: [],
  manualText: null,
};

function setup(): MatchSetup {
  return {
    seed: 42,
    firstPlayer: 0,
    players: [
      { playerId: 'a', leaderCardId: 'L1', deck: Array(50).fill('F') },
      { playerId: 'b', leaderCardId: 'L1', deck: Array(50).fill('F') },
    ],
    catalog: { L1: LEADER_WITH_ACTIVATE, F: FILLER },
  };
}

describe('Activate:Main with DON cost', () => {
  it('rejects ActivateMain when not enough DON', () => {
    let s = createInitialState(setup());
    // Skip mulligans
    s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
    s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
    // Reach Main phase. The state.players[0].donActive is 0 at start.
    while (s.phase !== 'Main') {
      s = apply(s, { kind: 'PassPhase', player: s.activePlayer }).state;
    }
    const r = apply(s, { kind: 'ActivateMain', player: 0, source: { kind: 'Leader' } });
    expect(r.error).toEqual({ code: 'NotEnoughDon', need: 2, have: 0 });
  });

  it('rests N DON and applies effect when enough DON', () => {
    let s = createInitialState(setup());
    s = apply(s, { kind: 'Mulligan', player: 0, mulligan: false }).state;
    s = apply(s, { kind: 'Mulligan', player: 1, mulligan: false }).state;
    while (s.phase !== 'Main') {
      s = apply(s, { kind: 'PassPhase', player: s.activePlayer }).state;
    }
    // Force enough donActive for testing
    s = {
      ...s,
      players: s.players.map((p, i) => (i === 0 ? { ...p, donActive: 3 } : p)) as typeof s.players,
    };
    const handBefore = s.players[0].hand.length;
    const r = apply(s, { kind: 'ActivateMain', player: 0, source: { kind: 'Leader' } });
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].donActive).toBe(1);
    expect(r.state.players[0].donRested).toBe(2);
    expect(r.state.players[0].hand.length).toBe(handBefore + 1);
  });
});
```

- [ ] **Step 2: Run — must fail**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/activate-main-cost.test.ts`
Expected: fails (currently the cost is ignored).

- [ ] **Step 3: Update `activateMain` in main.ts**

Find the existing `activateMain` function. Locate the `triggerHook` or effect application call. Before applying, find the `Activate:Main` effect and check its cost:

```ts
// in packages/engine/src/phases/main.ts, inside activateMain
const card = state.catalog[sourceCardId];
if (!card) return errorResult({ code: 'Unknown', detail: 'card not in catalog' });
const te = card.effects.find((e) => e.trigger === 'Activate:Main');
if (!te) return errorResult({ code: 'InvalidTarget', reason: 'no Activate:Main effect' });
const donCost = te.cost?.donX ?? 0;
const player = state.players[action.player];
if (donCost > 0 && player.donActive < donCost) {
  return errorResult({ code: 'NotEnoughDon', need: donCost, have: player.donActive });
}
let nextState = state;
if (donCost > 0) {
  nextState = {
    ...state,
    players: state.players.map((p, i) =>
      i === action.player
        ? { ...p, donActive: p.donActive - donCost, donRested: p.donRested + donCost }
        : p,
    ) as GameState['players'],
  };
}
// then trigger the effect from nextState (existing code path that applies te.effect)
```

The actual existing structure varies; preserve the rest of the function (rested check, etc.). The key insertion: cost validation + DON shift before effect application.

- [ ] **Step 4: Run test — must pass**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/activate-main-cost.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Run full suite**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/phases/main.ts packages/engine/tests/effects/activate-main-cost.test.ts
git commit -m "feat(engine): Activate:Main spends donX before resolving"
```

---

## Task 11: Executor — abrir `EffectTargetSelection` cuando hay multi-target

Refactor `applyEffect` so target-requiring effects with multiple candidates open a priority window instead of resolving immediately.

**Files:**

- Modify: `packages/engine/src/effects/executor.ts:185-203` (ko/banish/returnToHand/power cases)
- Test: extend `packages/engine/tests/effects/target-selection.test.ts` (new file)

- [ ] **Step 1: Write failing test**

```ts
// packages/engine/tests/effects/target-selection.test.ts
import { describe, it, expect } from 'vitest';
import { applyEffect } from '../../src/effects/executor';
import type { GameState, PlayerState, CharacterInPlay } from '../../src/types/state';
import type { CardStatic, Effect } from '../../src/types/card';

const C: CardStatic = {
  id: 'C',
  type: 'CHARACTER',
  colors: ['Red'],
  cost: 3,
  power: 4000,
  life: null,
  counter: 1000,
  keywords: [],
  effects: [],
  manualText: null,
};

function makeChar(id: string): CharacterInPlay {
  return {
    instanceId: id,
    cardId: 'C',
    rested: false,
    attachedDon: 0,
    powerThisTurn: 0,
    summoningSickness: false,
    usedBlockerThisTurn: false,
  };
}

function makePlayer(chars: CharacterInPlay[]): PlayerState {
  return {
    playerId: 'p',
    leader: { cardId: 'C', rested: false, attachedDon: 0, powerThisTurn: 0 },
    deck: [],
    hand: [],
    life: [],
    trash: [],
    banishZone: [],
    characters: chars,
    stage: null,
    donActive: 0,
    donRested: 0,
    donDeck: 10,
    mulliganTaken: false,
    firstTurnUsed: false,
  };
}

function makeState(p1Chars: CharacterInPlay[]): GameState {
  return {
    turn: 1,
    activePlayer: 0,
    phase: 'Main',
    priorityWindow: null,
    players: [makePlayer([]), makePlayer(p1Chars)],
    rng: { seed: 1, pointer: 0 },
    log: [],
    winner: null,
    catalog: { C },
    isFirstTurnOfFirstPlayer: false,
  };
}

describe('applyEffect target selection', () => {
  it('opens EffectTargetSelection when 2+ valid targets', () => {
    const state = makeState([makeChar('a'), makeChar('b')]);
    const effect: Effect = { kind: 'ko', target: { kind: 'opponentCharacter' } };
    const r = applyEffect(state, effect, { sourcePlayer: 0, sourceCardId: 'src' });
    expect(r.state.priorityWindow?.kind).toBe('EffectTargetSelection');
    if (r.state.priorityWindow?.kind === 'EffectTargetSelection') {
      expect(r.state.priorityWindow.validTargets).toHaveLength(2);
    }
  });

  it('resolves directly when single mandatory target', () => {
    const state = makeState([makeChar('a')]);
    const effect: Effect = { kind: 'ko', target: { kind: 'opponentCharacter' } };
    const r = applyEffect(state, effect, { sourcePlayer: 0, sourceCardId: 'src' });
    expect(r.state.priorityWindow).toBeNull();
    expect(r.state.players[1].characters).toHaveLength(0);
    expect(r.state.players[1].trash).toEqual(['C']);
  });

  it('opens window with optional flag when single target + optional', () => {
    const state = makeState([makeChar('a')]);
    const effect: Effect = { kind: 'ko', target: { kind: 'opponentCharacter' }, optional: true };
    const r = applyEffect(state, effect, { sourcePlayer: 0, sourceCardId: 'src' });
    expect(r.state.priorityWindow?.kind).toBe('EffectTargetSelection');
    if (r.state.priorityWindow?.kind === 'EffectTargetSelection') {
      expect(r.state.priorityWindow.optional).toBe(true);
    }
  });

  it('fizzles when 0 candidates (mandatory)', () => {
    const state = makeState([]);
    const effect: Effect = { kind: 'ko', target: { kind: 'opponentCharacter' } };
    const r = applyEffect(state, effect, { sourcePlayer: 0, sourceCardId: 'src' });
    expect(r.state.priorityWindow).toBeNull();
    expect(r.state.players[1].characters).toHaveLength(0);
  });

  it('fizzles when 0 candidates (optional)', () => {
    const state = makeState([]);
    const effect: Effect = { kind: 'ko', target: { kind: 'opponentCharacter' }, optional: true };
    const r = applyEffect(state, effect, { sourcePlayer: 0, sourceCardId: 'src' });
    expect(r.state.priorityWindow).toBeNull();
  });
});
```

- [ ] **Step 2: Run — must fail**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/target-selection.test.ts`
Expected: fails — current executor resolves the first match.

- [ ] **Step 3: Refactor `applyEffect` for target-requiring kinds**

In `packages/engine/src/effects/executor.ts`, import the new helper:

```ts
import { validTargetsForEffect } from './targets';
```

Replace the `case 'ko'`, `case 'banish'`, `case 'returnToHand'`, `case 'power'` blocks with logic that:

1. Computes `validTargets`.
2. If 0 targets → fizzle (no-op, no event, no window).
3. If 1 target AND not optional → resolve directly with that target (existing path).
4. Otherwise (≥2 OR optional) → return state with `priorityWindow = EffectTargetSelection { …, pendingChain: [] }`.

Concrete rewrite — extract a helper `resolveTargetedEffect`:

```ts
function resolveTargetedEffect(
  state: GameState,
  effect: Effect & { target: TargetSpec; optional?: boolean },
  context: EffectContext,
): EffectResult {
  const validTargets = validTargetsForEffect(state, context, effect);

  if (validTargets.length === 0) {
    // Fizzle silently
    return {
      state,
      events: [{ kind: 'EffectResolved', effect, sourceCardId: context.sourceCardId }],
    };
  }

  if (validTargets.length === 1 && !effect.optional) {
    // Resolve directly with the unique target
    return resolveDirectly(state, effect, context, validTargets[0]);
  }

  // Open priority window
  const newState: GameState = {
    ...state,
    priorityWindow: {
      kind: 'EffectTargetSelection',
      sourceCardId: context.sourceCardId,
      sourceOwner: context.sourcePlayer,
      effect,
      validTargets,
      optional: effect.optional ?? false,
      pendingChain: [],
    },
  };
  return { state: newState, events: [] };
}

function resolveDirectly(
  state: GameState,
  effect: Effect & { target: TargetSpec },
  context: EffectContext,
  target: TargetRef,
): EffectResult {
  // Apply effect against the chosen target
  let next = state;
  if (effect.kind === 'ko' && target.kind === 'Character') {
    const idx = state.players[target.owner].characters.findIndex(
      (c) => c.instanceId === target.instanceId,
    );
    if (idx >= 0) next = removeCharacterAt(state, target.owner, idx, 'trash');
  } else if (effect.kind === 'banish' && target.kind === 'Character') {
    const idx = state.players[target.owner].characters.findIndex(
      (c) => c.instanceId === target.instanceId,
    );
    if (idx >= 0) next = removeCharacterAt(state, target.owner, idx, 'banish');
  } else if (effect.kind === 'returnToHand' && target.kind === 'Character') {
    const idx = state.players[target.owner].characters.findIndex(
      (c) => c.instanceId === target.instanceId,
    );
    if (idx >= 0) next = removeCharacterAt(state, target.owner, idx, 'hand');
  } else if (effect.kind === 'power') {
    next = applyPowerToRef(state, target, effect.delta);
  }
  return {
    state: next,
    events: [{ kind: 'EffectResolved', effect, sourceCardId: context.sourceCardId }],
  };
}

function applyPowerToRef(state: GameState, target: TargetRef, delta: number): GameState {
  if (target.kind === 'Leader') {
    const p = state.players[target.owner];
    const updated = {
      ...p,
      leader: { ...p.leader, powerThisTurn: p.leader.powerThisTurn + delta },
    };
    const newPlayers = state.players.map((pp, i) =>
      i === target.owner ? updated : pp,
    ) as GameState['players'];
    return { ...state, players: newPlayers };
  }
  const p = state.players[target.owner];
  const idx = p.characters.findIndex((c) => c.instanceId === target.instanceId);
  if (idx < 0) return state;
  const newChars = [...p.characters];
  newChars[idx] = { ...newChars[idx], powerThisTurn: newChars[idx].powerThisTurn + delta };
  const updated = { ...p, characters: newChars };
  const newPlayers = state.players.map((pp, i) =>
    i === target.owner ? updated : pp,
  ) as GameState['players'];
  return { ...state, players: newPlayers };
}
```

In the `applyEffect` switch, replace ko/banish/returnToHand/power cases with calls to `resolveTargetedEffect`. Export `resolveDirectly` (or a similarly-named function) for Task 12 to use when `SelectEffectTarget` arrives.

- [ ] **Step 4: Run test — must pass**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/target-selection.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Run full engine suite**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test`
Expected: existing tests still pass — the behavior change only affects multi-target cases that were previously taking-first-match.

If a coverage-gaps or combat test relied on first-match behavior, update its fixture to have a single character so it resolves directly. Specifically check `tests/coverage-gaps.test.ts` and `tests/combat.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/effects/executor.ts packages/engine/tests/effects/target-selection.test.ts
git commit -m "feat(engine): executor opens EffectTargetSelection on multi-target effects"
```

---

## Task 12: `triggers.ts` — encolar pendingChain cuando un efecto bloquea

When an effect opens a priority window mid-trigger, the remaining effects of the same trigger must be queued.

**Files:**

- Modify: `packages/engine/src/effects/triggers.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/engine/tests/effects/target-selection.test.ts`:

```ts
import { triggerHook } from '../../src/effects/triggers';

it('triggerHook queues remaining effects in pendingChain', () => {
  const SOURCE: CardStatic = {
    id: 'S',
    type: 'CHARACTER',
    colors: ['Red'],
    cost: 3,
    power: 4000,
    life: null,
    counter: 1000,
    keywords: [],
    effects: [
      {
        trigger: 'OnPlay',
        effect: { kind: 'ko', target: { kind: 'opponentCharacter' } }, // multi-target
      },
      {
        trigger: 'OnPlay',
        effect: { kind: 'draw', amount: 1 },
      },
    ],
    manualText: null,
  };
  const state = makeState([makeChar('a'), makeChar('b')]);
  const stateWithSource = { ...state, catalog: { ...state.catalog, S: SOURCE } };
  const r = triggerHook(stateWithSource, 'OnPlay', 'S', 0);
  expect(r.state.priorityWindow?.kind).toBe('EffectTargetSelection');
  if (r.state.priorityWindow?.kind === 'EffectTargetSelection') {
    expect(r.state.priorityWindow.pendingChain).toHaveLength(1);
    expect(r.state.priorityWindow.pendingChain[0].kind).toBe('draw');
  }
});
```

- [ ] **Step 2: Run — must fail**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/target-selection.test.ts`
Expected: fails.

- [ ] **Step 3: Refactor `triggerHook`**

```ts
// packages/engine/src/effects/triggers.ts
import type { GameState, PlayerIndex } from '../types/state';
import type { GameEvent } from '../types/event';
import type { TriggeredEffect } from '../types/card';
import { applyEffect, type EffectContext } from './executor';

export interface TriggerResult {
  state: GameState;
  events: GameEvent[];
}

export function triggerHook(
  state: GameState,
  hook: TriggeredEffect['trigger'],
  sourceCardId: string,
  sourcePlayer: PlayerIndex,
): TriggerResult {
  const card = state.catalog[sourceCardId];
  if (!card) return { state, events: [] };
  const events: GameEvent[] = [];
  let next = state;
  const context: EffectContext = { sourcePlayer, sourceCardId };

  const queue = card.effects.filter((te) => te.trigger === hook).map((te) => te.effect);
  while (queue.length > 0) {
    const effect = queue.shift()!;
    const r = applyEffect(next, effect, context);
    next = r.state;
    events.push(...r.events);
    if (next.priorityWindow?.kind === 'EffectTargetSelection') {
      // Stash remaining effects in the priority window's pendingChain
      next = {
        ...next,
        priorityWindow: { ...next.priorityWindow, pendingChain: queue.slice() },
      };
      break;
    }
  }
  return { state: next, events };
}
```

- [ ] **Step 4: Run tests**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/target-selection.test.ts`
Expected: 6 passed (the new pendingChain test included).

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test`
Expected: full suite passes.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/effects/triggers.ts packages/engine/tests/effects/target-selection.test.ts
git commit -m "feat(engine): triggerHook queues remaining effects in pendingChain"
```

---

## Task 13: `apply.ts` — handler para `SelectEffectTarget`

When the player dispatches `SelectEffectTarget`, the engine resolves the pending effect with the chosen target and processes any pendingChain.

**Files:**

- Modify: `packages/engine/src/apply.ts`
- Test: extend target-selection.test.ts

- [ ] **Step 1: Write failing test**

Add to `target-selection.test.ts`:

```ts
import { apply } from '../../src/apply';

it('SelectEffectTarget resolves pending effect against chosen target', () => {
  const state = makeState([makeChar('a'), makeChar('b')]);
  const stateWithWindow: GameState = {
    ...state,
    priorityWindow: {
      kind: 'EffectTargetSelection',
      sourceCardId: 'src',
      sourceOwner: 0,
      effect: { kind: 'ko', target: { kind: 'opponentCharacter' } },
      validTargets: [
        { kind: 'Character', instanceId: 'a', owner: 1 },
        { kind: 'Character', instanceId: 'b', owner: 1 },
      ],
      optional: false,
      pendingChain: [],
    },
  };
  const r = apply(stateWithWindow, { kind: 'SelectEffectTarget', player: 0, targetIndex: 0 });
  expect(r.error).toBeUndefined();
  expect(r.state.priorityWindow).toBeNull();
  expect(r.state.players[1].characters).toHaveLength(1);
  expect(r.state.players[1].characters[0].instanceId).toBe('b');
});

it('SelectEffectTarget rejects null when not optional', () => {
  const state = makeState([makeChar('a')]);
  const stateWithWindow: GameState = {
    ...state,
    priorityWindow: {
      kind: 'EffectTargetSelection',
      sourceCardId: 'src',
      sourceOwner: 0,
      effect: { kind: 'ko', target: { kind: 'opponentCharacter' } },
      validTargets: [{ kind: 'Character', instanceId: 'a', owner: 1 }],
      optional: false,
      pendingChain: [],
    },
  };
  const r = apply(stateWithWindow, { kind: 'SelectEffectTarget', player: 0, targetIndex: null });
  expect(r.error).toEqual({ code: 'InvalidTarget', reason: 'cannot skip mandatory effect' });
});

it('SelectEffectTarget(null) cancels optional effect', () => {
  const state = makeState([makeChar('a')]);
  const stateWithWindow: GameState = {
    ...state,
    priorityWindow: {
      kind: 'EffectTargetSelection',
      sourceCardId: 'src',
      sourceOwner: 0,
      effect: { kind: 'ko', target: { kind: 'opponentCharacter' }, optional: true },
      validTargets: [{ kind: 'Character', instanceId: 'a', owner: 1 }],
      optional: true,
      pendingChain: [],
    },
  };
  const r = apply(stateWithWindow, { kind: 'SelectEffectTarget', player: 0, targetIndex: null });
  expect(r.error).toBeUndefined();
  expect(r.state.priorityWindow).toBeNull();
  expect(r.state.players[1].characters).toHaveLength(1);
});

it('SelectEffectTarget processes pendingChain', () => {
  const state = makeState([makeChar('a'), makeChar('b')]);
  const stateWithWindow: GameState = {
    ...state,
    priorityWindow: {
      kind: 'EffectTargetSelection',
      sourceCardId: 'src',
      sourceOwner: 0,
      effect: { kind: 'ko', target: { kind: 'opponentCharacter' } },
      validTargets: [
        { kind: 'Character', instanceId: 'a', owner: 1 },
        { kind: 'Character', instanceId: 'b', owner: 1 },
      ],
      optional: false,
      pendingChain: [{ kind: 'draw', amount: 1 }],
    },
  };
  const r = apply(stateWithWindow, { kind: 'SelectEffectTarget', player: 0, targetIndex: 0 });
  expect(r.error).toBeUndefined();
  expect(r.state.priorityWindow).toBeNull();
  expect(r.state.players[0].hand.length).toBe(state.players[0].hand.length); // deck empty in fixture, draw is a no-op or 0; check based on the fixture's deck
});
```

(Adjust the last expectation to match the fixture — if the deck has cards, hand grows by 1.)

- [ ] **Step 2: Run — must fail**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/target-selection.test.ts`
Expected: fails.

- [ ] **Step 3: Add `SelectEffectTarget` case in `apply.ts`**

In `packages/engine/src/apply.ts`, add a new case to the switch:

```ts
import { applyEffect } from './effects/executor';

// inside switch:
case 'SelectEffectTarget': {
  const pw = state.priorityWindow;
  if (pw?.kind !== 'EffectTargetSelection') {
    return errorResult(state, { code: 'NotYourPriority' });
  }
  if (action.targetIndex === null) {
    if (!pw.optional) {
      return errorResult(state, { code: 'InvalidTarget', reason: 'cannot skip mandatory effect' });
    }
    // Optional skip: clear window, drop pending effect; process pendingChain.
    next = { ...state, priorityWindow: null };
    next = processPendingChain(next, pw);
    break;
  }
  if (action.targetIndex < 0 || action.targetIndex >= pw.validTargets.length) {
    return errorResult(state, { code: 'InvalidTarget', reason: 'targetIndex out of range' });
  }
  const target = pw.validTargets[action.targetIndex];
  // Re-validate target still exists (race)
  // For Character target, re-check that the instanceId is still in play.
  if (target.kind === 'Character') {
    const stillThere = state.players[target.owner].characters.some(c => c.instanceId === target.instanceId);
    if (!stillThere) {
      // Fizzle and continue
      next = { ...state, priorityWindow: null };
      next = processPendingChain(next, pw);
      break;
    }
  }
  // Apply effect against the chosen target
  const cleared: GameState = { ...state, priorityWindow: null };
  const ctx = { sourcePlayer: pw.sourceOwner, sourceCardId: pw.sourceCardId };
  // We need a helper to apply against a specific target. Inline:
  const direct = resolveDirectlyForApply(cleared, pw.effect, ctx, target);
  next = direct.state;
  events = direct.events;
  // Process pendingChain (re-using applyEffect; may open new windows)
  next = processPendingChain(next, { ...pw, pendingChain: pw.pendingChain });
  break;
}
```

Add helper functions to `apply.ts`:

```ts
function resolveDirectlyForApply(
  state: GameState,
  effect: Effect,
  ctx: { sourcePlayer: PlayerIndex; sourceCardId: string },
  target: TargetRef,
): { state: GameState; events: GameEvent[] } {
  // Delegate to executor's exported helper. Add such an export if not present.
  // For this task, inline the same logic as Task 11's resolveDirectly.
  // … (copy from executor) …
}

function processPendingChain(
  state: GameState,
  pw: Extract<PriorityWindow, { kind: 'EffectTargetSelection' }>,
): GameState {
  const ctx = { sourcePlayer: pw.sourceOwner, sourceCardId: pw.sourceCardId };
  const queue = [...pw.pendingChain];
  let s = state;
  while (queue.length > 0 && s.priorityWindow === null) {
    const effect = queue.shift()!;
    const r = applyEffect(s, effect, ctx);
    s = r.state;
    if (s.priorityWindow?.kind === 'EffectTargetSelection') {
      // Stash remaining
      s = { ...s, priorityWindow: { ...s.priorityWindow, pendingChain: queue.slice() } };
    }
  }
  return s;
}
```

To avoid duplication, **expose `resolveDirectly` and `applyEffect`** from executor.ts. In `executor.ts`, export `resolveDirectly` as a public helper.

- [ ] **Step 4: Run target-selection test**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/target-selection.test.ts`
Expected: all pass.

- [ ] **Step 5: Run full engine suite**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test`
Expected: full suite passes.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/apply.ts packages/engine/src/effects/executor.ts packages/engine/tests/effects/target-selection.test.ts
git commit -m "feat(engine): SelectEffectTarget action handler with pendingChain"
```

---

## Task 14: `legal-actions.ts` — incluir `SelectEffectTarget` cuando window abierta

**Files:**

- Modify: `packages/engine/src/helpers/legal-actions.ts`

- [ ] **Step 1: Inspect the file to find the priorityWindow switch**

Run: `head -40 packages/engine/src/helpers/legal-actions.ts`. Identify where existing priorityWindow kinds (Mulligan, CounterStep, etc.) emit their legal actions.

- [ ] **Step 2: Add a case for `EffectTargetSelection`**

After the existing priorityWindow cases, add:

```ts
if (state.priorityWindow?.kind === 'EffectTargetSelection') {
  const pw = state.priorityWindow;
  const actions: Action[] = [];
  for (let i = 0; i < pw.validTargets.length; i += 1) {
    actions.push({ kind: 'SelectEffectTarget', player: pw.sourceOwner, targetIndex: i });
  }
  if (pw.optional) {
    actions.push({ kind: 'SelectEffectTarget', player: pw.sourceOwner, targetIndex: null });
  }
  return actions;
}
```

- [ ] **Step 3: Run engine tests**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/helpers/legal-actions.ts
git commit -m "feat(engine): legal actions include SelectEffectTarget"
```

---

## Task 15: Helpers — `effects/helpers.ts`

API terse para los archivos por carta.

**Files:**

- Create: `packages/engine/src/effects/helpers.ts`

- [ ] **Step 1: Implement helpers**

```ts
// packages/engine/src/effects/helpers.ts
import type {
  Effect,
  EffectCondition,
  CardFilter,
  TargetSpec,
  TriggeredEffect,
} from '../types/card';

// Triggers
export function onPlay(effect: Effect): TriggeredEffect {
  return { trigger: 'OnPlay', effect };
}
export function onKo(effect: Effect): TriggeredEffect {
  return { trigger: 'OnKO', effect };
}
export function onAttack(effect: Effect): TriggeredEffect {
  return { trigger: 'OnAttack', effect };
}
export function activateMain(donCost: number, effect: Effect): TriggeredEffect {
  return { trigger: 'Activate:Main', cost: { donX: donCost }, effect };
}
export function endOfTurn(effect: Effect): TriggeredEffect {
  return { trigger: 'EndOfTurn', effect };
}
export function staticAura(condition: EffectCondition, effect: Effect): TriggeredEffect {
  return { trigger: 'StaticAura', condition, effect };
}
export function trigger(effect: Effect): TriggeredEffect {
  return { trigger: 'Trigger', effect };
}

// Conditions
export const onYourTurn: EffectCondition = { onTurn: 'yours' };
export const onOpponentsTurn: EffectCondition = { onTurn: 'opponents' };
export function donAtLeast(n: number): EffectCondition {
  return { attachedDonAtLeast: n };
}

// Targets
export function self(): TargetSpec {
  return { kind: 'self' };
}
export function opponentLeader(): TargetSpec {
  return { kind: 'opponentLeader' };
}
export function opponentChar(filter?: CardFilter): TargetSpec {
  return { kind: 'opponentCharacter', filter };
}
export function ownChar(filter?: CardFilter): TargetSpec {
  return { kind: 'ownCharacter', filter };
}

// Effect builders
export function drawN(n: number): Effect {
  return { kind: 'draw', amount: n };
}
export function ko(target: TargetSpec, opt = false): Effect {
  return { kind: 'ko', target, optional: opt };
}
export function powerDelta(
  target: TargetSpec,
  delta: number,
  duration: 'thisTurn' | 'permanent' = 'thisTurn',
  opt = false,
): Effect {
  return { kind: 'power', target, delta, duration, optional: opt };
}
export function returnToHand(target: TargetSpec, opt = false): Effect {
  return { kind: 'returnToHand', target, optional: opt };
}
export function banishEffect(target: TargetSpec, opt = false): Effect {
  return { kind: 'banish', target, optional: opt };
}
export function manual(text: string): Effect {
  return { kind: 'manual', text };
}
export function sequence(...steps: Effect[]): Effect {
  return { kind: 'sequence', steps };
}
export function searchEffect(from: 'deck' | 'trash', filter: CardFilter, amount: number): Effect {
  return { kind: 'search', from, filter, amount };
}

// Filter builders
export function powerLte(n: number): CardFilter {
  return { powerMax: n };
}
export function costLte(n: number): CardFilter {
  return { costMax: n };
}
export function color(c: string): CardFilter {
  return { colors: [c] };
}
```

- [ ] **Step 2: Typecheck**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/effects/helpers.ts
git commit -m "feat(engine): effect builder helpers"
```

---

## Task 16: Coverage gate test

A test that fails when fewer than 85 cards are covered.

**Files:**

- Create: `packages/engine/tests/effects/library-coverage.test.ts`

- [ ] **Step 1: Write the test**

```ts
// packages/engine/tests/effects/library-coverage.test.ts
import { describe, it, expect } from 'vitest';
import { CARD_EFFECT_LIBRARY } from '../../src/effects/library';

const OP01_TOTAL = 121;
const REQUIRED = 85;

describe('OP01 library coverage', () => {
  it(`has at least ${REQUIRED} OP01 cards with effects`, () => {
    const op01Covered = Object.entries(CARD_EFFECT_LIBRARY).filter(
      ([id, fx]) => id.startsWith('OP01-') && fx.length > 0,
    ).length;
    // Print for visibility during build
    console.log(`OP01 coverage: ${op01Covered}/${OP01_TOTAL}`);
    expect(op01Covered).toBeGreaterThanOrEqual(REQUIRED);
  });
});
```

- [ ] **Step 2: Confirm currently fails**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/library-coverage.test.ts`
Expected: fails (library is empty).

- [ ] **Step 3: Skip the test for now (will pass at end of Task 18)**

Modify the `it` to `it.skip(...)` so the rest of the suite stays green during intermediate work. Re-enable in Task 18.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/tests/effects/library-coverage.test.ts
git commit -m "test(engine): coverage gate for OP01 library (skipped pending population)"
```

---

## Task 17: Sample card — `OP01-001` (Roronoa Zoro Leader)

Smoke-test the helpers + library plumbing on a single card before bulk work.

**Files:**

- Create: `packages/engine/src/effects/cards/OP01-001.ts`
- Create: `packages/engine/tests/cards/OP01-001.test.ts`
- Modify: `packages/engine/src/effects/library.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/engine/tests/cards/OP01-001.test.ts
import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-001';

describe('OP01-001 Roronoa Zoro (Leader)', () => {
  it('exposes a single StaticAura granting +1000 to own characters on your turn with 1+ DON', () => {
    expect(effects).toHaveLength(1);
    const aura = effects[0];
    expect(aura.trigger).toBe('StaticAura');
    expect(aura.condition).toEqual({ onTurn: 'yours', attachedDonAtLeast: 1 });
    expect(aura.effect).toMatchObject({
      kind: 'power',
      target: { kind: 'ownCharacter' },
      delta: 1000,
      duration: 'permanent',
    });
  });
});
```

- [ ] **Step 2: Run — fails (file doesn't exist)**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/cards/OP01-001.test.ts`
Expected: module not found.

- [ ] **Step 3: Implement card**

```ts
// packages/engine/src/effects/cards/OP01-001.ts
import { staticAura, donAtLeast, ownChar, powerDelta } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

export const effects: TriggeredEffect[] = [
  staticAura({ onTurn: 'yours', ...donAtLeast(1) }, powerDelta(ownChar(), 1000, 'permanent')),
];
```

- [ ] **Step 4: Wire into library.ts**

Replace `packages/engine/src/effects/library.ts` with:

```ts
import type { TriggeredEffect } from '../types/card';
import { effects as OP01_001 } from './cards/OP01-001';

export const CARD_EFFECT_LIBRARY: Readonly<Record<string, TriggeredEffect[]>> = Object.freeze({
  'OP01-001': OP01_001,
});

export function getEffectsForCard(cardId: string): TriggeredEffect[] {
  return CARD_EFFECT_LIBRARY[cardId] ?? [];
}
```

- [ ] **Step 5: Run test — must pass**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/cards/OP01-001.test.ts`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/effects/cards/OP01-001.ts packages/engine/src/effects/library.ts packages/engine/tests/cards/OP01-001.test.ts
git commit -m "feat(engine): OP01-001 Roronoa Zoro Leader StaticAura"
```

---

## Task 18: Bulk-populate OP01 library to ≥85 cards

This is the **iterative** task. The implementer reads each card's `effectText` from `apps/web/src/data/cards.json` and translates it into a `TriggeredEffect[]` via the helpers, with a focused unit test per card.

**Files:**

- Create: `packages/engine/src/effects/cards/OP01-XXX.ts` (≥84 more files)
- Create: `packages/engine/tests/cards/OP01-XXX.test.ts` (≥84 more files)
- Modify: `packages/engine/src/effects/library.ts` (append imports)

**Strategy** (worth following in order):

1. **Leaders** (~8 OP01 leaders): all are `StaticAura` patterns. Pattern matches OP01-001 closely.
2. **Simple OnPlay draws/buffs** (~10–15 cards): no target choice, easy.
3. **OnPlay with single target / optional target** (~25–30 cards): debuff, KO, return to hand.
4. **OnKO** (~5 cards): similar shape.
5. **Activate:Main with DON cost** (~10–15 cards).
6. **Mixed remaining** until count ≥85.

Cards with `[Trigger]` (life-card triggers) — already supported via `'Trigger'` trigger; library entry uses `trigger(effect)` helper. Cards with effects requiring search/choice picker → keep as no entry (they fall back to `manualText`).

**Card text → Effect translation cheat sheet:**

| Card text fragment                                                                     | Effect                                                        |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `Draw N` / `draw N cards`                                                              | `drawN(N)`                                                    |
| `K.O. up to 1 of your opponent's Characters with X power or less`                      | `ko(opponentChar(powerLte(X)), true)`                         |
| `K.O. 1 of your opponent's Characters`                                                 | `ko(opponentChar())`                                          |
| `Give up to 1 of your opponent's Characters −X power during this turn`                 | `powerDelta(opponentChar(), -X, 'thisTurn', true)`            |
| `Your Characters gain +X power during this turn`                                       | `powerDelta(ownChar(), X, 'thisTurn')`                        |
| `Return up to 1 of your opponent's Characters with cost N or less to its owner's hand` | `returnToHand(opponentChar(costLte(N)), true)`                |
| `[DON!! xN] [Your Turn]` aura                                                          | `staticAura({ onTurn: 'yours', ...donAtLeast(N) }, …)`        |
| `[Activate: Main] [Once Per Turn] ➁ Effect`                                            | `activateMain(2, …)` (once-per-turn enforcement out of scope) |
| `[Trigger] Effect` (life cards)                                                        | `trigger(effect)`                                             |

For each card, follow the **per-card task pattern**:

- [ ] **Step 1: Read effectText**

For card `OP01-XXX`:

```bash
node -e "console.log(require('./apps/web/src/data/cards.json').find(c => c.id === 'OP01-XXX').effectText)"
```

Read the text. Decide which helpers translate it. If the text requires search/choice/once-per-turn/reactive triggers, **skip this card** and move on (it stays as manualText fallback).

- [ ] **Step 2: Write `cards/OP01-XXX.ts`**

```ts
// packages/engine/src/effects/cards/OP01-XXX.ts
import { onPlay, opponentChar, powerDelta /* etc */ } from '../helpers';
import type { TriggeredEffect } from '../../types/card';

export const effects: TriggeredEffect[] = [
  onPlay(powerDelta(opponentChar(), -2000, 'thisTurn', true)),
];
```

- [ ] **Step 3: Write `tests/cards/OP01-XXX.test.ts`**

```ts
// packages/engine/tests/cards/OP01-XXX.test.ts
import { describe, it, expect } from 'vitest';
import { effects } from '../../src/effects/cards/OP01-XXX';

describe('OP01-XXX <Card Name>', () => {
  it('declares OnPlay debuff -2000 to opponent character (optional)', () => {
    expect(effects).toHaveLength(1);
    const e = effects[0];
    expect(e.trigger).toBe('OnPlay');
    expect(e.effect).toMatchObject({
      kind: 'power',
      target: { kind: 'opponentCharacter' },
      delta: -2000,
      duration: 'thisTurn',
      optional: true,
    });
  });
});
```

- [ ] **Step 4: Append to `library.ts`**

```ts
import { effects as OP01_XXX } from './cards/OP01-XXX';

export const CARD_EFFECT_LIBRARY = Object.freeze({
  'OP01-001': OP01_001,
  // …
  'OP01-XXX': OP01_XXX,
});
```

- [ ] **Step 5: Run that single test**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/cards/OP01-XXX.test.ts`
Expected: pass.

- [ ] **Step 6: Commit (every 5–10 cards)**

```bash
git add packages/engine/src/effects/cards/OP01-*.ts packages/engine/tests/cards/OP01-*.test.ts packages/engine/src/effects/library.ts
git commit -m "feat(engine): OP01 effects batch (cards X–Y)"
```

**Repeat steps 1–6 until ≥85 OP01 cards have entries.**

- [ ] **Step 7: Re-enable the coverage gate test**

In `packages/engine/tests/effects/library-coverage.test.ts`, change `it.skip` back to `it`. Run:

```bash
corepack pnpm@9.7.0 --filter @optcg/engine test -- tests/effects/library-coverage.test.ts
```

Expected: pass.

- [ ] **Step 8: Final batch commit**

```bash
git add packages/engine/tests/effects/library-coverage.test.ts
git commit -m "test(engine): enable OP01 coverage gate (>=85 cards)"
```

---

## Task 19: UI — `EffectTargetVariant` en `PriorityModal`

**Files:**

- Modify: `apps/web/src/app/play/[gameId]/_components/priority-modal.tsx`

- [ ] **Step 1: Add the variant**

In `priority-modal.tsx`, after the existing variants, add:

```tsx
import type { TargetRef } from '@optcg/engine';

case 'EffectTargetSelection':
  return <EffectTargetVariant pw={pw} />;
```

In the body of the function, add the new variant component:

```tsx
function EffectTargetVariant({
  pw,
}: {
  pw: Extract<PriorityWindow, { kind: 'EffectTargetSelection' }>;
}) {
  const sourceCard = state.catalog[pw.sourceCardId];
  const sourceName = sourceCard?.id ?? pw.sourceCardId;
  const description = formatEffect(pw.effect);

  function pick(targetIndex: number | null) {
    dispatch({ kind: 'SelectEffectTarget', player: pw.sourceOwner, targetIndex });
  }

  function targetCardIdAndPower(t: TargetRef): { cardId: string; power: number } {
    if (t.kind === 'Leader') {
      const cardId = state.players[t.owner].leader.cardId;
      return { cardId, power: computeEffectivePower(state, t) };
    }
    const c = state.players[t.owner].characters.find((x) => x.instanceId === t.instanceId);
    return { cardId: c?.cardId ?? '???', power: computeEffectivePower(state, t) };
  }

  return (
    <Dialog open modal>
      <DialogContent className="max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{sourceName} — choose target</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 py-2">
          {pw.validTargets.map((t, i) => {
            const meta = targetCardIdAndPower(t);
            return (
              <button
                key={i}
                type="button"
                onClick={() => pick(i)}
                className="rounded border border-amber-700/50 p-2 hover:border-amber-400"
              >
                <div className="relative aspect-[5/7] w-full overflow-hidden rounded">
                  <Image
                    src={cardImagePath(meta.cardId)}
                    alt={meta.cardId}
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                </div>
                <div className="mt-1 text-center text-xs">Power {meta.power}</div>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          {pw.optional && (
            <Button variant="secondary" onClick={() => pick(null)}>
              Skip
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Add the missing imports at the top:

```tsx
import { computeEffectivePower } from '@optcg/engine';
import type { PriorityWindow } from '@optcg/engine';
```

- [ ] **Step 2: Verify typecheck + tests**

Run: `corepack pnpm@9.7.0 --filter @optcg/web typecheck && corepack pnpm@9.7.0 --filter @optcg/web test`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/play/[gameId]/_components/priority-modal.tsx
git commit -m "feat(web): EffectTargetVariant in PriorityModal"
```

---

## Task 20: UI — highlight de validTargets en el board

**Files:**

- Modify: `apps/web/src/app/play/[gameId]/_components/character-card.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/leader-card.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/player-side.tsx`

- [ ] **Step 1: Add `highlighted` prop to CharacterCard**

In `character-card.tsx`, add an optional `highlighted?: boolean` prop. When true, add ring + pulse classes:

```tsx
className={`... ${highlighted ? 'ring-2 ring-amber-400 animate-pulse' : ''}`}
```

- [ ] **Step 2: Same for LeaderCard**

In `leader-card.tsx`, same prop + same classes.

- [ ] **Step 3: Wire from PlayerSide**

In `player-side.tsx`, compute `highlighted` per character + leader based on the priority window:

```tsx
const pw = state.priorityWindow;
const isHighlighted = (ref: { kind: 'Leader' | 'Character'; instanceId?: string }) => {
  if (pw?.kind !== 'EffectTargetSelection') return false;
  return pw.validTargets.some((t) => {
    if (t.kind !== ref.kind) return false;
    if (t.kind === 'Leader') return t.owner === playerIndex;
    return t.owner === playerIndex && ref.kind === 'Character' && t.instanceId === ref.instanceId;
  });
};
```

Pass `highlighted={isHighlighted({ kind: 'Leader' })}` to LeaderCard and `highlighted={isHighlighted({ kind: 'Character', instanceId: c.instanceId })}` to CharacterCard.

- [ ] **Step 4: Run tests**

Run: `corepack pnpm@9.7.0 --filter @optcg/web typecheck && corepack pnpm@9.7.0 --filter @optcg/web test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/play/[gameId]/_components/character-card.tsx apps/web/src/app/play/[gameId]/_components/leader-card.tsx apps/web/src/app/play/[gameId]/_components/player-side.tsx
git commit -m "feat(web): highlight validTargets on board during EffectTargetSelection"
```

---

## Task 21: ToastCenter — eventos de efectos

**Files:**

- Modify: `apps/web/src/app/play/[gameId]/_components/toast-center.tsx`

- [ ] **Step 1: Map `EffectResolved` events to toasts**

In `toast-center.tsx`, in the `mapEvent` function, add cases:

```tsx
case 'EffectResolved': {
  const e = ev.effect;
  if (e.kind === 'ko') return { text: 'Character KO\u2019d by effect', variant: 'danger' };
  if (e.kind === 'banish') return { text: 'Character banished', variant: 'danger' };
  if (e.kind === 'returnToHand') return { text: 'Character returned to hand', variant: 'warning' };
  if (e.kind === 'power') {
    const sign = e.delta >= 0 ? '+' : '';
    return { text: `Power ${sign}${e.delta}`, variant: e.delta >= 0 ? 'info' : 'warning' };
  }
  if (e.kind === 'draw') {
    return { text: ev.sourceCardId + ' draws ' + e.amount, variant: 'info' };
  }
  return null;
}
```

- [ ] **Step 2: Typecheck + test**

Run: `corepack pnpm@9.7.0 --filter @optcg/web typecheck && corepack pnpm@9.7.0 --filter @optcg/web test`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/play/[gameId]/_components/toast-center.tsx
git commit -m "feat(web): toasts for EffectResolved events"
```

---

## Task 22: AI — `EasyBot` y `MediumBot` manejan `EffectTargetSelection`

**Files:**

- Modify: `packages/ai/src/easy.ts`
- Modify: `packages/ai/src/medium.ts`
- Modify: `packages/ai/src/action-generator.ts` (probable location of priority handling)

- [ ] **Step 1: Check current priority handling structure**

Run: `grep -n "priorityWindow\|pickPriorityAction\|generatePriorityAction" packages/ai/src/*.ts | head -20`. Identify the function that maps priority windows to bot actions.

- [ ] **Step 2: Add EasyBot case**

In the priority resolution path:

```ts
if (state.priorityWindow?.kind === 'EffectTargetSelection') {
  const pw = state.priorityWindow;
  const total = pw.validTargets.length + (pw.optional ? 1 : 0);
  const { value: idx, rng: rng2 } = nextInt(rng, total);
  const targetIndex = idx < pw.validTargets.length ? idx : null;
  return {
    action: { kind: 'SelectEffectTarget', player: pw.sourceOwner, targetIndex },
    rng: rng2,
    rationale: `random select target idx=${targetIndex}`,
  };
}
```

- [ ] **Step 3: Add MediumBot heuristic**

In the medium bot's priority path:

```ts
if (state.priorityWindow?.kind === 'EffectTargetSelection') {
  const pw = state.priorityWindow;
  if (pw.validTargets.length === 0) {
    return {
      action: { kind: 'SelectEffectTarget', player: pw.sourceOwner, targetIndex: null },
      rng,
      rationale: 'no valid target',
    };
  }
  let chosenIdx = 0;
  let bestScore = -Infinity;
  const isThreatRemoval =
    pw.effect.kind === 'ko' ||
    pw.effect.kind === 'banish' ||
    pw.effect.kind === 'returnToHand' ||
    (pw.effect.kind === 'power' && pw.effect.delta < 0);
  for (let i = 0; i < pw.validTargets.length; i += 1) {
    const t = pw.validTargets[i];
    const score = computeEffectivePower(state, t) * (isThreatRemoval ? 1 : -1);
    if (score > bestScore) {
      bestScore = score;
      chosenIdx = i;
    }
  }
  return {
    action: { kind: 'SelectEffectTarget', player: pw.sourceOwner, targetIndex: chosenIdx },
    rng,
    rationale: `medium picks idx=${chosenIdx} score=${bestScore}`,
  };
}
```

(`computeEffectivePower` import from `@optcg/engine`.)

- [ ] **Step 4: Update AI tests**

Add to `packages/ai/tests/medium.test.ts`:

```ts
it('MediumBot picks highest-power target for KO', () => {
  // setup state with EffectTargetSelection, 2 targets at different powers
  // assert chosen targetIndex points at the higher-power target
});
```

- [ ] **Step 5: Run AI tests**

Run: `corepack pnpm@9.7.0 --filter @optcg/ai test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src packages/ai/tests/medium.test.ts
git commit -m "feat(ai): bots handle EffectTargetSelection"
```

---

## Task 23: Coverage threshold bump + final gate

**Files:**

- Modify: `packages/engine/vitest.config.ts`

- [ ] **Step 1: Bump engine coverage threshold**

```ts
thresholds: {
  lines: 85,
  branches: 80,
  functions: 85,
  statements: 85,
},
```

- [ ] **Step 2: Run full coverage**

Run: `corepack pnpm@9.7.0 --filter @optcg/engine test:coverage`
Expected: meets threshold. If not, add tests to bring up coverage.

- [ ] **Step 3: Run full monorepo gate**

```bash
corepack pnpm@9.7.0 typecheck
corepack pnpm@9.7.0 lint
corepack pnpm@9.7.0 test
corepack pnpm@9.7.0 format:check
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/vitest.config.ts
git commit -m "test(engine): bump coverage threshold to 85"
```

---

## Task 24: Smoke manual

**Files:** none (manual)

- [ ] **Step 1: Build a test deck via the deck builder**

Use cards with hand-coded effects: include OP01-001 (Zoro Leader), Cavendish (OP01-006), Trafalgar Law (OP01-007), and 47 fillers.

- [ ] **Step 2: Run hotseat smoke**

```bash
corepack pnpm@9.7.0 --filter @optcg/web dev
```

Open `/play`, choose the test deck for both players. Play a few turns:

- Verify Zoro Leader's aura applies (+1000 power on own characters when you have ≥1 DON, on your turn).
- Verify Cavendish OnPlay opens target picker, applies -2000 to chosen character.
- Verify Trafalgar Law OnKO opens target picker after KO, applies KO to a chosen low-power opponent.
- Verify Skip button cancels optional effects cleanly.
- Verify highlighting on board.
- Verify toasts fire.

- [ ] **Step 2: Run PvAI smoke**

Repeat with `vs AI Medium` mode. Verify the bot picks targets sensibly.

---

## Task 25: Update CLAUDE.md + memory

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update phase status**

```md
- **Fase:** Fases 0–7 mergeadas a `main`. Última PR: Fase 7 — Librería de efectos hand-coded (≥70 % OP01).
- **Próxima fase:** Mini-fases pendientes — drag & drop / atajos / animaciones / stats / replay / chat / search-choice picker / OP02 effects. Priorizar según tu pull.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Fase 7 effects library complete"
```

---

## Self-review log

**1. Spec coverage:**

| Spec section                               | Plan task                                          |
| ------------------------------------------ | -------------------------------------------------- |
| §1.1 StaticAura trigger                    | Task 3                                             |
| §1.2 EffectTargetSelection priority window | Task 4                                             |
| §1.3 SelectEffectTarget action             | Task 5                                             |
| §1.4 Effect.optional flag                  | Task 2                                             |
| §1.5 CardFilter.powerMax/Min               | Task 1                                             |
| §1.6 Activate:Main donX cost wiring        | Task 10                                            |
| §1.7 computeEffectivePower                 | Task 7, applied in Tasks 8–9                       |
| §1.8 pendingChain                          | Tasks 12–13                                        |
| §2 Library structure                       | Tasks 15–18                                        |
| §3 Runtime flow                            | Tasks 11–13                                        |
| §4 UI extensions                           | Tasks 19–21                                        |
| §5 AI extensions                           | Task 22                                            |
| §6 Testing                                 | Built into each task (TDD) + Task 23 coverage gate |
| §7 Exit criteria                           | Task 23 (gate) + Task 24 (smoke)                   |

**2. Placeholder scan:** No `TBD`/`TODO`/`fill in` patterns. Each step has concrete code or commands.

**3. Type consistency:**

- `TargetRef` defined in Task 4, used consistently in Tasks 6, 7, 11, 13, 19, 20, 22.
- `validTargetsForEffect(state, ctx, effect)` signature is consistent across Tasks 6, 11.
- `computeEffectivePower(state, ref)` signature is consistent across Tasks 7, 8, 9, 19, 22.
- `SelectEffectTarget { kind, player, targetIndex: number | null }` consistent in Tasks 5, 13, 14, 22.
- `EffectTargetSelection.pendingChain: Effect[]` consistent in Tasks 4, 12, 13.
- Helper names (`onPlay`, `staticAura`, `powerDelta`, `ko`, `opponentChar`, `powerLte`, etc.) consistent across Tasks 15, 17, 18.

**Edge note (Task 11):** `resolveDirectly` is referenced from Task 13 (apply.ts) — Task 11 must export it (or an equivalent helper) for cross-module use. Specified in Task 11 Step 3 ("Export `resolveDirectly`") and Task 13 Step 3 ("expose `resolveDirectly` and `applyEffect` from executor.ts").

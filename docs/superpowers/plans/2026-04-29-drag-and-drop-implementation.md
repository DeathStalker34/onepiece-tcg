# Drag & Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop as a fast-path alternative to the existing click flow for three actions: hand→field plays, DON→friendly target attaches, and attacker→enemy target declarations.

**Architecture:** A single `<DndContext>` from `@dnd-kit/core` wraps the existing `Board`. All game-rule decisions delegate to `state.legalActions` via a pure resolver hook (`useBoardDnd`); components only emit drag/drop intents. Click handlers stay intact unchanged.

**Tech Stack:** React 18, Next.js 14, `@dnd-kit/core` v6, Vitest, Tailwind, TypeScript strict.

---

## File Structure

**New files:**

| Path                                                                   | Responsibility                                                                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/play/[gameId]/_components/dnd/ids.ts`                | Drag/drop ID format strings + parsers + TS unions                                                                           |
| `apps/web/src/app/play/[gameId]/_components/dnd/ids.test.ts`           | Parser unit tests                                                                                                           |
| `apps/web/src/app/play/[gameId]/_components/dnd/use-board-dnd.ts`      | Pure resolver: `(dragIntent, dropIntent, legalActions) → Action \| null` and valid-drop-id computation                      |
| `apps/web/src/app/play/[gameId]/_components/dnd/use-board-dnd.test.ts` | Resolver unit tests (≥95 % branch)                                                                                          |
| `apps/web/src/app/play/[gameId]/_components/dnd/dnd-board.tsx`         | `<DndBoardProvider>` wrapping `<DndContext>` + `<DragOverlay>`; exposes `activeDragId` and `validDropIds` via React context |
| `apps/web/src/app/play/[gameId]/_components/dnd/drag-overlay.tsx`      | Styled card-image preview component                                                                                         |

**Modified files:**

| Path                                                            | Why                                                                                                                                                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/engine/src/index.ts`                                  | Export `computeLegalActions` so `useBoardDnd` can call it                                                                                                                                     |
| `apps/web/package.json`                                         | Add `@dnd-kit/core` dependency                                                                                                                                                                |
| `apps/web/src/app/play/[gameId]/_components/board.tsx`          | Wrap children in `<DndBoardProvider>`                                                                                                                                                         |
| `apps/web/src/app/play/[gameId]/_components/hand.tsx`           | Each card → `useDraggable`; click handler unchanged                                                                                                                                           |
| `apps/web/src/app/play/[gameId]/_components/don-stack.tsx`      | Each ready DON tile → `useDraggable`                                                                                                                                                          |
| `apps/web/src/app/play/[gameId]/_components/leader-card.tsx`    | Conditional `useDraggable` (when own + legal attacker) + `useDroppable`                                                                                                                       |
| `apps/web/src/app/play/[gameId]/_components/character-card.tsx` | Same pattern as leader                                                                                                                                                                        |
| `apps/web/src/app/play/[gameId]/_components/player-side.tsx`    | Wrap own field zone in a `useDroppable` container with id `drop:field`; pass `playerIndex`/`isOpponent` to children where they need to know whether to register as drag source or drop target |

---

## Task 1: Foundation — install dependency and export `computeLegalActions`

**Files:**

- Modify: `apps/web/package.json`
- Modify: `packages/engine/src/index.ts`

- [ ] **Step 1: Add `@dnd-kit/core` to web app**

```bash
corepack pnpm@9.7.0 --filter @optcg/web add @dnd-kit/core@^6.3.1
```

- [ ] **Step 2: Export `computeLegalActions` from engine**

Edit `packages/engine/src/index.ts`. Add this export near the other helper exports:

```ts
export { computeLegalActions } from './helpers/legal-actions';
```

- [ ] **Step 3: Typecheck**

```bash
corepack pnpm@9.7.0 --filter @optcg/engine --filter @optcg/web typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml packages/engine/src/index.ts
git commit -m "chore: add @dnd-kit/core and export computeLegalActions"
```

---

## Task 2: Drag/drop ID parsers (pure types) — TDD

**Files:**

- Create: `apps/web/src/app/play/[gameId]/_components/dnd/ids.ts`
- Create: `apps/web/src/app/play/[gameId]/_components/dnd/ids.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/app/play/[gameId]/_components/dnd/ids.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseDragId, parseDropId, formatDragId, formatDropId } from './ids';

describe('parseDragId', () => {
  it('parses hand cards', () => {
    expect(parseDragId('hand:3')).toEqual({ kind: 'hand', handIndex: 3 });
  });
  it('parses DON tokens', () => {
    expect(parseDragId('don:0')).toEqual({ kind: 'don', index: 0 });
  });
  it('parses leader attacker', () => {
    expect(parseDragId('attacker:leader')).toEqual({ kind: 'attacker-leader' });
  });
  it('parses character attacker', () => {
    expect(parseDragId('attacker:char:abc-123')).toEqual({
      kind: 'attacker-char',
      instanceId: 'abc-123',
    });
  });
  it('returns null for unknown', () => {
    expect(parseDragId('garbage')).toBeNull();
    expect(parseDragId('hand:notanumber')).toBeNull();
  });
});

describe('parseDropId', () => {
  it('parses field', () => {
    expect(parseDropId('drop:field')).toEqual({ kind: 'field' });
  });
  it('parses enemy leader target', () => {
    expect(parseDropId('drop:leader:1')).toEqual({ kind: 'enemy-leader', owner: 1 });
  });
  it('parses enemy character target', () => {
    expect(parseDropId('drop:char:abc-123:0')).toEqual({
      kind: 'enemy-char',
      instanceId: 'abc-123',
      owner: 0,
    });
  });
  it('parses friendly leader (DON target)', () => {
    expect(parseDropId('drop:friendly-leader')).toEqual({ kind: 'friendly-leader' });
  });
  it('parses friendly character (DON target)', () => {
    expect(parseDropId('drop:friendly-char:abc-123')).toEqual({
      kind: 'friendly-char',
      instanceId: 'abc-123',
    });
  });
  it('returns null for unknown', () => {
    expect(parseDropId('garbage')).toBeNull();
    expect(parseDropId('drop:char:abc-123:not-a-number')).toBeNull();
  });
});

describe('formatters', () => {
  it('round-trips drag ids', () => {
    const cases = ['hand:5', 'don:2', 'attacker:leader', 'attacker:char:xyz'];
    cases.forEach((s) => {
      const parsed = parseDragId(s);
      expect(parsed).not.toBeNull();
      expect(formatDragId(parsed!)).toBe(s);
    });
  });
  it('round-trips drop ids', () => {
    const cases = [
      'drop:field',
      'drop:leader:0',
      'drop:char:xyz:1',
      'drop:friendly-leader',
      'drop:friendly-char:xyz',
    ];
    cases.forEach((s) => {
      const parsed = parseDropId(s);
      expect(parsed).not.toBeNull();
      expect(formatDropId(parsed!)).toBe(s);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
corepack pnpm@9.7.0 --filter @optcg/web test src/app/play/\[gameId\]/_components/dnd/ids.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ids.ts`**

Create `apps/web/src/app/play/[gameId]/_components/dnd/ids.ts`:

```ts
import type { PlayerIndex } from '@optcg/engine';

export type DragIntent =
  | { kind: 'hand'; handIndex: number }
  | { kind: 'don'; index: number }
  | { kind: 'attacker-leader' }
  | { kind: 'attacker-char'; instanceId: string };

export type DropIntent =
  | { kind: 'field' }
  | { kind: 'enemy-leader'; owner: PlayerIndex }
  | { kind: 'enemy-char'; instanceId: string; owner: PlayerIndex }
  | { kind: 'friendly-leader' }
  | { kind: 'friendly-char'; instanceId: string };

function toPlayerIndex(s: string): PlayerIndex | null {
  if (s === '0') return 0;
  if (s === '1') return 1;
  return null;
}

export function parseDragId(id: string): DragIntent | null {
  const parts = id.split(':');
  if (parts[0] === 'hand' && parts.length === 2) {
    const i = Number(parts[1]);
    return Number.isInteger(i) ? { kind: 'hand', handIndex: i } : null;
  }
  if (parts[0] === 'don' && parts.length === 2) {
    const i = Number(parts[1]);
    return Number.isInteger(i) ? { kind: 'don', index: i } : null;
  }
  if (parts[0] === 'attacker' && parts[1] === 'leader' && parts.length === 2) {
    return { kind: 'attacker-leader' };
  }
  if (parts[0] === 'attacker' && parts[1] === 'char' && parts.length === 3) {
    return { kind: 'attacker-char', instanceId: parts[2] };
  }
  return null;
}

export function parseDropId(id: string): DropIntent | null {
  const parts = id.split(':');
  if (parts[0] !== 'drop') return null;
  if (parts[1] === 'field' && parts.length === 2) return { kind: 'field' };
  if (parts[1] === 'leader' && parts.length === 3) {
    const owner = toPlayerIndex(parts[2]);
    return owner === null ? null : { kind: 'enemy-leader', owner };
  }
  if (parts[1] === 'char' && parts.length === 4) {
    const owner = toPlayerIndex(parts[3]);
    return owner === null ? null : { kind: 'enemy-char', instanceId: parts[2], owner };
  }
  if (parts[1] === 'friendly-leader' && parts.length === 2) return { kind: 'friendly-leader' };
  if (parts[1] === 'friendly-char' && parts.length === 3) {
    return { kind: 'friendly-char', instanceId: parts[2] };
  }
  return null;
}

export function formatDragId(d: DragIntent): string {
  switch (d.kind) {
    case 'hand':
      return `hand:${d.handIndex}`;
    case 'don':
      return `don:${d.index}`;
    case 'attacker-leader':
      return 'attacker:leader';
    case 'attacker-char':
      return `attacker:char:${d.instanceId}`;
  }
}

export function formatDropId(d: DropIntent): string {
  switch (d.kind) {
    case 'field':
      return 'drop:field';
    case 'enemy-leader':
      return `drop:leader:${d.owner}`;
    case 'enemy-char':
      return `drop:char:${d.instanceId}:${d.owner}`;
    case 'friendly-leader':
      return 'drop:friendly-leader';
    case 'friendly-char':
      return `drop:friendly-char:${d.instanceId}`;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
corepack pnpm@9.7.0 --filter @optcg/web test src/app/play/\[gameId\]/_components/dnd/ids.test.ts
```

Expected: PASS — all 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/play/\[gameId\]/_components/dnd/ids.ts apps/web/src/app/play/\[gameId\]/_components/dnd/ids.test.ts
git commit -m "feat(web/dnd): drag/drop id parsers"
```

---

## Task 3: Resolver hook `useBoardDnd` — TDD

**Files:**

- Create: `apps/web/src/app/play/[gameId]/_components/dnd/use-board-dnd.ts`
- Create: `apps/web/src/app/play/[gameId]/_components/dnd/use-board-dnd.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/app/play/[gameId]/_components/dnd/use-board-dnd.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Action } from '@optcg/engine';
import { resolveDrop, computeValidDropIds } from './use-board-dnd';
import type { DragIntent } from './ids';

const playCharacter: Action = {
  kind: 'PlayCharacter',
  player: 0,
  handIndex: 2,
  donSpent: 0,
};

const attachToLeader: Action = {
  kind: 'AttachDon',
  player: 0,
  target: { kind: 'Leader' },
};

const attachToChar: Action = {
  kind: 'AttachDon',
  player: 0,
  target: { kind: 'Character', instanceId: 'c1' },
};

const attackLeader: Action = {
  kind: 'DeclareAttack',
  player: 0,
  attacker: { kind: 'Leader' },
  target: { kind: 'Leader' },
};

const attackChar: Action = {
  kind: 'DeclareAttack',
  player: 0,
  attacker: { kind: 'Character', instanceId: 'a1' },
  target: { kind: 'Character', instanceId: 't1', owner: 1 },
};

describe('resolveDrop', () => {
  it('matches hand drop on field to PlayCharacter with correct handIndex', () => {
    expect(resolveDrop({ kind: 'hand', handIndex: 2 }, { kind: 'field' }, [playCharacter])).toEqual(
      playCharacter,
    );
  });

  it('returns null for hand drop with no matching action (wrong index)', () => {
    expect(
      resolveDrop({ kind: 'hand', handIndex: 9 }, { kind: 'field' }, [playCharacter]),
    ).toBeNull();
  });

  it('matches DON drop on friendly leader', () => {
    expect(
      resolveDrop({ kind: 'don', index: 0 }, { kind: 'friendly-leader' }, [attachToLeader]),
    ).toEqual(attachToLeader);
  });

  it('matches DON drop on friendly character', () => {
    expect(
      resolveDrop({ kind: 'don', index: 0 }, { kind: 'friendly-char', instanceId: 'c1' }, [
        attachToChar,
      ]),
    ).toEqual(attachToChar);
  });

  it('matches leader attacker on enemy leader', () => {
    expect(
      resolveDrop({ kind: 'attacker-leader' }, { kind: 'enemy-leader', owner: 1 }, [attackLeader]),
    ).toEqual(attackLeader);
  });

  it('matches character attacker on enemy character', () => {
    expect(
      resolveDrop(
        { kind: 'attacker-char', instanceId: 'a1' },
        { kind: 'enemy-char', instanceId: 't1', owner: 1 },
        [attackChar],
      ),
    ).toEqual(attackChar);
  });

  it('returns null when attacker drops on friendly target', () => {
    expect(
      resolveDrop({ kind: 'attacker-leader' }, { kind: 'friendly-leader' }, [attackLeader]),
    ).toBeNull();
  });

  it('returns null when DON drops on enemy target', () => {
    expect(
      resolveDrop({ kind: 'don', index: 0 }, { kind: 'enemy-leader', owner: 1 }, [attachToLeader]),
    ).toBeNull();
  });

  it('returns null when no drop intent (dropped outside)', () => {
    expect(resolveDrop({ kind: 'hand', handIndex: 2 }, null, [playCharacter])).toBeNull();
  });
});

describe('computeValidDropIds', () => {
  it('returns field for a hand drag with a play action', () => {
    expect(computeValidDropIds({ kind: 'hand', handIndex: 2 }, [playCharacter])).toEqual(
      new Set(['drop:field']),
    );
  });

  it('returns friendly leader + char ids for DON drag', () => {
    expect(computeValidDropIds({ kind: 'don', index: 0 }, [attachToLeader, attachToChar])).toEqual(
      new Set(['drop:friendly-leader', 'drop:friendly-char:c1']),
    );
  });

  it('returns enemy targets for an attacker drag', () => {
    expect(computeValidDropIds({ kind: 'attacker-leader' }, [attackLeader])).toEqual(
      new Set(['drop:leader:1']),
    );
    expect(computeValidDropIds({ kind: 'attacker-char', instanceId: 'a1' }, [attackChar])).toEqual(
      new Set(['drop:char:t1:1']),
    );
  });

  it('returns empty set when drag has no matching legal actions', () => {
    expect(computeValidDropIds({ kind: 'hand', handIndex: 9 }, [playCharacter])).toEqual(new Set());
  });

  it('returns empty set when intent is null', () => {
    expect(computeValidDropIds(null, [playCharacter])).toEqual(new Set());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
corepack pnpm@9.7.0 --filter @optcg/web test src/app/play/\[gameId\]/_components/dnd/use-board-dnd.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `use-board-dnd.ts`**

Create `apps/web/src/app/play/[gameId]/_components/dnd/use-board-dnd.ts`:

```ts
import type { Action, GameState } from '@optcg/engine';
import { computeLegalActions } from '@optcg/engine';
import type { DragIntent, DropIntent } from './ids';
import { formatDropId } from './ids';

export function resolveDrop(
  drag: DragIntent,
  drop: DropIntent | null,
  legalActions: Action[],
): Action | null {
  if (drop === null) return null;

  for (const action of legalActions) {
    // Hand → field
    if (drag.kind === 'hand' && drop.kind === 'field') {
      if (
        (action.kind === 'PlayCharacter' ||
          action.kind === 'PlayEvent' ||
          action.kind === 'PlayStage') &&
        action.handIndex === drag.handIndex
      ) {
        return action;
      }
    }
    // DON → friendly leader
    if (drag.kind === 'don' && drop.kind === 'friendly-leader') {
      if (action.kind === 'AttachDon' && action.target.kind === 'Leader') return action;
    }
    // DON → friendly character
    if (drag.kind === 'don' && drop.kind === 'friendly-char') {
      if (
        action.kind === 'AttachDon' &&
        action.target.kind === 'Character' &&
        action.target.instanceId === drop.instanceId
      ) {
        return action;
      }
    }
    // Leader attacker → enemy leader
    if (drag.kind === 'attacker-leader' && drop.kind === 'enemy-leader') {
      if (
        action.kind === 'DeclareAttack' &&
        action.attacker.kind === 'Leader' &&
        action.target.kind === 'Leader'
      ) {
        return action;
      }
    }
    // Leader attacker → enemy character
    if (drag.kind === 'attacker-leader' && drop.kind === 'enemy-char') {
      if (
        action.kind === 'DeclareAttack' &&
        action.attacker.kind === 'Leader' &&
        action.target.kind === 'Character' &&
        action.target.instanceId === drop.instanceId
      ) {
        return action;
      }
    }
    // Character attacker → enemy leader
    if (drag.kind === 'attacker-char' && drop.kind === 'enemy-leader') {
      if (
        action.kind === 'DeclareAttack' &&
        action.attacker.kind === 'Character' &&
        action.attacker.instanceId === drag.instanceId &&
        action.target.kind === 'Leader'
      ) {
        return action;
      }
    }
    // Character attacker → enemy character
    if (drag.kind === 'attacker-char' && drop.kind === 'enemy-char') {
      if (
        action.kind === 'DeclareAttack' &&
        action.attacker.kind === 'Character' &&
        action.attacker.instanceId === drag.instanceId &&
        action.target.kind === 'Character' &&
        action.target.instanceId === drop.instanceId
      ) {
        return action;
      }
    }
  }
  return null;
}

export function computeValidDropIds(drag: DragIntent | null, legalActions: Action[]): Set<string> {
  const ids = new Set<string>();
  if (drag === null) return ids;

  for (const action of legalActions) {
    if (drag.kind === 'hand') {
      if (
        (action.kind === 'PlayCharacter' ||
          action.kind === 'PlayEvent' ||
          action.kind === 'PlayStage') &&
        action.handIndex === drag.handIndex
      ) {
        ids.add(formatDropId({ kind: 'field' }));
      }
    } else if (drag.kind === 'don') {
      if (action.kind === 'AttachDon') {
        if (action.target.kind === 'Leader') {
          ids.add(formatDropId({ kind: 'friendly-leader' }));
        } else {
          ids.add(formatDropId({ kind: 'friendly-char', instanceId: action.target.instanceId }));
        }
      }
    } else if (drag.kind === 'attacker-leader') {
      if (action.kind === 'DeclareAttack' && action.attacker.kind === 'Leader') {
        if (action.target.kind === 'Leader') {
          ids.add(formatDropId({ kind: 'enemy-leader', owner: action.target.owner ?? 1 }));
        } else {
          ids.add(
            formatDropId({
              kind: 'enemy-char',
              instanceId: action.target.instanceId,
              owner: action.target.owner,
            }),
          );
        }
      }
    } else if (drag.kind === 'attacker-char') {
      if (
        action.kind === 'DeclareAttack' &&
        action.attacker.kind === 'Character' &&
        action.attacker.instanceId === drag.instanceId
      ) {
        if (action.target.kind === 'Leader') {
          ids.add(formatDropId({ kind: 'enemy-leader', owner: action.target.owner ?? 1 }));
        } else {
          ids.add(
            formatDropId({
              kind: 'enemy-char',
              instanceId: action.target.instanceId,
              owner: action.target.owner,
            }),
          );
        }
      }
    }
  }
  return ids;
}

export function getLegalActions(state: GameState): Action[] {
  return computeLegalActions(state);
}
```

- [ ] **Step 4: Note on `target.owner` for `DeclareAttack`'s `Leader` variant**

Inspect `packages/engine/src/types/action.ts:24`. `target` for `DeclareAttack` is `{ kind: 'Leader' } | { kind: 'Character'; instanceId: string; owner: PlayerIndex }`. The Leader variant does NOT have an owner field. The current resolver fallback `?? 1` is wrong when local player is index 1. Fix the resolver.

Replace the `attacker-leader` and `attacker-char` branches in `computeValidDropIds` with code that takes `localPlayer: PlayerIndex` as a parameter and computes opponent = `1 - localPlayer`. Update the function signature:

```ts
export function computeValidDropIds(
  drag: DragIntent | null,
  legalActions: Action[],
  localPlayer: PlayerIndex,
): Set<string> {
```

And inside the attacker branches, use `1 - localPlayer` for the leader-target owner. Same fix in the test setup — pass `0` as the localPlayer in the existing tests.

Update the test file: every call to `computeValidDropIds` adds a `0` (local player 0) third argument:

```ts
computeValidDropIds({ kind: 'hand', handIndex: 2 }, [playCharacter], 0);
```

Also import `PlayerIndex` in `use-board-dnd.ts` from `@optcg/engine`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
corepack pnpm@9.7.0 --filter @optcg/web test src/app/play/\[gameId\]/_components/dnd/use-board-dnd.test.ts
```

Expected: PASS — 14 tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/play/\[gameId\]/_components/dnd/use-board-dnd.ts apps/web/src/app/play/\[gameId\]/_components/dnd/use-board-dnd.test.ts
git commit -m "feat(web/dnd): pure resolver mapping drag intents to engine actions"
```

---

## Task 4: DragOverlay component

**Files:**

- Create: `apps/web/src/app/play/[gameId]/_components/dnd/drag-overlay.tsx`

- [ ] **Step 1: Implement the overlay**

Create `apps/web/src/app/play/[gameId]/_components/dnd/drag-overlay.tsx`:

```tsx
'use client';

import Image from 'next/image';
import { cardImagePath } from '@/lib/card-image';

export function CardDragOverlay({ cardId }: { cardId: string | null }) {
  if (!cardId) return null;
  return (
    <div className="pointer-events-none aspect-[5/7] w-24 rotate-3 overflow-hidden rounded border border-amber-900/60 shadow-2xl">
      <Image src={cardImagePath(cardId)} alt={cardId} fill sizes="96px" className="object-cover" />
    </div>
  );
}
```

> Width 24 mirrors `Hand`/`Character` size. For DON drag we'll reuse the same overlay — drag overlay shows the card image; for DON we'll fall back to a neutral DON glyph. Add a variant.

- [ ] **Step 2: Add a DON variant**

Append to the same file:

```tsx
export function DonDragOverlay() {
  return (
    <div className="pointer-events-none h-16 w-12 rotate-3 rounded border border-yellow-600 bg-gradient-to-br from-yellow-500 to-yellow-700 shadow-2xl" />
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
corepack pnpm@9.7.0 --filter @optcg/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/play/\[gameId\]/_components/dnd/drag-overlay.tsx
git commit -m "feat(web/dnd): card and DON drag overlays"
```

---

## Task 5: `<DndBoardProvider>` — context wrapper

**Files:**

- Create: `apps/web/src/app/play/[gameId]/_components/dnd/dnd-board.tsx`

- [ ] **Step 1: Implement the provider**

Create `apps/web/src/app/play/[gameId]/_components/dnd/dnd-board.tsx`:

```tsx
'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { GameState, PlayerIndex } from '@optcg/engine';
import { useGame } from '../game-provider';
import { parseDragId, parseDropId } from './ids';
import { resolveDrop, computeValidDropIds, getLegalActions } from './use-board-dnd';
import { CardDragOverlay, DonDragOverlay } from './drag-overlay';

interface DndBoardCtxValue {
  activeDragId: string | null;
  validDropIds: Set<string>;
}

const DndBoardCtx = createContext<DndBoardCtxValue>({
  activeDragId: null,
  validDropIds: new Set(),
});

export function useDndBoard(): DndBoardCtxValue {
  return useContext(DndBoardCtx);
}

export function DndBoardProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, isOnline, myPlayerIndex } = useGame();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const localPlayer: PlayerIndex = isOnline && myPlayerIndex !== null ? myPlayerIndex : 0;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const validDropIds = useMemo<Set<string>>(() => {
    if (!activeDragId) return new Set();
    const drag = parseDragId(activeDragId);
    if (!drag) return new Set();
    return computeValidDropIds(drag, getLegalActions(state as GameState), localPlayer);
  }, [activeDragId, state, localPlayer]);

  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDragId(null);
      const drag = parseDragId(String(e.active.id));
      if (!drag) return;
      const drop = e.over ? parseDropId(String(e.over.id)) : null;
      const action = resolveDrop(drag, drop, getLegalActions(state as GameState));
      if (action) dispatch(action);
    },
    [state, dispatch],
  );

  const onDragCancel = useCallback(() => setActiveDragId(null), []);

  const overlayContent = useMemo(() => {
    if (!activeDragId) return null;
    const drag = parseDragId(activeDragId);
    if (!drag) return null;
    if (drag.kind === 'hand') {
      const cardId = state.players[localPlayer].hand[drag.handIndex];
      return cardId ? <CardDragOverlay cardId={cardId} /> : null;
    }
    if (drag.kind === 'don') return <DonDragOverlay />;
    if (drag.kind === 'attacker-leader') {
      return <CardDragOverlay cardId={state.players[localPlayer].leader.cardId} />;
    }
    if (drag.kind === 'attacker-char') {
      const c = state.players[localPlayer].characters.find((x) => x.instanceId === drag.instanceId);
      return c ? <CardDragOverlay cardId={c.cardId} /> : null;
    }
    return null;
  }, [activeDragId, state, localPlayer]);

  const ctxValue = useMemo<DndBoardCtxValue>(
    () => ({ activeDragId, validDropIds }),
    [activeDragId, validDropIds],
  );

  return (
    <DndBoardCtx.Provider value={ctxValue}>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        {children}
        <DragOverlay>{overlayContent}</DragOverlay>
      </DndContext>
    </DndBoardCtx.Provider>
  );
}
```

- [ ] **Step 2: Wrap board in the provider**

Edit `apps/web/src/app/play/[gameId]/_components/board.tsx`:

Add the import near the top:

```ts
import { DndBoardProvider } from './dnd/dnd-board';
```

Wrap the entire returned JSX inside `<DndBoardProvider>`:

```tsx
return (
  <DndBoardProvider>
    <div className="tabletop-bg min-h-screen">...existing children...</div>
  </DndBoardProvider>
);
```

- [ ] **Step 3: Typecheck**

```bash
corepack pnpm@9.7.0 --filter @optcg/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/play/\[gameId\]/_components/dnd/dnd-board.tsx apps/web/src/app/play/\[gameId\]/_components/board.tsx
git commit -m "feat(web/dnd): DndBoardProvider wraps the board with DndContext"
```

---

## Task 6: Hand → field drag interaction

**Files:**

- Modify: `apps/web/src/app/play/[gameId]/_components/hand.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/player-side.tsx`

- [ ] **Step 1: Make hand cards draggable**

In `apps/web/src/app/play/[gameId]/_components/hand.tsx`, add the dnd-kit import:

```ts
import { useDraggable } from '@dnd-kit/core';
```

Add a small inner component that wraps the card button with a draggable. Place this above the `Hand` function or inside the same file:

```tsx
function DraggableHandCard({
  cardId,
  handIndex,
  clickable,
  onClick,
}: {
  cardId: string;
  handIndex: number;
  clickable: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `hand:${handIndex}`,
    disabled: !clickable,
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      className={`relative aspect-[5/7] w-24 shrink-0 overflow-hidden rounded border border-amber-900/60 transition animate-in fade-in-0 slide-in-from-right-16 duration-500 ease-out ${clickable ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary' : 'cursor-default'} ${isDragging ? 'opacity-40' : ''}`}
      onClick={onClick}
      disabled={!clickable}
      aria-label={`Card ${cardId}`}
    >
      <Image src={cardImagePath(cardId)} alt={cardId} fill sizes="96px" className="object-cover" />
    </button>
  );
}
```

Replace the inner `<button>` inside the cards.map of the visible-hand branch with `<DraggableHandCard>`:

```tsx
cards.map((cardId, i) => (
  <CardHoverPreview key={`${cardId}-${i}`} cardId={cardId}>
    <DraggableHandCard
      cardId={cardId}
      handIndex={i}
      clickable={clickable}
      onClick={() => handleCardClick(cardId, i)}
    />
  </CardHoverPreview>
));
```

- [ ] **Step 2: Add the field drop zone to PlayerSide**

In `apps/web/src/app/play/[gameId]/_components/player-side.tsx`, import `useDroppable` and the dnd hook:

```ts
import { useDroppable } from '@dnd-kit/core';
import { useDndBoard } from './dnd/dnd-board';
```

At the top of the `PlayerSide` body, add:

```ts
const { validDropIds } = useDndBoard();
const isLocal =
  isOnline && myPlayerIndex !== null ? myPlayerIndex === playerIndex : !botPlayers[playerIndex];
const fieldDroppableId = 'drop:field';
const { setNodeRef: setFieldRef, isOver: isFieldOver } = useDroppable({
  id: fieldDroppableId,
  disabled: !isLocal,
});
const fieldIsValid = isLocal && validDropIds.has(fieldDroppableId);
const fieldGlow = fieldIsValid
  ? isFieldOver
    ? 'ring-2 ring-amber-400 bg-amber-400/10'
    : 'ring-2 ring-amber-400/70'
  : '';
```

Find the `<div className="zone-frame inline-flex items-center gap-2 p-2">` that wraps the characters + stage and apply the droppable ref + classes. Change to:

```tsx
<div
  ref={setFieldRef}
  className={`zone-frame inline-flex items-center gap-2 p-2 transition ${fieldGlow}`}
>
```

- [ ] **Step 3: Run dev server and manually verify**

```bash
corepack pnpm@9.7.0 --filter @optcg/web dev
```

Open `http://localhost:3000/play` → start hotseat. Drag a CHARACTER card from your hand onto the field. Expected: field glows amber while dragging; on drop, the character appears in play.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/play/\[gameId\]/_components/hand.tsx apps/web/src/app/play/\[gameId\]/_components/player-side.tsx
git commit -m "feat(web/dnd): drag hand card to field plays it"
```

---

## Task 7: DON → friendly leader/character interaction

**Files:**

- Modify: `apps/web/src/app/play/[gameId]/_components/don-stack.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/leader-card.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/character-card.tsx`

- [ ] **Step 1: Make ready DON tokens draggable**

In `apps/web/src/app/play/[gameId]/_components/don-stack.tsx`, replace the static stack of "Active" DON tiles with a row of individual draggable tiles (one per active DON). Add the import:

```ts
import { useDraggable } from '@dnd-kit/core';
```

Add a draggable tile component at the bottom of the file:

```tsx
function DraggableDonTile({ index, disabled }: { index: number; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `don:${index}`,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`h-16 w-12 rounded border border-yellow-600 bg-gradient-to-br from-yellow-500 to-yellow-700 shadow ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isDragging ? 'opacity-40' : ''}`}
      aria-label={`DON ${index + 1}`}
    />
  );
}
```

Replace the existing "Active" stack (the block under `<span className="text-[10px] uppercase text-yellow-300">Active</span>`) with a flex row of `<DraggableDonTile>`. Keep the count text:

```tsx
<div className="flex flex-col items-center gap-1">
  <div className="flex gap-0.5">
    {Array.from({ length: Math.min(donActive, 5) }).map((_, i) => (
      <DraggableDonTile key={i} index={i} disabled={!canAttach} />
    ))}
    {donActive > 5 && (
      <span className="ml-1 self-center text-xs font-bold text-yellow-200">+{donActive - 5}</span>
    )}
  </div>
  <span className="text-[10px] uppercase text-yellow-300">Active ({donActive})</span>
</div>
```

Keep the existing `<button>` wrapper around the entire stack so the click→AttachFlow modal still works for users who prefer click. Remove the `disabled` prop from the outer button so the click flow is always available when `canAttach` (no change needed if it already gates on canAttach).

- [ ] **Step 2: Add a droppable to LeaderCard for friendly DON drops**

In `apps/web/src/app/play/[gameId]/_components/leader-card.tsx`, accept a new optional prop `dndDropId?: string` and `dndDraggableId?: string`. Add imports:

```ts
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useDndBoard } from './dnd/dnd-board';
```

Update the component signature:

```tsx
export function LeaderCard({
  leader,
  lifeCount,
  actions = [],
  highlighted = false,
  effectivePower,
  basePower,
  dndDropId,
  dndDraggableId,
}: {
  leader: LeaderInPlay;
  lifeCount: number;
  actions?: ActionMenuOption[];
  highlighted?: boolean;
  effectivePower: number;
  basePower: number;
  dndDropId?: string;
  dndDraggableId?: string;
}) {
```

Add inside the body, before the JSX return:

```ts
const { validDropIds } = useDndBoard();
const { setNodeRef: setDropRef, isOver } = useDroppable({
  id: dndDropId ?? 'leader-no-drop',
  disabled: !dndDropId,
});
const isValidDrop = dndDropId !== undefined && validDropIds.has(dndDropId);
const dropGlow = isValidDrop ? (isOver ? 'ring-2 ring-amber-400' : 'ring-2 ring-amber-400/70') : '';

const {
  attributes,
  listeners,
  setNodeRef: setDragRef,
  isDragging,
} = useDraggable({
  id: dndDraggableId ?? 'leader-no-drag',
  disabled: !dndDraggableId,
});

function combineRefs(node: Element | null) {
  setDropRef(node);
  setDragRef(node);
}
```

Apply `combineRefs` to the outermost `<div className="relative">` (cast: `ref={combineRefs as React.Ref<HTMLDivElement>}`) and spread `{...(dndDraggableId ? attributes : {})} {...(dndDraggableId ? listeners : {})}` on it. Append `${dropGlow} ${isDragging ? 'opacity-40' : ''}` to the relative wrapper's className. Keep the existing `<button>` click handler intact.

- [ ] **Step 3: Same treatment for CharacterCard**

In `apps/web/src/app/play/[gameId]/_components/character-card.tsx`, mirror the changes from Step 2:

1. Add the same imports.
2. Extend props with optional `dndDropId?: string; dndDraggableId?: string;`.
3. Inside the body, add the same `validDropIds`, `useDroppable`, `useDraggable`, `combineRefs` block.
4. The current return JSX is `<><CardHoverPreview><button>...</button></CardHoverPreview>{ActionMenu}</>`. Wrap the `<CardHoverPreview>` in a new `<div>` that carries the ref + listeners + drop glow:

```tsx
return (
  <>
    <div
      ref={combineRefs as React.Ref<HTMLDivElement>}
      {...(dndDraggableId ? attributes : {})}
      {...(dndDraggableId ? listeners : {})}
      className={`inline-block rounded transition ${dropGlow} ${isDragging ? 'opacity-40' : ''}`}
    >
      <CardHoverPreview cardId={char.cardId}>
        <button ...existing...>...existing...</button>
      </CardHoverPreview>
    </div>
    {actions.length > 1 && <ActionMenu .../>}
  </>
);
```

- [ ] **Step 4: Wire dndDropId in PlayerSide for DON drops**

In `apps/web/src/app/play/[gameId]/_components/player-side.tsx`, when rendering own LeaderCard and own CharacterCards, pass:

```tsx
<LeaderCard
  ...
  dndDropId={isLocal ? 'drop:friendly-leader' : undefined}
/>
```

```tsx
<CharacterCard
  ...
  dndDropId={isLocal ? `drop:friendly-char:${c.instanceId}` : undefined}
/>
```

- [ ] **Step 5: Manual verify**

Restart dev server. Drag a DON token from the active row onto your leader. Expected: leader glows; on drop, DON attaches.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/play/\[gameId\]/_components/don-stack.tsx apps/web/src/app/play/\[gameId\]/_components/leader-card.tsx apps/web/src/app/play/\[gameId\]/_components/character-card.tsx apps/web/src/app/play/\[gameId\]/_components/player-side.tsx
git commit -m "feat(web/dnd): drag DON token to friendly leader/character attaches"
```

---

## Task 8: Attacker → enemy target interaction

**Files:**

- Modify: `apps/web/src/app/play/[gameId]/_components/player-side.tsx` (own + opponent)

- [ ] **Step 1: Wire dndDraggableId for attackers (own side)**

In `player-side.tsx`, when rendering own LeaderCard:

```tsx
const canLeaderAttack =
  isLocal && inMain && !p.leader.rested && p.firstTurnUsed;

<LeaderCard
  ...
  dndDropId={isLocal ? 'drop:friendly-leader' : undefined}
  dndDraggableId={canLeaderAttack ? 'attacker:leader' : undefined}
/>
```

For own characters, in the slot loop:

```tsx
const canCharAttack =
  isLocal &&
  inMain &&
  !c.rested &&
  p.firstTurnUsed &&
  (!c.summoningSickness || (charStatic?.keywords.includes('Rush') ?? false));

<CharacterCard
  ...
  dndDropId={isLocal ? `drop:friendly-char:${c.instanceId}` : undefined}
  dndDraggableId={canCharAttack ? `attacker:char:${c.instanceId}` : undefined}
/>
```

- [ ] **Step 2: Wire dndDropId for enemy targets (opponent side)**

When the opponent's `<PlayerSide>` renders, the same component instance handles both sides. We need to differentiate: if `isLocal` is false, this side is the opponent — its leader/characters should be drop targets for attacks.

In `player-side.tsx`, define an `enemyOwner` constant:

```ts
const isEnemy = !isLocal;
const enemyTargetForLeader = isEnemy ? `drop:leader:${playerIndex}` : undefined;
```

When rendering the LeaderCard, include both droppables (friendly DON when local, enemy attack when opponent):

```tsx
<LeaderCard
  ...
  dndDropId={isLocal ? 'drop:friendly-leader' : `drop:leader:${playerIndex}`}
  dndDraggableId={canLeaderAttack ? 'attacker:leader' : undefined}
/>
```

For each opponent character, in the slot loop:

```tsx
<CharacterCard
  ...
  dndDropId={
    isLocal
      ? `drop:friendly-char:${c.instanceId}`
      : `drop:char:${c.instanceId}:${playerIndex}`
  }
  dndDraggableId={canCharAttack ? `attacker:char:${c.instanceId}` : undefined}
/>
```

(`canCharAttack` is `false` for opponent characters because `isLocal` gate is false.)

- [ ] **Step 3: Manual verify**

Restart dev server. With a ready character on board (or after first turn for leader), drag your attacker onto the enemy leader. Expected: enemy leader/character glows; on drop, attack declared (counter step opens as usual).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/play/\[gameId\]/_components/player-side.tsx
git commit -m "feat(web/dnd): drag attacker to enemy target declares attack"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run all tests**

```bash
corepack pnpm@9.7.0 test
```

Expected: all pass.

- [ ] **Step 2: Lint**

```bash
corepack pnpm@9.7.0 lint
```

Expected: clean.

- [ ] **Step 3: Typecheck**

```bash
corepack pnpm@9.7.0 typecheck
```

Expected: clean.

- [ ] **Step 4: Format check**

```bash
corepack pnpm@9.7.0 format:check
```

Expected: clean. If not, run `corepack pnpm@9.7.0 format` and stage.

- [ ] **Step 5: Manual smoke (browser)**

Run dev server and verify the smoke checklist from the spec:

- Drag a CHARACTER from hand onto field — plays
- Drag a CHARACTER from hand onto leader — invalid, snap-back
- Drag a DON token onto own leader — attaches
- Drag a DON token onto own character — attaches
- Drag own ready leader onto enemy leader — attack
- Drag own ready character onto enemy character — attack
- Click flow still works for all of the above
- Drag a hand card and press Escape — snap-back

If everything is green, commit any auto-format changes:

```bash
git status
git add -A && git commit -m "chore: format" || true
```

- [ ] **Step 6: Push branch**

```bash
git push -u origin feature/drag-and-drop
```

---

## Notes / open questions logged during implementation

(Empty — to be filled during execution if any divergence from spec.)

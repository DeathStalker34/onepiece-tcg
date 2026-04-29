# Drag & Drop en partidas — design

Status: approved 2026-04-29
Mini-phase: drag-and-drop
Branch: `feature/drag-and-drop`

## Goal

Add a drag-and-drop alternative to the existing click-based board UI so that the three most common in-match actions feel snappier without breaking the click flow that already works.

## Scope

Three drag interactions. Everything else stays click-only.

| Drag source                    | Drop target                                       | Engine action                               |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------- |
| Hand card                      | Field zone (characters / event area / stage area) | `PlayCharacter` / `PlayEvent` / `PlayStage` |
| DON token (ready, in own pool) | Own leader or own character                       | `AttachDon`                                 |
| Own ready leader or character  | Enemy leader or enemy character                   | `DeclareAttack`                             |

Click handlers stay intact — drag is an additional fast path, not a replacement. `donSpent: 0` constant for plays (matches current click behavior; cost picker is a separate mini-phase).

## Out of scope

- Counter step drag (`PlayCounter`) — current staged-confirm UX is fine
- Blocker drag (`UseBlocker`) — same reason
- Cost picker for `donSpent` — a separate concern from drag
- Touch / mobile sensors — sim is desktop ≥1280 px per spec
- Keyboard sensor / a11y drag — not in this round
- Drop animations beyond the drag overlay — explicitly cosmetic
- E2E tests with Playwright — no E2E setup in repo today

## Architecture

### Library

`@dnd-kit/core` for the DnD primitives. Chosen over HTML5 native (clunky API, OS-rendered preview that can't be styled) and react-dnd (older, heavier).

### Composition

A single `<DndContext>` wraps the existing `Board` component tree. A `<DragOverlay>` renders the styled card preview that follows the cursor. Sensors: pointer only.

```
<DndContext sensors={[pointer]} onDragStart={...} onDragEnd={...}>
  <Board>
    <PlayerSide opponent>...</PlayerSide>
    <PlayerSide self>
      <Hand>             {/* DraggableHandCard per card */}
      <Field>            {/* DroppableFieldZone + draggable/droppable Leader & Character */}
      <DonStack>         {/* DraggableDonToken per ready DON */}
    </PlayerSide>
  </Board>
  <DragOverlay>          {/* card preview while dragging */}
</DndContext>
```

### Drag and drop ID scheme

The DnD layer is purely intent-shaped. All game-rule decisions come from `state.legalActions` (already returned by `engine.apply`).

| Element                                | ID format                             |
| -------------------------------------- | ------------------------------------- |
| Hand card                              | `hand:<handIndex>`                    |
| DON token                              | `don:<index>`                         |
| Attacker — leader                      | `attacker:leader`                     |
| Attacker — character                   | `attacker:char:<instanceId>`          |
| Drop — field zone                      | `drop:field`                          |
| Drop — enemy leader (attack target)    | `drop:leader:<ownerIndex>`            |
| Drop — enemy character (attack target) | `drop:char:<instanceId>:<ownerIndex>` |
| Drop — friendly leader (DON target)    | `drop:friendly-leader`                |
| Drop — friendly character (DON target) | `drop:friendly-char:<instanceId>`     |

### Drop on `drop:field`

There is one field drop zone, not three. The engine's `legalActions` already varies by hand card type — when the user drops hand index `i` on `drop:field`, the resolver finds the matching `PlayCharacter` / `PlayEvent` / `PlayStage` action with that `handIndex`. The dispatch is unambiguous because each hand card has exactly one play action variant.

### Action resolution

`onDragEnd(active, over)` flow:

1. Read current `state.legalActions` (already in context).
2. Parse `active.id` to a drag intent.
3. Parse `over.id` to a drop intent (or null if dropped outside).
4. Find the unique `Action` in `legalActions` matching `(dragIntent, dropIntent)`.
5. If found → dispatch through the same path as click. Source visually animates to the new zone via React's natural re-render.
6. If not → silent snap-back (dnd-kit default). No toast, no shake.

Cancellation (Escape) follows the same snap-back path.

### New files

| File                                                              | Responsibility                                                                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/play/[gameId]/_components/dnd/types.ts`         | Drag/drop ID parsers and TS types                                                                                                   |
| `apps/web/src/app/play/[gameId]/_components/dnd/use-board-dnd.ts` | Hook mapping `(dragIntent, dropIntent, legalActions) → Action \| null` and exposing `validDropIds: Set<string>` for the active drag |
| `apps/web/src/app/play/[gameId]/_components/dnd/drag-overlay.tsx` | Card preview rendered inside dnd-kit's `<DragOverlay>`                                                                              |

### Touched files

| File                                                                          | Change                                                                                                                                 |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/play/[gameId]/_components/board.tsx`                        | Wrap children in `<DndContext>` + `<DragOverlay>`; subscribe to active drag state to expose `validDropIds` via context                 |
| `apps/web/src/app/play/[gameId]/_components/hand.tsx`                         | Each card → `useDraggable`. Click handler unchanged.                                                                                   |
| `apps/web/src/app/play/[gameId]/_components/don-stack.tsx`                    | Each ready DON token → `useDraggable`                                                                                                  |
| `apps/web/src/app/play/[gameId]/_components/character-card.tsx`               | `useDroppable` (DON or attack target) + conditional `useDraggable` (when this character is the local player's and is a legal attacker) |
| `apps/web/src/app/play/[gameId]/_components/leader-card.tsx`                  | Same pattern as `character-card.tsx`                                                                                                   |
| `apps/web/src/app/play/[gameId]/_components/player-side.tsx` (or new sibling) | Field drop zone (`useDroppable` with id `drop:field`) covering the friendly play area                                                  |

### Architectural invariant

No game rules in components. The hook only filters `state.legalActions` — it never decides on its own whether a play is legal, what the cost is, who can attack whom, etc. This preserves CLAUDE.md §10's rule: rules live in the engine.

## UX

### Visual states

| Element                        | State                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Source (mid-drag)              | `opacity-40`                                                                                  |
| Drag overlay                   | Card image at native size, `rotate-3`, `shadow-2xl`, `cursor-grabbing`, `pointer-events-none` |
| Valid drop zones               | `ring-2 ring-amber-400/70` + soft glow                                                        |
| Invalid drop zones             | No change — neutral, no dimming                                                               |
| Valid zone with cursor over it | Solid `ring-amber-400` + `bg-amber-400/10`                                                    |

### Cursor states

| Context                                                       | Cursor                                     |
| ------------------------------------------------------------- | ------------------------------------------ |
| Hover over draggable source                                   | `cursor-grab`                              |
| Mid-drag (anywhere)                                           | `cursor-grabbing` (set on body by dnd-kit) |
| Hover over non-draggable source (not your turn, no DON, etc.) | `cursor-default`                           |

### Drop resolution

| Outcome                          | Behavior                                                             |
| -------------------------------- | -------------------------------------------------------------------- |
| Valid target                     | Dispatch action; React re-renders the new state; no custom animation |
| Invalid target / dropped outside | Silent snap-back                                                     |
| Escape during drag               | Same as snap-back                                                    |

## Testing

| Layer                          | Coverage                                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (`use-board-dnd.test.ts`) | Pure-function mapping `(dragId, dropId, legalActions) → Action \| null`. Aim 100 % branch coverage. Cases: hand→field valid, hand→leader invalid, attacker→enemy char valid, attacker→friendly invalid, DON→friendly char valid, unknown drag → null, unknown drop → null |
| Component (`board.test.tsx`)   | Render board with mock state; use `@dnd-kit/test-utils` to programmatically drag from each source to each target type; assert dispatch was called with the expected action                                                                                                |
| Manual smoke (post-deploy)     | Drag hand→field, attach DON, declare attack, invalid drop, click still works, escape during drag                                                                                                                                                                          |

## Risks / open questions

- **dnd-kit and React 18 strict mode** — verified compatible per dnd-kit docs (v6+).
- **Drag overlay performance** — card image is already loaded; overlay is a positioned clone, no extra fetch.
- **Existing target-picker for attacks** — drag attacker onto a target dispatches `DeclareAttack` directly without going through `target-picker`. Click flow still uses the picker (with its Can KO / Survives outcome pills). Drag users miss those pills mid-drag — acceptable trade-off for speed; users who want the preview use click.

## Acceptance criteria

1. From the hand, dragging a CHARACTER card onto the field plays it (engine receives `PlayCharacter` with `donSpent: 0`).
2. Dragging a ready DON token onto a friendly leader or character attaches it (engine receives `AttachDon`).
3. Dragging a ready friendly leader or character onto an enemy leader or character declares an attack (engine receives `DeclareAttack`).
4. Click handlers continue to work for all three cases.
5. Invalid drops snap back without errors.
6. `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check` all pass.
7. `use-board-dnd` has unit tests with ≥95 % branch coverage.

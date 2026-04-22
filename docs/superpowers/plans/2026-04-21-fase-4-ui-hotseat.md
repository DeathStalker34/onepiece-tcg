# Fase 4 — UI hotseat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** UI web que permite a 2 humanos completar una partida OPTCG OP01 en el mismo dispositivo usando el engine de Fase 3.

**Architecture:** Ver spec `docs/superpowers/specs/2026-04-21-fase-4-ui-hotseat-design.md`. Client-side state, engine es la única autoridad de reglas, board mirrored con hotseat handoff entre turnos.

**Tech Stack:** Next.js 14 App Router, React 18 client components, Tailwind, shadcn/ui, `@optcg/engine` + `@optcg/card-data`.

**Branch:** `feature/fase-4-ui-hotseat`.

**Modo autónomo:** plan auto-aprobado. Solo halt en blockers externos.

**Disciplina:**

- Cada task deja `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` verdes.
- No mutación de state — siempre `dispatch(action)` al engine.
- Zero reglas de juego en componentes (no `if (card.type === 'LEADER') { ...damage logic... }`).
- Commits con trailer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## Task 1: Catalog builder + deck loader (TDD)

**Files:**

- Create: `apps/web/src/lib/catalog-builder.ts`
- Create: `apps/web/src/lib/catalog-builder.test.ts`
- Create: `apps/web/src/lib/deck-loader.ts`
- Create: `apps/web/src/lib/deck-loader.test.ts`

**`catalog-builder.ts`**: función `buildCatalog(cards: Card[]): Record<string, CardStatic>` según spec §3.2. Incluye mapping crítico LEADER `cost → life` (apitcg concern). Keyword parser conservador desde `effectText` (tag bracket detection: `[Rush]`, `[Blocker]`, `[Double Attack]`, `[Banish]`). Efectos se mergean desde `getEffectsForCard(cardId)` (empty en Fase 3 library).

**Tests ≥6:**

- LEADER cost → life, cost null
- CHARACTER preserves cost/power/counter
- EVENT: power null
- Keyword detection: Rush/Blocker/DoubleAttack/Banish
- Multi-color split
- Unknown type defaults to CHARACTER with warning

**`deck-loader.ts`**: `expandDeckCards(cards: DeckCard[]): string[]` toma `[{ cardId, quantity }]` y produce array de 50 IDs. También `loadGameDeckById(deckId: string): Promise<{ deck: string[]; leaderCardId: string; deckName: string }>` que hace fetch a `/api/decks/[id]` + expand. Valida que total === 50 y que existe leader.

**Tests ≥4:**

- expandDeckCards: 4 + 4 + ... quantities expand correctly
- expandDeckCards: throws if total ≠ 50 (or returns what it has if relaxed)
- loadGameDeckById: happy path (mocked fetch)
- loadGameDeckById: no leader → throws

Commit: `feat(web): add catalog-builder and deck-loader utils`.

---

## Task 2: `/api/games` route — creates match setup server-side

**Files:**

- Create: `apps/web/src/app/api/games/route.ts`

`POST /api/games`:

```ts
Body: { seed?: number; p0DeckId: string; p1DeckId: string };
Response: { gameId: string; setup: MatchSetup };
```

Ownership guard via `x-user-id`. Loads both decks + their cards from Prisma, fetches full card catalog, calls `buildCatalog`, returns `MatchSetup` with catalog + decks + seed. `gameId = uuid` (for URL routing; state is client-side).

If seed not provided, generate via `crypto.randomInt`.

Validation:

- Both decks belong to user (or at least one belongs to user and the other is "borrowed" from any user — MVP decision: both must belong to user; hotseat is local).
- Deck has exactly 50 non-leader cards + a leaderCardId.
- Both leaders exist in catalog.
- Both decks have `leaderCardId` set.

On error: 400 with reason.

Commit: `feat(web): add POST /api/games that builds MatchSetup`.

---

## Task 3: `/play` setup page — pick decks + seed + start

**Files:**

- Create: `apps/web/src/app/play/page.tsx`
- Create: `apps/web/src/app/play/_components/deck-selector.tsx`

Client component. Fetches user's decks via existing `/api/decks`. UI:

- Header "New match"
- Two columns: "Player 0 deck" + "Player 1 deck", each a dropdown/list of user's decks (filter `deck.leaderCardId !== null` and `totalCards === 50`).
- Seed input (placeholder "Random").
- Button "Start game" (disabled until both picked) → POST `/api/games` → redirect `/play/[gameId]`.
- On error: toast or inline message.
- Edge case: user has <1 legal deck → show "Create decks in /builder first" link.

Commit: `feat(web): add /play setup page with deck picker`.

---

## Task 4: GameProvider + state plumbing

**Files:**

- Create: `apps/web/src/app/play/[gameId]/_components/game-provider.tsx`
- Create: `apps/web/src/app/play/[gameId]/page.tsx`

`game-provider.tsx` per spec §3.1: React context with `state`, `dispatch(action)`, `events`. Initialized from `MatchSetup` prop.

`page.tsx` (client):

- Reads `MatchSetup` from... where? Since it's generated in `/api/games` and not persisted, we pass via `sessionStorage` in Task 3 step (store `setup` under `optcg.game.<gameId>` key) and read here.
- Alternative: use a new `GET /api/games/[id]` that re-computes. Simpler: sessionStorage.
- Decision: **sessionStorage**. Refresh still loses game, but within-session reload works.
- Page reads setup, provides via GameProvider, renders placeholder `<Board />` (Task 5).

Commit: `feat(web): add GameProvider and /play/[gameId] shell`.

---

## Task 5: Board layout + tabletop styles

**Files:**

- Create: `apps/web/src/app/play/[gameId]/_components/board.tsx`
- Create: `apps/web/src/app/play/[gameId]/_components/player-side.tsx`
- Modify: `apps/web/src/app/globals.css` — añadir clases tabletop

Per spec §6. Board is a grid with:

- Top half: opponent's zones (rotated 180° to face down — or just labeled "opponent")
- Bottom half: own zones
- Right sidebar: game log + action bar
- Center: turn/phase indicator + hotseat handoff overlay mount

`PlayerSide` renders 6 zones: Leader+Life / Character row (5 slots) / Stage / DON pool / Deck pile / Trash pile. Each zone labeled. Player active glow if `state.activePlayer === playerIndex && !priorityWindow`.

Use `globals.css` additions from spec §6.

No interactions yet — pure rendering. Click handlers come in Task 7+.

Commit: `feat(web): add board layout with tabletop styles`.

---

## Task 6: Cards in play — LeaderCard + CharacterCard + Life stack + Hand

**Files:**

- Create: `apps/web/src/app/play/[gameId]/_components/leader-card.tsx`
- Create: `apps/web/src/app/play/[gameId]/_components/character-card.tsx`
- Create: `apps/web/src/app/play/[gameId]/_components/hand.tsx`
- Create: `apps/web/src/app/play/[gameId]/_components/life-stack.tsx`

`LeaderCard`: image + life count badge ("3/4"). Rested rotates 90°.

`CharacterCard`: image + power badge (current = base + attachedDon·1000 + powerThisTurn) + quantity of attached DON. Rested rotates 90°. Summoning sickness = slight opacity + icon.

`Hand`: shows cards as row at bottom. For hotseat, `isHidden` prop → render back-of-card stack with count.

`LifeStack`: stack of face-down cards (top card shown face-down, count overlay).

All use `next/image` with src from `card.imagePath` pulled from catalog. No interactions yet — hook up in Task 7.

Commit: `feat(web): add LeaderCard/CharacterCard/Hand/LifeStack rendering`.

---

## Task 7: DON pool + action bar + phase indicator

**Files:**

- Create: `apps/web/src/app/play/[gameId]/_components/don-pool.tsx`
- Create: `apps/web/src/app/play/[gameId]/_components/action-bar.tsx`

`DonPool`: count of active + rested DON. Active DON clickable (will be wired to AttachDon in Task 9). For now only visual.

`ActionBar`: shows current phase ("Main phase — P0's turn"), and buttons:

- `PassPhase` (visible in Refresh/Draw/Don)
- `EndTurn` (visible in Main)
- `Keep` / `Mulligan` during Mulligan (actually these live in the priority modal, Task 10)
- Dispatch via `useGame()`.

Wire PassPhase + EndTurn so player can at least advance phases without playing any cards — this allows an empty game to run to timeout eventually (deck decking). Click → `dispatch({ kind: 'PassPhase', player: state.activePlayer })`.

Commit: `feat(web): add DON pool and action bar with PassPhase/EndTurn`.

---

## Task 8: Priority modal — Mulligan

**Files:**

- Create: `apps/web/src/app/play/[gameId]/_components/priority-modal.tsx`

Reads `state.priorityWindow` and renders variant. Start with Mulligan:

Modal "You drew 5 cards. Mulligan?" → shows your 5-card hand (images) → buttons "Keep" | "Mulligan (redraw 5)".

On click → `dispatch({ kind: 'Mulligan', player: pw.player, mulligan: bool })`.

Commit: `feat(web): add priority modal with Mulligan variant`.

---

## Task 9: Play cards from hand — click-to-select + context menu + AttachDon + ActivateMain

**Files:**

- Modify: `apps/web/src/app/play/[gameId]/_components/hand.tsx`
- Create: `apps/web/src/app/play/[gameId]/_components/action-menu.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/don-pool.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/leader-card.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/character-card.tsx`

Flow:

- Click a hand card → show `ActionMenu` with options based on card type:
  - CHARACTER → "Play as Character"
  - EVENT → "Play as Event"
  - STAGE → "Play as Stage"
  - Always "View details" (reuse `CardDetailDialog` from Fase 1)
- Choose → dispatch `PlayCharacter/Event/Stage` with handIndex + donSpent=0 (MVP: no DON boost at play; advanced in polish).
- Click DON pool → "Attach to Leader" (simple MVP — dispatches `AttachDon` with leader target). Later iteration: pick target.
- Click own Leader with Activate:Main effect → dispatch `ActivateMain`.
- Click own Character with Activate:Main → dispatch `ActivateMain`.

If error from engine, show toast (add `sonner` if convenient or simple div overlay for 3s).

Commit: `feat(web): wire hand play + DON attach + Activate:Main`.

---

## Task 10: Attack flow — target picker

**Files:**

- Create: `apps/web/src/app/play/[gameId]/_components/target-picker.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/leader-card.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/character-card.tsx`

Click own active leader/character (no rested) during Main → `ActionMenu`: "Attack" | "Activate" (if applicable) | "View".

Click Attack → `TargetPicker` overlay highlights opponent's Leader + rested Characters → click → dispatch `DeclareAttack`.

`DeclareAttack` opens Counter Step (priorityWindow). Priority modal variant for CounterStep shown in Task 11.

Commit: `feat(web): add Attack flow with target picker`.

---

## Task 11: Priority modal — Counter / Blocker / Trigger variants

**Files:**

- Modify: `apps/web/src/app/play/[gameId]/_components/priority-modal.tsx`

Complete the modal with all priority window kinds:

- **CounterStep**: "Opponent attacks [leader/char]. Power: X vs Y." → show defender's hand filtered to cards with `counter > 0` → click to play one (dispatch `PlayCounter`). Button "Decline counter" → dispatch `DeclineCounter`.

- **BlockerStep**: "Pick a Blocker to redirect this attack" → list defender's available blockers → click to redirect (dispatch `UseBlocker`). Button "Decline".

- **TriggerStep**: "Your Life revealed [CardName]. Trigger: [effect description]. Activate?" → "Yes" | "No" → dispatch `ActivateTrigger { activate: bool }`.

Each variant is self-contained; the parent `PriorityModal` switches on `priorityWindow.kind`.

Commit: `feat(web): add Counter/Blocker/Trigger priority modal variants`.

---

## Task 12: Hotseat handoff + game log + game over screen

**Files:**

- Create: `apps/web/src/app/play/[gameId]/_components/hotseat-handoff.tsx`
- Create: `apps/web/src/app/play/[gameId]/_components/game-log.tsx`
- Create: `apps/web/src/app/play/[gameId]/_components/game-over.tsx`
- Modify: `apps/web/src/app/play/[gameId]/_components/board.tsx` — mount these conditionally

`HotseatHandoff`: full-screen overlay shown when `state.turn > 0 && state.phase === 'Refresh' && no priorityWindow && just transitioned` (track via state comparison or just trigger on phase change). Message: "Pass device to {opponent.playerId}. Click to continue." Button dismisses.

Simplification: expose a toggle/button "Pass device" in ActionBar that, when clicked after EndTurn, shows the overlay; otherwise ActionBar shows the next player's actions directly. MVP: show overlay automatically when `activePlayer` flips.

`GameLog`: right sidebar, renders `events` from context (last 50). Each event rendered as concise line: `"P0 played OP01-013"`, `"P1 leader attacked P0 leader"`, etc.

`GameOver`: overlay when `state.winner !== null`. Shows "Winner: {p}". Buttons "Play again" (redirect `/play`) + "Home" (redirect `/`).

Commit: `feat(web): add hotseat handoff, game log and game over screen`.

---

## Task 13: Smoke + polish + exit criteria

**Files:** Cualquier fix pequeño + pequeños ajustes visuales.

**Step 1:** Full gates

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
```

**Step 2:** Start dev server, manually smoke-test:

- Crear 2 decks en /builder (si no existen).
- Ir a /play, elegir ambos, start.
- Jugar ~3-5 turnos simulando 2 jugadores.
- Provocar Counter Step (atacar con cartas).
- Ejecutar un Blocker si hay.
- Si Life revela Trigger, verificar que aparece modal.
- Terminar partida (o pasar turnos hasta que deck se vacíe → winner).
- Verificar Game Over.

Si algo falla:

- UI: fix + commit `fix(web): ...`.
- Engine: NO tocar (fuera de scope; engine ya pasó review en Fase 3). Documentar como concern.

**Step 3:** Verificar exit criteria spec §8:

- [ ] /play acepta 2 decks + seed y arranca
- [ ] Todas las zonas visibles para ambos jugadores
- [ ] Counter Step en modal explícito, no ambiguo
- [ ] Blocker modal aparece cuando aplica
- [ ] Trigger modal aparece cuando Life revela Trigger
- [ ] Hotseat handoff funciona
- [ ] Game over aparece al alcanzar winner
- [ ] Gates verdes

**Step 4:** Si hubo commits de fix, sigue a cierre de fase. Si no, no commit adicional.

---

## Exit criteria

- [ ] catalog-builder + deck-loader tests verdes
- [ ] /api/games valida y devuelve MatchSetup correcto
- [ ] /play permite pickear 2 decks + seed y arrancar
- [ ] Board renderiza todas las zonas para ambos jugadores
- [ ] Mulligan modal funciona
- [ ] Play card (Character/Event/Stage) funciona
- [ ] AttachDon, ActivateMain funcionan
- [ ] DeclareAttack + Counter Step + Blocker Step + Trigger Step funcionan en modales
- [ ] HotseatHandoff entre turnos funciona
- [ ] GameLog muestra eventos
- [ ] GameOver aparece al alcanzar winner
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` verdes
- [ ] Smoke manual: partida OP01 completa sin errores de engine

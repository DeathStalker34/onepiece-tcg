# @optcg/engine

Pure TypeScript engine for a One Piece TCG simulator. Consumes `CardStatic` + `MatchSetup` + `Action`s; produces deterministic `GameState` evolution.

## Public contract

| Export               | Signature                                                                 |
| -------------------- | ------------------------------------------------------------------------- |
| `createInitialState` | `(setup: MatchSetup) => GameState`                                        |
| `apply`              | `(state: GameState, action: Action) => ApplyResult`                       |
| `validateDeck`       | `(draft: DeckDraft, cardIndex: Map<string, CardRow>) => ValidationResult` |

`ApplyResult = { state, events, legalActions, error? }`. On error, `state === inputState`.

## Invariants

- **No framework deps.** ESLint blocks `react*`, `next*`, `@optcg/card-data`, `@prisma/client`, and `Math.random()` inside `packages/engine/**`.
- **`GameState` 100% JSON-serializable.** No Map/Set/Date/functions/class instances.
- **`apply` is pure.** Input state never mutated.
- **Determinism.** Seeded PRNG (mulberry32). Same `seed + action sequence` → identical `GameState`.
- **Coverage ≥85%** enforced by Vitest (`lines/branches/functions/statements`).

## Test matrix

| Archivo                 | Qué cubre                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rng.test.ts`           | PRNG determinismo, shuffle, nextInt range, serializable pointer                                                                                    |
| `immutable.test.ts`     | Helpers puros (updateAt / removeAt / replaceWhere / removeWhere)                                                                                   |
| `deck.test.ts`          | `validateDeck` — leader presente, 50 cartas, max 4 copias, compatibilidad de colores                                                               |
| `setup.test.ts`         | `createInitialState` — shuffle determinista, mulligan window, life/hand/deck size                                                                  |
| `phases.test.ts`        | Mulligan flow, Refresh/Draw/DON/End, first-turn skip, EndTurn, PlayCharacter/Event/Stage, AttachDon, ActivateMain, OnPlay wiring                   |
| `combat.test.ts`        | DeclareAttack, CounterStep (multi-counter), Blocker redirect, resolve (Life/Character KO), Trigger step, DoubleAttack, Banish keyword, OnKO wiring |
| `effects.test.ts`       | Cada Effect kind (draw/ko/banish/returnToHand/power/search/sequence/choice/manual)                                                                 |
| `library.test.ts`       | CARD_EFFECT_LIBRARY frozen; getEffectsForCard fallback                                                                                             |
| `e2e-game.test.ts`      | Partida scriptada completa hasta GameOver; determinismo 10 runs con misma seed                                                                     |
| `coverage-gaps.test.ts` | Guardas de fase/priority, ramas de target (ownCharacter/opponentLeader), search desde trash, límite de mano en End, acciones desconocidas          |

## Architectural notes

- `GameState.catalog` se pasa en `MatchSetup` y se arrastra por el estado — el engine no lo busca externamente.
- `priorityWindow` discriminated union modela pasos que requieren input del jugador no-activo (Counter, Blocker, Trigger, Mulligan).
- Efectos declarativos (`Effect`) resueltos por `applyEffect` con un `EffectContext { sourcePlayer, sourceCardId }`.
- `TriggeredEffect` conecta a hooks (OnPlay, OnKO, OnAttack, Activate:Main, EndOfTurn, Trigger) vía `triggerHook()` en los handlers respectivos.
- Simplificación Fase 3: Blocker redirect no re-abre Counter Step; `choice` effects toman `options[0]` (UI decidirá en Fase 4); `search` toma primera coincidencia del deck/trash.

## Referencias

- Spec: `docs/superpowers/specs/2026-04-20-fase-3-engine-core-design.md`
- Plan: `docs/superpowers/plans/2026-04-20-fase-3-engine-core.md`
- Parent spec: `docs/superpowers/specs/2026-04-17-optcg-sim-design.md`

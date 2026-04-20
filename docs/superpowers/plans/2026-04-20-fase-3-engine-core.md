# Fase 3 — Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Engine puro en `packages/engine` capaz de correr partidas completas de OPTCG dadas decklists + seed. Determinista. Cobertura ≥85%.

**Architecture:** Ver spec `docs/superpowers/specs/2026-04-20-fase-3-engine-core-design.md`. TS puro, 0 deps de framework, state 100% JSON-serializable, PRNG seedeable.

**Tech Stack:** TypeScript strict, Vitest con threshold 85%, zod (opcional para validators internos).

**Branch:** `feature/fase-3-engine-core`.

**Modo autónomo:** plan auto-aprobado. Solo halt en decisiones críticas (schema incompatible, blocker externo).

**Disciplina estricta:**

- Cada task empieza con tests rojos, implementa, verifica verde, commit con trailer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Ningún `any`, ningún `Math.random` (regla ESLint lo bloqueará).
- Cada task deja `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` verdes antes del commit.
- No amend, no force-push, no `--no-verify`.

---

## Task 1: Engine guards — ESLint rules + vitest threshold activado

**Files:**

- Modify: `eslint.config.js` (root — añadir regla por-package)
- Modify: `packages/engine/vitest.config.ts` (activar threshold 85%)

**Step 1:** Editar `eslint.config.js` root. Después del bloque TypeScript general, añadir un nuevo bloque de reglas que aplique solo a `packages/engine/**`:

```js
// Engine — hard isolation rules
{
  files: ['packages/engine/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: '@optcg/card-data', message: 'packages/engine must not import from card-data.' },
        { name: '@prisma/client', message: 'packages/engine must not touch Prisma.' },
      ],
      patterns: [
        { group: ['react', 'react/*', 'react-dom/*', 'next', 'next/*'], message: 'packages/engine must not import from React/Next.' },
      ],
    }],
    'no-restricted-syntax': ['error', {
      selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
      message: 'Use the injected PRNG (rng.ts) — never Math.random in engine code.',
    }],
  },
},
```

**Step 2:** Editar `packages/engine/vitest.config.ts` — en el bloque `coverage.thresholds` asegurar `lines/branches/functions/statements: 85`. Si ya están así desde Fase 0, verificar y no tocar.

Leer el archivo antes de editar; si ya está bien, solo confirmar en el report.

**Step 3:** Gates + commit

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
git add eslint.config.js packages/engine/vitest.config.ts
git commit -m "$(cat <<'EOF'
chore(engine): activate 85% coverage threshold and isolation lint rules

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Si el vitest.config.ts ya tenía el threshold (Fase 0 lo dejó opt-in según spec), este commit solo añade las reglas ESLint; ajustar mensaje si es así.

---

## Task 2: PRNG + inmutabilidad helpers (TDD)

**Files:**

- Create: `packages/engine/src/rng.ts`
- Create: `packages/engine/src/helpers/immutable.ts`
- Create: `packages/engine/tests/rng.test.ts`
- Create: `packages/engine/tests/immutable.test.ts`
- Modify: `packages/engine/src/index.ts` (borrar smoke test si existe y dejarlo vacío en plan — Task 3 lo puebla)

**Step 1: RNG — red test + implementation.**

`rng.ts` contrato:

```ts
export interface RngState {
  seed: number;
  pointer: number;
}

export function createRng(seed: number): RngState;
export function nextFloat(rng: RngState): { value: number; rng: RngState }; // [0,1)
export function nextInt(rng: RngState, maxExclusive: number): { value: number; rng: RngState };
export function shuffle<T>(arr: readonly T[], rng: RngState): { result: T[]; rng: RngState };
```

Algoritmo: **mulberry32** (32-bit PRNG determinista, implementación clásica). Fuente canonical:

```ts
function mulberry32(a: number): number {
  a = (a + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

En el contexto del PRNG serializable: `pointer` es un contador; cada `nextFloat(rng)` aumenta pointer en 1 y devuelve `mulberry32(seed + pointer)`. Esto garantiza que dados seed+pointer el siguiente número es determinista. Fisher-Yates shuffle usando `nextInt`.

Tests (rng.test.ts) — 8 tests mínimo:

- Same seed → same first 10 floats.
- `nextInt(rng, 5)` respeta `[0, 5)`.
- `shuffle` con 100 elementos no pierde ni duplica.
- `shuffle` determinista: dos shuffles con misma seed → mismo orden.
- `nextFloat` nunca devuelve ≥1 o <0 sobre 1000 invocaciones.
- Empty array shuffle → empty array.
- `pointer` avanza por 1 en cada next.
- JSON.stringify de `RngState` preserva seed+pointer.

**Step 2: Immutable helpers — red test + implementation.**

`helpers/immutable.ts`:

```ts
export function updateAt<T>(arr: readonly T[], index: number, value: T): T[];
export function removeAt<T>(arr: readonly T[], index: number): T[];
export function replaceWhere<T>(
  arr: readonly T[],
  predicate: (t: T) => boolean,
  update: (t: T) => T,
): T[];
export function removeWhere<T>(arr: readonly T[], predicate: (t: T) => boolean): T[];
```

Tests — 4–6 tests cubriendo cada helper, no mutación del input, out-of-bounds, predicate no match (devuelve mismo contenido).

**Step 3: Limpiar index.ts**

`packages/engine/src/index.ts`: dejar como placeholder. Task 3 lo poblará. Por ahora:

```ts
// packages/engine/src/index.ts
// Fase 3 — populated incrementally by subsequent tasks.
export {};
```

Si existe un test smoke de Fase 0 (`tests/smoke.test.ts`), mantenerlo si sigue pasando; si falla por el cambio de index, borrarlo.

**Step 4:** Gates + commit

```bash
pnpm --filter @optcg/engine test
pnpm format:check && pnpm lint && pnpm typecheck
git add packages/engine/src/rng.ts packages/engine/src/helpers packages/engine/tests/rng.test.ts packages/engine/tests/immutable.test.ts packages/engine/src/index.ts packages/engine/tests/smoke.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): add seeded PRNG and immutable array helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Sólo incluir `tests/smoke.test.ts` en el `git add` si se borró/modificó.)

---

## Task 3: Core types

**Files:**

- Create: `packages/engine/src/types/card.ts`
- Create: `packages/engine/src/types/state.ts`
- Create: `packages/engine/src/types/action.ts`
- Create: `packages/engine/src/types/event.ts`
- Create: `packages/engine/src/types/error.ts`
- Modify: `packages/engine/src/index.ts` — re-exportar

Transcribir los tipos tal cual del spec §5 (card / state / action / event / error). Todos los interfaces + discriminated unions + const arrays (`KEYWORDS`, `CARD_TYPES`) + type aliases.

Sin tests propios — tipos no se testean directamente. Verificación: `pnpm --filter @optcg/engine typecheck` debe pasar y todos los re-exports deben resolverse desde `index.ts`.

Actualizar `index.ts`:

```ts
export type * from './types/card';
export type * from './types/state';
export type * from './types/action';
export type * from './types/event';
export type * from './types/error';
export { KEYWORDS } from './types/card';
export { createRng, nextFloat, nextInt, shuffle } from './rng';
export type { RngState } from './rng';
```

Gates + commit `feat(engine): add core types for GameState, Action, Effect, Event, Error`.

---

## Task 4: Move deck-validation — engine + update web

**Files:**

- Create: `packages/engine/src/deck.ts` (contenido idéntico al `deck-validation.ts` del web)
- Create: `packages/engine/tests/deck.test.ts` (migra los 7 tests)
- Delete: `apps/web/src/lib/deck-validation.ts`
- Delete: `apps/web/src/lib/deck-validation.test.ts`
- Modify: `apps/web/src/app/builder/[deckId]/_components/deck-panel.tsx` — cambiar `import ... from '@/lib/deck-validation'` → `import ... from '@optcg/engine'`
- Modify: `apps/web/package.json` — añadir `"@optcg/engine": "workspace:*"` a `dependencies`
- Modify: `packages/engine/src/index.ts` — re-exportar `validateDeck` y tipos

**Step 1:** Copiar el contenido exacto de `apps/web/src/lib/deck-validation.ts` → `packages/engine/src/deck.ts`. Exportar `validateDeck`, `DeckDraft`, `CardRow`, `ValidationResult`, `ValidationIssue`.

**Step 2:** Copiar tests a `packages/engine/tests/deck.test.ts` ajustando el import: `from '../src/deck'`.

**Step 3:** Añadir `@optcg/engine` al `apps/web/package.json` dependencies: `"@optcg/engine": "workspace:*"`. Run `pnpm install`.

**Step 4:** Editar `deck-panel.tsx` para importar `validateDeck, type ValidationResult, type CardRow` desde `@optcg/engine` en vez de `@/lib/deck-validation`.

**Step 5:** Borrar ambos archivos de `apps/web/src/lib/deck-validation.*`.

**Step 6:** Re-export en engine index:

```ts
export { validateDeck } from './deck';
export type { DeckDraft, CardRow, ValidationResult, ValidationIssue } from './deck';
```

**Step 7:** Gates — 7 tests del deck pasan en engine; web sigue verde.

Commit: `refactor: move deck-validation from apps/web to packages/engine`.

---

## Task 5: Test fixtures — CardStatic catalog + decks

**Files:**

- Create: `packages/engine/tests/fixtures/test-cards.ts`
- Create: `packages/engine/tests/fixtures/simple-red-deck.ts`

**Step 1:** `test-cards.ts` exporta `TEST_CATALOG: Record<string, CardStatic>` con ≥15 cartas:

- 2 leaders (ambos Red para simetría del e2e; ambos con 4 life, 5000 power).
- 2 characters básicos cost 1 power 2000 counter 1000 (para filler).
- 1 character con keyword **Rush** (cost 4, power 5000).
- 1 character con keyword **Blocker** (cost 3, power 4000).
- 1 character con keyword **Counter** (cost 2, power 2000, counter 2000).
- 1 character con keyword **DoubleAttack** (cost 5, power 6000).
- 1 character con keyword **Banish** (cost 3, power 4000).
- 1 character con OnPlay → draw 1 (cost 2, power 3000).
- 1 character con OnKO → banish opponent character (cost 4, power 4000).
- 1 character con Trigger → draw 1 (cost 2, power 3000, counter 1000).
- 1 event con `ko { kind: opponentCharacter }` (cost 4).
- 1 event con `power +2000` sobre leader this turn (cost 1).

IDs sintéticos: `TEST-LEADER-01`, `TEST-LEADER-02`, `TEST-CHAR-BASIC-01`, ... prefijo `TEST-` para indicar que son ficticios (no apitcg).

**Step 2:** `simple-red-deck.ts` exporta `simpleRedDeck50(): string[]` devolviendo un array de 50 IDs del catalog (repeticiones max 4 por ID según regla OPTCG). Un helper `buildCatalog()` que combina un leader + deck en el `catalog` params del `MatchSetup`.

Sin tests directos — son fixtures. Gates solo verifican typecheck.

Commit: `test(engine): add CardStatic catalog and 50-card red deck fixtures`.

---

## Task 6: createInitialState + Mulligan flow (TDD)

**Files:**

- Create: `packages/engine/src/setup.ts`
- Create: `packages/engine/tests/setup.test.ts`

**Step 1:** Red test (`setup.test.ts`) — ≥8 tests:

- `createInitialState` con 2 players válidos → state.players.length === 2.
- Cada player tiene hand de 5 cartas y deck de 50-5-life.
- `life` cards iguales al `leader.life` (4 si ambos leaders son 4-life).
- `donDeck === 10` cada player.
- `donActive === 0, donRested === 0`.
- `turn === 0, activePlayer === firstPlayer, phase === 'Setup'`.
- `priorityWindow.kind === 'Mulligan'`, player = first.
- Determinismo: misma seed → misma hand inicial.
- `winner === null, log === []`.

**Step 2:** Implementar:

```ts
export function createInitialState(setup: MatchSetup): GameState {
  // shuffle each deck with the seed
  // top N=life goes to life area, next 5 to hand, rest stays in deck
  // ...
}
```

Uso de `shuffle` del `rng.ts`. Arrays al top son index 0.

**Step 3:** Mulligan flow vive dentro del orquestador — Task 7 lo maneja al procesar `Action.kind === 'Mulligan'`. `setup.ts` solo crea el estado con `priorityWindow: { kind: 'Mulligan', player: first }`.

Commit: `feat(engine): add createInitialState with mulligan priority window`.

---

## Task 7: apply orchestrator + legal-actions + Refresh/Draw/DON/End phases (TDD)

**Files:**

- Create: `packages/engine/src/apply.ts`
- Create: `packages/engine/src/helpers/legal-actions.ts`
- Create: `packages/engine/src/phases/refresh.ts`
- Create: `packages/engine/src/phases/draw.ts`
- Create: `packages/engine/src/phases/don.ts`
- Create: `packages/engine/src/phases/end.ts`
- Create: `packages/engine/tests/phases.test.ts`

**Step 1:** `apply(state, action): ApplyResult`:

- Validar priorityWindow (si hay window abierta, solo acepta actions compatibles con ella; error `NotYourPriority` si no).
- Dispatch por `action.kind`:
  - `Mulligan` → aplica mulligan si true (shuffle hand al deck + draw 5 nuevo), cierra priorityWindow. Si ambos players ya han decidido, avanza `phase: 'Refresh'` y limpia `priorityWindow`.
  - `PassPhase` → avanza al siguiente phase (Refresh→Draw→DON→Main→End; End dispara cambio de activePlayer + Refresh del otro).
  - `EndTurn` (solo en Main): salta a End phase directamente.
  - Main actions → delegan a `phases/main.ts` (Task 8).
  - Combat → delegan a `combat/*.ts` (Tasks 10-12).
- Devolver `{ state: newState, events, legalActions, error? }`.
- Si `error` presente, `state = inputState` (no cambios), events=[], legalActions=[computed sobre inputState].

**Step 2:** `legal-actions.ts`:

```ts
export function computeLegalActions(state: GameState): Action[];
```

Casos:

- `priorityWindow.kind === 'Mulligan'` → `Mulligan { player, mulligan: true }` + `Mulligan { player, mulligan: false }`.
- `phase === 'Main'` → PlayCharacter/Event/Stage si cost/color válido; AttachDon si `donActive > 0`; ActivateMain si hay character con Activate:Main disponible; DeclareAttack si characters o leader pueden atacar; `EndTurn`.
- `priorityWindow.kind === 'CounterStep'` → para cada counter card en la mano: `PlayCounter { handIndex }`; `DeclineCounter`.
- etc.

No hace falta ser exhaustivo en Task 7 — se va completando según avanzan Tasks 8-12. En Task 7 cubrimos al menos los Mulligan + PassPhase + EndTurn.

**Step 3:** Phase logic (stateless, pure):

- `refresh.ts`: todas las cards del active pasan de rested=true a rested=false. DON: `donActive += donRested; donRested = 0`.
- `draw.ts`: si `isFirstTurnOfFirstPlayer`, skip. Si no, mueve top of deck a hand. Si deck vacío → `winner = otherPlayer`.
- `don.ts`: añade 2 al `donActive` tomando de `donDeck` (1 si `isFirstTurnOfFirstPlayer`). Cap 10 combined.
- `end.ts`: resetea `powerThisTurn` en leader + todos los characters. `attachedDon` regresa a `donActive` del respectivo. `summoningSickness` de todos → false. Hand > 10 → descartar al trash (para e2e scriptado, el player activo elige; como fallback, descarta el tail).
- Tras End: `activePlayer = 1 - activePlayer`, `turn += 1`, `phase = 'Refresh'`, `isFirstTurnOfFirstPlayer = false` (una vez que el primer player termine su primer turno).

**Step 4:** Tests (phases.test.ts) — ≥10:

- PassPhase desde Refresh → Draw → DON → Main.
- Mulligan true: hand shuffled back, new hand of 5.
- Mulligan false: hand keeps.
- Both players decide mulligan → priorityWindow cierra, phase=Refresh.
- First turn of first player: Draw skipped, DON=1 (no 2).
- Refresh activa rested DON y characters.
- End phase: powerThisTurn reset, attachedDon resets, summoningSickness off.
- Deck empty on Draw → winner = other player.
- Hand > 10 at End → trash excedente.
- `activePlayer` alterna tras End.

**Step 5:** Gates + commit `feat(engine): add apply orchestrator, legal-actions and phase transitions (Refresh/Draw/DON/End)`.

---

## Task 8: Main phase — play Character/Event/Stage (TDD)

**Files:**

- Create: `packages/engine/src/phases/main.ts`
- Modify: `packages/engine/src/apply.ts` — dispatch Main actions to `main.ts`
- Modify: `packages/engine/tests/phases.test.ts` — añadir tests main

**Lógica:**

- `PlayCharacter`: valida `phase === 'Main'` + activePlayer. Toma card en `handIndex`. Verifica cost (donActive ≥ card.cost - donSpent, donSpent ≤ donActive). Verifica color compatible con leader. Verifica `characters.length < 5`. Paga DON (restar de donActive). Mueve card de hand al characters array como `CharacterInPlay { instanceId (rng.next()), rested: false, summoningSickness: !keyword.Rush, attachedDon: 0, powerThisTurn: 0 }`. Dispara `OnPlay` si corresponde (Task 14).
- `PlayEvent`: similar al anterior pero ejecuta su efecto `OnPlay` y manda card a trash. Efectos usan `effects/executor.ts` (Task 13).
- `PlayStage`: reemplaza `state.stage` si existe (al trash el anterior).

**Tests** — ≥8:

- Play character válido: character entra active (o sticky depending on Rush), DON restado correcto.
- Cost insuficiente → `NotEnoughDon`.
- Color mismatch → `ColorMismatch`.
- Ya 5 characters → `MaxCharactersReached`.
- Rush character: summoningSickness=false.
- No-Rush: summoningSickness=true.
- PlayEvent ejecuta efecto (mock test con draw 1 efecto).
- PlayStage reemplaza previous.

Commit: `feat(engine): add Main phase handlers (PlayCharacter/PlayEvent/PlayStage)`.

---

## Task 9: Main phase — AttachDon + Activate:Main (TDD)

**Files:**

- Modify: `packages/engine/src/phases/main.ts`
- Modify: `packages/engine/tests/phases.test.ts`

**Lógica:**

- `AttachDon`: toma 1 de `donActive`, lo añade a `attachedDon` del target (Leader o Character). Emite `DonAttached`. Limita al spec: "You may attach any number of DON" — 1 por action, el cliente hace N actions.
- `ActivateMain`: valida `phase === 'Main'`, source has `TriggeredEffect { trigger: 'Activate:Main' }`, pay cost (`rest self`), execute effect via executor. Marca `rested=true`.

**Tests** — ≥5:

- AttachDon a Leader aumenta `leader.attachedDon` y decrementa `donActive`.
- No DON → `NotEnoughDon`.
- ActivateMain on Zoro leader ejecuta `power +1000 this turn`.
- ActivateMain en rested → `CharacterIsRested`.
- Character sin Activate:Main → `InvalidTarget`.

Commit: `feat(engine): add AttachDon and ActivateMain handlers`.

---

## Task 10: Combat — DeclareAttack + CounterStep (TDD)

**Files:**

- Create: `packages/engine/src/combat/declare.ts`
- Create: `packages/engine/src/combat/counter-step.ts`
- Create: `packages/engine/tests/combat.test.ts`
- Modify: `packages/engine/src/apply.ts` — dispatch DeclareAttack/PlayCounter/DeclineCounter

**Lógica:**

- `DeclareAttack`: valida atacante active, no rested, no summoningSickness (salvo Rush), target eligible (Leader siempre, Character solo si rested). Resta el atacante (rested=true). Calcula `attackPower`. Crea `priorityWindow: { kind: 'CounterStep', attacker, defender }`. Cambia el "priority" al defender.
- `PlayCounter`: valida priorityWindow=CounterStep y player=defender. Toma card en handIndex. Verifica `cardStatic.counter !== null && > 0`. Mueve card a trash. Aumenta `defender.defensePower += cardStatic.counter`. Mantiene priorityWindow abierta (puedes jugar múltiples counters).
- `DeclineCounter`: cierra CounterStep y dispara resolve (Task 11).

**Tests** — ≥8:

- Declarar ataque con leader → priorityWindow=CounterStep.
- Defender no puede declarar ataque durante CounterStep.
- Play counter → defensePower suma.
- DeclineCounter cierra el window (verificar priorityWindow=null o avanza a resolve).
- Attacker summoningSickness → error.
- Attacker rested → error.
- Target character active → error (debe estar rested).
- Rush bypass de summoningSickness.

Commit: `feat(engine): add DeclareAttack and CounterStep`.

---

## Task 11: Combat — resolve + Life + Trigger + DoubleAttack (TDD)

**Files:**

- Create: `packages/engine/src/combat/resolve.ts`
- Modify: `packages/engine/src/apply.ts`
- Modify: `packages/engine/src/combat/counter-step.ts` — llamar a resolve al cerrar CounterStep
- Modify: `packages/engine/tests/combat.test.ts`

**Lógica:**

- `resolve(state, attacker, defender)`:
  - Si `attackPower >= defensePower`:
    - Target=Character → remove del `characters` array. Si Banish → banishZone, else → trash. Dispara OnKO effects (Task 14). Emite `CharacterKod`.
    - Target=Leader → calcular lifeLoss (1 + DoubleAttack?1:0). Revelar top de life area. Mover a hand, O abrir `priorityWindow: { kind: 'TriggerStep', revealedCardId, owner: defender, triggerEffect }` si tiene Trigger. Si life vacío → `winner = attacker.owner`, `phase = 'GameOver'`.
  - Cerrar priorityWindow CounterStep (si venía de ahí).
- `ActivateTrigger { activate: true }`: ejecuta `triggerEffect` y mueve card a hand. Cierra TriggerStep.
- `ActivateTrigger { activate: false }`: salta trigger, mueve card a hand.

**Tests** — ≥10:

- Atacante > defender → character KO (to trash).
- Atacante > defender + Banish → to banishZone.
- Atacante < defender → atacante rested pero no damage.
- Leader attack: Life -1.
- DoubleAttack: Life -2.
- Trigger reveal → priorityWindow TriggerStep.
- ActivateTrigger true → effect + card to hand.
- ActivateTrigger false → card to hand, no effect.
- Life 0 → winner set, phase=GameOver.
- OnKO banish opp character dispara.

Commit: `feat(engine): add combat resolve with Life, Trigger and DoubleAttack`.

---

## Task 12: Combat — Blocker (TDD)

**Files:**

- Create: `packages/engine/src/combat/blocker.ts`
- Modify: `packages/engine/src/apply.ts`
- Modify: `packages/engine/src/combat/counter-step.ts` — antes de resolve, check blocker availability
- Modify: `packages/engine/tests/combat.test.ts`

**Lógica:**

- Al DeclareAttack, además de CounterStep, check si defensor tiene Character con Blocker keyword, active (rested=false), y no-usado-este-turno. Si sí, `priorityWindow` puede alternar: primero CounterStep, después si no se decline-bloq se pregunta blocker. Decisión de diseño: **PriorityWindow encadenadas**. Después de DeclineCounter, si hay blockers disponibles, abrir `BlockerStep`.
- `UseBlocker`: target del combate cambia al blocker character, blocker queda `rested=true` y marca `usedBlockerThisTurn=true`. Re-evalúa Counter Step del nuevo target (simplificación: no re-abrir Counter Step; spec OPTCG real lo permite pero para Fase 3 simplificamos — declaramos esto en decisiones). Ir a resolve.
- `DeclineBlocker`: ir a resolve con target original.

Decisión documentada en código: por simplicidad, Blocker redirect no re-abre Counter Step. Si el e2e test necesita ese caso, se ajusta.

**Tests** — ≥5:

- Blocker disponible → priorityWindow BlockerStep tras DeclineCounter.
- UseBlocker: target cambia, blocker queda rested.
- DeclineBlocker: target original, resolve inmediato.
- Blocker ya usado este turno no aparece como legal.
- Blocker rested no aparece.

Commit: `feat(engine): add Blocker redirect`.

---

## Task 13: Declarative Effect executor (TDD)

**Files:**

- Create: `packages/engine/src/effects/executor.ts`
- Create: `packages/engine/tests/effects.test.ts`

**Lógica:** `applyEffect(state, effect, context): { state, events }`:

- `draw { amount }`: mueve `amount` top-of-deck → hand. Si deck vacío, trigger loss.
- `ko { target }`: KO del target (mueve a trash/banish, OnKO).
- `power { target, delta, duration }`: aumenta `powerThisTurn` o `power` (permanent no común en TCG — por ahora equivale).
- `returnToHand { target }`: character/event del target regresa a hand.
- `banish { target }`: mover a banishZone.
- `search { from, filter, amount }`: para Fase 3 scriptado, scan + pick topmost matching. Si no hay UI real, ir al primero que cumpla filter.
- `sequence { steps }`: reduce steps secuencialmente.
- `choice { options }`: para Fase 3 se ejecuta `options[0]` por defecto; el e2e test pasa la elección en el Action extension (extendible).
- `manual { text }`: emite `EffectResolved` con `kind: 'manual'` y no hace nada mutating.

**Context** incluye: `sourcePlayer`, `sourceCardId`, `targetOverrides` (si el Action trae el target seleccionado).

**Tests** — ≥12 (uno por kind + edge cases).

Commit: `feat(engine): add declarative Effect executor`.

---

## Task 14: Triggers wiring — OnPlay / OnKO / Trigger / EndOfTurn

**Files:**

- Create: `packages/engine/src/effects/triggers.ts`
- Modify: `packages/engine/src/phases/main.ts` — OnPlay
- Modify: `packages/engine/src/combat/resolve.ts` — OnKO
- Modify: `packages/engine/src/phases/end.ts` — EndOfTurn
- Modify: `packages/engine/tests/effects.test.ts`

**Lógica:** funciones puras que, dado un evento del juego, buscan en `card.effects` los `TriggeredEffect` con `trigger === <hook>` y los ejecutan vía `applyEffect`. Una sola función general:

```ts
export function triggerHook(
  state: GameState,
  hook: TriggeredEffect['trigger'],
  sourceCardId: string,
  sourcePlayer: PlayerIndex,
  extra?: { targetOverride?: TargetSpec },
): { state: GameState; events: GameEvent[] };
```

Main/combat/end llaman a `triggerHook` en sus momentos.

**Tests:**

- Play character con OnPlay draw 1 → hand +1.
- KO character con OnKO ko opponent → opp character removed.
- Life reveal con Trigger → effect ran (ya cubierto en Task 11 resolve).
- End of turn effects: decrement+reset correctos.

Commit: `feat(engine): wire OnPlay/OnKO/Trigger/EndOfTurn hooks`.

---

## Task 15: Per-card overrides library

**Files:**

- Create: `packages/engine/src/effects/library.ts`
- Modify: `packages/engine/tests/fixtures/test-cards.ts` — asignar `effects: libraryOverrides['TEST-LEADER-01']` etc.

`library.ts` exporta `CARD_OVERRIDES: Record<string, TriggeredEffect[]>` para los ~15 cards del fixture + 2-3 reales (Zoro OP01-001, etc.). El fixture usa este map para poblar `effects` en cada CardStatic. Esto permite que:

- `library.ts` se expanda en Fase 7 sin tocar el fixture.
- El `catalog` de la Fase 4 (web consumer) use estos overrides + puede añadir los suyos.

Sin tests propios — cubiertos vía fixture usage.

Commit: `feat(engine): add per-card effect library with test overrides`.

---

## Task 16: End-to-end scripted game test (TDD)

**Files:**

- Create: `packages/engine/tests/e2e-game.test.ts`

**Objetivo:** escribir una secuencia de Actions que forma una partida scriptada completa desde Setup hasta GameOver. Dado una seed fija, la secuencia determinística debe:

1. Ambos players decide Mulligan=false.
2. Ambos players alternan turnos. Juegan cartas, atacan al Leader del otro.
3. Alguno de los dos pierde todas las vidas → GameOver.
4. `state.winner !== null` al final.
5. Se ejecuta en un loop de 10 iteraciones; cada iteración construye el state desde cero con la misma seed y la misma secuencia de Actions; todos los final states son `JSON.stringify`-idénticos.

Estructura del test:

```ts
const SEED = 12345;
const SCRIPTED_ACTIONS: Action[] = [
  { kind: 'Mulligan', player: 0, mulligan: false },
  { kind: 'Mulligan', player: 1, mulligan: false },
  // turn 1, player 0: PassPhase* x N to Main, play chars, attack
  // ...
];

it('runs a complete scripted game deterministically 10 times', () => {
  const finalStates: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    let state = createInitialState({ seed: SEED, firstPlayer: 0, players: [...], catalog: TEST_CATALOG });
    for (const action of SCRIPTED_ACTIONS) {
      const res = apply(state, action);
      if (res.error) throw new Error(`action ${JSON.stringify(action)} errored: ${JSON.stringify(res.error)}`);
      state = res.state;
    }
    expect(state.winner).not.toBeNull();
    finalStates.push(JSON.stringify(state));
  }
  expect(new Set(finalStates).size).toBe(1);
});
```

**Escribir la secuencia de Actions** es el grueso del trabajo. Requiere simular manualmente varios turnos. Mínimo 30-60 actions. Aproximadamente:

- Turno 1 P0: Refresh (auto, PassPhase), Draw skip, DON=1, Main: PassPhase (sin poder jugar nada cost>1 con 1 DON), EndTurn.
- Turno 1 P1: Refresh, Draw 1, DON=2, Main: play cost 1 char, EndTurn.
- Turno 2 P0: Refresh, Draw 1, DON+2=3, Main: play cost 2 char, DeclareAttack leader con Rush si hay, EndTurn.
- ...
- Continuar hasta que un leader pierde 4 lives.

El subagente debe iterar: correr el test, ver qué action falla, ajustar, repetir. Es esperable que tome varias iteraciones.

**Si el test no converge tras 5-6 intentos de tweak**, reportar DONE_WITH_CONCERNS con el estado actual y lo que falta. No es razonable pedir al subagente que debugue por horas.

Commit: `test(engine): add deterministic scripted e2e game`.

---

## Task 17: Coverage ≥85% + README

**Files:**

- Modify: tests varios (añadir tests hasta cubrir el threshold).
- Create: `packages/engine/README.md`

**Step 1:** Run coverage:

```bash
pnpm --filter @optcg/engine test:coverage
```

Mirar qué líneas/branches quedan descubiertas. Añadir tests específicos para cubrirlas. Priorizar branches sin cubrir.

**Step 2:** Si tras los tests extras sigue <85%, revisar si hay dead code o defensive coding innecesario. Limpiar / simplificar.

**Step 3:** Crear `packages/engine/README.md`:

```md
# @optcg/engine

Engine puro de OPTCG. Consume `CardStatic` + `MatchSetup` + `Action`s; produce `GameState`. Determinista dada una seed.

## Contrato público

- `createInitialState(setup: MatchSetup): GameState`
- `apply(state: GameState, action: Action): ApplyResult`
- `validateDeck(draft: DeckDraft, cardIndex: Map<string, CardRow>): ValidationResult`

## Invariantes

- Sin deps de framework (enforzado por ESLint en root).
- `GameState` JSON-serializable.
- `apply` puro (no muta input).
- PRNG seedeable (`rng: { seed, pointer }`).
- Cobertura ≥85% (CI enforced).

## Casos de test

| Archivo        | Qué cubre |
| -------------- | --------- |
| ... (rellenar) |

## Referencias

- Spec: `docs/superpowers/specs/2026-04-20-fase-3-engine-core-design.md`
- Reglas OPTCG: [link oficial si aplica]
```

**Step 4:** Gates finales: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` + `pnpm --filter @optcg/engine test:coverage` verde.

Commit: `docs(engine): add README with test matrix and bump coverage to 85%+`.

---

## Exit criteria

- [ ] `pnpm --filter @optcg/engine test` verde — todos los tests
- [ ] `pnpm --filter @optcg/engine test:coverage` ≥85% en las 4 dimensiones
- [ ] E2E scripted test: 10 runs deterministas, mismo state
- [ ] `apps/web` sigue construyendo tras mover `deck-validation`
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` verdes en root
- [ ] `packages/engine/README.md` con tabla de casos
- [ ] ESLint bloquea imports no permitidos en el engine (verify con un grep manual en git diff)

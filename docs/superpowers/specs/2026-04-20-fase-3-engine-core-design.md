# Fase 3 — Engine core (design)

**Fecha:** 2026-04-20
**Branch:** `feature/fase-3-engine-core`
**Spec padre:** [2026-04-17-optcg-sim-design.md](./2026-04-17-optcg-sim-design.md) §4, §11 Fase 3
**Modo:** desarrollo autónomo — plan auto-aprobado, solo halt en decisiones críticas.

## 1. Objetivo

Dejar un **engine puro de TypeScript** en `packages/engine` capaz de correr partidas completas de OPTCG dadas dos decklists validadas y una seed. Determinista (seed + secuencia de Actions → mismo GameState siempre). El engine es la única fuente de verdad de reglas; UI (Fase 4), IA (Fase 5) y servidor (Fase 6) consumen `apply(state, action)`.

El test de aceptación es una partida scriptada que llega hasta victoria sin intervención manual, en 10 ejecuciones la misma seed produce el mismo resultado.

## 2. Scope

**Dentro:**

- `packages/engine` con tipos + `createInitialState` + `apply` + `validateDeck` (movido desde `apps/web/src/lib`).
- PRNG seedeable y serializable.
- Fases del turno: Refresh, Draw, DON, Main, End, GameOver.
- Combate: DeclareAttack → Counter Step → resolve → Life loss → Trigger check.
- Keywords: Rush, Blocker, Counter, DoubleAttack, Banish, OnPlay, OnKO, Activate:Main, Trigger, `[DON!!xN]` cost boost.
- Sistema declarativo de efectos (`Effect` + `TriggeredEffect`) + ejecutor puro.
- Overrides de efectos para 5–10 cartas concretas (las que necesita el test e2e).
- Gate de cobertura **≥85% en `packages/engine`** activado en CI.
- Tabla de casos de test documentada en `packages/engine/README.md`.

**Fuera:**

- Parser de `effectText` → `Effect` (Fase 7 — "Parser de efectos declarativo ampliado").
- Efectos de la long-tail de cartas (≥70% de OP01) — Fase 7.
- UI del tablero (Fase 4).
- IA (Fase 5).
- Multiplayer / serialización en red (Fase 6).
- Mapeo `card-data.Card` → `CardStatic` en Fase 3: se hace a mano en los tests; en Fase 4 el web construirá el catálogo.
- Replays (Fase 7).

## 3. Arquitectura

```
packages/engine/
├── src/
│   ├── index.ts                     re-exports públicos
│   ├── types/
│   │   ├── card.ts                  CardStatic, Keyword, Effect, TriggeredEffect
│   │   ├── state.ts                 GameState, PlayerState, Character/Leader/StageInPlay, Phase, PriorityWindow
│   │   ├── action.ts                Action discriminated union
│   │   ├── event.ts                 GameEvent (para UI / log)
│   │   └── error.ts                 EngineError codes
│   ├── rng.ts                       PRNG (mulberry32), shuffle, pick
│   ├── deck.ts                      validateDeck (movido desde apps/web; reglas idénticas)
│   ├── setup.ts                     createInitialState
│   ├── apply.ts                     apply() orchestrator
│   ├── phases/
│   │   ├── refresh.ts               refresh phase logic
│   │   ├── draw.ts                  draw phase logic
│   │   ├── don.ts                   DON phase logic
│   │   ├── main.ts                  Main phase action handlers
│   │   └── end.ts                   End phase logic
│   ├── combat/
│   │   ├── declare.ts               DeclareAttack + legal target check
│   │   ├── counter-step.ts          Counter window orchestration
│   │   ├── resolve.ts               Final combat resolution (power compare, Life loss, Trigger)
│   │   └── blocker.ts               Blocker redirect
│   ├── effects/
│   │   ├── executor.ts              Pure Effect interpreter
│   │   ├── triggers.ts              Hooks for OnPlay/OnKO/Trigger/Activate:Main
│   │   └── library.ts               Per-card overrides (5-10 cartas)
│   └── helpers/
│       ├── immutable.ts             pure update helpers (updateAt, removeAt, etc.)
│       └── legal-actions.ts         compute legalActions given current state
├── tests/
│   ├── rng.test.ts
│   ├── deck.test.ts                 hereda tests de apps/web
│   ├── setup.test.ts
│   ├── phases.test.ts
│   ├── combat.test.ts
│   ├── effects.test.ts
│   ├── e2e-game.test.ts             partida scriptada completa (seed determinista 10 runs)
│   └── fixtures/
│       ├── simple-red-deck.ts       50-card mock deck con CardStatic
│       └── test-cards.ts            ~15 CardStatic objects para los tests
├── README.md                        tabla de casos, invariantes, contrato público
├── vitest.config.ts                 threshold 85%
├── tsconfig.json
└── package.json

apps/web/src/lib/deck-validation.ts  → ELIMINADO (movido al engine)
apps/web/src/lib/deck-validation.test.ts → ELIMINADO (tests migran al engine)
apps/web/src/app/builder/[deckId]/_components/deck-panel.tsx → import cambia a @optcg/engine
```

### 3.1 Invariantes (no negociables)

- **Sin deps de framework.** Engine no importa de React, Next, Prisma, Node APIs runtime (`fs`/`http`/`fetch`), `@optcg/card-data`. Solo TypeScript estándar + zod (si algún validator lo pide).
- **GameState 100% JSON-serializable.** Nada de `Map`/`Set`/`Date`/funciones/clases con métodos mutables. Arrays de primitivos + objetos planos.
- **`apply` es puro.** Input `state` nunca se muta; siempre devuelve un nuevo objeto. Inmutabilidad por construcción (spread/split); helpers en `immutable.ts` garantizan esto.
- **PRNG seedeable + estado serializable.** `GameState.rng = { seed, pointer }`. Cada `next()` avanza pointer determinísticamente. Mismo seed + misma secuencia → mismo resultado.
- **`legalActions` es un array serializable.** No funciones; solo Actions que el cliente puede emitir.
- **Cobertura ≥85%** en `packages/engine` como threshold de `vitest.config.ts`. CI falla si baja.

## 4. Contrato público

```ts
// packages/engine/src/index.ts
export function createInitialState(setup: MatchSetup): GameState;
export function apply(state: GameState, action: Action): ApplyResult;
export function validateDeck(draft: DeckDraft, cardIndex: Map<string, CardRow>): ValidationResult;

export type {
  GameState,
  PlayerState,
  Phase,
  PriorityWindow,
  Action,
  ApplyResult,
  EngineError,
  GameEvent,
  MatchSetup,
  PlayerSetup,
  CardStatic,
  CardFilter,
  Effect,
  TriggeredEffect,
  Keyword,
  DeckDraft,
  ValidationResult,
  ValidationIssue,
  CardRow,
};
```

`ApplyResult`:

```ts
interface ApplyResult {
  state: GameState; // nuevo estado
  events: GameEvent[]; // para animaciones / log
  legalActions: Action[]; // próximas acciones legales (para UI / IA)
  error?: EngineError; // si la acción era ilegal; state no cambia
}
```

Si `error` está presente, `state` === `inputState` (mismo reference). `events` y `legalActions` siempre presentes.

## 5. Modelo de datos

### 5.1 CardStatic

```ts
export const KEYWORDS = ['Rush', 'Blocker', 'Counter', 'DoubleAttack', 'Banish'] as const;
export type Keyword = (typeof KEYWORDS)[number];

export interface CardStatic {
  id: string; // "OP01-001"
  type: 'LEADER' | 'CHARACTER' | 'EVENT' | 'STAGE';
  colors: string[];
  cost: number | null; // null en LEADER
  power: number | null; // null en EVENT/STAGE
  life: number | null; // solo LEADER
  counter: number | null; // solo CHARACTER
  keywords: Keyword[];
  effects: TriggeredEffect[]; // catálogo declarativo; vacío si manual
  manualText: string | null; // fallback legible en la UI si no hay parser
}
```

Nota: `CardStatic.life` es el life del LEADER tal cual (no el workaround del adapter de Fase 1 — en Fase 3 el consumer del engine es responsable de pasar `life = cardDataRow.cost` para LEADERs). El engine no conoce apitcg.

### 5.2 Effect & TriggeredEffect

```ts
export type Effect =
  | { kind: 'draw'; amount: number }
  | { kind: 'search'; from: 'deck' | 'trash'; filter: CardFilter; amount: number }
  | { kind: 'ko'; target: TargetSpec }
  | { kind: 'power'; target: TargetSpec; delta: number; duration: 'thisTurn' | 'permanent' }
  | { kind: 'returnToHand'; target: TargetSpec }
  | { kind: 'banish'; target: TargetSpec }
  | { kind: 'sequence'; steps: Effect[] }
  | { kind: 'choice'; options: Effect[] }
  | { kind: 'manual'; text: string };

export interface TriggeredEffect {
  trigger: 'OnPlay' | 'OnKO' | 'OnAttack' | 'Activate:Main' | 'EndOfTurn' | 'Trigger';
  condition?: EffectCondition;
  cost?: EffectCost;
  effect: Effect;
}

export type TargetSpec =
  | { kind: 'self' }
  | { kind: 'opponentLeader' }
  | { kind: 'opponentCharacter'; filter?: CardFilter }
  | { kind: 'ownCharacter'; filter?: CardFilter };

export interface CardFilter {
  type?: CardStatic['type'];
  colors?: string[];
  costMax?: number;
  costMin?: number;
  keyword?: Keyword;
}

export interface EffectCost {
  rest?: 'self';
  donX?: number; // [DON!!xN] cost
  trashHand?: number;
}

export interface EffectCondition {
  onTurn?: 'yours' | 'opponents';
  attachedDonAtLeast?: number;
}
```

### 5.3 GameState

```ts
export type Phase = 'Setup' | 'Refresh' | 'Draw' | 'Don' | 'Main' | 'End' | 'GameOver';

export type PlayerIndex = 0 | 1;

export interface MatchSetup {
  seed: number;
  firstPlayer: PlayerIndex;
  players: [PlayerSetup, PlayerSetup];
  catalog: Record<string, CardStatic>; // by cardId
}

export interface PlayerSetup {
  playerId: string;
  leaderCardId: string;
  deck: string[]; // 50 card IDs, pre-validated
}

export interface GameState {
  turn: number;
  activePlayer: PlayerIndex;
  phase: Phase;
  priorityWindow: PriorityWindow | null;
  players: [PlayerState, PlayerState];
  rng: { seed: number; pointer: number };
  log: Action[]; // replay trail
  events: GameEvent[]; // reset each apply() — not cumulative
  winner: PlayerIndex | null;
  catalog: Record<string, CardStatic>; // carried through for effect lookups
  isFirstTurnOfFirstPlayer: boolean; // controls "no draw, DON=1" rule
}

export interface PlayerState {
  playerId: string;
  leader: LeaderInPlay;
  deck: string[]; // top at index 0
  hand: string[];
  life: string[]; // face-down; when lost, top goes to hand
  trash: string[];
  banishZone: string[]; // Banish keyword target
  characters: CharacterInPlay[]; // max 5 active
  stage: StageInPlay | null;
  donActive: number; // 0..10
  donRested: number; // 0..10; active+rested ≤ 10
  donDeck: number; // starts at 10
  mulliganTaken: boolean;
}

export interface LeaderInPlay {
  cardId: string;
  rested: boolean;
  attachedDon: number; // resets to 0 at end of turn
  powerThisTurn: number; // resets at end of turn
}

export interface CharacterInPlay {
  instanceId: string; // uuid deterministic from rng
  cardId: string;
  rested: boolean;
  attachedDon: number;
  powerThisTurn: number;
  summoningSickness: boolean; // false if Rush; toggles off at start of next turn
}

export interface StageInPlay {
  cardId: string;
}

export type PriorityWindow =
  | { kind: 'Mulligan'; player: PlayerIndex }
  | { kind: 'CounterStep'; attacker: AttackerRef; defender: DefenderRef }
  | { kind: 'TriggerStep'; revealedCardId: string; owner: PlayerIndex; triggerEffect: Effect }
  | { kind: 'BlockerStep'; attacker: AttackerRef; originalTarget: DefenderRef };

export interface AttackerRef {
  owner: PlayerIndex;
  source: { kind: 'Leader' } | { kind: 'Character'; instanceId: string };
  attackPower: number; // snapshotted at declare time
}

export interface DefenderRef {
  owner: PlayerIndex;
  target: { kind: 'Leader' } | { kind: 'Character'; instanceId: string };
  defensePower: number; // live; Counter Step adds to this
}
```

### 5.4 Action

```ts
export type Action =
  // Setup
  | { kind: 'Mulligan'; player: PlayerIndex; mulligan: boolean }
  // Phase transitions
  | { kind: 'PassPhase'; player: PlayerIndex }
  | { kind: 'EndTurn'; player: PlayerIndex }
  // Main phase
  | { kind: 'PlayCharacter'; player: PlayerIndex; handIndex: number; donSpent: number }
  | { kind: 'PlayEvent'; player: PlayerIndex; handIndex: number; donSpent: number }
  | { kind: 'PlayStage'; player: PlayerIndex; handIndex: number; donSpent: number }
  | {
      kind: 'AttachDon';
      player: PlayerIndex;
      target: { kind: 'Leader' } | { kind: 'Character'; instanceId: string };
    }
  | {
      kind: 'ActivateMain';
      player: PlayerIndex;
      source: { kind: 'Leader' } | { kind: 'Character'; instanceId: string };
    }
  // Combat
  | {
      kind: 'DeclareAttack';
      player: PlayerIndex;
      attacker: { kind: 'Leader' } | { kind: 'Character'; instanceId: string };
      target: { kind: 'Leader' } | { kind: 'Character'; instanceId: string; owner: PlayerIndex };
    }
  | { kind: 'PlayCounter'; player: PlayerIndex; handIndex: number }
  | { kind: 'DeclineCounter'; player: PlayerIndex }
  | { kind: 'UseBlocker'; player: PlayerIndex; blockerInstanceId: string }
  | { kind: 'DeclineBlocker'; player: PlayerIndex }
  | { kind: 'ActivateTrigger'; player: PlayerIndex; activate: boolean };
```

### 5.5 GameEvent

```ts
export type GameEvent =
  | { kind: 'PhaseEntered'; phase: Phase }
  | { kind: 'CardDrawn'; player: PlayerIndex; count: number }
  | { kind: 'CardPlayed'; player: PlayerIndex; cardId: string; donSpent: number }
  | { kind: 'DonAttached'; player: PlayerIndex; target: string; amount: number }
  | { kind: 'AttackDeclared'; attacker: string; target: string; power: number }
  | { kind: 'CounterPlayed'; player: PlayerIndex; cardId: string; counterAmount: number }
  | { kind: 'BlockerUsed'; blockerInstanceId: string }
  | { kind: 'CharacterKod'; instanceId: string; cardId: string }
  | { kind: 'LifeLost'; player: PlayerIndex; remaining: number; revealedCardId: string }
  | { kind: 'TriggerResolved'; cardId: string; activated: boolean }
  | { kind: 'EffectResolved'; effect: Effect; sourceCardId: string }
  | { kind: 'GameOver'; winner: PlayerIndex };
```

### 5.6 EngineError

```ts
export type EngineError =
  | { code: 'WrongPhase'; expected: Phase[]; actual: Phase }
  | { code: 'NotYourPriority' }
  | { code: 'NotEnoughDon'; need: number; have: number }
  | { code: 'InvalidTarget'; reason: string }
  | { code: 'CardNotInHand' }
  | { code: 'ColorMismatch' }
  | { code: 'MaxCharactersReached'; limit: 5 }
  | { code: 'CharacterAlreadyAttacked' }
  | { code: 'CharacterIsRested' }
  | { code: 'SummoningSickness' }
  | { code: 'GameAlreadyOver' }
  | { code: 'Unknown'; detail: string };
```

## 6. Reglas de juego (referencia OPTCG oficial)

### 6.1 Setup

1. Cada jugador coloca su LEADER.
2. Shuffle del deck (50).
3. Roba 5 cartas. Opción de mulligan (barajar 5 de vuelta al deck y robar 5 nuevas — una sola vez).
4. Coloca `leader.life` cartas del deck boca abajo en Life area.
5. Pon `donDeck = 10`.
6. `firstPlayer` empieza. `isFirstTurnOfFirstPlayer = true`.

### 6.2 Orden de fases (cada turno del jugador activo)

| Fase    | Qué ocurre                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refresh | Todas las cartas rested del activo pasan a active (Leader, Characters, DON).                                                                                                          |
| Draw    | Robar 1 carta. Si el deck está vacío, el jugador activo pierde. **Skip si `isFirstTurnOfFirstPlayer`**.                                                                               |
| DON     | Añadir 2 DON al donActive (cap 10). Skip 1 si `isFirstTurnOfFirstPlayer` (añadir solo 1).                                                                                             |
| Main    | Jugador activo puede hacer acciones (Play, AttachDon, ActivateMain, DeclareAttack). Pasa con `EndTurn`.                                                                               |
| End     | Resetear `powerThisTurn`, `attachedDon` (DON regresa a donActive/rested según estado), summoningSickness off, hand limit 10 (descarta excedente al trash). Trigger EndOfTurn effects. |

Al terminar End, `activePlayer` cambia, `turn += 1`, y se entra en Refresh del otro.

### 6.3 Reglas de combate

1. **DeclareAttack:** el atacante debe estar active. Se rested. `attackPower = basePower + attachedDon*1000 + powerThisTurn`.
2. **Target eligible:**
   - Leader: siempre legal.
   - Character opponent: debe estar **rested** (regla OPTCG: solo atacas characters rested).
3. **Counter Step:** defensor puede jugar cartas Counter de mano. Cada counter suma 1000/2000 al `defensePower`. Defensor emite `PlayCounter` (múltiples) o `DeclineCounter`. El counter va al trash tras jugarse.
4. **Blocker:** si el target es Leader o Character, el defensor tiene characters con keyword Blocker active y 1 uso/turno sin usar, puede redirigir el ataque a su Blocker (`UseBlocker`). El Blocker pasa a ser el nuevo target.
5. **Resolve:** si `attackPower >= defensePower`:
   - Target Character → KO'd (to trash, OnKO triggers, Banish → banishZone).
   - Target Leader → Life -1. Revelar top de Life. Si tiene Trigger effect, `ActivateTrigger` opcional; si no, la carta revelada va a la hand del defensor. Si no quedan life cards y el Leader recibe damage, `winner = attacker.owner`.
   - DoubleAttack: duplica Life loss a 2.
6. **Post-combat:** atacante queda rested; Character target en KO va al trash (o banishZone si Banish). OnPlay NO se dispara aquí (OnPlay es al play, no al attack).

### 6.4 Keywords implementados

| Keyword      | Efecto                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Rush         | Character no tiene summoningSickness el turno que se juega — puede atacar.                        |
| Blocker      | Permite redirigir un ataque a este character (1 vez por turno por blocker).                       |
| Counter      | Carta con `counter > 0` jugable desde mano durante Counter Step. `counter` es el valor del boost. |
| DoubleAttack | Al golpear al Leader, Life -2 en vez de -1.                                                       |
| Banish       | Al ser KO'd, va a `banishZone` en vez de `trash`.                                                 |
| [DON!!xN]    | Algunos efectos requieren `attachedDon >= N` como `condition`.                                    |

## 7. Declarative effect executor

`applyEffect(state, effect, context)` es pura. `context` incluye el jugador, la carta fuente, target(s) seleccionados.

Ejemplo: `{ kind: 'draw', amount: 2 }` → mueve 2 cartas de `player.deck` al `player.hand`, emite `CardDrawn`.

Si `effect.kind === 'manual'`, el engine emite un `GameEvent` "ManualEffect" con el texto y no hace nada más — la UI expone botones para resolver manualmente (fuera del scope de Fase 3).

Per-card overrides están en `packages/engine/src/effects/library.ts`. Mínimo para e2e:

| cardId                      | Efecto modelado                                                                 | Por qué                                  |
| --------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| Zoro leader (OP01-001)      | Activate:Main → `power +1000 this turn` sobre `self` (leader), cost `rest self` | Válida Activate:Main + power buff        |
| Un char con OnPlay draw 1   | OnPlay → `draw 1`                                                               | Válida OnPlay + effect resolver          |
| Un char Rush                | — (keyword only)                                                                | Válida Rush bypass de summoning sickness |
| Un char Blocker             | — (keyword only)                                                                | Válida Blocker redirect                  |
| Un char con Counter +1000   | — (usado en Counter Step)                                                       | Válida Counter                           |
| Un char con DoubleAttack    | — (keyword only)                                                                | Válida DoubleAttack life damage          |
| Un char con Trigger draw 1  | Trigger → `draw 1`                                                              | Válida Life reveal trigger               |
| Un char con OnKO banish opp | OnKO → banish opp character                                                     | Válida OnKO + banish                     |
| Un Event con ko target      | `ko { kind: opponentCharacter }`                                                | Válida ko effect                         |

Se asignan a `OP01-xxx` reales donde sea posible; en caso contrario se crean IDs sintéticas `TEST-xxx` solo para el fixture. Preferimos reales para alinear con cartas existentes en la DB.

## 8. Testing plan

`vitest.config.ts` en `packages/engine` ya tenía threshold `85%`. Ahora se activa:

```ts
thresholds: { lines: 85, branches: 85, functions: 85, statements: 85 },
```

### 8.1 Test matrix

| Archivo            | Qué cubre                                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rng.test.ts`      | seed fija → secuencia idéntica, pointer avanza, shuffle determinista                                                                                                                                            |
| `deck.test.ts`     | validateDeck heredado de Fase 2 (migrado 7 tests) + 1 nuevo: valida deck vacío                                                                                                                                  |
| `setup.test.ts`    | createInitialState: life cards desde leader.life; hand 5; donDeck 10; mulligan sí/no; deterministic con seed                                                                                                    |
| `phases.test.ts`   | transiciones Refresh → Draw → DON → Main → End → other player Refresh; skip rules de first turn                                                                                                                 |
| `combat.test.ts`   | DeclareAttack → CounterStep → resolve; Blocker redirect; Life loss; Trigger reveal; DoubleAttack 2 life; Banish zone                                                                                            |
| `effects.test.ts`  | Cada kind de Effect (draw/ko/power/returnToHand/banish/search/sequence/choice/manual); OnPlay + OnKO + Trigger wiring                                                                                           |
| `e2e-game.test.ts` | Partida scriptada: dos jugadores, seed fija, secuencia de Actions, game acaba con `winner !== null`. Se corre 10 veces con misma seed, se verifica que TODOS los GameState finales son `JSON.stringify`-iguales |

### 8.2 Fixtures

- `fixtures/simple-red-deck.ts` — 50 IDs formando un deck Red legal referenciados en el catálogo.
- `fixtures/test-cards.ts` — ~15 `CardStatic` objects (2 leaders + 13 characters/events/stages) con efectos declarativos asignados. Este catálogo se usa en todos los tests — es la "base cards" del engine.

### 8.3 Cobertura

CI corre `pnpm --filter @optcg/engine test:coverage`. Si lines/branches/functions/statements < 85%, falla. Reporte HTML en `coverage/` (gitignored).

## 9. Exit criteria

| Check                                                                  | Validación                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `createInitialState` setup válido para 2 players                       | Test `setup.test.ts`                                                        |
| Fases del turno se transicionan correctamente                          | Test `phases.test.ts`                                                       |
| Combate básico + Counter + Blocker + Life + Trigger + DoubleAttack     | Test `combat.test.ts`                                                       |
| Declarative effects + OnPlay/OnKO/Trigger                              | Test `effects.test.ts`                                                      |
| Determinismo: 10 corridas con misma seed → mismo state                 | Test `e2e-game.test.ts` con loop de 10                                      |
| Partida scriptada llega a `winner !== null`                            | Test `e2e-game.test.ts`                                                     |
| Cobertura ≥85% lines/branches/functions/statements                     | `pnpm --filter @optcg/engine test:coverage`                                 |
| `validateDeck` movido y web actualizado                                | `deck-validation.ts` removido de `apps/web`, web importa de `@optcg/engine` |
| `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` verdes | CI                                                                          |
| `packages/engine/README.md` con tabla de casos                         | Inspección manual                                                           |

## 10. Decisiones autónomas

| #   | Decisión                                                                                        | Alternativas                        | Por qué                                                                     |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| D1  | `CardStatic` en el engine, sin dep de `card-data`                                               | Engine importa tipos de Prisma      | Spec §4.2 — engine aislado; consumer mapea `card-data.Card → CardStatic`    |
| D2  | Catálogo como `Record<string, CardStatic>` en `GameState`                                       | Estado global / registro externo    | Engine puro; estado serializable autocontenido                              |
| D3  | `priorityWindow` como discriminated union dentro de `GameState`                                 | Máquina de estados externa          | Serializable; cliente puede leer qué acción jugar                           |
| D4  | Per-card overrides en `library.ts`                                                              | Parser del `effectText` (Fase 7)    | Fase 3 no parsea; solo interpreta lo que venga en `CardStatic.effects`      |
| D5  | E2E test con 2 Zoro leaders + decks simétricos rojos                                            | 2 leaders distintos                 | Simplifica la script y aisla bugs del engine de bugs de matching de colores |
| D6  | `instanceId` de characters generado vía `rng.next()`                                            | UUID en runtime                     | Serializable y determinista                                                 |
| D7  | `Phase = 'Setup'` antes del primer Refresh                                                      | Skip Setup y empezar en Refresh     | Deja espacio para Mulligan decisions antes del turno 1                      |
| D8  | Counter cards son characters con `counter > 0` jugables desde mano a trash durante Counter Step | Cartas con keyword Counter distinto | Matchea reglas OPTCG reales                                                 |
| D9  | `deck-validation.ts` se MUEVE, no se copia                                                      | Mantener en web + re-exportar       | Limpia la deuda técnica explícita de Fase 2 §3.1                            |
| D10 | `attachedDon` resetea al End Phase, NO al Refresh                                               | Persiste turnos                     | Regla OPTCG: DON attached regresa al pool rested en End                     |
| D11 | Mulligan es parte del flujo Setup (no skip automático)                                          | Flag al crear state                 | Jugador necesita ver mano para decidir mulligan; encaja en PriorityWindow   |
| D12 | Coverage gate a 85% EN EL MERGE TIME; durante desarrollo es opt-in                              | Desde el commit 1                   | Pragmatismo: sería frustrante bloquear commits intermedios                  |

## 11. Riesgos

| Riesgo                                                                    | Mitigación                                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Tamaño del scope — 17 tareas no trivial                                   | Ejecución autónoma con subagentes; cada task 1 commit con tests                                                |
| Determinismo se rompe por `Math.random` olvidado en algún sitio           | Regla ESLint: `no-restricted-syntax` contra `Math.random()` en el package. Test e2e con 10 runs que lo detecta |
| Engine acaba dependiendo de `card-data` por accidente                     | Regla ESLint `no-restricted-imports` contra `@optcg/card-data` y `next*`/`react*`                              |
| Cobertura queda bajo 85% en branches                                      | Añadir tests cuando falte durante la verificación final (tarea 17)                                             |
| Counter Step + Trigger + Blocker crean flujos complejos de PriorityWindow | El `apply` valida estrictamente `priorityWindow` antes de cada action; tests cubren transiciones               |
| Reglas edge-case no documentadas en spec padre                            | Marcar con `// TODO[rules]` y elegir la interpretación razonable; no bloquear                                  |
| Prettier reformatea inmutabilidad compacta → bugs                         | Helpers en `immutable.ts` con tests propios                                                                    |

## 12. Assumptions

- El consumer del engine (tests, Fase 4) es responsable de construir el `catalog` a partir de `card-data` + `library.ts` (los overrides).
- Las reglas OPTCG son las de 2024+. Casos ambiguos se marcan `TODO[rules]` y se resuelven con la interpretación más común.
- El e2e test no necesita simular el shuffle con aleatoriedad "real" — seed fija garantiza reproducibilidad.
- Los efectos `choice` requieren UI de selección; en Fase 3 para e2e scriptado, el test pasa la opción elegida como parte del Action (extensión del type si hiciera falta).

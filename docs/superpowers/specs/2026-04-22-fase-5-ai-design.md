# Fase 5 — IA Easy + Medium (design)

**Fecha:** 2026-04-22
**Branch:** `feature/fase-5-ai`
**Spec padre:** [2026-04-17-optcg-sim-design.md](./2026-04-17-optcg-sim-design.md) §11 Fase 5
**Modo:** autónomo — plan auto-aprobado, halt solo en decisiones críticas.

## 1. Objetivo

Crear `packages/ai` con dos bots consumidores del engine de Fase 3: **Easy** (random legal) y **Medium** (heurístico). Integrar modo PvAI en la UI para que un humano pueda jugar contra un bot.

Exit criteria: Easy juega 100 partidas sin errores legales. Medium gana a Easy en >70% de 50 partidas con seeds deterministas.

## 2. Scope

**Dentro:**

- `packages/ai` — paquete nuevo, TS puro, 0 deps de framework/Prisma/card-data.
- Interfaz `Bot` que devuelve un `Action` dado un `GameState` + `PlayerIndex` + `RngState`.
- Bot **Easy**: random legal action (usa RNG seedeable para determinismo).
- Bot **Medium**: heurístico (atacar líder siempre que pueda, priorizar playing cartas útiles, counter/blocker defensivo).
- Tests self-play: Easy vs Easy 100 partidas sin errores; Medium vs Easy ≥70% wins en 50 partidas.
- UI: modo PvAI en `/play` (toggle hotseat ↔ PvAI) o ruta nueva; auto-dispatch de acciones del bot en su turno.
- Tests con fixtures propias (TEST catalog replicado del engine).

**Fuera:**

- Bot Hard / MCTS / ML (parent spec no lo pide).
- Opening-book, planificación multi-turno.
- Dificultad ajustable (velocidad de juego, "personalidad").
- Streaming de acciones con delay realista en UI (puede venir en polish).

## 3. Arquitectura

```
packages/ai/
├── src/
│   ├── index.ts                  re-exports públicos
│   ├── types.ts                  Bot interface, BotDecision, etc.
│   ├── action-generator.ts       enumera acciones legales por fase/priority
│   ├── easy.ts                   random legal action
│   ├── medium.ts                 heurístico
│   └── helpers/
│       └── evaluators.ts         power/threat heurísticas
├── tests/
│   ├── easy.test.ts              unit: picks legal action
│   ├── medium.test.ts            unit: prefers attacking + playing big chars
│   ├── self-play.test.ts         Easy vs Easy 100 games, Medium vs Easy 50 games
│   └── fixtures/
│       ├── test-cards.ts         catálogo test (duplicado del engine para aislar)
│       └── simple-red-deck.ts    50-card mock deck
├── package.json                  @optcg/ai, deps: @optcg/engine
├── tsconfig.json
└── vitest.config.ts              threshold 85% opt-in (no gate)

apps/web/src/
├── app/play/
│   └── page.tsx                  añade selector Hotseat / PvAI (Easy/Medium)
├── app/play/[gameId]/
│   └── _components/
│       └── game-provider.tsx     opcional: auto-dispatch bot actions
├── lib/
│   └── bot-runner.ts             helper: useEffect que dispatcha bot turn
```

### 3.1 Invariantes

- `packages/ai` NO importa de React/Next/Prisma/card-data. Solo `@optcg/engine` + TS stdlib.
- `GameState` se consume read-only; bot nunca muta.
- Bot es determinístico dada una seed.
- RNG seedeable explícito (no `Math.random`).

## 4. Bot interface

```ts
// packages/ai/src/types.ts
import type { Action, GameState, PlayerIndex } from '@optcg/engine';
import type { RngState } from '@optcg/engine';

export interface BotDecision {
  action: Action;
  rng: RngState;
  /** Optional: reason for debugging / display. */
  rationale?: string;
}

export interface Bot {
  id: 'easy' | 'medium';
  name: string;
  /**
   * Given the current state, decide the next action for `player`.
   * Must return an Action that `engine.apply()` accepts (no errors).
   */
  pick(state: GameState, player: PlayerIndex, rng: RngState): BotDecision;
}
```

Public exports: `EasyBot`, `MediumBot`, `type Bot`, `type BotDecision`.

## 5. Action generator

Shared helper that enumerates candidate actions for a given state + player. Encodes the same rule checks as the engine (mirrored from `validateX` logic). Returns only actions that `apply()` would accept.

```ts
// packages/ai/src/action-generator.ts
export function generatePriorityAction(state: GameState, player: PlayerIndex): Action | null;

export function generateMainActions(state: GameState, player: PlayerIndex): Action[];
```

- `generatePriorityAction` returns the single expected action when a priority window is open and `player` has priority (e.g., DeclineCounter/UseBlocker/ActivateTrigger). Returns `null` if not our priority.
- `generateMainActions` enumerates:
  - `EndTurn`
  - `PlayCharacter` for each hand card of type CHARACTER whose cost ≤ donActive + donSpent (try donSpent=0).
  - `PlayEvent` / `PlayStage` similarly.
  - `DeclareAttack` for each active non-sickness (Leader + characters with Rush-OR-not-summoningSickness) × each legal target (opp Leader + rested opp chars). Respect first-turn rule: skip attacks if `!player.firstTurnUsed`.
  - `AttachDon` to Leader or each own character (if donActive > 0).
  - `ActivateMain` for leader/chars with Activate:Main effect.

The output list is bounded (max ~40 actions per state). Easy just picks one uniformly at random; Medium filters/scores.

## 6. Easy bot

Strategy:

- Mulligan: always keep (mulligan: false).
- Priority windows: decline counter/blocker, decline trigger activate.
- Main: pick random legal action from `generateMainActions`.

Deterministic via seeded `RngState` passed through `pick`.

## 7. Medium bot

Heurísticas (simples, suficientes para superar Easy ≥70%):

1. **Mulligan**: keep.
2. **Priority**:
   - CounterStep: play highest-counter card in hand if total defense still ≥ attackPower (avoid wasting counter when still losing).
   - BlockerStep: use blocker if the attack is on the Leader AND (blocker base power + defensePower) ≥ attackPower OR life would reach 0 otherwise.
   - TriggerStep: activate if the Trigger effect is beneficial (any effect that's not `manual` → activate).
3. **Main**:
   - If leader not rested AND can attack AND opponent leader life > 0 → **attack leader** (most aggressive).
   - Else if any active non-sickness character can attack → **attack opponent leader** (if leader can be attacked legally) OR **attack weakest rested opp character** (biggest KO threat removed).
   - Else if cost-affordable CHARACTER in hand AND `characters.length < 5` → play the highest-power one.
   - Else if `donActive > 0` → attach all to leader (powers up attacks).
   - Else EndTurn.

Use `generateMainActions` as the candidate pool; Medium scores each:

```ts
function scoreAction(a: Action, state: GameState, player: PlayerIndex): number {
  switch (a.kind) {
    case 'DeclareAttack': return 100 + (target is Leader ? 50 : 0);
    case 'PlayCharacter': return 40 + power_of_card_or_0;
    case 'AttachDon': return 15;
    case 'ActivateMain': return 30;
    case 'PlayEvent': return 25;
    case 'PlayStage': return 10;
    case 'EndTurn': return 0;
    default: return 0;
  }
}
```

Pick the highest-scored action. Tie-break by earliest in list.

## 8. Self-play tests

`tests/self-play.test.ts`:

```ts
function playGame(
  p0: Bot,
  p1: Bot,
  seed: number,
  maxActions = 1000,
): { winner: PlayerIndex | null; actions: number } {
  let state = createInitialState({ seed, firstPlayer: 0, players: [...], catalog: TEST_CATALOG });
  let rng = createRng(seed + 1);
  let count = 0;
  while (state.winner === null && state.phase !== 'GameOver' && count < maxActions) {
    // Auto-advance non-interactive phases inline
    if (state.phase === 'Refresh' || state.phase === 'Draw' || state.phase === 'Don') {
      const res = apply(state, { kind: 'PassPhase', player: state.activePlayer });
      if (res.error) throw new Error(`PassPhase error at action ${count}: ${JSON.stringify(res.error)}`);
      state = res.state;
      count++;
      continue;
    }
    // Decide whose action it is (priority window player or active player)
    const actor = state.priorityWindow && 'player' in state.priorityWindow
      ? state.priorityWindow.player
      : state.priorityWindow?.kind === 'CounterStep' ? state.priorityWindow.defender.owner
      : state.priorityWindow?.kind === 'BlockerStep' ? state.priorityWindow.originalTarget.owner
      : state.priorityWindow?.kind === 'TriggerStep' ? state.priorityWindow.owner
      : state.activePlayer;
    const bot = actor === 0 ? p0 : p1;
    const decision = bot.pick(state, actor, rng);
    rng = decision.rng;
    const res = apply(state, decision.action);
    if (res.error) throw new Error(`Bot ${bot.id} illegal action ${decision.action.kind} at ${count}: ${JSON.stringify(res.error)}`);
    state = res.state;
    count++;
  }
  return { winner: state.winner, actions: count };
}

describe('Easy vs Easy', () => {
  it('plays 100 games without engine errors and always reaches a winner', () => {
    for (let i = 0; i < 100; i++) {
      const r = playGame(EasyBot, EasyBot, 1000 + i);
      expect(r.winner).not.toBeNull();
    }
  });
});

describe('Medium vs Easy', () => {
  it('Medium wins ≥35 out of 50 games (≥70%)', () => {
    let mediumWins = 0;
    for (let i = 0; i < 50; i++) {
      // Medium plays as player 0, Easy as player 1
      const r = playGame(MediumBot, EasyBot, 2000 + i);
      if (r.winner === 0) mediumWins++;
    }
    expect(mediumWins).toBeGreaterThanOrEqual(35);
  });
});
```

Budget: 100 + 50 = 150 games × ~60-100 actions/game = 15k actions. Easy to run under 5s.

## 9. UI integration — PvAI mode

### 9.1 Setup page

Extend `/play` with a "Mode" select:

- **Hotseat** (current): both players human.
- **vs AI Easy**: P0 human, P1 = EasyBot.
- **vs AI Medium**: P0 human, P1 = MediumBot.

Only 1 deck input needed in PvAI (user's deck × 2 used — same-mirror for MVP; or an "AI deck" picker).

Decision D1: **In PvAI, the user picks BOTH decks** (one for P0/self, one for P1/bot). Simpler, no special "AI deck pool" needed.

Decision D2: **Bot identity stored in sessionStorage alongside MatchSetup**:

```ts
sessionStorage.setItem(
  `optcg.game.${gameId}`,
  JSON.stringify({ setup, aiOpponent: 'easy' | 'medium' | null }),
);
```

### 9.2 GameProvider extension

`GameProvider` accepts optional `{ botForPlayer: { 0?: Bot; 1?: Bot } }`. A useEffect watches `state`; when it's a bot's turn (or bot has priority), auto-dispatches `bot.pick(state, playerIndex, rng).action`. Same pattern as the Refresh/Draw/Don auto-advance.

Throttle bot decisions to ~400ms delay so the user can see what happened.

### 9.3 `/play/[gameId]` page

Reads bot config from sessionStorage. Passes `botForPlayer` to `GameProvider`. Rest of the board is identical.

## 10. Decisiones autónomas

| #   | Decisión                                                                         | Alternativas                            | Por qué                                                       |
| --- | -------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| D1  | User picks both decks in PvAI (own + AI's)                                       | AI has a canned deck pool               | Simpler MVP; reuses Fase 2 deck builder                       |
| D2  | Bot config in sessionStorage alongside MatchSetup                                | New DB table `Game.aiOpponent`          | No persistencia server-side (Fase 6 revisita)                 |
| D3  | Medium scoring table fixed (no learning)                                         | Evolving weights / ML                   | Parent spec explícitamente "heurístico"; Easy/Medium son MVPs |
| D4  | Action generator mirrors engine rules                                            | Engine exposes `computeAllLegalActions` | Engine stays focused on validation; bot owns its enumeration  |
| D5  | Bot delay 400ms en UI via setTimeout                                             | Instant / configurable                  | Gives player time to read events log                          |
| D6  | In PvAI, firstPlayer=0 (user goes first)                                         | Random / user-chosen                    | Simple; user feels in control                                 |
| D7  | Mulligan: both bots always keep                                                  | Probabilistic mulligan                  | Simple; not a strong decision axis                            |
| D8  | CounterStep: Medium plays counter iff total defense >= atkPower with new counter | Always play highest                     | Avoid wasting counters when still losing                      |
| D9  | BlockerStep: Medium uses blocker iff (blocker + counter) can stop OR life lethal | Always use                              | Avoid wasting blocker                                         |
| D10 | Tests use fixed seeds 1000..1099 (Easy), 2000..2049 (Medium)                     | Random seeds                            | Deterministic CI                                              |

## 11. Riesgos

| Riesgo                                                   | Mitigación                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| Bot entra en bucle (no termina partida)                  | `maxActions = 1000` cap; tests lanzan error si excede       |
| Action generator omite una acción y bot no puede avanzar | Siempre añade `EndTurn` como fallback en Main               |
| Medium win rate < 70% con heurísticas simples            | Iterar pesos tras primer run; documentar si requiere tuning |
| Bot elige acción que engine rechaza (bug de generator)   | Test Easy 100 partidas captura cualquier `apply` error      |
| Async bot dispatching en UI carrea con el auto-advance   | Use single useEffect unificado o cuidado con race           |

## 12. Assumptions

- Deck/catalog del engine en `TEST_CATALOG` fixture es suficiente para tests bot (no necesita OP01 real).
- `RngState` del engine es reusable para el bot sin cambios.
- La mayoría de partidas Easy-vs-Easy terminan por deck-out (nadie ataca efectivamente hasta deck=0); esto cuenta como victoria legal y el test `winner !== null` se cumple.

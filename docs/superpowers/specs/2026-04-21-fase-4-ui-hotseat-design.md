# Fase 4 — UI hotseat 1v1 (design)

**Fecha:** 2026-04-21
**Branch:** `feature/fase-4-ui-hotseat`
**Spec padre:** [2026-04-17-optcg-sim-design.md](./2026-04-17-optcg-sim-design.md) §6, §11 Fase 4
**Modo:** desarrollo autónomo — plan auto-aprobado, solo halt en decisiones críticas.

## 1. Objetivo

Dar vida visual al engine de Fase 3. Construir una UI web que dos jugadores humanos puedan usar pasándose el ratón en el mismo dispositivo para jugar una partida completa de OPTCG con cartas OP01. La UI consume `apply(state, action)` del engine para cada interacción — cero reglas de juego viven en los componentes React.

Exit criteria: 2 humanos completan una partida de OP01 sin bugs visibles, todas las zonas legibles, Counter Step sin ambigüedad.

## 2. Scope

**Dentro:**

- Ruta `/play` — setup (pick decks + seed) → game board.
- `GameProvider` React context con `useReducer` sobre `apply()` del engine.
- **Catalog builder**: mapea `card-data.Card` → `CardStatic` (incluye mapeo LEADER `cost` → `life`, merge con `CARD_EFFECT_LIBRARY`).
- Board layout mirrored: oponente arriba, activo abajo. Todas las zonas visibles (Leader, Life, Character area 5 slots, Stage, DON pool, Hand, Deck stack, Trash stack).
- Hotseat handoff overlay tras `EndTurn` — tapa la vista hasta que el siguiente jugador confirme.
- Acciones por click (no drag & drop en MVP — decisión D5).
- Modal explícito para Counter Step, Blocker Step, Trigger Step, Mulligan.
- Game log lateral con los últimos N eventos del engine.
- Game over screen con winner + "Play again" / "Home".
- Tablero tabletop cálido (direction visual A del parent spec §6): paleta warm wood / parchment con shadcn como base.
- Smoke e2e manual: dos jugadores hipotéticos completan un turno cada uno.

**Fuera:**

- Drag & drop (decisión D5 — click basta, menor scope).
- Animaciones ricas (transitions CSS básicas sí — spring animations no).
- Hover preview grande (se reutiliza `CardDetailDialog` de Fase 1 con click).
- Atajos de teclado (nice-to-have; post-MVP).
- Persistencia de partida (refresh = game lost — si el usuario lo pide se añade en polish).
- Sonidos (Fase 7).
- Replay (Fase 7).
- IA (Fase 5).
- Multiplayer online (Fase 6).
- Bot/spectator modes.

## 3. Arquitectura

```
apps/web/src/
├── app/
│   ├── play/
│   │   ├── page.tsx                       (client) setup flow: pick decks + seed → start
│   │   └── [gameId]/
│   │       ├── page.tsx                   (client) board
│   │       └── _components/
│   │           ├── game-provider.tsx      React context + useReducer sobre apply()
│   │           ├── board.tsx              Layout mirror (both players)
│   │           ├── player-side.tsx        Per-player zones (Leader+Life, Chars, Stage, DON, Deck, Trash)
│   │           ├── hand.tsx               Active player's hand (hidden for other in hotseat)
│   │           ├── leader-card.tsx        Leader + life stack + rested/active state
│   │           ├── character-card.tsx     Character in play (rested/active, don counter, power)
│   │           ├── don-pool.tsx           DON active/rested counts + click to attach
│   │           ├── action-bar.tsx         Bottom bar: EndTurn, PassPhase, current-phase label
│   │           ├── priority-modal.tsx     Union modal renderer (Mulligan / Counter / Blocker / Trigger)
│   │           ├── target-picker.tsx      Overlay: pick target for Attack/Attach/Effect
│   │           ├── game-log.tsx           Event list (right sidebar)
│   │           ├── hotseat-handoff.tsx    Between-turn overlay
│   │           └── game-over.tsx          End-of-game screen
├── lib/
│   ├── catalog-builder.ts                 Card[] → Record<string, CardStatic>
│   └── deck-loader.ts                     Fetch deck by id + expand DeckCard quantities to 50-card string[]
components/
└── (existing shadcn + game-specific shared)
```

### 3.1 State architecture

```tsx
// game-provider.tsx
type GameState = import('@optcg/engine').GameState;
type Action = import('@optcg/engine').Action;

const GameContext = createContext<{
  state: GameState;
  dispatch: (action: Action) => { error?: EngineError; events: GameEvent[] };
  events: GameEvent[]; // cumulative log (state.log is action-only; events are emitted per apply)
} | null>(null);

export function GameProvider({
  setup,
  children,
}: {
  setup: MatchSetup;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<GameState>(() => createInitialState(setup));
  const [eventLog, setEventLog] = useState<GameEvent[]>([]);

  function dispatch(action: Action) {
    const result = apply(state, action);
    setState(result.state);
    setEventLog((prev) => [...prev, ...result.events]);
    return { error: result.error, events: result.events };
  }

  return (
    <GameContext.Provider value={{ state, dispatch, events: eventLog }}>
      {children}
    </GameContext.Provider>
  );
}
```

Notes:

- Reducer pattern with `useReducer` would be cleaner but React's `useState` + the engine's `apply` is sufficient — the engine IS the reducer.
- `eventLog` accumulates across calls; `state.log` tracks only Actions, not Events.

### 3.2 Catalog builder

```ts
// apps/web/src/lib/catalog-builder.ts
import type { Card } from '@optcg/card-data';
import type { CardStatic, CardType, Keyword } from '@optcg/engine';
import { getEffectsForCard } from '@optcg/engine';

export function buildCatalog(cards: Card[]): Record<string, CardStatic> {
  const map: Record<string, CardStatic> = {};
  for (const c of cards) {
    map[c.id] = cardToStatic(c);
  }
  return map;
}

function cardToStatic(c: Card): CardStatic {
  const type = normalizeType(c.type);
  // apitcg stores LEADER life in the cost field (Fase 1 concern)
  const life = type === 'LEADER' ? c.cost : null;
  const cost = type === 'LEADER' ? null : c.cost;
  return {
    id: c.id,
    type,
    colors: c.colors.split(',').filter(Boolean),
    cost,
    power: c.power,
    life,
    counter: c.counter,
    keywords: parseKeywords(c.effectText),
    effects: getEffectsForCard(c.id),
    manualText: c.effectText || null,
  };
}

function normalizeType(t: string): CardType {
  if (t === 'LEADER' || t === 'CHARACTER' || t === 'EVENT' || t === 'STAGE') return t;
  // DON cards from apitcg are filtered at deck-build level; if we encounter one, default to CHARACTER to avoid runtime errors.
  return 'CHARACTER';
}

function parseKeywords(effectText: string): Keyword[] {
  // Conservative keyword detection from effectText. Fase 7's parser will replace this.
  const keywords: Keyword[] = [];
  const text = effectText.toLowerCase();
  if (text.includes('[rush]')) keywords.push('Rush');
  if (text.includes('[blocker]')) keywords.push('Blocker');
  if (text.includes('[double attack]') || text.includes('[doubleattack]'))
    keywords.push('DoubleAttack');
  if (text.includes('[banish]')) keywords.push('Banish');
  // Counter is detected via `card.counter > 0`, not keyword tag.
  return keywords;
}
```

### 3.3 Hotseat flow

1. `/play` → user picks 2 decks from their own `/builder` deck list (pick twice — one for P0, one for P1; or pick once and auto-mirror for testing).
2. Optional seed input.
3. "Start game" → `POST /api/games` (returns gameId; state lives client-side; server-side persistence out of scope) → redirect `/play/[gameId]`.
4. Board mounts. Mulligan modal for P0. P0 decides → Mulligan for P1 → game starts with P0's Refresh phase.
5. P0 plays until `EndTurn`. `HotseatHandoff` overlay: "Pass to P1 (Tiago)". Button "Ready" → overlay closes.
6. P1 turn. Repeat. Hand of the non-active player is hidden (overlay covers or shows "N cards in hand").
7. When `winner` != null, `GameOver` screen.

**Gotcha:** Priority windows flip the "active" player from the UI perspective. When P0 attacks P1's leader, Counter Step opens and P1 has priority. We need to show P1's hand in that moment even though `state.activePlayer === 0`. The Hotseat handoff must trigger **between EndTurn and next Refresh**, not on CounterStep transitions (those happen mid-turn and need both players' input fluidly).

Decision: **during priority windows that flip to the defender, the handoff overlay activates** before showing the defender's hand. After the defender resolves (plays counter / declines / etc.), handoff back to attacker. This adds friction but prevents information leak.

Simplification for MVP: **show both hands via a toggle button** ("Show opponent's hand — use for debugging"). Default hidden. Hot-seat handoffs between turns, not mid-turn. Counter Step uses a modal where the defender interacts without seeing their hand layout — they see counter candidates filtered + displayed in the modal, not the full hand. This balances playability with info-hiding.

### 3.4 Server-side API (minimal)

`POST /api/games` — takes `{ seed, p0DeckId, p1DeckId }`, fetches both decks + catalog from Prisma, returns `{ gameId, matchSetup }`. MatchSetup includes full catalog + deck card ID arrays.

- `gameId` is a UUID (client-generated or server-generated; either works since state lives client-side).
- State is NOT persisted server-side. Refresh → state lost (MVP limitation).
- Future: persist `GameState` JSON in Prisma under a `Game` table for resume.

### 3.5 Invariantes

- **Cero reglas de juego en componentes React.** Si un componente hace `if (card.type === 'LEADER')` con lógica de decidir combate, es bug — mueve al engine.
- **Engine es la única fuente de verdad.** Componentes solo leen `state` y despachan `Action`s.
- **`dispatch` retorna `{ error, events }`** — si `error`, mostrar toast + no mutar UI ni re-render.
- **Accesibilidad básica:** cada action button con aria-label, modal focus trap (shadcn Dialog ya lo hace).

## 4. Flujo de interacción

### 4.1 Turno activo normal

1. Estado `phase = 'Refresh'` → auto-avanza al mostrar UI? **Decisión D4: manual**. El usuario ve "Refresh phase" y pulsa "Next" (PassPhase). Más pedagógico para aprender OPTCG.
2. `phase = 'Draw'` → "Next" (PassPhase).
3. `phase = 'DON'` → "Next" (PassPhase). Al entrar a Main, los +2 DON ya están visibles.
4. `phase = 'Main'` → botones: "End turn", plus actions by zone:
   - Hand card click → options: "Play as Character" / "Play as Event" / "Play as Stage" / "View details" (según type).
   - DON pool click → "Attach to Leader" | "Attach to a Character" (target picker).
   - Leader click (if has `Activate:Main` effect) → "Activate" | "Attack".
   - Character click (if active + no summoning sickness) → "Activate" (if has effect) | "Attack".
5. On Attack → Target picker overlay: "Leader" | lista de characters rested → seleccionar → DeclareAttack.
6. Counter Step modal abre si PlayerIndex ≠ activePlayer. Defensor ve "Counters en mano" (filtrados por `counter > 0`) + botón "Decline Counter".
7. Si hay Blocker disponible, abre Blocker modal con lista de characters con keyword Blocker active + "Decline".
8. Si Life se revela con Trigger, abre Trigger modal con "Activate" + descripción del efecto + "Decline".
9. Combate resuelve, volver a Main.

### 4.2 End turn

`EndTurn` → End phase runs → turn rolls → `HotseatHandoff` overlay.

### 4.3 Mulligan (al inicio)

Modal "You have 5 cards. Keep or mulligan?" — "Keep" / "Mulligan". Activo primero, luego el otro.

## 5. Componentes clave (signatures)

```tsx
// player-side.tsx
<PlayerSide
  playerIndex={0}
  isActive={state.activePlayer === 0}
  isHidden={/* hotseat logic */}
/>

// leader-card.tsx
<LeaderCard
  leader={state.players[0].leader}
  life={state.players[0].life}
  onClick={...}        // opens Activate:Main or Attack target picker
  canBeAttackTarget={...}
/>

// character-card.tsx
<CharacterCard
  char={state.players[0].characters[i]}
  isOwn={true}
  onAction={(kind: 'attack' | 'activate') => ...}
/>

// priority-modal.tsx
<PriorityModal state={state} onResolve={dispatch} />
// Internally reads state.priorityWindow and renders the right modal variant.

// game-log.tsx
<GameLog events={eventLog} />
// Shows last 30 events, newest on top, scrollable.
```

## 6. Estilos (tabletop cálido)

Paleta base (añadir a `tailwind.config.ts` + `globals.css`):

- **Fondo principal**: `#2d1e12` (wood dark) a `#4a3423` (gradient).
- **Tablero central**: textura de parchment `#d9c79a` fondo, bordes cobre `#8b5a2b`.
- **Zonas**: rect `#3a2a1a` con borde sutil `#8b5a2b`, texto `#f4e4bc`.
- **Player activo**: glow sutil `rgba(255, 200, 100, 0.3)`.
- **Cartas**: imagen fija + overlay de estado (rested = rotar 90°, desaturar).
- **Priority/modal**: dim backdrop `rgba(0, 0, 0, 0.7)` + shadcn Dialog.

Tailwind utilities custom:

```css
/* globals.css additions */
.tabletop-bg {
  background: linear-gradient(180deg, #2d1e12 0%, #4a3423 100%);
}
.parchment-surface {
  background: linear-gradient(180deg, #d9c79a 0%, #c4ad7c 100%);
  box-shadow: inset 0 0 20px rgba(139, 90, 43, 0.3);
}
.zone-frame {
  border: 1px solid #8b5a2b;
  background: #3a2a1a;
  color: #f4e4bc;
}
```

Cartas en play: aspect-[5/7] con `next/image`. Rested = `rotate-90` con transition 200ms.

## 7. Testing

| Qué                                                                            | Cómo                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `catalog-builder.ts` `cardToStatic` mapping (especialmente LEADER life = cost) | Vitest unit                                                                                     |
| `deck-loader.ts` expansión de quantities a string[] de 50                      | Vitest unit                                                                                     |
| UI components                                                                  | Sin tests unitarios en Fase 4 (smoke manual cubre). Fase 7 podría añadir Storybook si escalamos |
| E2E / smoke                                                                    | Manual con dev server — dos "jugadores" ficticios completando una partida                       |

Cobertura: sin gate global en Fase 4. Coverage del engine sigue en ≥85% (enforzado en Fase 3).

## 8. Exit criteria

| Check                                                                                   | Validación        |
| --------------------------------------------------------------------------------------- | ----------------- |
| `/play` acepta 2 decks + seed y arranca partida                                         | Manual            |
| Ambos jugadores pueden completar su turno (draw, play, attack, endturn)                 | Manual            |
| Todas las zonas (Leader, Life, Character×5, Stage, DON, Hand, Deck, Trash) son visibles | Manual inspección |
| Counter Step aparece en modal explícito, defensor puede jugar counters o decline        | Manual            |
| Blocker Step aparece cuando aplica                                                      | Manual            |
| Trigger Step aparece cuando Life revela Trigger                                         | Manual            |
| Hotseat handoff entre turnos funciona                                                   | Manual            |
| Game over screen aparece al alcanzar winner                                             | Manual            |
| `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` verdes                  | CI                |
| `catalog-builder` maps LEADER cost → life                                               | Unit test         |
| `deck-loader` expands correctly                                                         | Unit test         |

## 9. Decisiones autónomas

| #   | Decisión                                                                  | Alternativas                 | Por qué                                                                                 |
| --- | ------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| D1  | State via React Context + `useState` + `apply()`                          | `useReducer`, Zustand        | Engine ya es reducer-shaped (`apply`); Zustand trae dep extra sin valor MVP             |
| D2  | Sin persistencia server-side de `GameState`                               | Postgres/Prisma `Game` table | MVP; refresh = game lost aceptable para Fase 4                                          |
| D3  | Phase transitions con botón "Next" manual                                 | Auto-avance                  | Más pedagógico; usuario ve claramente qué fase es                                       |
| D4  | `GameState` completo en cliente, server solo entrega catalog + deck       | Server autoritative          | Fase 6 introduce server autoritative para multi; Fase 4 client-local                    |
| D5  | Click-to-play, no drag & drop                                             | D&D via dnd-kit              | Scope reducido; menos edge cases; D&D se añade en polish                                |
| D6  | Ambos jugadores ven las mismas cartas reales (no info hiding por default) | Info hiding estricto         | Hotseat pragmático — ambos jugadores confían; toggle "hide opponent's hand" como opción |
| D7  | Hotseat handoff solo entre EndTurn → next Refresh                         | También en priority windows  | Mid-turn info hiding complica la UX; los counters se exponen en modal filtrado          |
| D8  | Deck picker: usuario elige 2 decks propios                                | Lobby con invitación         | Es hotseat, un solo user humano                                                         |
| D9  | Botón "Auto-mulligan decline" en Mulligan modal                           | Un botón de "Keep"           | Keep es lo común pero ofrecer Mulligan es legal OPTCG                                   |
| D10 | Tabletop warm palette custom en globals.css                               | Cambio de theme shadcn       | Aislado al board; home/builder mantienen theme default                                  |
| D11 | Sin deep animations (solo transitions CSS <300ms)                         | Framer Motion                | Frame budget; reevaluar en Fase 7                                                       |
| D12 | `instanceId` de characters expuesto en DOM para click handlers            | Índice numérico              | Engine ya los da; consistente con engine semantics                                      |
| D13 | Counter Step muestra counters candidatos en modal, no toda la mano        | Mano completa                | Evita clutter + es lo que OPTCG Sim oficial hace                                        |

## 10. Riesgos

| Riesgo                                                                                  | Mitigación                                                                                                            |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Partida no llega a completarse por algún action handler mal dispatched                  | Engine devuelve `error` claro; UI muestra toast y estado no se actualiza                                              |
| Cards sin efectos declarativos (keyword-only) no producen los efectos esperados         | La mayoría de cartas OP01 sin parser serán "muditos" — se juegan pero sin triggers especiales; Fase 7 llena el parser |
| Hotseat info hiding es confuso / irritante                                              | Empezar con "ambos ven todo" (D6); toggle opt-in para esconder                                                        |
| Performance con 60+ cartas en el DOM                                                    | `next/image` con sizes; CSS transforms only; no layout thrash                                                         |
| Reglas edge-case no cubiertas por engine visibles en play                               | Se enrutan a `manual` effects (ya soportado); UI muestra botón "Resolve manually"                                     |
| Refresh del browser pierde la partida                                                   | Comunicarlo al usuario en game over / confirmation dialog al cerrar tab                                               |
| DON cards no existen en `card-data` DB (apitcg no las sincroniza como cartas regulares) | Engine no las maneja como cartas individuales — solo contador. No afecta UI                                           |

## 11. Assumptions

- Los 242 cards (OP01+OP02) sincronizados en Fase 1 son suficientes para dos decks de 50. Multi-color leaders permitirán variedad.
- Los usuarios ya tienen decks creados en `/builder` (Fase 2). Si no, UI muestra "Create a deck first" link.
- Ninguna carta de OP01/OP02 requiere reglas imposibles de representar con el `Effect` union actual. Si se encuentran, se marcan `manual` y el juego sigue con fallback.
- Hotseat handoff entre turnos es aceptable UX — no necesitamos split-screen o multi-device.
- `pnpm dev` sirve para manual smoke; no hay CI e2e en Fase 4.

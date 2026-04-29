# Fase 7 · Librería de efectos hand-coded — Diseño

> Spec de la primera mini-fase del bloque "Pulido" (§11 del top-level design). Cubre la librería de efectos declarativos con cobertura ≥70 % de OP01 y la infraestructura runtime que la habilita.

**Goal.** Ejecutar automáticamente el efecto declarativo de ≥70 % (≥85 / 121) de las cartas de OP01, con selección de target interactiva cuando aplique. Las cartas que requieren mecánicas fuera de scope (search/choice con picker, once-per-turn, reactivos a opponent action) siguen como `manualText` con botón.

**Scope cerrado.** OP01 únicamente; target selection (no search/choice picker); triggers `OnPlay` + `OnKO` + `Activate:Main` con coste DON + nuevo `StaticAura`. Drag & drop, atajos de teclado, animaciones, sonidos, stats, replay y chat se mueven a futuras mini-fases (7.5/7.6/…).

---

## 1. Extensiones al engine

### 1.1 Nuevo trigger `StaticAura`

Auras pasivas condicionales (típicas de Leaders y algunos Characters):

```ts
type TriggeredEffect = {
  trigger:
    | 'OnPlay'
    | 'OnKO'
    | 'OnAttack'
    | 'Activate:Main'
    | 'EndOfTurn'
    | 'Trigger'
    | 'StaticAura';
  condition?: EffectCondition; // ya existe
  cost?: EffectCost; // ya existe
  effect: Effect;
};
```

`StaticAura` no se "dispara" — su `effect` se evalúa cuando se computa el power (u otro stat afectado) de cualquier carta. La `condition` se aplica al momento de evaluación: `onTurn: 'yours'` mira `state.activePlayer`, `attachedDonAtLeast: N` mira los DON pegados al source.

### 1.2 Nuevo `PriorityWindow.kind: 'EffectTargetSelection'`

```ts
type PriorityWindow =
  | …existing variants…
  | {
      kind: 'EffectTargetSelection';
      sourceCardId: string;       // carta cuyo efecto está pendiente
      sourceOwner: PlayerIndex;
      effect: Effect;              // efecto a resolver una vez se elige
      validTargets: TargetRef[];   // targets legales (filtrados ya por filter)
      optional: boolean;           // si true, "Skip" cancela el efecto
      pendingChain: Effect[];       // otros efectos del mismo trigger encolados
    };

type TargetRef =
  | { kind: 'Leader'; owner: PlayerIndex }
  | { kind: 'Character'; instanceId: string; owner: PlayerIndex };
```

### 1.3 Nueva acción `SelectEffectTarget`

```ts
| { kind: 'SelectEffectTarget'; player: PlayerIndex; targetIndex: number | null }
```

`targetIndex` indexa `validTargets`. `null` cancela (sólo válido si `optional: true`).

### 1.4 Extensión de `Effect` con flag `optional`

Para representar "Give up to 1 …" (opcional) vs "Give 1 …" (mandatorio), los `Effect` que requieren target adquieren un flag `optional?: boolean` (default `false`):

```ts
type Effect =
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

Cuando el engine resuelve un Effect optional con N candidatos:

- N == 0 → fizzle.
- N >= 1 → abre `EffectTargetSelection` con `optional: true`. Skip cancela.

Cuando es mandatorio:

- N == 0 → fizzle (no error — la regla OPTCG dice que "if you can't, you don't").
- N == 1 → resuelve directo, sin window.
- N >= 2 → abre `EffectTargetSelection` con `optional: false` (no Skip).

### 1.5 Extensión de `CardFilter` con `powerMax`

Para parsear "with 4000 power or less", `CardFilter` añade campo:

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

### 1.6 Wire de `EffectCost.donX` para `Activate:Main`

Cuando se ejecuta una acción `ActivateMain` y el efecto en `card.effects` tiene `cost.donX = N`:

- Verificar `state.players[player].donActive >= N`. Si no → error `NotEnoughDon { need: N, have }`.
- Antes de aplicar el `effect`, mover N DON activos a `donRested`.
- Continuar resolución normal.

### 1.7 Nueva función `computeEffectivePower(state, ref)`

Sustituye al cálculo inline `card.power + attachedDon * 1000 + powerThisTurn` que hoy aparece en `combat/declare.ts` y `target-picker.tsx`:

```ts
export function computeEffectivePower(
  state: GameState,
  ref:
    | { kind: 'Leader'; owner: PlayerIndex }
    | { kind: 'Character'; instanceId: string; owner: PlayerIndex },
): number;
```

Algoritmo:

1. Resolver el card y su `attachedDon` + `powerThisTurn` (igual que hoy).
2. Iterar todas las cartas en juego (leaders + characters de ambos jugadores).
3. Para cada `TriggeredEffect` con `trigger === 'StaticAura'`, evaluar `condition` contra el estado actual:
   - `onTurn: 'yours' | 'opponents'` → comparar con `state.activePlayer === sourceOwner`.
   - `attachedDonAtLeast: N` → `source.attachedDon >= N`.
4. Si la condición se cumple Y el `effect` es `kind: 'power'` con `target` que matchea `ref` (mediante `TargetSpec` resolution en el contexto del source) → sumar `effect.delta`.
5. Devolver power final (no negativo).

Punto sutil: las auras solo afectan `power`. Otros stats (counter, life) no son sujetos de aura en OP01 — se mantiene fuera de scope.

Consumidores que se actualizan: `combat/declare.ts` y `apps/web/.../target-picker.tsx` + `combat/resolve.ts` para defense power.

### 1.8 Cola de efectos encolados (`pendingChain`)

Si un solo trigger tiene múltiples efectos (ej. `sequence` con varios pasos que requieren targets distintos), el primer paso abre `EffectTargetSelection` con los siguientes en `pendingChain`. Al resolver `SelectEffectTarget`, el engine extrae el siguiente paso y, si requiere target, abre otra ventana; si no, lo aplica y avanza.

---

## 2. Librería de efectos

### 2.1 Estructura de archivos

```
packages/engine/src/effects/
├── cards/
│   ├── OP01-001.ts          # un archivo por cardId con efectos
│   ├── OP01-005.ts
│   └── …
├── helpers.ts                # constructores terse: onPlay(), staticAura(), drawN(), opponentChar()…
├── library.ts                # index — importa cards/* y exporta CARD_EFFECT_LIBRARY
├── executor.ts               # se extiende con manejo de target selection
└── triggers.ts               # se extiende para encolar pendingChain
```

### 2.2 `helpers.ts` — API de los archivos por carta

```ts
// Triggers
export function onPlay(effect: Effect): TriggeredEffect;
export function onKo(effect: Effect): TriggeredEffect;
export function activateMain(donCost: number, effect: Effect): TriggeredEffect;
export function endOfTurn(effect: Effect): TriggeredEffect;
export function staticAura(condition: EffectCondition, effect: Effect): TriggeredEffect;
export function trigger(effect: Effect): TriggeredEffect; // para [Trigger] de life cards

// Conditions builders (combinables con spread)
export const onYourTurn: EffectCondition; // { onTurn: 'yours' }
export const onOpponentsTurn: EffectCondition; // { onTurn: 'opponents' }
export function donAtLeast(n: number): EffectCondition; // { attachedDonAtLeast: n }

// Targets
export function self(): TargetSpec;
export function opponentLeader(): TargetSpec;
export function opponentChar(filter?: CardFilter): TargetSpec;
export function ownChar(filter?: CardFilter): TargetSpec;

// Effect builders. `opt` boolean controls "up to 1" semantics; default mandatorio.
export function drawN(n: number): Effect;
export function ko(target: TargetSpec, opt?: boolean): Effect;
export function powerDelta(
  target: TargetSpec,
  delta: number,
  duration?: 'thisTurn' | 'permanent',
  opt?: boolean,
): Effect;
export function returnToHand(target: TargetSpec, opt?: boolean): Effect;
export function banish(target: TargetSpec, opt?: boolean): Effect;
export function manual(text: string): Effect;
export function sequence(...steps: Effect[]): Effect;

// Filter builders
export function powerLte(n: number): CardFilter; // { power<=n via custom prop }
export function costLte(n: number): CardFilter;
export function color(c: string): CardFilter;
export function and(...filters: CardFilter[]): CardFilter;
```

> Nota: `CardFilter` actual sólo expone `type/colors/costMax/costMin/keyword`. Para parseamos correctamente cosas tipo "power 4000 or less" hay que extender `CardFilter` con `powerMax?: number`.

### 2.3 Ejemplos de entradas

```ts
// OP01-001.ts — Roronoa Zoro (Leader)
import { staticAura, onYourTurn, donAtLeast, ownChar, powerDelta } from '../helpers';

export const effects = [
  staticAura({ ...onYourTurn, ...donAtLeast(1) }, powerDelta(ownChar(), 1000, 'permanent')),
];
```

```ts
// OP01-006.ts — Cavendish: "[On Play] Give up to 1 of your opponent's Characters −2000 power during this turn."
import { onPlay, opponentChar, powerDelta } from '../helpers';

export const effects = [
  onPlay(powerDelta(opponentChar(), -2000, 'thisTurn', true)), // opt=true → "up to 1"
];
```

```ts
// OP01-007.ts — Trafalgar Law: "[On K.O.] K.O. up to 1 of your opponent's Characters with 4000 power or less."
import { onKo, opponentChar, powerLte, ko } from '../helpers';

export const effects = [
  onKo(ko(opponentChar(powerLte(4000)), true)), // opt=true
];
```

### 2.4 `library.ts` — Index explícito

Genera la asignación a mano (sin glob mágico) para que TypeScript haga type-check completo:

```ts
import { effects as OP01_001 } from './cards/OP01-001';
import { effects as OP01_005 } from './cards/OP01-005';
// …continúa para cada carta cubierta

export const CARD_EFFECT_LIBRARY: Readonly<Record<string, TriggeredEffect[]>> = Object.freeze({
  'OP01-001': OP01_001,
  'OP01-005': OP01_005,
  // …
});
```

### 2.5 Cobertura objetivo

≥85 / 121 cartas OP01. Las restantes:

- Quedan con `effects: []` en el library (default `getEffectsForCard()` ya devuelve `[]`).
- `CardStatic.manualText` sigue poblado desde `effectText` original — la UI muestra el botón "Manual effect" como hoy.
- Un test (`tests/effects/library-coverage.test.ts`) gatea el ratio ≥70 %.

---

## 3. Flujo runtime de un efecto

Caso de Cavendish jugado con dos opponent characters en mesa:

1. Cliente dispatch `PlayCharacter`. Engine pone Cavendish en `characters[]`, dispara `triggerHook('OnPlay', 'OP01-006')`.
2. Executor lee `effects: [onPlay(powerDelta(opponentChar(), -2000, 'thisTurn'))]`.
3. Resolución del effect:
   - `target = opponentChar()` resuelve a `[{kind: 'Character', instanceId: ..., owner: 1}, ...]` con 2 candidatos.
   - Como hay >1 candidato y la frase es "up to 1" (codificada como `optional: true` en el helper `opponentChar`), abre `EffectTargetSelection`:
     ```
     priorityWindow = {
       kind: 'EffectTargetSelection',
       sourceCardId: 'OP01-006',
       sourceOwner: 0,
       effect: { kind: 'power', target: opponentChar(), delta: -2000, duration: 'thisTurn' },
       validTargets: [...],
       optional: true,
       pendingChain: [],
     }
     ```
   - Engine emite evento `EffectPending { sourceCardId }` (nuevo).
4. Cliente recibe StateUpdate. `PriorityModal` renderiza variante `EffectTargetSelection` (reusa `<TargetPicker />`).
5. Usuario elige target o pulsa "Skip" → dispatch `SelectEffectTarget { targetIndex }`.
6. Engine resuelve el `effect` con el target seleccionado, cierra el priority window, emite `EffectResolved`.
7. Si `pendingChain.length > 0`: extrae el siguiente effect, repite desde paso 3.

**Casos edge**:

- **Único candidato + mandatory**: el engine resuelve directo, no abre window.
- **Único candidato + optional**: abre window igualmente para que el jugador pueda elegir saltarse.
- **Cero candidatos válidos**: el effect "fizzles" silenciosamente (no error, no log adicional).
- **Target pasa a inválido**: cuando el jugador dispatcha `SelectEffectTarget`, el engine re-valida que el target sigue cumpliendo el filter contra el estado actual. Si no → effect fizzles, log `EffectFizzled`.
- **Online filtering**: `validTargets` se filtra al cliente igual que el resto del state (ningún cardId privado expuesto). En OP01 todos los targets de target-selection son visible-zone (Leader, characters), así que no hay riesgo real.
- **PvAI bot**: `EasyBot` elige `targetIndex` random uniforme entre `validTargets` (o `null` si optional con prob 1/(N+1)). `MediumBot` elige el target con mayor `computeEffectivePower` para efectos "ko" / debuffs (heurística "remove threat"); para buffs propios elige el de mayor power para potenciar.

---

## 4. UI cliente

### 4.1 `PriorityModal` extension

Nueva variante `EffectTargetVariant` que reusa `<TargetPicker />` con adaptaciones:

- **Header**: "`<source-card-name>` — choose target" (en lugar de "⚔ Pick attack target"). Sin icono de espadas — esto no es ataque.
- **Effect description**: línea adicional con descripción humana del efecto pendiente — reusa el helper `formatEffect()` que ya existe en `priority-modal.tsx`.
- **Skip button**: visible solo si `pw.optional === true`. Dispatch `SelectEffectTarget { targetIndex: null }`.
- **Targets**: cada tile reusa `<TargetPicker />`'s power badge. Outcome pill se calcula por tipo de effect:
  - `kind: 'ko'` → "✓ Will KO" (siempre verde si target en validTargets).
  - `kind: 'power'` con delta negativo → "→ {newPower} power" (rojo si baja a 0; gris si reduce sin matar).
  - `kind: 'returnToHand'` → "→ hand".
  - `kind: 'banish'` → "→ banished".

### 4.2 Highlight visual de targets en el board

Cuando `EffectTargetSelection` está abierta, las cartas en `validTargets` reciben un anillo pulsante (CSS `animate-pulse` + `ring-2 ring-amber-400`) **además** de aparecer en la modal. Le da pista visual de "estos son los blancos válidos" sin tener que abstraerse al modal.

Implementado vía un nuevo prop opcional `highlighted: boolean` en `<CharacterCard />` y `<LeaderCard />`, y un selector que evalúa `pw.kind === 'EffectTargetSelection' && pw.validTargets.includes(this card)`.

### 4.3 Toasts y feedback

`ToastCenter` añade casos:

| Evento                                                  | Mensaje                        | Variante      |
| ------------------------------------------------------- | ------------------------------ | ------------- |
| `EffectPending(sourceCardId)`                           | `<source>` triggers…           | info (300 ms) |
| `EffectResolved(effect, sourceCardId)` con `kind: 'ko'` | `<source>` KO'd `<target>`     | success       |
| `EffectResolved` con `kind: 'power'`                    | `<source>` -2000 to `<target>` | warning       |
| `EffectResolved` con `kind: 'draw'`                     | `<source>` drew N cards        | info          |
| `EffectFizzled(sourceCardId, reason)`                   | `<source>`'s effect fizzled    | muted         |

### 4.4 Manual fallback

Cartas con `effects: []` (no parseadas) siguen igual que hoy: `manualText` se muestra en el `ActionMenu` con un botón "Manual effect" que solo abre un texto descriptivo sin dispatch — el jugador resuelve a mano.

---

## 5. AI (`packages/ai`)

Ambos bots reciben extensión en `pickPriorityAction`:

```ts
case 'EffectTargetSelection': {
  if (pw.validTargets.length === 0) {
    if (pw.optional) return { kind: 'SelectEffectTarget', player, targetIndex: null };
    // mandatory but no valid → engine should have fizzled. Defensive: skip.
    return { kind: 'SelectEffectTarget', player, targetIndex: null };
  }
  // EasyBot: random.
  // MediumBot: depende del effect kind:
  //   - 'ko' / debuff: target con mayor computeEffectivePower
  //   - 'power' delta>0 (own buff): target propio con mayor power
  //   - 'returnToHand' / 'banish' a opponent: target con mayor power
  return { kind: 'SelectEffectTarget', player, targetIndex: chosen };
}
```

---

## 6. Testing

### 6.1 Engine

- `tests/cards/OP01-{xxx}.test.ts`: un fichero por carta con efectos; al menos 1 test cubriendo el efecto end-to-end. Target ~85 ficheros, ~250 tests.
- `tests/effects/static-aura.test.ts`: `computeEffectivePower` con auras activas/inactivas, condition checks, KO del source desactiva la aura.
- `tests/effects/target-selection.test.ts`: priorityWindow se abre, `SelectEffectTarget` válida/inválida, `pendingChain` chain, target gone-stale fizzle.
- `tests/effects/activate-main-cost.test.ts`: DON cost se resta antes del effect; `NotEnoughDon` si insuficiente.
- `tests/effects/library-coverage.test.ts`: gate ≥85/121 OP01 cards con `effects.length > 0`.

Coverage gate del engine sube de `lines: 80` a `lines: 85`. `effects/cards/**` entra en el include glob.

### 6.2 Web

- `priority-modal.test.tsx` (extensión): variante `EffectTargetSelection` renderiza, clic resuelve, "Skip" funciona si optional.
- `effect-flow.test.tsx`: smoke — jugar Cavendish en un fixture con dos opponents → modal abre → seleccionar target → state actualizado.
- `target-highlight.test.tsx`: validTargets en `pw` se reflejan en `highlighted: true` de los componentes correctos.

### 6.3 AI

- `medium.test.ts`: `pickPriorityAction` ante `EffectTargetSelection` elige correcto según effect kind.
- `self-play.test.ts`: aún 50 Medium-vs-Easy, Medium win-rate ≥70 % con OP01 fixtures que incluyan ahora cartas con efectos hand-coded.

### 6.4 Smoke manual (en plan)

Jugar OP01-vs-OP01 hotseat con un mazo curado (Cavendish + Zoro Leader + Uta + 2-3 más con efectos parseados) — verificar visualmente:

- Aura de Zoro Leader aplica +1000 cuando tiene 1+ DON.
- Cavendish OnPlay abre target picker y aplica -2000 al elegido.
- Uta OnPlay auto-resuelve search (toma primer match per simplificación de Fase 3).
- Manual fallback sigue funcionando para cartas no parseadas.

---

## 7. Exit criteria

- [ ] ≥85 / 121 cartas OP01 con `effects.length > 0` en `CARD_EFFECT_LIBRARY`.
- [ ] Test gate `library-coverage.test.ts` verde (gate del 70 %).
- [ ] Engine soporta `StaticAura` con `computeEffectivePower` — tests verdes, sustitución completa del cálculo de power inline en combat y UI.
- [ ] Engine soporta `EffectTargetSelection` priority window + `SelectEffectTarget` action — flow end-to-end.
- [ ] `Activate:Main` con `EffectCost.donX` resta DON correctamente — test verde.
- [ ] UI muestra `EffectTargetVariant` con descripción del efecto y outcome pill.
- [ ] Cards en `validTargets` reciben highlight visual en el board.
- [ ] Toasts adicionales (`EffectResolved`/`EffectFizzled`) integrados en `ToastCenter`.
- [ ] AI bots manejan `EffectTargetSelection` con heurísticas razonables — self-play test verde.
- [ ] Manual fallback intacto para cartas no parseadas.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` verdes en monorepo.
- [ ] Engine coverage `lines >= 85`.

## 8. Out of scope (futuras mini-fases)

- **OP02 effects** — añadir `cards/OP02-XXX.ts` cuando llegue su turno. Estructura ya soporta crecimiento sin cambios.
- **Search picker UI** (efectos `kind: 'search'` con selección interactiva). Hoy auto-resuelve por primera match.
- **Choice picker UI** (efectos `kind: 'choice'`). Hoy auto-resuelve `options[0]`.
- **Once-Per-Turn enforcement**. Requiere contador per-card per-turn en `PlayerState`.
- **Reactive triggers** (`OnOpponentEvent`, etc.). Requiere hooks en apply() para acciones del rival.
- **Optional costs** ("You may pay X to do Y"). Hoy la versión paga se aplica si hay recurso, gratis si no — simplificación.
- **Drag & drop, atajos de teclado**. Sub-fase aparte.
- **Animaciones extra y sonidos**. Sub-fase aparte.
- **Stats de partida y modo réplay**. Sub-fase aparte.
- **Chat in-game**. Sub-fase aparte.

## 9. Riesgos

| Riesgo                                                                                     | Mitigación                                                                                                                       |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Lectura ambigua del card text humano (por ej. "1" vs "up to 1") → bug semántico hand-coded | Cada card-id tiene un test funcional; revisar contra la wiki oficial OPTCG cuando haya duda; `// TODO[rules]` para casos límites |
| `computeEffectivePower` con N auras → O(N×cards) por llamada, performance en games grandes | Cache opcional dentro del state si se detecta lag; medir antes de optimizar                                                      |
| Engine isolation rule: `effects/cards/**` no debe importar React/Next/Prisma               | ESLint rule existente cubre `packages/engine/**` — automático                                                                    |
| Hand-code de 85 cards → mucho copy-paste/errores                                           | Helpers terse + tests por carta atrapan errores; PR review (auto-review entre tareas via subagent skill)                         |
| TargetSpec semantics inconsistentes entre attack picker y effect picker                    | Compartir builder de targets en un util en engine; tests que verifican que ambos generan misma list                              |

# Design · Simulador One Piece TCG

- **Fecha:** 2026-04-17
- **Estado:** Aprobado (pendiente de review del usuario sobre este documento)
- **Autor:** Claude (a partir del prompt de Tiago)
- **Alcance:** Top-level design. Cada una de las 7 fases de implementación tendrá su propio plan (`writing-plans`).

---

## 1. Resumen

Simulador de escritorio web del **One Piece Trading Card Game** (OPTCG) con tres modos: **hotseat local**, **PvAI** (3 niveles) y **multijugador online**. No es un producto comercial; es una herramienta personal y comunitaria para practicar mazos. Calidad técnica innegociable: código modular, engine puro separado de UI y de red, reglas testeadas con alta cobertura.

La clave arquitectónica es un **engine puro en TypeScript** que es la única fuente de verdad de las reglas de OPTCG. UI, IA y servidor multijugador consumen el mismo engine. Todas las acciones son serializables y deterministas dada una seed, lo que habilita red, replay e IA sin duplicar lógica.

## 2. Alcance

### Dentro

- Mazo de 1 Leader + 50 main + 10 DON.
- Setup completo (mulligan, Life del Leader, determinar inicio).
- 5 fases de turno (Refresh, Draw, DON, Main, End) con reglas de turno inicial.
- Combate completo con Counter Step (Blocker + Events/Counters desde mano).
- Keywords: Rush, Blocker, Counter (X), DoubleAttack, Banish, OnPlay, OnKO, Activate: Main, When Attacking, Trigger, `[DON!!xN]`.
- Deck builder visual con validación en vivo, import/export `.txt` estándar y JSON propio.
- Tablero web apaisado, drag & drop, animaciones core, Counter Step con UI explícita, game log lateral.
- IA Easy (aleatoria legal) y Medium (heurísticas); Hard se pospone.
- Multijugador online con salas por código, reconexión y chat.
- Fallback manual para cartas cuyos efectos aún no estén soportados por el parser.

### Fuera (no MVP)

- Matchmaking, ranking global, torneos.
- Mobile / tablet (sólo desktop ≥1280 px).
- Formato oficial competitivo con restricciones temporales (banned list estacional).
- Monetización, cuentas sociales, integración con tiendas de cartas.
- IA "Hard" con búsqueda adversarial (Fase 7 o posterior).
- Sets más allá de OP01+OP02 en MVP (ampliar en Fase 7).

## 3. Decisiones confirmadas

| # | Decisión | Valor | Razón |
|---|---|---|---|
| 1 | Sets iniciales | **OP01 + OP02** | Cardpool manejable, iteración rápida del parser de efectos. Ampliar en Fase 7. |
| 2 | Auth MVP | **Username local sin password** | Cero fricción, localStorage + id anónimo. Magic link innecesario para un sim personal. |
| 3 | Hosting multijugador | **Fly.io** (o Railway) para `apps/server` + Vercel para `apps/web` | Vercel serverless no mantiene conexiones WebSocket largas; Fly sí. |
| 4 | Idioma UI | **Español primero, i18n-ready desde día 1** | `next-intl` con claves, sin hardcode. Coste marginal bajo ahora, imposible retrofit después. |
| 5 | Imágenes cartas | **Inglés por defecto, toggle EN/JP en settings** | apitcg.com cubre EN bien; JP aporta valor para seguir meta asiático. |
| 6 | Long tail de efectos | **Modo manual con botones** (`+1000`, `KO target`, `draw 1`, …) + log al chat | No bloquea partidas por cartas raras. Marcar cartas como "auto" o "manual" según cobertura del parser. |
| 7 | Dirección visual | **Tabletop cálido** (estilo Hearthstone limpio, tonos madera + dorado, sombras sutiles) | Elegida por el usuario frente a minimalista moderno y navy+rojo OPTCG. |
| 8 | Dispositivos | **Desktop only** (≥1280 px) | Tablero apaisado no funciona bien en móvil; tablet fuera del MVP. |
| 9 | Determinismo | **Seed aleatoria por partida** | No hay botón "seed fija"; replay se reconstruye desde log de acciones (la seed vive en el log). |

## 4. Arquitectura

### 4.1 Monorepo

```
/optcg-sim
├── apps/
│   ├── web/          Next.js 14 App Router — UI de juego, builder, auth, rutas API ligeras
│   └── server/       Servidor Socket.IO autoritativo — valida con engine, estado privado por jugador
├── packages/
│   ├── engine/       TS puro, zod, cero deps de React/Next/Node APIs
│   ├── card-data/    CardDataService, Prisma schema, sincronizador, caché de imágenes
│   ├── ai/           Bots (easy/medium) consumiendo engine
│   └── ui/           Componentes shadcn/ui compartidos entre web y builder
├── prisma/           schema.prisma (SQLite → Postgres cuando haga falta)
└── scripts/
    └── sync-cards.ts Descarga sets desde apitcg.com
```

Herramientas: **pnpm workspaces**, **TypeScript strict** global, **turborepo** opcional para cacheo de builds.

### 4.2 Separación de responsabilidades (no negociable)

- **`packages/engine`** no importa de React, Next, Socket.IO, Prisma ni `fetch`. Sólo TypeScript estándar + `zod`. Si algún día necesita entropía, se inyecta vía un parámetro `PRNG`.
- **`apps/web`** no implementa reglas. Si en un componente aparece algo tipo `if (card.type === 'LEADER')` para decidir comportamiento de juego, es un bug de arquitectura: debe salir de `engine`.
- **`apps/server`** valida acciones llamando a `engine.apply()`. Si la acción es ilegal, la rechaza. El cliente nunca decide.
- **`packages/ai`** sólo lee `GameState` visible a su jugador y propone `Action`s. Nunca hace trampas (no mira la mano del rival en red; en PvAI local sí puede, ver §9).

### 4.3 Determinismo y serialización

- `GameState` y `Action` son **JSON-puros**. Nada de `Map`, `Set`, `Date` objetos, funciones ni clases con métodos mutables.
- Todo aleatorio (shuffle, revelar trigger, empate) pasa por un PRNG **seedeable** que vive dentro del estado (`state.rng`). La seed se genera en el servidor al crear la partida y se incluye en el log de acciones.
- **Invariante:** dado `initialState` y una secuencia `[action1, action2, …]`, el `GameState` final es idéntico siempre. Esto habilita replay, network sync y tests reproducibles.

### 4.4 API del engine

```ts
// packages/engine/src/index.ts
export function createInitialState(setup: MatchSetup): GameState;

export function apply(state: GameState, action: Action): ApplyResult;

export type ApplyResult = {
  state: GameState;              // nuevo estado (inmutable; engine nunca muta el input)
  events: GameEvent[];           // para animaciones y log ("cardDrawn", "attackResolved"…)
  legalActions: Action[];        // próximas acciones legales dado el turno de prioridad
  error?: EngineError;           // si la acción era ilegal
};

export function validateDeck(deck: DeckList, leader: Card): ValidationResult;
```

El engine es **síncrono** y **sin side effects**. La UI y el servidor despachan `apply` y suscriben a eventos.

### 4.5 Protocolo cliente ↔ servidor (multijugador)

- Cliente envía `ProposedAction` por Socket.IO.
- Servidor corre `engine.apply(serverState, action)`:
  - Si legal: actualiza `serverState`, emite `StateUpdate` a ambos clientes con la parte visible (mano privada filtrada por jugador).
  - Si ilegal: emite `ActionRejected` sólo al proponente con el motivo.
- Reconexión: cliente envía `Reconnect { matchId, playerId, token }`; servidor reenvía último `StateUpdate` visible.
- Chat: mensajes simples `{ from, text, timestamp }` separados del log de acciones.

### 4.6 Modelo de efectos declarativos

Cada efecto de carta se representa como árbol serializable:

```ts
type Effect =
  | { kind: 'draw', amount: number }
  | { kind: 'search', from: 'deck'|'trash', filter: CardFilter, amount: number }
  | { kind: 'ko', target: TargetSpec }
  | { kind: 'power', target: TargetSpec, delta: number, duration: 'thisTurn'|'permanent' }
  | { kind: 'returnToHand', target: TargetSpec }
  | { kind: 'banish', target: TargetSpec }
  | { kind: 'sequence', steps: Effect[] }
  | { kind: 'choice', options: Effect[] }
  | { kind: 'manual', text: string };   // fallback

type TriggeredEffect = {
  trigger: 'OnPlay' | 'OnKO' | 'OnAttack' | 'Activate:Main' | 'EndOfTurn' | 'Trigger';
  condition?: EffectCondition;
  cost?: EffectCost;
  effect: Effect;
};
```

Catálogo en `packages/engine/src/effects/library.ts` empieza con efectos comunes. Overrides por carta en `packages/engine/src/effects/cards/{cardId}.ts` cuando haga falta. Cartas sin parser se marcan con `effect: { kind: 'manual', text: '…' }` y la UI expone botones genéricos.

## 5. Modelo de datos

### 5.1 Card (estático, del dataset)

```ts
interface Card {
  id: string;                    // "OP01-001"
  setCode: string;               // "OP01"
  name: string;
  type: 'LEADER' | 'CHARACTER' | 'EVENT' | 'STAGE' | 'DON';
  color: Color[];                // puede ser multicolor
  cost: number | null;           // null para LEADER y DON
  power: number | null;
  counter: 0 | 1000 | 2000 | null;
  life: number | null;           // sólo LEADER
  attribute: Attribute[];        // Slash, Strike, Ranged, Wisdom, Special
  types: string[];               // ej. "Straw Hat Crew", "Captain"
  keywords: Keyword[];
  triggerEffect: string | null;  // texto plano del Trigger
  rawText: string;
  parsedEffects: TriggeredEffect[];  // vacío si aún no parseada
  imageUrl: string;              // ruta local en /public/cards/{set}/{id}.webp
  rarity: Rarity;
}
```

### 5.2 Runtime (GameState)

```ts
interface GameState {
  matchId: string;
  seed: string;                  // para PRNG reproducible
  rngState: number;              // estado actual del PRNG
  turn: number;
  activePlayer: PlayerId;
  startingPlayer: PlayerId;      // para aplicar reglas del primer turno
  phase: 'refresh' | 'draw' | 'don' | 'main' | 'end';
  priority?: PriorityWindow;     // ver §5.3
  players: Record<PlayerId, PlayerState>;
  pendingTriggers: TriggerInstance[];
  log: ActionLogEntry[];
  winner?: PlayerId;
}

interface PlayerState {
  id: PlayerId;
  leader: CardInPlay;
  characters: CardInPlay[];      // máx. 5 (regla OPTCG; verificar ⚠️)
  stage: CardInPlay | null;
  hand: CardInPlay[];
  deck: CardInPlay[];
  trash: CardInPlay[];
  life: CardInPlay[];            // boca abajo hasta que se voltean
  donDeck: DonChip[];
  donActive: DonChip[];          // en Cost Area
  hasMulliganed: boolean;
}

interface CardInPlay {
  uid: string;                   // UUID único por instancia en esta partida
  cardId: string;                // FK a Card
  controller: PlayerId;
  zone: Zone;
  rested: boolean;               // "tapped"
  attachedDonUids: string[];
  summoningSick: boolean;        // true el turno que entra si no tiene Rush
  damage: number;                // no se usa en OPTCG estándar; reservado
  modifiers: Modifier[];         // efectos temporales (+1000 esta ronda, etc.)
}

interface DonChip {
  uid: string;
  controller: PlayerId;
  state: { kind: 'active' } | { kind: 'rested' } | { kind: 'attachedTo', targetUid: string };
}
```

Referencias entre entidades **siempre por UID**, nunca por índice. Esto sobrevive shuffles, robos, cambios de zona y movimientos entre ellas.

### 5.3 PriorityWindow (Counter Step y similares)

```ts
type PriorityWindow =
  | { kind: 'counter', defender: PlayerId, attackerUid: string, targetUid: string, blockerDeclared?: string }
  | { kind: 'triggerChoice', player: PlayerId, options: TriggerOption[] }
  | { kind: 'onPlayChoice', player: PlayerId, cardUid: string, options: EffectOption[] };
```

Mientras `state.priority` esté definido, `engine.apply()` sólo acepta acciones apropiadas a ese window. Esto hace el Counter Step explícito en el estado, serializable y fácil de renderizar en UI como un modal/panel lateral.

### 5.4 Action (discriminated union)

```ts
type Action =
  | { type: 'Mulligan', playerId: PlayerId, accept: boolean }
  | { type: 'PassPhase' }
  | { type: 'PlayCard', cardUid: string, costDonUids: string[] }
  | { type: 'AttachDon', donUid: string, targetUid: string }
  | { type: 'DetachDon', donUid: string }
  | { type: 'ActivateAbility', cardUid: string, abilityIdx: number, costDonUids: string[] }
  | { type: 'Attack', attackerUid: string, targetUid: string }
  | { type: 'DeclareBlocker', blockerUid: string }
  | { type: 'PlayCounter', cardUid: string }
  | { type: 'PassPriority' }
  | { type: 'ResolveTrigger', choice: number }
  | { type: 'ManualEffect', description: string, patch: StatePatch }   // fallback long-tail
  | { type: 'Concede', playerId: PlayerId };
```

Todas las acciones son JSON-puras, validables con `zod`, y el servidor las rechaza si no cumplen el esquema.

## 6. Engine: reglas OPTCG a implementar

Fuente de verdad para la Fase 3. Casos ambiguos marcados con ⚠️ y resueltos en la fase correspondiente consultando reglas oficiales.

### 6.1 Composición de mazo

- Leader: 1 carta. Define colores legales y Life inicial.
- Main deck: exactamente **50 cartas**, máx. **4 copias por `id`**, sólo colores del Leader.
- DON deck: exactamente **10 DON**.
- Sin sideboard.

### 6.2 Setup

1. Shuffle main deck de ambos jugadores.
2. Poner Leader bocarriba.
3. DON deck a un lado.
4. Robar 5 cartas. Mulligan único (devolver las 5 y robar otras 5).
5. Poner N cartas boca abajo como Life, N = `Leader.life`.
6. Determinar quién empieza (configurable: random o elección). El que empieza **no roba** en su primer Draw Phase.

### 6.3 Fases del turno

1. **Refresh** — enderezar (untap) todas tus cartas y DON activos.
2. **Draw** — robar 1 carta (excepto primer turno del jugador inicial).
3. **DON** — añadir DON del DON deck a Cost Area: +1 en turno 1 del inicial, +2 en los demás.
4. **Main** — sin orden fijo, tantas veces como puedas pagar: jugar Character/Event/Stage, adjuntar DON, activar `Activate: Main`, atacar con enderezados que no tengan summoning sick (o que tengan Rush).
5. **End** — disparar efectos `End of Turn`. Descartar a 10 cartas de mano (⚠️ **verificar regla oficial OPTCG**; si no aplica, documentarlo y retirar).

### 6.4 Combate (flujo exacto)

1. **Declarar ataque:** jugador elige atacante (Character o Leader propio, enderezado, sin summoning sick) y target enemigo (Leader, o Character rest — enderezado sólo con keywords específicas).
2. **Atacante rest** (gira).
3. **Counter Step** — engine abre `priority: { kind: 'counter', defender, attackerUid, targetUid }`. Defensor puede:
   - Declarar Blocker (1 por combate; redirige el ataque al blocker rest).
   - Jugar una o más cartas de Counter desde la mano (descartarlas, sumar su `counter` al defensor).
   - Jugar Events `[Counter]`.
   - Pasar prioridad.
4. **Resolución:** comparar `attackerPower + don attachments + buffs` vs `defenderPower + counters + buffs`.
   - `attacker ≥ defender`: ataque exitoso.
     - Si target era Character: al trash.
     - Si target era Leader: perder 1 Life → la carta superior va a la **mano** del defensor. Si tiene Trigger, se evalúa condición; si cumple, se activa.
     - Leader con 0 Life que recibe daño exitoso → **derrota**.
   - `attacker < defender`: nada pasa.
5. **Efectos `OnAttack` / `OnKO`:** disparar en el orden del controlador activo. Resolución con prioridades anidadas si hay choices.

### 6.5 Keywords a soportar

`Rush`, `Blocker`, `Counter (X)`, `DoubleAttack`, `Banish`, `OnPlay`, `OnKO`, `Activate: Main`, `When Attacking`, `Trigger`, `[DON!!xN]` (efectos condicionados a N DON adjuntos).

### 6.6 Zonas por jugador

Leader Area · Character Area (máx. 5 ⚠️) · Stage Area (1) · Cost Area (DON activos) · DON Deck · Main Deck · Trash (público, ordenado) · Hand (privada) · Life Area (boca abajo con contador visible).

## 7. UI: dirección y principios

### 7.1 Dirección visual: Tabletop cálido

- **Paleta:** madera oscura (`#3d2817` → `#5a3a23`), acentos dorados (`#d4a574`), DON como monedas con brillo dorado.
- **Sombras sutiles**, sensación de mesa física iluminada. NO textura pixelada tipo Hearthstone épico; limpio y moderno.
- **Distractores eliminados:** sin partículas ambientales, sin avatares animados, sin marcos barrocos. El foco es el estado de juego.
- Tipografía: sans-serif de lectura cómoda (Inter o Geist). Títulos ligeramente serif para contraste si aporta.

### 7.2 Layout del tablero

- Apaisado 16:10, pensado para ≥1280 px.
- **Arriba:** área del oponente simétrica al jugador.
- **Abajo:** jugador con mano en primer plano, Characters, Leader, DON a la izquierda del Leader.
- **Centro:** barra de fase horizontal (Refresh · Draw · DON · Main · End) con fase activa destacada.
- **Lateral derecho:** log de acciones (últimas 20) con scroll, y chat si hay multijugador.
- **Indicadores siempre visibles** a 1080p sin zoom: fase, DON `x/y`, Life de ambos Leaders, cartas en deck/trash/mano del oponente (boca abajo), turno actual.

### 7.3 Interacciones clave

- **Hover sobre carta** → modal grande con imagen + texto + keywords resaltadas. Delay 200 ms para evitar flicker.
- **Drag & drop** (`@dnd-kit`):
  - Jugar carta: mano → zona de Character / Stage / Event.
  - Adjuntar DON: chip DON → Character o Leader.
  - Atacar: atacante → objetivo.
- **Counter Step UI explícita:** cuando el oponente ataca, modal/panel inferior con:
  - Atacante + power.
  - Defensor + power base.
  - Counters disponibles en mano (destacados).
  - Botones: `Declarar Blocker`, `Jugar Counter`, `No contrarrestar`.
- **Animaciones (Framer Motion):** robar, jugar carta (con flip), ataque, daño a Life (voltear y volar a mano), adjuntar DON (+1000 flotando).
- **Indicadores por carta:** rotación 90° si rest, badge numérico de DON adjuntos, halo de summoning sick.
- **Atajos de teclado:** Space (siguiente fase), Enter (confirmar), Esc (cancelar selección).

### 7.4 Deck builder

- Panel izquierdo: buscador (nombre, color, coste, tipo, keyword, set).
- Panel central: cartas filtradas en grid.
- Panel derecho: mazo actual con contador, validación en vivo (rojo si ilegal).
- Estadísticas: curva de coste, distribución por color, `#counters`, `#blockers`, atributos, tipos.
- Import/export: `.txt` estándar comunidad (`4xOP01-001`) y JSON propio.

### 7.5 i18n desde el día 1

Textos UI en claves `next-intl`. Archivos `/apps/web/messages/es.json` y `/apps/web/messages/en.json` (en vacío hasta Fase 7). Tests chequean que no haya strings hardcoded en JSX.

## 8. Multijugador

- **Servidor autoritativo** Socket.IO en `apps/server`. Guarda estado por `matchId` en memoria (Redis cuando escale; out of scope MVP).
- **Salas por código:** host crea partida → recibe código → invitado se une. Sin matchmaking.
- **Reconexión:** cliente manda `Reconnect { matchId, playerId, token }` en ≤60 s; servidor reenvía último `StateUpdate`.
- **Chat:** mensajes simples en canal separado del log de acciones.
- **Privacidad:** el servidor filtra la mano del rival en cada `StateUpdate` (el cliente jamás conoce lo que no le tocaría ver si la partida fuera presencial).
- **Anti-cheat básico:** toda acción del cliente se valida con `engine.apply()` server-side. Si es ilegal, `ActionRejected`. El cliente **propone**, no **decide**.

## 9. IA

### 9.1 Arquitectura

- `packages/ai` expone `chooseAction(state: GameState, playerId: PlayerId): Action`.
- Bots consumen **el mismo engine** que el jugador humano. En PvAI local corren client-side.
- En PvAI local, la IA puede leer todo `GameState` (no hay otro cliente al que engañar). Se documenta. En multijugador la IA no aplica.

### 9.2 Niveles

- **Easy:** acción aleatoria entre `legalActions`.
- **Medium:** heurísticas:
  - Adjuntar DON al Character con mayor power atacante.
  - Atacar al Leader enemigo siempre que sea viable.
  - Bloquear si el ataque va a matar al Leader.
  - Jugar cartas de menor coste primero cuando el board está vacío.
  - Usar Counter si evitar daño al Leader.
- **Hard (Fase 7+):** búsqueda tipo expectimax/MCTS a 1–2 turnos vista. No prioritario.

## 10. Calidad y verificación

### 10.1 Estándares innegociables

- **TypeScript strict** global (`noImplicitAny`, `strictNullChecks`). Prohibido `any` salvo `// SAFETY:` justificado.
- **Engine sin deps de framework.** Pre-commit hook verifica que `packages/engine/package.json` no importe React, Next, Node APIs, ni `socket.io`.
- **Acciones y estado serializables.** Test que hace `JSON.parse(JSON.stringify(state))` y compara.
- **Determinismo.** Test que dado seed y secuencia de acciones produce el mismo estado final dos veces.
- **Sin reglas en componentes React.** Lint rule que prohíbe `if (card.type === …)` con lógica de juego dentro de `apps/web/src/components`.
- **Componentes <200 líneas.** Lint + review manual.
- **Commits convencionales** (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- **1 PR por fase** con review gate explícito.

### 10.2 Cobertura de tests

- `packages/engine`: **>85 %** líneas y ramas. Unit tests por fase, reglas de combate, keyword behavior, efecto declarativo.
- `apps/web`: tests Playwright para flujos críticos (builder → partida → victoria en hotseat).
- `apps/server`: tests de protocolo (acción legal vs ilegal, reconexión, partida sincronizada entre 2 clientes simulados).
- CI: GitHub Actions — lint, typecheck, unit tests en cada push; Playwright en `main`.

## 11. Roadmap por fases

Cada fase termina con **PR + review checkpoint**. No se empieza la siguiente hasta aprobación explícita.

### Fase 0 · Setup (≤1 día)

- Monorepo pnpm + turborepo.
- Next.js 14 + Tailwind + shadcn/ui base.
- Prisma + SQLite con migración inicial vacía.
- Vitest en `packages/engine`.
- GitHub Actions con lint + typecheck + test.
- Pre-commit hook (husky + lint-staged).

**Exit criteria:** `pnpm install && pnpm test && pnpm lint` verdes. CI verde en primer push. `pnpm dev` levanta Next.js.

### Fase 1 · Card data pipeline

- `packages/card-data` con `CardDataService` interfaz abstracta.
- Implementación con apitcg.com (fallback Limitless TCG si apitcg no cubre algo).
- `scripts/sync-cards.ts` descarga OP01+OP02: cartas a SQLite, imágenes a `/apps/web/public/cards/{set}/{id}.webp`.
- UI galería `/cards` con búsqueda y filtros básicos.

**Exit criteria:** `pnpm cards:sync` trae ≥ (OP01+OP02 total) cartas con imágenes locales. Galería filtrable por color/tipo/coste/nombre. Sin llamadas a la API en runtime (todo caché).

### Fase 2 · Deck builder

- Página `/builder` con 3 paneles (buscador / grid / mazo).
- Validación en vivo (contador 0/50, marcar ilegales).
- Import `.txt` estándar, export `.txt` y JSON.
- Persistencia en SQLite por `userId` (username local).
- Auth simple: input "elige username" en primera visita, guardar en localStorage + SQLite.

**Exit criteria:** construir mazo legal de OP01, guardar, recargar página, seguir ahí. Import de decklist comunitaria funcional con ≥2 ejemplos reales.

### Fase 3 · Engine core

- Tipos `GameState`, `Action`, `PriorityWindow`.
- `createInitialState`, `apply`, `validateDeck`.
- Fases del turno completas (Refresh, Draw, DON, Main, End).
- Combate con Counter Step.
- Keywords core (Rush, Blocker, Counter, DoubleAttack, Banish, OnPlay, OnKO, Activate:Main, Trigger, `[DON!!xN]`).
- Efectos declarativos + fallback manual.
- PRNG seedeable.
- Tests: >85 % cobertura, casos documentados (tabla en README de engine).

**Exit criteria:** test de partida scriptada completa (setup → combate → victoria) pasa determinísticamente 10/10 runs con misma seed. Cobertura ≥85 %.

### Fase 4 · UI de partida (hotseat 1v1 local)

- Tablero con dirección visual A (tabletop cálido).
- Todas las zonas visibles.
- Drag & drop funcional.
- Animaciones core (robar, jugar, atacar, daño a Life, DON).
- Game log lateral.
- Hover preview de cartas.
- **Counter Step UI explícita**.
- Atajos de teclado.

**Exit criteria:** 2 humanos pasándose el ratón completan una partida de OP01 sin bugs visibles, todas las zonas legibles, Counter Step no ambiguo.

### Fase 5 · IA Easy + Medium

- `packages/ai` con los dos bots.
- Selector de dificultad en menú principal.
- Pantalla de PvAI.

**Exit criteria:** Easy juega 100 partidas sin errores legales. Medium gana a Easy en >70 % de 50 partidas.

### Fase 6 · Multijugador online

- `apps/server` Socket.IO desplegado en Fly.io.
- Salas por código, lobby simple.
- Reconexión 60 s.
- Chat en partida.
- Filtrado de mano privada server-side.

**Exit criteria:** 2 navegadores en máquinas distintas completan partida. Matar el cliente 1 + reconectar en <60 s restaura estado sin inconsistencias.

### Fase 7 · Pulido

- Parser de efectos declarativo ampliado: ≥70 % de cartas OP01 con `parsedEffects` no vacío.
- Stats de partida (winrate por mazo en SQLite).
- Modo réplay: desde `log[]` reproduce partida paso a paso.
- Animaciones extra y sonidos opcionales.

**Exit criteria:** réplay determinista de 5 partidas arbitrarias del historial. Stats visibles por mazo.

## 12. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| API de apitcg.com cambia o se cae | Sync roto, imágenes viejas | `CardDataService` abstracto; datos y imágenes cacheados localmente; fallback Limitless TCG |
| Reglas OPTCG ambiguas en casos de borde | Bugs de partida | Marcar con `// TODO[rules]`; no inventar; preguntar al usuario; comparar con OPTCG Sim oficial cuando haya duda |
| Parser de efectos declarativos se vuelve imposible para el long-tail | Bloquear partidas por cartas raras | Fallback manual desde Fase 3; cartas "auto" vs "manual" explícitas en UI |
| Socket.IO en Fly.io sin sticky sessions rompe reconexiones | Partidas online inestables | Afinar Fly.io con máquinas fijas por match; Redis si hace falta |
| Costes de tokens del visual-companion excesivos | Brainstorming caro | Usar sólo para decisiones realmente visuales |

## 13. Assumptions pendientes de validar

- `// ASSUMPTION:` Character Area max = 5 (⚠️ verificar en rulebook oficial en Fase 3).
- `// ASSUMPTION:` Regla de descartar a 10 en End Phase aplica a OPTCG (verificar; si no, retirar).
- `// ASSUMPTION:` apitcg.com `/v1/one-piece/cards` cubre OP01 y OP02 con imágenes oficiales y texto de efecto en inglés completo.
- `// ASSUMPTION:` Dominio y licencia: uso personal/comunitario, sin redistribución de imágenes oficiales fuera del servidor privado del usuario.
- `// ASSUMPTION:` No hay regulaciones adicionales del cliente Windows que afecten al servidor de desarrollo local.

## 14. Glosario OPTCG

- **Leader** — carta central, representa al personaje principal; define colores y Life.
- **Character** — criatura jugable; ataca, defiende, recibe DON.
- **Event** — efecto de un solo uso; a veces jugable durante Counter Step (`[Counter]`).
- **Stage** — carta persistente tipo "terreno" (1 a la vez por jugador).
- **DON!!** — recurso que se gasta para jugar cartas y adjuntado da +1000 power.
- **Life** — cartas boca abajo; cada daño exitoso al Leader las voltea y el defensor las roba.
- **Counter** — valor en carta de Character/Event que se descarta durante Counter Step para sumar power defensivo.
- **Blocker** — keyword que permite rest'ar un Character para redirigir un ataque.
- **Rush** — Character puede atacar el turno que entra.
- **DoubleAttack** — si el ataque es exitoso contra Leader, se voltea 2 Life en lugar de 1.
- **Trigger** — efecto que se activa al voltear una Life como daño.
- **Summoning sick** — un Character no puede atacar el turno que entra salvo con Rush.

---

## Revisión del spec (post-escritura)

- **Placeholders:** no hay TBD/TODO sin ⚠️ explícito. Los `// TODO[rules]` y `// ASSUMPTION:` son marcadores intencionales para el implementador.
- **Consistencia interna:** arquitectura (§4), datos (§5), reglas (§6) y UI (§7) se refieren entre sí con nombres idénticos. Fases (§11) encajan con dependencias.
- **Scope:** demasiado grande para un único plan de implementación. **Cada una de las 7 fases se brainstormea y planifica por separado** cuando toque arrancarla. Este doc es el paraguas top-level.
- **Ambigüedad:** resuelta donde la decisión estaba tomada; marcada con ⚠️ donde hay que consultar rulebook oficial (sólo en §6).

Siguientes pasos:
1. Usuario revisa este doc.
2. Tras aprobación, init git, commit del doc.
3. Invocar `writing-plans` para la **Fase 0 (Setup)**.

# Fase 6 · Multijugador online — Diseño

> Spec de la Fase 6 del simulador OPTCG. Complementa `docs/superpowers/specs/2026-04-17-optcg-sim-design.md` §4.5, §8 y §11; cualquier conflicto se resuelve a favor de este documento.

**Goal.** Dos navegadores conectados a un servidor autoritativo completan una partida OPTCG end-to-end con reconexión 60 s, filtrado de mano server-side y protección anti-cheat.

**Alcance Fase 6 (cerrado).** Servidor local + smoke en dos pestañas. Despliegue a Fly.io, chat, turn timer, spectator, cuentas persistentes y replay quedan fuera.

---

## 1. Arquitectura

Se añade un nuevo workspace `apps/server` — servidor Node autoritativo. Stack: TypeScript strict + `socket.io` + `fastify` (HTTP healthcheck + CORS) + vitest. Sin Next, sin Prisma, sin frontend.

```
apps/server/
├── src/
│   ├── index.ts          # bootstrap: Fastify + Socket.IO + catalog load
│   ├── catalog.ts        # carga catalog.json al arrancar
│   ├── match/
│   │   ├── store.ts      # Map<matchId, Match>
│   │   ├── match.ts      # fachada sobre GameState + timers + sockets
│   │   └── codes.ts      # generador de códigos 6 chars, colisiones
│   ├── protocol/
│   │   ├── messages.ts   # ClientMsg / ServerMsg discriminated unions + zod schemas
│   │   └── filter.ts     # private-hand filtering
│   └── logger.ts
├── scripts/build-catalog.ts   # emite catalog.json desde @optcg/card-data
└── tests/
```

**Cliente (`apps/web`)** mantiene `GameProvider` para hotseat/PvAI. Añade un `NetGameProvider` que expone la misma API (`state`, `events`, `dispatch`, `dispatchBatch`, `botPlayers: {}`) pero bajo el capó habla Socket.IO contra el servidor. `Board/PlayerSide/etc.` no cambian — siguen consumiendo `useGame()`.

**Catálogo compartido:** `packages/card-data` gana un script `pnpm --filter @optcg/card-data export:catalog` que emite `dist/catalog.json`. El servidor lo consume al arrancar; el cliente web sigue con su pipeline actual. CI verifica que ambos builds usen el mismo commit del catálogo (misma rama del repo).

**Modelo de confianza:** cliente **propone** acciones; servidor **decide** con `engine.apply()`. Si el cliente está en desacuerdo con el estado que recibe, el servidor gana. No hay predicción optimista en MVP.

---

## 2. Protocolo Socket.IO

Todos los mensajes son JSON-serializables, discriminados por `kind`, validados con `zod` schemas server-side.

### 2.1 Cliente → Servidor (`ClientMsg`)

| Mensaje              | Payload                                            | Cuándo                                           |
| -------------------- | -------------------------------------------------- | ------------------------------------------------ |
| `CreateMatch`        | `{ nickname }`                                     | Host pulsa "Create"                              |
| `JoinMatch`          | `{ matchId, nickname }`                            | Guest abre URL `/play/online/<code>`             |
| `SubmitDeck`         | `{ matchId, token, leaderCardId, deck: string[] }` | Cada jugador tras pick de mazo                   |
| `SetReady`           | `{ matchId, token, ready: boolean }`               | Toggle del botón Ready                           |
| `ProposeAction`      | `{ matchId, token, action: Action }`               | Toda acción de la partida                        |
| `ProposeActionBatch` | `{ matchId, token, actions: Action[] }`            | Secuencias atómicas (p.ej. Counter Step confirm) |
| `Reconnect`          | `{ matchId, token }`                               | Cliente monta y tiene sesión guardada            |
| `Rematch`            | `{ matchId, token, ready: boolean }`               | Tras `GameOver`                                  |
| `Forfeit`            | `{ matchId, token }`                               | Botón explícito                                  |

### 2.2 Servidor → Cliente (`ServerMsg`)

| Mensaje                | Payload                                                                 | Destinatarios                                                                    |
| ---------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `MatchCreated`         | `{ matchId, token, playerIndex: 0 }`                                    | Solo host                                                                        |
| `MatchJoined`          | `{ matchId, token, playerIndex: 1 }`                                    | Solo guest                                                                       |
| `LobbyUpdate`          | `{ players: [{ nickname, deckReady, ready } \| null, …], matchStatus }` | Ambos                                                                            |
| `GameStart`            | `{ firstPlayer: 0 \| 1, initialState: GameState }`                      | Ambos (estado ya filtrado)                                                       |
| `StateUpdate`          | `{ state: GameState, events: GameEvent[] }`                             | Ambos (estado ya filtrado por destinatario)                                      |
| `ActionRejected`       | `{ reason: EngineError, batchIndex?: number }`                          | Solo el proponente (`batchIndex` solo presente si venía de `ProposeActionBatch`) |
| `OpponentDisconnected` | `{ secondsToForfeit: 60 }`                                              | El conectado                                                                     |
| `OpponentReconnected`  | `{}`                                                                    | El que esperaba                                                                  |
| `GameOver`             | `{ winner: 0 \| 1, reason: 'engine' \| 'forfeit' \| 'timeout' }`        | Ambos                                                                            |
| `Error`                | `{ code: string, message: string }`                                     | Solo el afectado                                                                 |

### 2.3 Filtrado de mano privada (`filter.ts`)

Antes de emitir un `StateUpdate`/`GameStart` al jugador `P`:

- `state.players[1-P].hand` → `Array(hand.length).fill('__hidden__')`
- `state.players[1-P].life` → `Array(life.length).fill('__hidden__')` (hasta que el trigger se resuelva)
- `state.players[1-P].deck` → `Array(deck.length).fill('__hidden__')`

El tipo sigue siendo `string[]` (no rompe `GameState`). El cliente ya sabe renderizar card-backs para IDs desconocidos. La mano propia llega intacta; los counts del rival siguen siendo correctos (lo que importa para UI).

### 2.4 Fiabilidad

Socket.IO hace ack+retry nativo. El servidor no trackea ACKs de aplicación — si un `StateUpdate` no llega por desconexión, el cliente recupera el último estado válido al mandar `Reconnect`.

---

## 3. Servidor — internals

### 3.1 `MatchStore` (`match/store.ts`)

`Map<matchId, Match>` en memoria. Sin persistencia. Si el servidor reinicia, todos los matches mueren (aceptable, el exit criteria no exige supervivencia a reinicios).

- Cap hardcoded de **500 matches simultáneos**; `CreateMatch` responde `Error(code: 'ServerFull')` si se alcanza.
- **GC** cada 15 min: mata matches con `status === 'finished'` y `createdAt > 2h`.

### 3.2 `Match` (`match/match.ts`)

```ts
interface Match {
  id: string; // 6 chars alphanum, generador en codes.ts
  createdAt: number;
  status: 'waiting' | 'lobby' | 'playing' | 'finished';
  players: [Player | null, Player | null];
  state: GameState | null; // null hasta que ambos Ready
  disconnectTimers: Map<string, NodeJS.Timeout>; // key = token
}

interface Player {
  token: string; // uuid v4 generado server-side
  nickname: string;
  socketId: string | null; // null mientras esté desconectado
  deck: { leaderCardId: string; cards: string[] } | null;
  ready: boolean;
}
```

### 3.3 Lifecycle (transiciones)

| Evento                                          | Transición                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CreateMatch`                                   | Nuevo Match `waiting`, asigna token al host como `players[0]`, responde `MatchCreated`.                                                                                                                                                                                                                                                                                                                                     |
| `JoinMatch` sobre match `waiting`               | Asigna token al guest como `players[1]`, pasa a `lobby`, emite `LobbyUpdate` a ambos.                                                                                                                                                                                                                                                                                                                                       |
| `JoinMatch` sobre match no-`waiting`            | Responde `Error(code: 'MatchUnavailable')`.                                                                                                                                                                                                                                                                                                                                                                                 |
| `SubmitDeck`                                    | Valida con `validateDeck(leader, deck, catalog)`. Si falla → `Error(code: 'DeckInvalid', message)`. Si OK → guarda y emite `LobbyUpdate`.                                                                                                                                                                                                                                                                                   |
| `SetReady` con ambos ready tras deck válido     | `createInitialState({ seed, firstPlayer: random 0/1, players: [deck0, deck1] })`, `status='playing'`, emite `GameStart` filtrado a cada uno.                                                                                                                                                                                                                                                                                |
| `ProposeAction`                                 | Verifica `token === expectedActor.token` (activePlayer en Main, defender.owner en CounterStep/BlockerStep, owner en TriggerStep, player de Mulligan). Si no → `ActionRejected(code: 'NotYourPriority')`. Luego `apply(state, action)`. Si `error` → `ActionRejected` al proponente. Si OK → actualiza, emite `StateUpdate` filtrado a cada uno. Si los eventos incluyen `GameOver` → `status='finished'`, emite `GameOver`. |
| Disconnect de un socket (del Socket.IO adapter) | Marca `players[i].socketId = null`. Arranca `setTimeout(60_000)` en `disconnectTimers`. Emite `OpponentDisconnected` al otro si sigue conectado.                                                                                                                                                                                                                                                                            |
| `Reconnect` con token válido                    | Limpia timer. Actualiza `socketId`. Emite `OpponentReconnected` al otro; reenvía último `StateUpdate` (y `LobbyUpdate` si aplica) al reconectado.                                                                                                                                                                                                                                                                           |
| Timer 60 s expira                               | `status='finished'`, `winner = 1 - desconectado`, emite `GameOver(reason: 'timeout')`. Programa `store.delete(matchId)` en 30 s (ventana de acks).                                                                                                                                                                                                                                                                          |
| `Forfeit`                                       | Igual que timeout pero `reason: 'forfeit'`.                                                                                                                                                                                                                                                                                                                                                                                 |
| `Rematch` con ambos ready tras `finished`       | Si ambos vivos y ready → nuevo `createInitialState` con firstPlayer invertido, `status='playing'`, emite `GameStart`.                                                                                                                                                                                                                                                                                                       |

### 3.4 Validación y anti-cheat

- **Schema validation:** cada `ClientMsg` pasa por `zod` schema antes de tocar lógica. Mensajes malformados → `Error(code: 'BadRequest')`, no se tumba el servidor.
- **Token check:** todo mensaje que tenga `matchId + token` (todos menos `CreateMatch` y `JoinMatch`) se valida contra `match.players[i].token`. Si no coincide → `Error(code: 'Unauthorized')`.
- **Priority check:** `ProposeAction` solo se acepta si el token corresponde al jugador cuya priority es esa en el momento del mensaje. Evita que player 0 mande acciones como player 1 durante Counter Step.
- **Deck check:** `validateDeck` del engine + verificación de que todos los IDs existan en `catalog.json` del servidor.

### 3.5 Configuración

- `PORT` env (default `3001`).
- `CORS_ORIGIN` env (default `http://localhost:3000`).
- `NODE_ENV` estándar; en dev, logs verbose; en prod, JSON structured.
- Sin base de datos, sin secrets, sin rate-limit en MVP (single-instance local).

---

## 4. Cliente — integración en `apps/web`

### 4.1 Rutas

```
/play/online                 → landing: "Create" | "Join with code"
/play/online/[code]          → lobby + in-game (mismo componente)
```

La ruta `/play` (mode selector hotseat/Easy/Medium) no cambia. Fase 6 añade un cuarto modo accesible desde `/play` mediante el botón **Play Online** que redirige a `/play/online`.

### 4.2 `useOnlineSocket(matchId?)`

Hook en `apps/web/src/lib/online/use-online-socket.ts`:

- Crea un `socket.io-client` contra `NEXT_PUBLIC_SERVER_URL` (default `http://localhost:3001`).
- Expone un reducer con `{ phase: 'connecting'|'lobby'|'playing'|'finished', state, events, error, opponentDisconnected }`.
- Gestiona sesión en `localStorage['optcg.online.session.<matchId>']` = `{ token, nickname, playerIndex }`.
- Al montar con `matchId` y sesión existente → manda `Reconnect` automáticamente.
- Abstrae ack: cada `ProposeAction` devuelve `Promise<void>` que resuelve con el siguiente `StateUpdate` o rechaza con `ActionRejected`.

### 4.3 `NetGameProvider`

Wrapper con la misma shape que `GameProvider` (`state`, `events`, `dispatch`, `dispatchBatch`, `botPlayers: {}`). Lee de `useOnlineSocket`. Diferencias bajo el capó:

| Aspecto                       | Hotseat/PvAI                                  | Online                                                                                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dispatch(action)`            | `apply()` local, `setState`                   | `emit ProposeAction`; espera `StateUpdate`; `setState` cuando llega                                                                                                                                                                                         |
| Auto-advance Refresh/Draw/Don | cliente                                       | servidor (cliente solo observa)                                                                                                                                                                                                                             |
| Bot runner                    | cliente                                       | n/a                                                                                                                                                                                                                                                         |
| Hand del rival                | ya visible (hotseat) o hidden por rule (PvAI) | llega ya filtrada                                                                                                                                                                                                                                           |
| `dispatchBatch(actions)`      | chain local                                   | emite las acciones como un `ProposeActionBatch { actions: Action[] }`; el servidor las aplica secuencialmente **de forma atómica** (si una falla, rollback y `ActionRejected` con el índice que falló); si todas pasan, emite **un** `StateUpdate` al final |

### 4.4 Pantalla de lobby

`OnlineLobby` component:

1. Nickname input (si no hay en localStorage; 1-24 chars, sin caracteres de control).
2. Deck picker reutilizando el de `/play` (lee `localStorage` de mazos guardados).
3. Ready toggle.
4. Display del estado del rival: "Opponent: `<nickname>` · deck ready ✓ · ready ✓".
5. Cuando ambos ready → `SetReady(true)` → espera `GameStart`.
6. Al llegar `GameStart` → el componente cambia a renderizar `<Board />` como en hotseat.

### 4.5 UI de reconexión y forfeit

- **Banner superior** amarillo con countdown `"Opponent disconnected — 52 s to forfeit"` cuando llega `OpponentDisconnected`; desaparece con `OpponentReconnected`.
- **Modal `GameOver`** ya existente recibe variants nuevos: `reason: 'timeout'` → "Opponent didn't return — you win", `reason: 'forfeit'` → "Opponent forfeited — you win".
- **Botón `Forfeit`** en el header flotante (solo durante `playing`), con confirm.
- Al llegar `GameOver` → modal ofrece "Rematch" (emite `Rematch(ready: true)`) y "Leave" (navega a `/play/online`).

### 4.6 Qué NO cambia

Todos los componentes de tablero: `Board`, `PlayerSide`, `TargetPicker`, `DonStack`, `ToastCenter`, `PriorityModal`, `HotseatHandoff`, etc. Ya leen de `useGame()`, que es el mismo contract.

El `HotseatHandoff` se esconde automáticamente en online porque `isPvAI` pasa a calcularse como `Boolean(botPlayers[0] || botPlayers[1])` — `botPlayers` en online es `{}`, y además introducimos un flag adicional `isOnline: boolean` en el context para que el handoff lo pueda saltar explícitamente (online no necesita "pasar el dispositivo").

---

## 5. Testing

### 5.1 Servidor (`apps/server/tests/`)

| Suite                       | Cubre                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `match/store.test.ts`       | Crear / joinar / GC de matches, colisión de códigos (`codes.test.ts`), cap de 500                                                                       |
| `match/lifecycle.test.ts`   | Transiciones `waiting → lobby → playing → finished` con mensajes correctos a cada socket mock                                                           |
| `match/filter.test.ts`      | Mano del rival llega como `__hidden__[]` del tamaño correcto; la propia llega intacta                                                                   |
| `match/anti-cheat.test.ts`  | Token mismatch → `ActionRejected(Unauthorized)`; player 0 intentando actuar en priority de player 1 en Counter Step → `ActionRejected(NotYourPriority)` |
| `match/timeout.test.ts`     | Disconnect + `vi.useFakeTimers` + 60 s → `GameOver(timeout)` con winner correcto; reconnect antes de 60 s limpia timer                                  |
| `match/rematch.test.ts`     | Tras `GameOver`, ambos `Rematch(ready)` → nuevo `GameStart` con firstPlayer invertido, mismos decks                                                     |
| `protocol/validate.test.ts` | Cada `ClientMsg` malformado → `Error(BadRequest)` sin crashear servidor                                                                                 |

**Target:** cobertura >80 % en `apps/server/src/match/`. Threshold opt-in en `vitest.config.ts`.

### 5.2 Cliente (`apps/web/src/lib/online/`)

- `use-online-socket.test.ts` — monta servidor Socket.IO in-memory en `beforeAll` y valida ciclo completo create → join → deck → ready → game flow → rematch end-to-end.
- `net-game-provider.test.tsx` — `dispatch(action)` no actualiza `state` hasta recibir `StateUpdate`; recibe `ActionRejected` y expone el error al caller.

### 5.3 Smoke manual (documentado en el plan)

1. `pnpm --filter @optcg/server dev` en terminal 1.
2. `pnpm --filter @optcg/web dev` en terminal 2.
3. Abrir 2 pestañas (una incógnito para evitar colisión de localStorage) en `/play/online`.
4. Completar partida end-to-end.
5. Cerrar pestaña 1, reabrir en <60 s, verificar que retoma.
6. Cerrar pestaña 1 definitivamente, esperar 60 s, verificar `GameOver(timeout)` en la otra.

### 5.4 Fuera de scope de tests

- Load / stress test del servidor.
- Fuzzing del protocolo.
- Tests contra Fly.io desplegado (se valida manualmente cuando se haga el deploy real).

---

## 6. Exit criteria

- [ ] `apps/server` arranca con `pnpm --filter @optcg/server dev` y sirve Socket.IO en `:3001`.
- [ ] `/play/online` permite Create → Share code/URL → Join → ambos pick deck + ready → partida completa funcional.
- [ ] Servidor autoritativo: toda acción pasa por `engine.apply()`; el `StateUpdate` nunca expone `cardId` real de la mano/deck/life del rival.
- [ ] Anti-cheat: token mismatch o priority wrong → `ActionRejected` con código apropiado.
- [ ] Disconnect ↔ reconnect en <60 s restaura la partida sin inconsistencias.
- [ ] Disconnect >60 s → forfeit automático con `GameOver(timeout)`.
- [ ] `Forfeit` manual funciona igual que timeout.
- [ ] Rematch tras `GameOver` arranca nueva partida con firstPlayer invertido.
- [ ] `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` verdes en todo el monorepo.
- [ ] Cobertura `apps/server/src/match/` >80 %.
- [ ] `docs/deploy-fly.md` con receta de deploy (Dockerfile + fly.toml + env vars) — committed, no ejecutado.

## 7. Out-of-scope Fase 6 (diferido a Fase 7 o posterior)

- Chat in-game.
- Despliegue real a Fly.io.
- Turn timer (detección de AFK dentro del turno).
- Spectator mode.
- Matchmaking automático.
- Cuentas / auth persistente más allá de localStorage por match.
- Historial de partidas online / stats.
- Replay online.
- Parser expandido de efectos declarativos (sigue Fase 7).

## 8. Riesgos

| Riesgo                                                       | Mitigación                                                                                                                                                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drift entre catálogo cliente y servidor                      | `catalog.json` se exporta desde `@optcg/card-data` en el mismo commit; ambos builds leen del mismo SHA (verificable en CI).                                                                                             |
| `StateUpdate` grande por `GameState` completo en cada acción | Emitir solo en transiciones reales (~1 por acción); filtrado reduce el payload; medir si aparece lag perceptible — si pasa, optimizar con diff (out of scope MVP).                                                      |
| Token en localStorage se abusa en multi-tab                  | Una sesión por `matchId` única; si se abre la misma URL en dos tabs, la primera pierde la conexión (servidor actualiza `socketId` al último). UX: no es cheating, solo que no puedes jugarte contigo mismo en dos tabs. |
| Deck validation falla silencioso                             | `SubmitDeck` devuelve `Error(DeckInvalid, message)` con el motivo; lobby muestra el motivo; permite reenviar.                                                                                                           |
| Socket.IO polling fallback en redes raras                    | Default auto-negocia; no tocar salvo problema concreto.                                                                                                                                                                 |

## 9. Assumptions

- Los mazos de los jugadores están guardados en `localStorage` del cliente (Fase 2). El servidor nunca persiste mazos, solo los recibe al inicio de cada partida.
- El cliente tiene acceso a su propio catálogo de cartas (vía Fase 1 + Fase 2). El servidor tiene el suyo vía `catalog.json`. Si ambos vienen del mismo commit, son idénticos.
- Fly.io y CORS para producción se cierran en Fase 6.5 o al principio de Fase 7 con la receta manual dejada en `docs/deploy-fly.md`.

## 10. Fuera de alcance, explícito

- **No se implementa todavía** `packages/engine` con nada nuevo; Fase 6 consume el engine tal cual está tras Fase 5 (excepto si se descubre un bug de serialización del estado, que sí se parchea en el engine).
- **No se tocan** los componentes de tablero salvo para añadir el banner de disconnect, la integración con `NetGameProvider`, y un flag `isOnline` en el context.

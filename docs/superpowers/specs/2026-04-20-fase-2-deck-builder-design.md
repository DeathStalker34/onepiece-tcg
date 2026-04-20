# Fase 2 — Deck builder (design)

**Fecha:** 2026-04-20
**Branch:** `feature/fase-2-deck-builder`
**Spec padre:** [2026-04-17-optcg-sim-design.md](./2026-04-17-optcg-sim-design.md) §11 Fase 2
**Modo:** desarrollo autónomo aprobado por el usuario — decisiones baked-in, documentadas en §10.

## 1. Objetivo

Permitir al usuario construir mazos legales de OPTCG sobre el catálogo OP01+OP02 sincronizado en Fase 1. Persistencia local vía SQLite + username por primera visita. Import/export `.txt` para interoperar con decklists de comunidad.

Esto habilita Fase 3 (engine), que recibirá un `DeckList` serializado por esta fase como entrada para partidas.

## 2. Scope

**Dentro:**

- Modelo `User` + `Deck` + `DeckCard` en Prisma (misma base de datos que Fase 1).
- Flujo de "primer usuario": modal al abrir la app la primera vez si no hay `userId` en localStorage.
- Rutas:
  - `/builder` — listado de mazos del usuario + botón "New deck".
  - `/builder/[deckId]` — editor de mazo (3 paneles).
- API routes (Next.js App Router, `app/api/...`):
  - `POST /api/users` — crear usuario (upsert por `username`).
  - `GET /api/users/[id]/decks` — listar mazos.
  - `POST /api/decks` — crear mazo.
  - `GET /api/decks/[id]` — leer mazo.
  - `PUT /api/decks/[id]` — actualizar (full replace de cartas + metadatos).
  - `DELETE /api/decks/[id]` — borrar.
- Validación en vivo:
  - Contador `N/50` en el panel derecho.
  - Badge por regla (leader presente, 50 exactas, max 4 copias, colores compatibles).
  - Marcar en el grid las cartas que **no** comparten color con el leader.
- Import `.txt` (tolerante a las 2 convenciones más comunes: `4x OP01-001` y `OP01-001 x4` y el simple `OP01-001` por línea).
- Export `.txt` y `.json`.
- Persistencia: sincronización manual (botón "Save") — sin autosave para reducir edge-cases.
- 2 fixtures de decklists reales en `packages/card-data/fixtures/decks/` para tests de import.

**Fuera:**

- Login real (passwords, OAuth) — el "username" es un id local, sin protección.
- Compartir mazos entre usuarios.
- Historial de cambios / versiones de mazo.
- Validación de sideboard o DON!! deck (DON es común y no se construye).
- Drag & drop — usar click + botones (más simple, mejor a11y).
- Reglas de cartas con "max 1" — no existen en OP01/OP02 base; si apareciesen, el validador las ignora.
- Soporte móvil — desktop ≥1280px (spec §2 filter).
- Búsqueda avanzada (por power range, rarity range) — filtros actuales bastan.
- Deck stats (distribución de costes, curve) — pulido Fase 7.

## 3. Arquitectura

```
apps/web/src/
├── app/
│   ├── builder/
│   │   ├── page.tsx                     RSC: lista de mazos del usuario
│   │   ├── _components/
│   │   │   └── deck-list-item.tsx       fila de mazo con delete/open
│   │   └── [deckId]/
│   │       ├── page.tsx                 RSC: carga deck + cartas disponibles
│   │       └── _components/
│   │           ├── builder-layout.tsx   (client) estado de edición
│   │           ├── deck-panel.tsx       (client) lista de cartas en mazo + validación
│   │           ├── card-grid-builder.tsx (client) grid con +/- hover
│   │           └── import-export.tsx    (client) modal import, botones export
│   └── api/
│       ├── users/
│       │   ├── route.ts                 POST /api/users
│       │   └── [id]/decks/route.ts      GET decks for user
│       └── decks/
│           ├── route.ts                 POST /api/decks
│           └── [id]/route.ts            GET / PUT / DELETE /api/decks/[id]
├── components/
│   └── user-gate.tsx                    (client) modal al no haber userId en localStorage
├── lib/
│   ├── user-context.tsx                 React context + useUser hook
│   ├── deck-validation.ts               reglas puras (testeable unitariamente)
│   ├── deck-txt.ts                      parse/serialize .txt (testeable)
│   └── deck-json.ts                     serialize .json
└── (Fase 1 files unchanged)

packages/card-data/
├── prisma/schema.prisma                 + User, Deck, DeckCard models
├── prisma/migrations/.../               migración 20260420_decks_v1
├── src/index.ts                         re-export de Deck/DeckCard/User types
└── fixtures/decks/
    ├── op01-zoro-red-green.txt          fixture real para test import
    └── op02-blackbeard-black.txt        fixture real para test import
```

### 3.1 Invariantes

- **Reglas de juego OUT del engine están OK en Fase 2.** El validador de mazos vive en `apps/web/src/lib/deck-validation.ts` porque `packages/engine` aún no existe en su versión final (Fase 3). En Fase 3 moveremos `deck-validation.ts` a `packages/engine/src/deck.ts` y el web lo consumirá vía import. Queda documentado como deuda técnica intencional.
- `apps/web` sigue sin llamar a apitcg — consume Prisma + filesystem local.
- `packages/card-data` NO importa de React/Next.
- Rutas API leen `x-user-id` header (puesto por fetch desde client). Server valida que el deck pertenezca al usuario. Sin auth real — es seguridad cosmética para uso local.

## 4. Modelo de datos

### 4.1 Nuevas tablas

```prisma
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  decks     Deck[]
}

model Deck {
  id            String   @id @default(uuid())
  userId        String
  name          String
  leaderCardId  String?                       // null mientras se está construyendo
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  cards         DeckCard[]

  @@index([userId])
}

model DeckCard {
  id        String @id @default(uuid())
  deckId    String
  cardId    String
  quantity  Int    // 1..4 (enforced en código; SQLite no soporta CHECK con Prisma cleanly)

  deck      Deck   @relation(fields: [deckId], references: [id], onDelete: Cascade)

  @@unique([deckId, cardId])
  @@index([deckId])
}
```

**Decisiones:**

| Decisión                                             | Rationale                                                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `User.id` como UUID (no `@default(autoincrement())`) | UUIDs se pueden generar client-side si hace falta, más seguros ante ataques de enumeración                                                                                                       |
| `leaderCardId` nullable                              | Usuario puede abrir un deck vacío; obligarlo a picar leader antes de crear complica la UX                                                                                                        |
| `DeckCard.quantity` sin CHECK                        | Prisma + SQLite mete fricción; validar en código es suficiente (API rechaza >4)                                                                                                                  |
| `onDelete: Cascade` en Deck→User y DeckCard→Deck     | Borrar usuario borra mazos; borrar mazo borra filas pivote. Previene huérfanas                                                                                                                   |
| `@@unique([deckId, cardId])`                         | Evita duplicados; la quantity se agrega sumando, no multiplicando filas                                                                                                                          |
| Sin referencia FK a `Card` desde `DeckCard.cardId`   | Prisma + SQLite + Card.id String funcionaría, pero acoplarías el deck a la existencia de la carta en BD. Si mañana purgas OP01 por error, no quieres perder decks. Validación se hace en lectura |

### 4.2 Migración

`prisma migrate dev --name decks_v1` genera `20260420XXXXXX_decks_v1/migration.sql`. Sin datos en `User`/`Deck`/`DeckCard` (nuevas tablas), la migración es aditiva.

## 5. Flujo de usuario

### 5.1 Primera visita (o localStorage borrado)

1. `UserGate` component monta en el layout raíz. Lee `localStorage.getItem('optcg.userId')`.
2. Si no existe, muestra modal bloqueante: "Elige un username" + input + botón "Continue".
3. `POST /api/users { username }` → devuelve `{ id, username }`.
4. Cliente guarda `{ id, username }` en localStorage (`optcg.user`).
5. Modal cierra. App hidrata con `UserProvider` context.

### 5.2 Builder — `/builder`

1. RSC lee userId via header `x-user-id` (forzado a runtime, no static).
2. Llama a Prisma `findMany` de decks del user.
3. Renderiza lista: cada ítem = deck card (nombre, leader preview, counter "48/50", "Open" / "Delete").
4. Botón "New deck" → `POST /api/decks { name: 'My Deck', userId }` → redirect a `/builder/[newDeckId]`.

### 5.3 Builder editor — `/builder/[deckId]`

Layout:

```
┌────────────────┬──────────────────────────────┬──────────────────────┐
│ FilterSidebar  │ CardGridBuilder               │ DeckPanel            │
│ (reuse Fase 1) │ (card tile + quantity badge)  │ - Header (name, save)│
│                │                               │ - Leader slot        │
│                │                               │ - Main deck list     │
│                │                               │ - Validation badges  │
│                │                               │ - Import/Export btns │
│ w-56           │ flex-1                        │ w-80                 │
└────────────────┴──────────────────────────────┴──────────────────────┘
```

- Filtros del sidebar funcionan igual que en `/cards` (reutilizamos el componente `FilterSidebar` con una prop `basePath` para redirigir bien).
- Grid muestra cartas. Al hover aparecen `+` y `-` para ajustar quantity. Click en el body del tile abre el modal de detalle (reutilizar `CardDetailDialog` de Fase 1).
- Quantity badge (ej. `2/4`) visible si la carta está en el mazo.
- Cartas incompatibles con el leader (color mismatch) se renderizan con opacidad reducida y tooltip.
- Panel derecho:
  - Header: nombre del mazo (editable in-place) + botón Save.
  - Leader slot: drop zone simple (click "Change leader" abre picker filtrado por LEADER type).
  - Lista de cartas ordenada por coste y luego id. Cada ítem: imagen mini, nombre, `Nx` quantity, `-/+` controls.
  - Sección de validación: 3 badges (verde/rojo) — "Leader set", "50 cards", "Colors match", "Max 4 per card".
  - Botón Import → modal con textarea para pegar `.txt`.
  - Botones Export .txt / Export .json → descarga.

### 5.4 Guardar

- Cliente calcula el estado actual del mazo (JSON) y llama `PUT /api/decks/[id]` con body completo.
- Server transaction: delete-all DeckCards + re-insert + update Deck.name + leaderCardId. Simple reemplazo total; con ≤50 filas por mazo la performance es trivial.
- Toast "Saved" (usar shadcn toast o simple `alert` provisional — decisión final ver §10).

## 6. Reglas de validación (puras)

`apps/web/src/lib/deck-validation.ts`:

```ts
export interface DeckDraft {
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

export interface ValidationResult {
  totalCards: number;
  issues: ValidationIssue[];
  isLegal: boolean;
}

export type ValidationIssue =
  | { kind: 'missingLeader' }
  | { kind: 'wrongCount'; expected: 50; actual: number }
  | { kind: 'overLimit'; cardId: string; quantity: number }
  | { kind: 'colorMismatch'; cardId: string; leaderColors: string[]; cardColors: string[] };

export function validateDeck(draft: DeckDraft, cardIndex: Map<string, CardRow>): ValidationResult {
  // ...
}
```

Reglas cubiertas (spec OPTCG):

1. **Leader obligatorio** — issue `missingLeader` si `leaderCardId === null`.
2. **50 cartas exactas** en main deck (no cuenta el leader) — issue `wrongCount`.
3. **Max 4 copias** de cualquier cardId — issue `overLimit` por cada infracción.
4. **Compatibilidad de colores** — cada card en main deck debe compartir ≥1 color con el leader — issue `colorMismatch`.

`isLegal === issues.length === 0`.

## 7. Import / Export

### 7.1 Formatos `.txt` soportados (import)

Parser tolerante. Reconoce:

```
4x OP01-001
OP01-013 x 4
OP01-024
  OP01-037   x2
# comentario
```

Normaliza:

- Ignora líneas vacías y las que empiezan con `#`.
- Regex: `^(?:(\d+)[xX]\s*)?([A-Z]{2,3}\d+-\d+(?:_p\d+)?)(?:\s*[xX]\s*(\d+))?\s*$` (soporta `NxID` y `ID xN`; defaultea a 1).
- Si la misma `cardId` aparece varias veces, suma quantities (ej. dos líneas `OP01-013` → quantity 2).

### 7.2 Export `.txt`

```
# Deck: My Deck
# Leader: OP01-001 (Roronoa Zoro)
OP01-013 x 4
OP01-014 x 4
...
```

Una línea por cartaId, ordenadas por coste ascendente y luego id.

### 7.3 Export `.json`

```json
{
  "version": 1,
  "name": "Red-Green Zoro",
  "leader": "OP01-001",
  "cards": [
    { "id": "OP01-013", "quantity": 4 },
    { "id": "OP01-024", "quantity": 2 }
  ]
}
```

### 7.4 Fixtures

`packages/card-data/fixtures/decks/op01-zoro-red-green.txt` y `op02-blackbeard-black.txt` — decklists representativas reales con ~40-50 líneas que los tests de import usan como ground truth. Los creamos en Task 1 del plan para que los tests puedan referenciarlos.

## 8. Testing

| Qué                                 | Dónde                                                   | Alcance                                                                                                |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `validateDeck` (todas las 4 reglas) | `apps/web/src/lib/deck-validation.test.ts`              | Casos: leader missing, 49/50/51, 5 copies of one card, card from other color                           |
| `parseDeckText` (import formats)    | `apps/web/src/lib/deck-txt.test.ts`                     | Happy path, ambos formatos NxID/ID xN, comentarios, líneas vacías, duplicados sumados, fixtures reales |
| `serializeDeckText` (export)        | `apps/web/src/lib/deck-txt.test.ts`                     | Orden correcto, formato consistente, round-trip parse(serialize(x)) === x                              |
| `serializeDeckJson`                 | `apps/web/src/lib/deck-json.test.ts`                    | Estructura correcta                                                                                    |
| API routes (integration)            | `apps/web/src/app/api/**/*.test.ts`                     | Skip — Next.js route testing es frágil; UI smoke en Task final cubre end-to-end                        |
| UI (builder)                        | Sin tests unitarios; smoke manual en verificación final |                                                                                                        |

Cobertura: sin gate en Fase 2 (Fase 3 introduce el gate de 85% en engine).

## 9. Exit criteria

| Check                                                                  | Validación                        |
| ---------------------------------------------------------------------- | --------------------------------- |
| Primera visita pide username y lo persiste                             | Manual en navegador               |
| `/builder` lista decks; "New deck" crea uno y redirige                 | Manual                            |
| Editor renderiza 3 paneles en desktop ≥1280px                          | Manual                            |
| Añadir cartas actualiza quantity y validación en vivo                  | Manual                            |
| Build legal OP01 deck → Save → reload → mismo estado                   | Manual                            |
| Import de `op01-zoro-red-green.txt` reconstruye el mazo                | Manual + test unitario del parser |
| Import de `op02-blackbeard-black.txt` reconstruye el mazo              | Manual + test unitario del parser |
| Export `.txt` round-trip → importar de vuelta → mazo idéntico          | Manual + test                     |
| Export `.json` descarga estructurado                                   | Manual                            |
| Validación muestra badges correctos en 3 estados: ok / warning / error | Manual                            |
| `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` verdes | CI                                |

## 10. Decisiones tomadas autónomamente

Por petición del usuario, Fase 2 se desarrolla autónomamente. Decisiones clave baked-in:

| #   | Decisión                                                                                              | Alternativas consideradas                      | Por qué esta                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| D1  | Leader-first UX (el mazo empieza sin leader; los color-mismatches se marcan una vez el leader existe) | Forzar picker de leader antes de crear el deck | Menos fricción; usuario puede crear deck y pensar en la composición antes de commit            |
| D2  | Múltiples mazos por usuario                                                                           | 1 deck slot                                    | Exit criteria menciona "import ≥2 decklists" — naturalmente requiere múltiples mazos           |
| D3  | Quantity UI con botones +/- en hover                                                                  | Drag & drop                                    | Simpler, mejor a11y, click-to-add es el patrón de OPTCG Sim oficial                            |
| D4  | Save manual (botón)                                                                                   | Autosave debounced                             | Menos edge cases, feedback explícito, save-on-reload no es necesario para el scope             |
| D5  | `deck-validation.ts` vive en `apps/web/src/lib`                                                       | Ya en `packages/engine`                        | El engine aún no existe en su forma final (Fase 3). Moverlo es parte explícita del plan Fase 3 |
| D6  | `DeckCard.cardId` sin FK a `Card`                                                                     | FK estricta con cascade                        | Resiliencia ante re-sync del card-data (no perder mazos si una carta se purga)                 |
| D7  | Ownership por `x-user-id` header (sin auth real)                                                      | cookies / sesiones                             | Scope: uso personal/comunitario; spec §13 ya reconoce uso "personal/privado"                   |
| D8  | Import tolerante a `NxID` y `ID xN`                                                                   | Solo 1 formato                                 | Dos convenciones circulan en comunidades de OPTCG; tolerar ambas evita fricción                |
| D9  | `.txt` export usa `ID x N` (con espacio)                                                              | `NxID`                                         | Más legible para humanos; `NxID` funciona pero `Nx` parece un comando                          |
| D10 | No drag & drop                                                                                        | Sí                                             | YAGNI; botones son accesibles por teclado por defecto                                          |
| D11 | Deck name editable inline en el panel                                                                 | Modal separado                                 | Menos clicks, patrón moderno                                                                   |
| D12 | Toast con shadcn Sonner si existe, fallback alert                                                     | alert siempre                                  | Sonner añade un radix-peer más (ya hay radix); acceptable para el budget                       |

## 11. Riesgos

| Riesgo                                                                               | Mitigación                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fixtures de decklists no existen listos → hay que construirlos "a mano"              | Generar 2 fixtures mínimas: 1 OP01 legal (~50 cartas) + 1 OP02 legal. Pick cartas populares conocidas                                                              |
| Validación de colores falla en edge cases (LEADER bicolor + carta monocolor ≠ ambos) | La regla real es "al menos 1 color compartido"; los tests cubren el escenario                                                                                      |
| Username collision (dos people con mismo username)                                   | `@unique` en schema; POST devuelve 409 si ya existe. Frontend reintenta con mensaje claro                                                                          |
| Pérdida de localStorage en dev tools clear                                           | Re-flujo de username (inputa de nuevo). Mazos persisten en DB ligados al userId; si se pierde el userId, el nuevo user empieza en 0. Aceptable para scope personal |
| API routes en Next 14 App Router con Prisma — rare bugs con serverless edge runtime  | Forzar `export const runtime = 'nodejs'` en cada route handler                                                                                                     |

## 12. Dependencias nuevas

| Paquete                                                                                            | Dónde      | Para qué                                                                    |
| -------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `sonner`                                                                                           | `apps/web` | Toast notifications (decisión D12) — opcional, caerá a alert si da fricción |
| Shadcn components añadidos: `toast` (si via sonner), `dropdown-menu`, `dialog` (ya), `scroll-area` | `apps/web` | UX del builder                                                              |

## 13. Assumptions

- OP01+OP02 contienen ≥1 LEADER rojo, ≥1 azul, ≥1 amarillo (suficiente para construir leader para 2 fixtures distintas). Verificar en el primer smoke. Si falla, las fixtures se ajustan.
- La regla de "colores compartidos entre leader y carta" es la oficial (no se está rewriting reglas).
- `localStorage` disponible en el navegador. Si está desactivado, la app muestra un error claro "localStorage required".
- El número de cartas del DON!! deck (10) no forma parte del builder; apitcg devuelve las DON como cartas pero el builder las filtra (por `type === 'DON'`) de la vista grid por defecto.

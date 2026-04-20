# Fase 1 — Card data pipeline (design)

**Fecha:** 2026-04-20
**Branch:** `feature/fase-1-card-data`
**Spec padre:** [2026-04-17-optcg-sim-design.md](./2026-04-17-optcg-sim-design.md) §11 Fase 1

## 1. Objetivo

Dejar el juego con datos reales de las cartas OP01+OP02 (≈240 cartas) descargadas de apitcg.com, cacheadas localmente en SQLite + imágenes en `/public/cards`, y consultables desde una galería web con filtros. El runtime de `apps/web` no hace HTTP a apitcg nunca — todo sale de Prisma + filesystem local.

Esto habilita Fase 2 (deck builder) y Fase 3 (engine con Card ID reales) sin re-syncear nada.

## 2. Scope

**Dentro:**

- `packages/card-data` consolidado con Prisma schema real, `CardDataService` abstracto + `ApitcgAdapter`, helpers de imágenes.
- `scripts/sync.ts` co-located en el paquete, invocable como `pnpm cards:sync`.
- Sets OP01 y OP02 en inglés.
- Galería `/cards` en `apps/web` con filtros color/tipo/coste/nombre + modal de detalle.

**Fuera (no Fase 1):**

- Parsing de `effectText` → `parsedEffects` (Fase 3).
- Adaptador Limitless TCG (spec §11 lo menciona como fallback; se materializa solo si apitcg no cubre OP01/OP02 — ver §7 riesgos).
- Imágenes/textos en japonés (Fase 7 o cuando se priorice el toggle EN/JP).
- Página de detalle dedicada `/cards/[id]` (por ahora modal basta).
- Tests de UI (la lógica vive en la RSC y en `card-data`; cubrimos ese lado).
- Sets distintos a OP01/OP02 (se añaden vía `--sets` flag sin cambios de código).

## 3. Arquitectura

```
packages/card-data/
├── prisma/
│   └── schema.prisma              Card model real (reemplaza placeholder Fase 0)
├── scripts/
│   └── sync.ts                    tsx scripts/sync.ts --sets OP01,OP02
├── src/
│   ├── index.ts                   re-exports públicos (prisma, tipos, service factory)
│   ├── service.ts                 interface CardDataService
│   ├── adapters/
│   │   └── apitcg.ts              ApitcgAdapter (única implementación hoy)
│   ├── images.ts                  downloadAndEncodeWebp (sharp)
│   └── types.ts                   RawCard (apitcg shape) + DomainCard (nuestro shape)
├── tests/
│   ├── apitcg-adapter.test.ts
│   ├── images.test.ts
│   ├── sync.test.ts
│   └── fixtures/
│       └── apitcg-op01-sample.json
└── package.json

apps/web/src/app/cards/
├── page.tsx                       RSC: searchParams → Prisma → grid
├── loading.tsx                    skeleton
└── _components/
    ├── filter-sidebar.tsx         (client) checkboxes + search debounced
    ├── card-grid.tsx              grid responsive + CardTile
    ├── card-tile.tsx              (client) botón → Dialog
    ├── card-detail-dialog.tsx     (client) shadcn Dialog con datos completos
    └── pagination.tsx             <Link>s con searchParams preservados

apps/web/public/cards/{SET}/{id}.webp   imágenes sirviéndose estáticas (gitignored)
```

### 3.1 Invariantes

- `packages/card-data` **no** importa de React/Next. Dependencias: `@prisma/client`, `zod`, `sharp`, Node stdlib.
- `apps/web` **no** importa de apitcg ni hace `fetch` a apitcg. Solo `prisma.card` + imágenes estáticas.
- `GameState` / `Action` del engine **no** se tocan en esta fase (engine sigue con su smoke test).

## 4. Modelo de datos

### 4.1 Schema Prisma

```prisma
model Card {
  id          String   @id                    // "OP01-001"
  setId       String                          // "OP01"
  setName     String                          // "Romance Dawn"
  name        String
  rarity      String                          // L | C | U | R | SR | SEC
  type        String                          // LEADER | CHARACTER | EVENT | STAGE | DON
  cost        Int?                            // null en LEADER y DON
  power       Int?                            // null en EVENT / STAGE
  counter     Int?                            // solo CHARACTER
  life        Int?                            // solo LEADER
  colors      String                          // "Red" o "Red,Green"
  attributes  String                          // "Straw Hat Crew,Supernovas"
  effectText  String                          // raw; Fase 3 parsea
  triggerText String?                         // raw; null si no tiene trigger
  imagePath   String                          // "/cards/OP01/OP01-001.webp"
  sourceUrl   String                          // URL original apitcg (auditable)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([setId])
  @@index([type])
  @@index([cost])
}
```

**Decisiones de modelado:**

| Campo                                               | Racional                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `colors`/`attributes` como `String` comma-separated | SQLite no tiene arrays. Filtros se hacen con `contains`. ≤400 filas total → no se justifica normalizar |
| Índices en `setId`, `type`, `cost`                  | Los 3 filtros categóricos más frecuentes                                                               |
| Sin `parsedEffects`                                 | Corte limpio: Fase 3 añade `parsedEffects Json?`                                                       |
| `sourceUrl` persistido                              | Auditable; detecta drift si apitcg cambia URLs                                                         |
| Sin `languageCode`                                  | EN-only. JP se añade como `nameJa`/`effectTextJa` opcionales en su fase                                |

**Migración:** `pnpm --filter @optcg/card-data db:migrate` genera `20260420_cards_v1` que dropea la tabla placeholder de Fase 0 (vacía) y crea la nueva.

### 4.2 Tipos TS

```ts
// packages/card-data/src/types.ts
export const CARD_TYPES = ['LEADER', 'CHARACTER', 'EVENT', 'STAGE', 'DON'] as const;
export type CardType = (typeof CARD_TYPES)[number];

export interface RawCard {
  id: string;
  code?: string;
  name: string;
  rarity: string;
  type: string;
  cost?: number;
  power?: number;
  counter?: number;
  life?: number;
  color: string;
  family?: string;
  ability?: string;
  trigger?: string;
  set: { id: string; name: string };
  images: { small?: string; large: string };
}

export interface DomainCard {
  id: string;
  setId: string;
  setName: string;
  name: string;
  rarity: string;
  type: CardType;
  cost: number | null;
  power: number | null;
  counter: number | null;
  life: number | null;
  colors: string[];
  attributes: string[];
  effectText: string;
  triggerText: string | null;
  sourceImageUrl: string;
}
```

`RawCardSchema` (zod) valida lo que devuelve apitcg. Si el schema cambia, el sync falla en parse con mensaje claro y no corrompe la DB.

## 5. `CardDataService`

```ts
// packages/card-data/src/service.ts
export interface CardDataService {
  /** Lista todas las cartas de un set. No descarga imágenes. */
  listCardsInSet(setId: string): Promise<DomainCard[]>;

  /** URL absoluta de la imagen oficial del set para esa carta. */
  imageUrlFor(card: DomainCard): string;
}

// packages/card-data/src/adapters/apitcg.ts
export class ApitcgAdapter implements CardDataService {
  /* ... */
}
```

Diseñar la interfaz aunque hoy solo haya una impl: coste ~0 en TS y evita refactor cuando algún día haga falta Limitless u otro proveedor.

## 6. Sync script

### 6.1 Comportamiento

```ts
const DEFAULT_SETS = ['OP01', 'OP02'];

async function main() {
  const sets = parseSetsFlag() ?? DEFAULT_SETS;
  const service = new ApitcgAdapter({ apiKey: env.APITCG_KEY });
  const outDir = resolvePublicCardsDir();

  for (const setId of sets) {
    const cards = await retry(() => service.listCardsInSet(setId), {
      attempts: 3,
      backoff: [1000, 4000, 10000],
    });
    for (const card of cards) {
      const imagePath = `/cards/${card.setId}/${card.id}.webp`;
      const absImage = path.join(outDir, card.setId, `${card.id}.webp`);
      if (!fs.existsSync(absImage) || argv.forceImages) {
        try {
          await downloadAndEncodeWebp(card.sourceImageUrl, absImage);
        } catch (err) {
          warn(card.id, err);
          continue;
        }
      }
      await prisma.card.upsert({
        where: { id: card.id },
        create: toDbRow(card, imagePath),
        update: toDbRow(card, imagePath),
      });
    }
  }
}
```

### 6.2 Garantías

| Aspecto      | Comportamiento                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Idempotencia | `upsert` por `id`. Re-ejecutar no duplica                                                          |
| Incremental  | Imágenes existentes se saltan salvo `--force-images`                                               |
| Resiliencia  | Retry con backoff en `listCardsInSet`; fallo individual de imagen = warn + continue                |
| Abort        | 3 retries agotados en listing de un set → exit 1 (sin cartas, no hay nada que insertar)            |
| Logging      | `console.log` por set + resumen final (`X creadas, Y actualizadas, Z saltadas por imagen fallida`) |
| Config       | Flags: `--sets OP01,OP02`, `--force-images`. Env: `APITCG_KEY`, `DATABASE_URL`                     |

### 6.3 Invocación

```json
// root package.json
"scripts": { "cards:sync": "pnpm --filter @optcg/card-data sync" }

// packages/card-data/package.json
"scripts": { "sync": "tsx scripts/sync.ts" }
```

## 7. Galería `/cards`

### 7.1 Data flow

```tsx
// apps/web/src/app/cards/page.tsx  (RSC)
const PAGE_SIZE = 48;

export default async function CardsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseFilters(searchParams);
  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where: filters.where,
      skip: filters.skip,
      take: PAGE_SIZE,
      orderBy: { id: 'asc' },
    }),
    prisma.card.count({ where: filters.where }),
  ]);
  return (
    <div className="flex gap-6 p-6">
      <FilterSidebar initial={searchParams} />
      <main className="flex-1">
        <CardGrid cards={cards} />
        <Pagination page={filters.page} total={total} pageSize={PAGE_SIZE} />
      </main>
    </div>
  );
}
```

### 7.2 Traducción de filtros a Prisma

| SearchParam       | Where                                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| `q=luffy`         | `name: { contains: 'luffy' }` (SQLite `LIKE` ya es case-insensitive en ASCII) |
| `color=Red`       | `colors: { contains: 'Red' }`                                                 |
| `color=Red,Green` | `AND: [{ colors: { contains: 'Red' } }, { colors: { contains: 'Green' } }]`   |
| `type=CHARACTER`  | `type: 'CHARACTER'`                                                           |
| `cost=3`          | `cost: 3`                                                                     |
| `cost=3,4`        | `cost: { in: [3, 4] }`                                                        |

### 7.3 Componentes

| Componente         | Tipo   | Rol                                                                                                   |
| ------------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| `FilterSidebar`    | client | Checkboxes color/tipo/coste, input search debounced 250 ms, todos actualizan URL vía `router.replace` |
| `CardGrid`         | server | Grid `grid-cols-2 md:grid-cols-4 lg:grid-cols-6`                                                      |
| `CardTile`         | client | `<button>` con `next/image`, abre `Dialog`                                                            |
| `CardDetailDialog` | client | Shadcn `Dialog` con imagen grande + todos los campos                                                  |
| `Pagination`       | server | `<Link>`s con searchParams preservados                                                                |

`loading.tsx` muestra skeleton grid mientras la RSC resuelve.

## 8. Testing

| Qué                                                         | Cómo                                                                                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ApitcgAdapter.listCardsInSet`                              | Vitest + fixture `apitcg-op01-sample.json`. Happy path (1 LEADER, 1 CHARACTER, 1 EVENT, 1 STAGE) + carta multicolor + carta sin trigger |
| `RawCardSchema` zod                                         | Rechaza: falta `set.id`, `type` inválido, `cost` como string                                                                            |
| Helpers de normalización (`splitColors`, `splitAttributes`) | Unit                                                                                                                                    |
| `downloadAndEncodeWebp`                                     | Mock `fetch` (buffer de imagen de prueba) + `tmpdir`. Verifica que el archivo final es webp válido                                      |
| Sync (smoke)                                                | `ApitcgAdapter` mockeado devolviendo 2 cartas fake, corre `main()`, verifica `prisma.card.count() === 2` y 2 `.webp` en `tmpdir`        |
| UI                                                          | **Sin tests en Fase 1**                                                                                                                 |

**DB de tests:** `DATABASE_URL="file:./test.db"` + `prisma migrate reset --force` en setup. Aislada de la DB real de dev.

Cobertura opt-in (`test:coverage`), sin threshold hasta Fase 3.

## 9. Exit criteria

| Check                                                                  | Validación                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------- |
| `pnpm cards:sync` termina exit 0 con OP01+OP02                         | Ejecución manual. Log final con conteos                                     |
| ≥ total oficial de cartas en DB                                        | `sqlite> SELECT COUNT(*) FROM Card WHERE setId IN ('OP01','OP02')`          |
| Cada fila tiene imagen en disco                                        | Script de verificación al final: `fs.existsSync` para todos los `imagePath` |
| Galería `/cards` en `pnpm dev`                                         | Carga, aplica filtro, abre modal, pagina                                    |
| Filtros funcionan                                                      | Smoke manual: color, type, cost, q combinados                               |
| Sync idempotente                                                       | Re-ejecutar no duplica ni cambia filas salvo `updatedAt`                    |
| Runtime de `apps/web` no llama a apitcg                                | `rg "apitcg                                                                 | fetch.\*apitcg" apps/web/src` → 0 hits |
| `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` verdes | CI verde al abrir PR                                                        |

## 10. Riesgos

| Riesgo                             | Mitigación                                                                                                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apitcg no cubre OP01/OP02 completo | Assumption spec §13. Si pasa en implementación: subir issue, decidir entre añadir `LimitlessAdapter` o dataset manual. No bloquea la arquitectura aquí — la interfaz ya permite añadir adaptadores |
| apitcg cambia schema de respuesta  | zod falla temprano con mensaje claro; corregir `RawCard` + `ApitcgAdapter.map` en un commit menor                                                                                                  |
| Licencia de imágenes               | Uso personal/comunitario (spec §13). `public/cards/` **gitignored**: cada usuario descarga con su propio sync                                                                                      |
| Tamaño del cache local             | DB SQLite y webp también gitignored                                                                                                                                                                |
| `prisma migrate` en CI             | CI solo corre `db:generate` (no hay DB real). Tests crean DB efímera                                                                                                                               |

## 11. Gitignore a añadir

```
apps/web/public/cards/**
!apps/web/public/cards/.gitkeep
packages/card-data/prisma/*.db
packages/card-data/prisma/*.db-journal
```

## 12. Dependencias nuevas

| Paquete | Dónde                      | Para qué                                                     |
| ------- | -------------------------- | ------------------------------------------------------------ |
| `sharp` | `packages/card-data`       | Encode webp                                                  |
| `tsx`   | `packages/card-data` (dev) | Ejecutar el sync script sin build                            |
| `zod`   | `packages/card-data`       | Validación `RawCardSchema` (ya permitido en `engine` + aquí) |

Shadcn componentes a añadir en `apps/web`: `Dialog`, `Input`, `Checkbox`, `Label`, `Separator` (se instalan vía `pnpm dlx shadcn add ...`).

## 13. Assumptions

- apitcg.com tiene endpoint listando cartas por set con imagen oficial + texto completo en inglés para OP01 y OP02 (confirma spec §13).
- El tamaño total de las imágenes webp para OP01+OP02 cabe cómodamente en filesystem del desarrollador (<50 MB estimado, 240 cartas × ~200 KB).
- Los filtros de galería cubren los casos de uso de Fase 1; filtros más ricos (rareza, ataque, power range) pueden esperar a Fase 2 cuando el builder los pida.

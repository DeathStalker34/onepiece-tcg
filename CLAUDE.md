# OPTCG Simulator

Simulador web del One Piece Trading Card Game — hotseat local, PvAI (3 niveles) y multijugador online. Herramienta personal/comunitaria, no producto comercial. Calidad técnica alta pero scope enfocado.

## Estado actual

- **Fase:** Fases 0-6.5 mergeadas a `main`. Multijugador online en producción: server en https://optcg-server.fly.dev, web en https://optcg-web.fly.dev (Fly.io, región `cdg`).
- **Próxima fase:** Fase 7 — Pulido (parser expandido de efectos, stats por mazo, replay, chat, drag&drop, atajos de teclado).
- **Fase-gated delivery:** no empieces la siguiente fase sin aprobación explícita del usuario. Pasa primero por `superpowers:brainstorming` → spec → `writing-plans` antes de tocar código.

## Fuentes de verdad

| Documento        | Path                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Diseño top-level | [docs/superpowers/specs/2026-04-17-optcg-sim-design.md](docs/superpowers/specs/2026-04-17-optcg-sim-design.md) |
| Plan Fase 0      | [docs/superpowers/plans/2026-04-17-fase-0-setup.md](docs/superpowers/plans/2026-04-17-fase-0-setup.md)         |

Lee spec §10 (calidad innegociable) y §11 (roadmap de 7 fases) antes de proponer cambios de arquitectura.

## Cómo trabajamos

- **Idioma:** Español en conversación, inglés en código y commits.
- **Respuestas:** concisas, con tablas/bullets sobre prosa.
- **Decisiones múltiples:** recomendaciones en tabla, no preguntas abiertas.
- **Entrega por fases:** al cerrar una fase → resumen + exit criteria verificados → esperar aprobación del usuario → siguiente fase.
- **1 PR por fase** (spec §10.1). Branches `feature/fase-N-<nombre>`.
- **Conventional commits:** `chore:`, `feat:`, `fix:`, `ci:`, `docs:`, `refactor:`, `test:`.
- **Nunca amend**, siempre commits nuevos.

## Arquitectura (1 párrafo)

El **engine en `packages/engine`** es la única fuente de verdad de las reglas de OPTCG. UI, IA y servidor consumen el mismo engine vía `engine.apply(state, action)`. `GameState` y `Action` son **JSON-serializables y deterministas** dada una seed — esto habilita multijugador, replay e IA sin duplicar lógica.

```
apps/
├── web/           Next.js 14 App Router — UI de juego + builder
└── server/        Socket.IO autoritativo — valida con engine (Fase 6)
packages/
├── engine/        TS puro, cero deps de framework (Fase 3)
├── card-data/     Prisma + apitcg.com sync (Fase 1)
├── ai/            Bots consumiendo engine (Fase 5)
└── ui/            shadcn/ui compartido (se consolida después)
```

## Quality bars no negociables (spec §10)

- **TypeScript strict** global. `@typescript-eslint/no-explicit-any` es **error**, no warning.
- **Engine sin deps de framework:** `packages/engine` NO importa de React, Next, Node APIs, Socket.IO, Prisma ni `fetch`. Sólo TS estándar + zod.
- **Acciones y estado serializables** (sin Map/Set/Date/funciones/clases mutables).
- **Sin reglas de juego en componentes React.** Si ves `if (card.type === 'LEADER')` con lógica de partida dentro de `apps/web/src/components`, es un bug de arquitectura — saca eso al engine.
- **Cobertura engine >85%** (opt-in vía `test:coverage`; se activa como gate en Fase 3).
- **Componentes React <200 líneas.**

## Comandos

| Comando                                      | Qué hace                                     |
| -------------------------------------------- | -------------------------------------------- |
| `pnpm install`                               | Instala deps (usa `--frozen-lockfile` en CI) |
| `pnpm dev`                                   | Levanta Next.js en `http://localhost:3000`   |
| `pnpm build`                                 | Build de producción de `apps/web`            |
| `pnpm test`                                  | Vitest en todos los workspaces               |
| `pnpm lint`                                  | ESLint en todos los workspaces               |
| `pnpm typecheck`                             | `tsc --noEmit` en todos los workspaces       |
| `pnpm format:check`                          | Prettier en modo verificación                |
| `pnpm format`                                | Prettier autoescritura                       |
| `pnpm --filter @optcg/card-data db:generate` | Regenera Prisma client                       |
| `pnpm --filter @optcg/card-data db:migrate`  | Ejecuta migración Prisma                     |

## Gotcha de entorno (Windows)

Si `pnpm` no está en PATH:

1. **Preferido:** `corepack enable pnpm` en shell **con admin** (persistente).
2. **Fallback:** anteponer `corepack pnpm@9.7.0 <cmd>` a cada comando, o mantener un shim en `~/AppData/Roaming/npm/pnpm.cmd` que haga `corepack pnpm@9.7.0 "$@"`.

CI no se ve afectado (usa `pnpm/action-setup@v4` con pnpm real).

## Cierre de fase — checklist

1. Ejecutar exit criteria del plan de la fase (están al final de cada `docs/superpowers/plans/*.md`).
2. Dejar `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check` verdes.
3. Resumen al usuario: qué se entregó, decisiones tomadas, commits relevantes.
4. **Esperar aprobación.**
5. Cuando el usuario apruebe: push branch + abrir PR contra `main`. La CI dispara al abrir PR.
6. Solo tras merge y reset a `main`, empezar nueva fase (brainstorming + writing-plans).

## Qué NO hacer

- Empezar la siguiente fase sin confirmación explícita.
- Meter imports de React/Next/Node en `packages/engine`.
- Implementar reglas de juego dentro de componentes React.
- Hacer `git push --force` sobre `main`.
- Commit con `--no-verify` o `--no-gpg-sign` sin razón explícita.
- Crear PRs o abrir issues sin que el usuario lo pida.

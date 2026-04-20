// packages/engine/src/index.ts
// Fase 3 — populated incrementally by subsequent tasks.
export { createRng, nextFloat, nextInt, shuffle } from './rng';
export type { RngState } from './rng';
export { updateAt, removeAt, replaceWhere, removeWhere } from './helpers/immutable';

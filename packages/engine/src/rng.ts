export interface RngState {
  seed: number;
  pointer: number;
}

function mulberry32(a: number): number {
  let t = (a + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createRng(seed: number): RngState {
  return { seed, pointer: 0 };
}

export function nextFloat(rng: RngState): { value: number; rng: RngState } {
  const value = mulberry32(rng.seed + rng.pointer);
  return { value, rng: { seed: rng.seed, pointer: rng.pointer + 1 } };
}

export function nextInt(rng: RngState, maxExclusive: number): { value: number; rng: RngState } {
  const { value, rng: next } = nextFloat(rng);
  return { value: Math.floor(value * maxExclusive), rng: next };
}

export function shuffle<T>(arr: readonly T[], rng: RngState): { result: T[]; rng: RngState } {
  const result = [...arr];
  let cur = rng;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const { value: j, rng: next } = nextInt(cur, i + 1);
    cur = next;
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return { result, rng: cur };
}

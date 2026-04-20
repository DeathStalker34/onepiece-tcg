import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, shuffle, type RngState } from '../src/rng';

describe('createRng', () => {
  it('initializes with seed and pointer=0', () => {
    const rng = createRng(42);
    expect(rng.seed).toBe(42);
    expect(rng.pointer).toBe(0);
  });
});

describe('nextFloat', () => {
  it('returns a value in [0, 1) and advances pointer by 1', () => {
    const rng = createRng(1);
    const { value, rng: next } = nextFloat(rng);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
    expect(next.pointer).toBe(1);
    expect(next.seed).toBe(1);
  });

  it('same seed produces same sequence', () => {
    const seq = (rng: RngState, n: number) => {
      const vals: number[] = [];
      let cur = rng;
      for (let i = 0; i < n; i += 1) {
        const r = nextFloat(cur);
        vals.push(r.value);
        cur = r.rng;
      }
      return vals;
    };
    expect(seq(createRng(7), 10)).toEqual(seq(createRng(7), 10));
  });

  it('never returns out-of-range over 1000 calls', () => {
    let rng = createRng(123);
    for (let i = 0; i < 1000; i += 1) {
      const { value, rng: next } = nextFloat(rng);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      rng = next;
    }
  });

  it('serializes: JSON round-trip preserves seed+pointer', () => {
    const rng = createRng(99);
    const { rng: advanced } = nextFloat(nextFloat(nextFloat(rng).rng).rng);
    const clone = JSON.parse(JSON.stringify(advanced)) as RngState;
    expect(clone).toEqual(advanced);
  });
});

describe('nextInt', () => {
  it('returns a value in [0, max)', () => {
    let rng = createRng(5);
    for (let i = 0; i < 100; i += 1) {
      const { value, rng: next } = nextInt(rng, 10);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(10);
      rng = next;
    }
  });

  it('advances pointer by 1', () => {
    const rng = createRng(5);
    const { rng: next } = nextInt(rng, 50);
    expect(next.pointer).toBe(1);
  });
});

describe('shuffle', () => {
  it('preserves elements without duplicates or losses', () => {
    const input = Array.from({ length: 100 }, (_, i) => i);
    const { result } = shuffle(input, createRng(11));
    expect(result.length).toBe(100);
    expect([...result].sort((a, b) => a - b)).toEqual(input);
  });

  it('is deterministic for the same seed', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const a = shuffle(input, createRng(42)).result;
    const b = shuffle(input, createRng(42)).result;
    expect(a).toEqual(b);
  });

  it('returns empty array for empty input', () => {
    const { result, rng } = shuffle([], createRng(1));
    expect(result).toEqual([]);
    expect(rng.pointer).toBe(0);
  });

  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input, createRng(8));
    expect(input).toEqual(copy);
  });
});

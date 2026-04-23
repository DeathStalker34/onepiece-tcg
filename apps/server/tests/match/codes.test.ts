import { describe, it, expect } from 'vitest';
import { generateMatchCode } from '../../src/match/codes';

describe('generateMatchCode', () => {
  it('produces 6 uppercase alphanum chars', () => {
    const code = generateMatchCode(() => false);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('retries on collision', () => {
    let calls = 0;
    const existsUntil = () => {
      calls += 1;
      return calls <= 2;
    };
    const code = generateMatchCode(existsUntil);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('throws after 50 collision retries', () => {
    expect(() => generateMatchCode(() => true)).toThrow(/collision/i);
  });
});

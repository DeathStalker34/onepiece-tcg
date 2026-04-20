import { describe, expect, it } from 'vitest';
import { version } from '../src/index.js';

describe('engine smoke', () => {
  it('exposes a version string', () => {
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });
});

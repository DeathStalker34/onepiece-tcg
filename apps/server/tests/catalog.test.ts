import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../src/catalog';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('loadCatalog', () => {
  it('loads a valid catalog JSON', () => {
    const path = resolve(__dirname, '../src/catalog.fixture.json');
    const catalog = loadCatalog(path);
    expect(Object.keys(catalog)).toHaveLength(2);
    expect(catalog['OP01-001'].type).toBe('LEADER');
    expect(catalog['OP01-001'].life).toBe(5);
  });

  it('throws when file missing', () => {
    expect(() => loadCatalog('/nonexistent/path.json')).toThrow(/catalog/i);
  });
});

import { describe, expect, it } from 'vitest';
import { cardImagePath } from './card-image';

describe('cardImagePath', () => {
  it('produces standard path', () => {
    expect(cardImagePath('OP01-013')).toBe('/cards/OP01/OP01-013.webp');
  });
  it('strips variant suffix', () => {
    expect(cardImagePath('OP01-013_p1')).toBe('/cards/OP01/OP01-013.webp');
  });
  it('handles ST01, P-XXX', () => {
    expect(cardImagePath('ST01-006')).toBe('/cards/ST01/ST01-006.webp');
    expect(cardImagePath('P-023')).toBe('/cards/P/P-023.webp');
  });
});

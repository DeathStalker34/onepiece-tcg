import { describe, expect, it } from 'vitest';
import { updateAt, removeAt, replaceWhere, removeWhere } from '../src/helpers/immutable';

describe('updateAt', () => {
  it('updates a single element at an index', () => {
    const r = updateAt([1, 2, 3], 1, 99);
    expect(r).toEqual([1, 99, 3]);
  });

  it('does not mutate input', () => {
    const input = [1, 2, 3];
    updateAt(input, 0, 99);
    expect(input).toEqual([1, 2, 3]);
  });
});

describe('removeAt', () => {
  it('removes element at index', () => {
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });

  it('out-of-bounds index returns copy unchanged', () => {
    expect(removeAt([1, 2], 5)).toEqual([1, 2]);
  });
});

describe('replaceWhere', () => {
  it('replaces every matching element', () => {
    expect(
      replaceWhere(
        [1, 2, 3, 4],
        (n) => n % 2 === 0,
        (n) => n * 10,
      ),
    ).toEqual([1, 20, 3, 40]);
  });

  it('no match → unchanged copy', () => {
    expect(
      replaceWhere(
        [1, 2, 3],
        (n) => n > 100,
        (n) => n,
      ),
    ).toEqual([1, 2, 3]);
  });
});

describe('removeWhere', () => {
  it('removes every matching element', () => {
    expect(removeWhere([1, 2, 3, 4, 5], (n) => n > 3)).toEqual([1, 2, 3]);
  });

  it('no match → unchanged copy', () => {
    expect(removeWhere([1, 2, 3], (n) => n > 100)).toEqual([1, 2, 3]);
  });
});

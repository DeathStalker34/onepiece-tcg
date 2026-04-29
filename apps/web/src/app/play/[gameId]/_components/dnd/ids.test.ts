import { describe, it, expect } from 'vitest';
import { parseDragId, parseDropId, formatDragId, formatDropId } from './ids';

describe('parseDragId', () => {
  it('parses hand cards', () => {
    expect(parseDragId('hand:3')).toEqual({ kind: 'hand', handIndex: 3 });
  });
  it('parses DON tokens', () => {
    expect(parseDragId('don:0')).toEqual({ kind: 'don', index: 0 });
  });
  it('parses leader attacker', () => {
    expect(parseDragId('attacker:leader')).toEqual({ kind: 'attacker-leader' });
  });
  it('parses character attacker', () => {
    expect(parseDragId('attacker:char:abc-123')).toEqual({
      kind: 'attacker-char',
      instanceId: 'abc-123',
    });
  });
  it('returns null for unknown', () => {
    expect(parseDragId('garbage')).toBeNull();
    expect(parseDragId('hand:notanumber')).toBeNull();
  });
});

describe('parseDropId', () => {
  it('parses field', () => {
    expect(parseDropId('drop:field')).toEqual({ kind: 'field' });
  });
  it('parses enemy leader target', () => {
    expect(parseDropId('drop:leader:1')).toEqual({ kind: 'enemy-leader', owner: 1 });
  });
  it('parses enemy character target', () => {
    expect(parseDropId('drop:char:abc-123:0')).toEqual({
      kind: 'enemy-char',
      instanceId: 'abc-123',
      owner: 0,
    });
  });
  it('parses friendly leader (DON target)', () => {
    expect(parseDropId('drop:friendly-leader')).toEqual({ kind: 'friendly-leader' });
  });
  it('parses friendly character (DON target)', () => {
    expect(parseDropId('drop:friendly-char:abc-123')).toEqual({
      kind: 'friendly-char',
      instanceId: 'abc-123',
    });
  });
  it('returns null for unknown', () => {
    expect(parseDropId('garbage')).toBeNull();
    expect(parseDropId('drop:char:abc-123:not-a-number')).toBeNull();
  });
});

describe('formatters', () => {
  it('round-trips drag ids', () => {
    const cases = ['hand:5', 'don:2', 'attacker:leader', 'attacker:char:xyz'];
    cases.forEach((s) => {
      const parsed = parseDragId(s);
      expect(parsed).not.toBeNull();
      expect(formatDragId(parsed!)).toBe(s);
    });
  });
  it('round-trips drop ids', () => {
    const cases = [
      'drop:field',
      'drop:leader:0',
      'drop:char:xyz:1',
      'drop:friendly-leader',
      'drop:friendly-char:xyz',
    ];
    cases.forEach((s) => {
      const parsed = parseDropId(s);
      expect(parsed).not.toBeNull();
      expect(formatDropId(parsed!)).toBe(s);
    });
  });
});

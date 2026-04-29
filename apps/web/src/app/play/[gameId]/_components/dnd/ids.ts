import type { PlayerIndex } from '@optcg/engine';

export type DragIntent =
  | { kind: 'hand'; handIndex: number }
  | { kind: 'don'; index: number }
  | { kind: 'attacker-leader' }
  | { kind: 'attacker-char'; instanceId: string };

export type DropIntent =
  | { kind: 'field' }
  | { kind: 'enemy-leader'; owner: PlayerIndex }
  | { kind: 'enemy-char'; instanceId: string; owner: PlayerIndex }
  | { kind: 'friendly-leader' }
  | { kind: 'friendly-char'; instanceId: string };

function toPlayerIndex(s: string): PlayerIndex | null {
  if (s === '0') return 0;
  if (s === '1') return 1;
  return null;
}

export function parseDragId(id: string): DragIntent | null {
  const parts = id.split(':');
  if (parts[0] === 'hand' && parts.length === 2) {
    const i = Number(parts[1]);
    return Number.isInteger(i) ? { kind: 'hand', handIndex: i } : null;
  }
  if (parts[0] === 'don' && parts.length === 2) {
    const i = Number(parts[1]);
    return Number.isInteger(i) ? { kind: 'don', index: i } : null;
  }
  if (parts[0] === 'attacker' && parts[1] === 'leader' && parts.length === 2) {
    return { kind: 'attacker-leader' };
  }
  if (parts[0] === 'attacker' && parts[1] === 'char' && parts.length === 3) {
    return { kind: 'attacker-char', instanceId: parts[2] };
  }
  return null;
}

export function parseDropId(id: string): DropIntent | null {
  const parts = id.split(':');
  if (parts[0] !== 'drop') return null;
  if (parts[1] === 'field' && parts.length === 2) return { kind: 'field' };
  if (parts[1] === 'leader' && parts.length === 3) {
    const owner = toPlayerIndex(parts[2]);
    return owner === null ? null : { kind: 'enemy-leader', owner };
  }
  if (parts[1] === 'char' && parts.length === 4) {
    const owner = toPlayerIndex(parts[3]);
    return owner === null ? null : { kind: 'enemy-char', instanceId: parts[2], owner };
  }
  if (parts[1] === 'friendly-leader' && parts.length === 2) return { kind: 'friendly-leader' };
  if (parts[1] === 'friendly-char' && parts.length === 3) {
    return { kind: 'friendly-char', instanceId: parts[2] };
  }
  return null;
}

export function formatDragId(d: DragIntent): string {
  switch (d.kind) {
    case 'hand':
      return `hand:${d.handIndex}`;
    case 'don':
      return `don:${d.index}`;
    case 'attacker-leader':
      return 'attacker:leader';
    case 'attacker-char':
      return `attacker:char:${d.instanceId}`;
  }
}

export function formatDropId(d: DropIntent): string {
  switch (d.kind) {
    case 'field':
      return 'drop:field';
    case 'enemy-leader':
      return `drop:leader:${d.owner}`;
    case 'enemy-char':
      return `drop:char:${d.instanceId}:${d.owner}`;
    case 'friendly-leader':
      return 'drop:friendly-leader';
    case 'friendly-char':
      return `drop:friendly-char:${d.instanceId}`;
  }
}

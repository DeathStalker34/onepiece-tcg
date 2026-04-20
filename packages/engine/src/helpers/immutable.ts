export function updateAt<T>(arr: readonly T[], index: number, value: T): T[] {
  if (index < 0 || index >= arr.length) return [...arr];
  const out = [...arr];
  out[index] = value;
  return out;
}

export function removeAt<T>(arr: readonly T[], index: number): T[] {
  if (index < 0 || index >= arr.length) return [...arr];
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

export function replaceWhere<T>(
  arr: readonly T[],
  predicate: (t: T) => boolean,
  update: (t: T) => T,
): T[] {
  return arr.map((t) => (predicate(t) ? update(t) : t));
}

export function removeWhere<T>(arr: readonly T[], predicate: (t: T) => boolean): T[] {
  return arr.filter((t) => !predicate(t));
}

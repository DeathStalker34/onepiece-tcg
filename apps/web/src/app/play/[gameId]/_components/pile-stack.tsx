'use client';

interface Props {
  count: number;
  label: string;
  size?: 'sm' | 'md';
  onClick?: () => void;
}

export function PileStack({ count, label, size = 'md', onClick }: Props) {
  const cardWidth = size === 'sm' ? 'w-14' : 'w-20';
  const cardHeight = size === 'sm' ? 'h-[78px]' : 'h-[112px]';
  const stackDepth = Math.min(count, 4);

  const content = (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${cardWidth} ${cardHeight}`}>
        {count === 0 ? (
          <div
            className={`${cardWidth} ${cardHeight} rounded border border-amber-900/40 bg-stone-900/20`}
            aria-label={`${label} (empty)`}
          />
        ) : (
          Array.from({ length: stackDepth }).map((_, i) => (
            <div
              key={i}
              className={`absolute ${cardWidth} ${cardHeight} rounded border-2 border-amber-800/80 bg-gradient-to-br from-amber-900 to-stone-900 shadow`}
              style={{ top: `-${i * 2}px`, left: `-${i * 1}px`, zIndex: i }}
              aria-hidden
            />
          ))
        )}
        <span
          className="absolute inset-0 z-10 flex items-center justify-center text-sm font-bold text-white drop-shadow"
          aria-hidden
        >
          {count}
        </span>
      </div>
      <span className="zone-label text-[10px]">{label}</span>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer transition hover:scale-105"
        aria-label={`${label} — ${count} cards`}
      >
        {content}
      </button>
    );
  }
  return content;
}

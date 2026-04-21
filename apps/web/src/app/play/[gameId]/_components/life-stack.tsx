'use client';

export function LifeStack({ count }: { count: number }) {
  return (
    <div className="relative h-24 w-16">
      {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
        <div
          key={i}
          className="absolute aspect-[5/7] w-16 rounded border border-amber-900/60 bg-stone-700"
          style={{ top: `${i * 4}px`, left: `${i * 2}px`, zIndex: i }}
          aria-hidden
        />
      ))}
      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-white">
        {count}
      </span>
    </div>
  );
}

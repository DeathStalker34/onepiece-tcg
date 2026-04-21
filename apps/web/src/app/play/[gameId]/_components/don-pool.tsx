'use client';

interface Props {
  active: number;
  rested: number;
  donDeck: number;
  compact?: boolean;
}

export function DonPool({ active, rested, donDeck, compact = false }: Props) {
  const max = active + rested;
  return (
    <div className="zone-frame space-y-1 p-2">
      <div className="zone-label">DON</div>
      {compact ? (
        <div className="text-xs">
          <span className="font-bold text-yellow-300">{active}</span> /{' '}
          <span className="opacity-70">{max}</span>
          <span className="ml-2 opacity-60">deck: {donDeck}</span>
        </div>
      ) : (
        <div className="space-y-1 text-xs">
          <div>
            Active: <span className="font-bold text-yellow-300">{active}</span>
          </div>
          <div>
            Rested: <span className="opacity-70">{rested}</span>
          </div>
          <div className="opacity-60">DON deck: {donDeck}</div>
        </div>
      )}
    </div>
  );
}

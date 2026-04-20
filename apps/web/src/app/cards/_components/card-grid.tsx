import type { Card } from '@optcg/card-data';
import { CardTile } from './card-tile';

export function CardGrid({ cards }: { cards: Card[] }) {
  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">No cards match the current filters.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
      {cards.map((card) => (
        <CardTile key={card.id} card={card} />
      ))}
    </div>
  );
}

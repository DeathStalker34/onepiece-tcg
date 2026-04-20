import type { DomainCard } from './types';

export interface CardDataService {
  listCardsInSet(setId: string): Promise<DomainCard[]>;
  imageUrlFor(card: DomainCard): string;
}

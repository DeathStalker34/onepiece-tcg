export interface CardRow {
  id: string;
  colors: string[];
  type: string;
}

export interface DeckDraft {
  leaderCardId: string | null;
  cards: Array<{ cardId: string; quantity: number }>;
}

export type ValidationIssue =
  | { kind: 'missingLeader' }
  | { kind: 'wrongCount'; expected: 50; actual: number }
  | { kind: 'overLimit'; cardId: string; quantity: number }
  | {
      kind: 'colorMismatch';
      cardId: string;
      leaderColors: string[];
      cardColors: string[];
    };

export interface ValidationResult {
  totalCards: number;
  issues: ValidationIssue[];
  isLegal: boolean;
}

const MAX_COPIES_PER_CARD = 4;
const REQUIRED_TOTAL = 50 as const;

export function validateDeck(draft: DeckDraft, cardIndex: Map<string, CardRow>): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!draft.leaderCardId) {
    issues.push({ kind: 'missingLeader' });
  }

  const totalCards = draft.cards.reduce((sum, c) => sum + c.quantity, 0);
  if (totalCards !== REQUIRED_TOTAL) {
    issues.push({ kind: 'wrongCount', expected: REQUIRED_TOTAL, actual: totalCards });
  }

  for (const entry of draft.cards) {
    if (entry.quantity > MAX_COPIES_PER_CARD) {
      issues.push({
        kind: 'overLimit',
        cardId: entry.cardId,
        quantity: entry.quantity,
      });
    }
  }

  if (draft.leaderCardId) {
    const leader = cardIndex.get(draft.leaderCardId);
    if (leader) {
      const leaderColors = leader.colors;
      for (const entry of draft.cards) {
        const card = cardIndex.get(entry.cardId);
        if (!card) continue;
        const shared = card.colors.some((c) => leaderColors.includes(c));
        if (!shared) {
          issues.push({
            kind: 'colorMismatch',
            cardId: entry.cardId,
            leaderColors,
            cardColors: card.colors,
          });
        }
      }
    }
  }

  return {
    totalCards,
    issues,
    isLegal: issues.length === 0,
  };
}

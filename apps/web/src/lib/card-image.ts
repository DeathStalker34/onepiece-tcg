/**
 * Derives the static image path for a card given its ID.
 * cardId "OP01-013" → "/cards/OP01/OP01-013.webp"
 * Strips `_pN` variant suffixes to fall back to the base image.
 */
export function cardImagePath(cardId: string): string {
  const base = cardId.replace(/_p\d+$/, '');
  const setId = base.split('-')[0];
  return `/cards/${setId}/${base}.webp`;
}

import { BuilderLayout } from './_components/builder-layout';

export default function DeckEditorPage({ params }: { params: { deckId: string } }) {
  return <BuilderLayout deckId={params.deckId} />;
}

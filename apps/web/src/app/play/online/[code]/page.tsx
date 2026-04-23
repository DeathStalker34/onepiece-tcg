'use client';

import { useOnlineSocket } from '@/lib/online/use-online-socket';
import { OnlineLobby } from './_components/online-lobby';
import { NetGameProvider } from './_components/net-game-provider';
import { Board } from '@/app/play/[gameId]/_components/board';

export default function OnlineMatchPage({ params }: { params: { code: string } }) {
  const online = useOnlineSocket(params.code);

  if (online.phase === 'connecting' && !online.state) {
    return <main className="p-8">Connecting…</main>;
  }
  if (online.phase === 'idle' || online.phase === 'lobby') {
    return <OnlineLobby online={online} matchId={params.code} />;
  }
  if ((online.phase === 'playing' || online.phase === 'finished') && online.state) {
    return (
      <NetGameProvider online={online}>
        <Board />
      </NetGameProvider>
    );
  }
  return <main className="p-8">Unknown state.</main>;
}

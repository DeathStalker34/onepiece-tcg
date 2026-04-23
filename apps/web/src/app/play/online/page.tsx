'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loadNickname, saveNickname } from '@/lib/online/session-storage';
import { useOnlineSocket } from '@/lib/online/use-online-socket';

export default function OnlineLanding() {
  const router = useRouter();
  const online = useOnlineSocket();
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadNickname();
    if (saved) setNickname(saved);
  }, []);

  useEffect(() => {
    if (online.matchId) {
      saveNickname(nickname);
      router.push(`/play/online/${online.matchId}`);
    }
  }, [online.matchId, nickname, router]);

  useEffect(() => {
    if (online.error) setError(online.error);
  }, [online.error]);

  function handleCreate(): void {
    if (!nickname.trim()) return setError('Nickname required');
    setError(null);
    void online.createMatch(nickname.trim());
  }

  function handleJoin(): void {
    if (!nickname.trim()) return setError('Nickname required');
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) return setError('Code must be 6 chars');
    setError(null);
    void online.joinMatch(normalized, nickname.trim());
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Online match</h1>

      <div className="space-y-2">
        <Label htmlFor="nickname">Nickname</Label>
        <Input
          id="nickname"
          maxLength={24}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={handleCreate} disabled={!nickname.trim()}>
          Create match
        </Button>

        <div className="flex gap-2">
          <Input
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <Button onClick={handleJoin} variant="secondary">
            Join
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </main>
  );
}

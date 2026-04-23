'use client';

import { useEffect, useState } from 'react';

export function DisconnectBanner() {
  const [visible, setVisible] = useState(false);
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    const listener = (e: Event): void => {
      const ev = e as CustomEvent<{ disconnected: boolean }>;
      setVisible(ev.detail.disconnected);
      if (ev.detail.disconnected) setSeconds(60);
    };
    window.addEventListener('optcg:opponent', listener);
    return () => window.removeEventListener('optcg:opponent', listener);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const i = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(i);
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-900 shadow">
      Opponent disconnected — {seconds}s to forfeit
    </div>
  );
}

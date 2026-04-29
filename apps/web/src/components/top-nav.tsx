'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  { href: '/cards', label: 'Cards' },
  { href: '/builder', label: 'Decks' },
  { href: '/play', label: 'Play' },
] as const;

// Hide chrome inside active matches: /play/<gameId> and /play/online/<code>.
// Keeps it visible on the mode selector (/play) and online lobby (/play/online).
function isInMatch(pathname: string): boolean {
  const segs = pathname.split('/').filter(Boolean);
  if (segs[0] !== 'play') return false;
  if (segs[1] === 'online') return segs.length >= 3;
  return segs.length >= 2;
}

export function TopNav() {
  const pathname = usePathname();

  if (isInMatch(pathname)) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          OPTCG Sim
        </Link>
        <ul className="flex gap-1">
          {SECTIONS.map((s) => {
            const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-foreground/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

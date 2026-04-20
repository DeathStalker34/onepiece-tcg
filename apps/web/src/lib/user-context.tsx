'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface User {
  id: string;
  username: string;
}

interface UserContextValue {
  user: User | null;
  setUser: (u: User | null) => void;
  ready: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

const STORAGE_KEY = 'optcg.user';

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as User;
        if (parsed?.id && parsed?.username) {
          setUserState(parsed);
        }
      }
    } catch {
      /* ignore malformed localStorage */
    }
    setReady(true);
  }, []);

  function setUser(u: User | null) {
    setUserState(u);
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return <UserContext.Provider value={{ user, setUser, ready }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

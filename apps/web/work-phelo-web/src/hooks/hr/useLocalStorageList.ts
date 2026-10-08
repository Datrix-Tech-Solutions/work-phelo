'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * A list kept in the browser, per key, for screens that don't have a backend yet. Storage can be
 * blocked, in which case the list still works for the session.
 */
export function useLocalStorageList<T>(key: string): [T[], Dispatch<SetStateAction<T[]>>] {
  const [list, setList] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      setList(Array.isArray(parsed) ? (parsed as T[]) : []);
    } catch {
      setList([]);
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(list));
    } catch {
      // Storage unavailable; keep going in memory.
    }
  }, [list, loaded, key]);

  return [list, setList];
}

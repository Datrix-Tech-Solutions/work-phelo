'use client';

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from 'react';

const listeners = new Set<() => void>();
// Fallback for when storage is blocked, so the list still works for the session.
const memory = new Map<string, string>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable; keep going in memory.
  }
  listeners.forEach((listener) => listener());
}

function parseList<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * A list kept in the browser, per key, for screens that don't have a backend yet. Storage can be
 * blocked, in which case the list still works for the session.
 */
export function useLocalStorageList<T>(key: string): [T[], Dispatch<SetStateAction<T[]>>] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  const list = useMemo(() => parseList<T>(raw), [raw]);

  const setList = useCallback<Dispatch<SetStateAction<T[]>>>(
    (action) => {
      const current = parseList<T>(readRaw(key));
      const next = typeof action === 'function' ? action(current) : action;
      writeRaw(key, JSON.stringify(next));
    },
    [key],
  );

  return [list, setList];
}

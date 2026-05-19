"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

type Token = number;
type Item = { id: Token; label: string; message?: string };

interface ShowOptions {
  label?: string;
  message?: string;
}

interface LoadingContextValue {
  show: (options?: ShowOptions) => Token;
  hide: (token: Token) => void;
  run: <T>(fn: () => Promise<T>, options?: ShowOptions) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

// External store: lives outside React's concurrent scheduler so updates render
// synchronously, even when triggered from inside a startTransition callback.
function createStore(defaultLabel: string) {
  let stack: Item[] = [];
  let nextId = 0;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return stack;
    },
    push(options?: ShowOptions): Token {
      const id = ++nextId;
      stack = [
        ...stack,
        {
          id,
          label: options?.label ?? defaultLabel,
          message: options?.message,
        },
      ];
      listeners.forEach((l) => l());
      return id;
    },
    remove(id: Token) {
      stack = stack.filter((item) => item.id !== id);
      listeners.forEach((l) => l());
    },
  };
}

const EMPTY: Item[] = [];

export function LoadingProvider({
  children,
  defaultLabel = "Loading",
}: {
  children: ReactNode;
  defaultLabel?: string;
}) {
  const store = useMemo(() => createStore(defaultLabel), [defaultLabel]);

  const stack = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => EMPTY,
  );

  const show = useCallback(
    (options?: ShowOptions) => store.push(options),
    [store],
  );
  const hide = useCallback((token: Token) => store.remove(token), [store]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, options?: ShowOptions) => {
      const token = show(options);
      try {
        return await fn();
      } finally {
        hide(token);
      }
    },
    [show, hide],
  );

  const value = useMemo<LoadingContextValue>(
    () => ({ show, hide, run }),
    [show, hide, run],
  );

  const top = stack[stack.length - 1];

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {top ? <LoadingOverlay label={top.label} message={top.message} /> : null}
    </LoadingContext.Provider>
  );
}

export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error("useLoading must be used inside LoadingProvider");
  }
  return ctx;
}

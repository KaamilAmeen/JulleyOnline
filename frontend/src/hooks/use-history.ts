"use client";

import { useCallback, useRef, useState } from "react";

/**
 * A tiny undo/redo stack. Entries are opaque; the caller decides what an
 * entry means (here: a task move that can be replayed in either direction).
 */
export function useHistory<T>() {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [state, setState] = useState({ undo: 0, redo: 0 });

  const sync = useCallback(() => {
    setState({ undo: past.current.length, redo: future.current.length });
  }, []);

  const push = useCallback(
    (entry: T) => {
      past.current.push(entry);
      if (past.current.length > 50) past.current.shift();
      future.current = [];
      sync();
    },
    [sync],
  );

  const undo = useCallback((): T | null => {
    const entry = past.current.pop();
    if (!entry) return null;
    future.current.push(entry);
    sync();
    return entry;
  }, [sync]);

  const redo = useCallback((): T | null => {
    const entry = future.current.pop();
    if (!entry) return null;
    past.current.push(entry);
    sync();
    return entry;
  }, [sync]);

  const clear = useCallback(() => {
    past.current = [];
    future.current = [];
    sync();
  }, [sync]);

  return { push, undo, redo, clear, canUndo: state.undo > 0, canRedo: state.redo > 0 };
}

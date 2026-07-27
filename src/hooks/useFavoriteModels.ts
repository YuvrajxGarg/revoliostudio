"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "revolio_favorite_models";

function readStored(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Favorited models — stored in the browser (per-device, not per-account).
 * Kept as a small standalone hook so the persistence layer (localStorage
 * today) can be swapped for a Supabase-backed column later without
 * touching any of the model-selector UI.
 */
export function useFavoriteModels() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFavorites(readStored());
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Ignore storage errors (private browsing, quota, etc.) — favorites
        // just won't persist across reloads in that case.
      }
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}

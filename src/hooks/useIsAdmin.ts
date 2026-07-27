"use client";

import { useEffect, useState } from "react";

let cache: boolean | null = null;
let inflight: Promise<boolean> | null = null;

async function fetchIsAdmin(): Promise<boolean> {
  if (cache !== null) return cache;
  if (!inflight) {
    inflight = fetch("/api/me")
      .then((r) => (r.ok ? r.json() : { isAdmin: false }))
      .then((json) => {
        cache = Boolean(json.isAdmin);
        return cache;
      })
      .catch(() => false);
  }
  return inflight;
}

/**
 * Cheap client-side admin check (mirrors usePresetOverrides.ts's cached-fetch
 * pattern) — used to show admin-only hover affordances in client component
 * trees that have no server-component ancestor already carrying isAdmin
 * down as a prop, e.g. the Featured Templates grid's "Edit prompt" hover
 * button.
 */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(cache ?? false);

  useEffect(() => {
    let cancelled = false;
    fetchIsAdmin().then((value) => {
      if (!cancelled) setIsAdmin(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}

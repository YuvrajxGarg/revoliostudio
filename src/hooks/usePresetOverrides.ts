"use client";

import { useEffect, useState } from "react";

let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

async function fetchOverrides(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch("/api/presets/overrides")
      .then((r) => (r.ok ? r.json() : { overrides: {} }))
      .then((json) => {
        cache = (json.overrides ?? {}) as Record<string, string>;
        return cache;
      })
      .catch(() => ({}));
  }
  return inflight;
}

/**
 * Admin-edited prompt overrides for Featured Templates (see
 * preset_prompt_overrides table / the Preset Prompts admin tab) — a sparse
 * `{ [presetId]: prompt }` map. Fetched once per page load and cached
 * module-wide since every studio page rendering FeaturedTemplatesGrid needs
 * the same data, and it only changes when an admin edits it.
 */
export function usePresetOverrides() {
  const [overrides, setOverrides] = useState<Record<string, string>>(cache ?? {});

  useEffect(() => {
    let cancelled = false;
    fetchOverrides().then((data) => {
      if (!cancelled) setOverrides(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return overrides;
}

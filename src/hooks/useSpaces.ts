"use client";

import { useCallback, useEffect, useState } from "react";
import type { Space } from "@/lib/space-types";

/** Lists the current user's spaces. */
export function useSpaces() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/spaces");
      if (res.ok) setSpaces(await res.json());
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = useCallback((id: string) => setSpaces((prev) => prev.filter((s) => s.id !== id)), []);

  return { spaces, loading, reload: load, remove };
}

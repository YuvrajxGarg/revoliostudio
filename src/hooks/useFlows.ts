"use client";

import { useCallback, useEffect, useState } from "react";
import type { Flow } from "@/lib/flow-types";

/** Loads the user's own flows and (when scope="public") the Community feed. */
export function useFlows(scope: "mine" | "public") {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(scope === "public" ? "/api/flows?scope=public" : "/api/flows");
      if (res.ok) setFlows(await res.json());
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = useCallback((id: string) => setFlows((prev) => prev.filter((f) => f.id !== id)), []);
  const upsert = useCallback(
    (flow: Flow) => setFlows((prev) => (prev.some((f) => f.id === flow.id) ? prev.map((f) => (f.id === flow.id ? flow : f)) : [flow, ...prev])),
    []
  );

  return { flows, loading, reload: load, remove, upsert };
}

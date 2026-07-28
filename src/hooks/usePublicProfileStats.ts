"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PublicProfileStats } from "@/lib/types";

/**
 * Streak/model-diversity/activity-map stats for the public /u/[username]
 * profile page. Reads through get_public_profile_stats (0038 migration) so
 * only aggregate counts are ever exposed.
 */
export function usePublicProfileStats(userId: string | null) {
  const [stats, setStats] = useState<PublicProfileStats | null | undefined>(undefined);

  useEffect(() => {
    if (!userId) {
      setStats(null);
      return;
    }
    let cancelled = false;
    setStats(undefined);
    const supabase = createClient();
    supabase
      .rpc("get_public_profile_stats", { p_user_id: userId })
      .then((res: { data: unknown }) => {
        if (cancelled) return;
        const rows = res.data as PublicProfileStats[] | PublicProfileStats | null;
        const row = Array.isArray(rows) ? rows[0] ?? null : rows;
        setStats(row ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return stats;
}

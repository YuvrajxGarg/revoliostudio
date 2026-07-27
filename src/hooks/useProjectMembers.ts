"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ProjectMemberRole = "owner" | "editor" | "viewer";

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  created_at: string;
  profile: {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

/**
 * Membership list + invite/remove for a single "team" project. Mirrors
 * useSharedGenerations/ShareModal's shape — invite goes through
 * /api/projects/[id]/members (which reuses search_profiles(), the same RPC
 * the generation Share dialog already uses to find existing Revolio users
 * by email/name).
 */
export function useProjectMembers(projectId: string | null) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("project_members")
      .select("id, project_id, user_id, role, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as Omit<ProjectMember, "profile">[];

    if (rows.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .in(
        "id",
        rows.map((r) => r.user_id)
      );
    const profiles = (profileRows ?? []) as NonNullable<ProjectMember["profile"]>[];
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    setMembers(
      rows.map((r) => ({
        ...r,
        profile: profileById.get(r.user_id) ?? null,
      }))
    );
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const inviteMember = useCallback(
    async (userId: string) => {
      if (!projectId) return "No project selected";
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return data.error ?? "Failed to add member";
      }
      await refresh();
      return null;
    },
    [projectId, refresh]
  );

  const removeMember = useCallback(
    async (userId: string) => {
      if (!projectId) return "No project selected";
      const res = await fetch(`/api/projects/${projectId}/members?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return data.error ?? "Failed to remove member";
      }
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      return null;
    },
    [projectId]
  );

  return { members, loading, refresh, inviteMember, removeMember };
}

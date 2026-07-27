"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ProjectType = "personal" | "team";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  color: string;
  type: ProjectType;
  deleted_at: string | null;
  created_at: string;
}

/**
 * CRUD over the user's projects (Magnific-style folders for generations).
 * `type: "team"` projects are shared with whoever's in project_members (see
 * useProjectMembers.ts) — RLS on the `projects`/`generations` tables (0025
 * migration) is what actually grants teammates read access; this hook just
 * lists whatever projects.select() returns, own or shared.
 *
 * Deleting is a soft-delete (sets deleted_at) so it can show up in Trash and
 * be restored — see restoreProject/permanentlyDeleteProject.
 */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    setProjects((data ?? []) as Project[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createProject = useCallback(
    async (name: string, color = "#e85002", type: ProjectType = "personal") => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return { project: null, error: "Not signed in" };
      const { data, error } = await supabase
        .from("projects")
        .insert({ user_id: session.user.id, name, color, type })
        .select()
        .single();
      if (!error && data) setProjects((prev) => [...prev, data as Project]);
      return {
        project: (data as Project) ?? null,
        error: error
          ? `${error.message}${error.message.includes("does not exist") || error.message.includes("schema cache") ? " — run supabase/migrations/0025_projects_team_trash.sql in the Supabase SQL editor" : ""}`
          : null,
      };
    },
    []
  );

  const renameProject = useCallback(async (id: string, name: string) => {
    const supabase = createClient();
    await supabase.from("projects").update({ name }).eq("id", id);
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  /** Soft-delete — moves the project to Trash instead of removing it. */
  const deleteProject = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const restoreProject = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("projects").update({ deleted_at: null }).eq("id", id);
    return error?.message ?? null;
  }, []);

  const permanentlyDeleteProject = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", id);
    return error?.message ?? null;
  }, []);

  return {
    projects,
    loading,
    refresh,
    createProject,
    renameProject,
    deleteProject,
    restoreProject,
    permanentlyDeleteProject,
  };
}

/** Trashed (soft-deleted) projects only — powers the Projects page's Trash
 * view alongside trashed generations. Separate from useProjects() itself so
 * the normal project pickers/tiles never accidentally show a deleted one. */
export function useTrashedProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    setProjects((data ?? []) as Project[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, loading, refresh };
}

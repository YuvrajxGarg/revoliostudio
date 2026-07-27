"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Folder, Plus } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";

/** Compact Magnific-style Projects panel for the home dashboard. */
export function ProjectsCard() {
  const { projects, loading, createProject } = useProjects();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const n = name.trim();
    if (!n) return;
    const { error: err } = await createProject(n);
    if (err) {
      setError(err);
      return;
    }
    setName("");
    setCreating(false);
    setError(null);
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between pb-2">
        <Link href="/projects" className="flex items-center gap-1 text-sm font-medium hover:text-accent">
          Projects <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={() => setCreating((v) => !v)}
          title="New project"
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-2 text-muted hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {creating && (
        <div className="flex items-center gap-1.5 pb-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Project name…"
            className="w-full rounded-lg border border-border-subtle bg-surface-2 px-2 py-1 text-xs outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            onClick={handleCreate}
            className="rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-white hover:bg-accent-2"
          >
            Add
          </button>
        </div>
      )}
      {error && <div className="pb-2 text-[11px] text-danger-text">{error}</div>}

      <div className="flex flex-col gap-0.5">
        {loading ? (
          <div className="h-16 rounded-xl shimmer" />
        ) : projects.length === 0 ? (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg py-3 text-left text-xs text-muted hover:text-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            No projects yet — create one to organize your work.
          </button>
        ) : (
          projects.slice(0, 6).map((p) => (
            <Link
              key={p.id}
              href={`/gallery?project=${p.id}`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2 transition-colors"
            >
              <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
              <span className="truncate">{p.name}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

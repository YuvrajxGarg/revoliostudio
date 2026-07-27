"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Folder, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { useComposerStore } from "@/store/composerStore";

/**
 * Magnific-style project chip: shows the active project and lets the user
 * file upcoming generations into a project (or none) from a small popover.
 */
export function ProjectPicker({ className, block = false }: { className?: string; block?: boolean }) {
  const { projects, createProject } = useProjects();
  const projectId = useComposerStore((s) => s.projectId);
  const setProjectId = useComposerStore((s) => s.setProjectId);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active = projects.find((p) => p.id === projectId) ?? null;

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const { project: created } = await createProject(name);
    if (created) {
      setProjectId(created.id);
      setNewName("");
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative", block && "w-full", className)} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 text-xs text-foreground hover:bg-border-subtle transition-colors",
          // `block` = full-width bar (folder+name left, chevron pinned right)
          // for the sidebar's top row; otherwise a compact inline chip.
          block ? "w-full justify-between px-2.5 py-2" : "px-2 py-1"
        )}
        title="File new generations under a project"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: active?.color ?? "var(--muted)" }} />
          <span className={cn("truncate", !block && "max-w-[8rem]")}>{active ? active.name : "No project"}</span>
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 text-muted" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 top-full z-50 mt-1 rounded-xl border border-border-subtle bg-surface p-1 shadow-2xl",
            block ? "w-full" : "w-56"
          )}
        >
          <button
            onClick={() => {
              setProjectId(null);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface-2"
          >
            <Folder className="h-3.5 w-3.5 text-muted" />
            <span className="flex-1 text-left">No project</span>
            {!projectId && <Check className="h-3.5 w-3.5 text-accent" />}
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setProjectId(p.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface-2"
            >
              <Folder className="h-3.5 w-3.5" style={{ color: p.color }} />
              <span className="flex-1 truncate text-left">{p.name}</span>
              {projectId === p.id && <Check className="h-3.5 w-3.5 text-accent" />}
            </button>
          ))}
          <div className="mt-1 flex items-center gap-1 border-t border-border-subtle pt-1.5 px-1 pb-0.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="New project…"
              className="w-full rounded-md bg-surface-2 px-2 py-1 text-xs outline-none placeholder:text-muted"
            />
            <button
              onClick={handleCreate}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-white hover:bg-accent-2"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

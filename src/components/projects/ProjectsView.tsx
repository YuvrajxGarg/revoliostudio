"use client";

import { useEffect, useRef, useState } from "react";
import {
  Folder,
  FolderKanban,
  Heart,
  MoreVertical,
  Plus,
  Trash2,
  Upload as UploadIcon,
  Images,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProjects, type Project, type ProjectType } from "@/hooks/useProjects";
import { useGenerations } from "@/hooks/useGenerations";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { GridSizeSlider } from "@/components/gallery/GridSizeSlider";
import { usePersistentState } from "@/hooks/usePersistentState";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ProjectDetailView } from "./ProjectDetailView";
import { TrashView } from "./TrashView";
import { UploadsView } from "./UploadsView";
import { cn } from "@/lib/utils";

const COLORS = ["#e8a202", "#e85002", "#f5a623", "#4285f4", "#10a37f", "#7c5cff", "#ff5cd0"];

function projectGradient(color: string) {
  return `linear-gradient(160deg, ${color} 0%, ${color}99 55%, ${color}55 100%)`;
}

type RailView = "projects" | "assets" | "favorites" | "uploads" | "trash";

const RAIL_ITEMS: { id: RailView; label: string; icon: typeof Folder }[] = [
  { id: "projects", label: "All projects", icon: FolderKanban },
  { id: "assets", label: "All assets", icon: Images },
  { id: "favorites", label: "Favorites", icon: Heart },
  { id: "uploads", label: "Uploads", icon: UploadIcon },
  { id: "trash", label: "Trash", icon: Trash2 },
];

/** A plain generations grid, parameterized by filter — backs both "All
 * assets" and "Favorites" in the rail, which are otherwise identical. */
function GenerationsRailView({ favoritesOnly, emptyLabel }: { favoritesOnly?: boolean; emptyLabel: string }) {
  const [colWidth, setColWidth] = usePersistentState("revolio-grid-width", 220);
  const gens = useGenerations(undefined, { favoritesOnly });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <GridSizeSlider value={colWidth} onChange={setColWidth} />
      </div>
      <GenerationGrid
        items={gens.items}
        loading={gens.loading}
        hasMore={gens.hasMore}
        onLoadMore={gens.loadMore}
        onDeleted={gens.removeItem}
        onFavoriteToggle={(id, isFavorite) => {
          if (favoritesOnly && !isFavorite) gens.removeItem(id);
        }}
        columnWidth={colWidth}
        emptyLabel={emptyLabel}
      />
    </div>
  );
}

/**
 * Magnific-style Projects page: a left rail (All projects / All assets /
 * Favorites / Uploads / Trash) plus the classic "New project" + colorful
 * project tiles grid. Clicking a project tile opens it inline
 * (ProjectDetailView) rather than navigating to the Gallery filtered by
 * project — that's what lets a team project's member list live right next
 * to its generations.
 */
export function ProjectsView() {
  const { projects, loading, createProject, renameProject, deleteProject } = useProjects();
  const [rail, setRail] = useState<RailView>("projects");
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<ProjectType>("personal");
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id ?? null);
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (creating) setTimeout(() => inputRef.current?.focus(), 0);
  }, [creating]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    const supabase = createClient();
    Promise.all(
      projects.map(async (p) => {
        const { count } = await supabase
          .from("generations")
          .select("id", { count: "exact", head: true })
          .eq("project_id", p.id)
          .is("deleted_at", null);
        return [p.id, count ?? 0] as const;
      })
    ).then((entries) => setCounts(Object.fromEntries(entries)));
  }, [projects]);

  // Keep the inline project detail view's own data fresh if it gets renamed
  // from the tile menu while open.
  useEffect(() => {
    if (!openProject) return;
    const fresh = projects.find((p) => p.id === openProject.id);
    if (fresh && fresh.name !== openProject.name) setOpenProject(fresh);
  }, [projects, openProject]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    const { project, error: err } = await createProject(name, COLORS[projects.length % COLORS.length], newType);
    if (err) {
      setError(err);
      return;
    }
    if (project) {
      setNewName("");
      setNewType("personal");
      setCreating(false);
    }
  }

  function tileMenu(p: Project) {
    return (
      <div
        ref={menuRef}
        className="absolute right-2 top-9 z-20 w-36 rounded-xl border border-border-subtle bg-surface p-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => {
            const name = prompt("Rename project", p.name);
            if (name?.trim()) renameProject(p.id, name.trim());
            setMenuFor(null);
          }}
          className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-surface-2"
        >
          Rename
        </button>
        <button
          onClick={() => {
            setDeleting(p);
            setMenuFor(null);
          }}
          className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-danger-text hover:bg-surface-2"
        >
          Delete
        </button>
      </div>
    );
  }

  if (openProject) {
    return (
      <ProjectDetailView project={openProject} currentUserId={currentUserId} onBack={() => setOpenProject(null)} />
    );
  }

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <aside className="hidden sm:flex w-48 shrink-0 flex-col gap-0.5 border-r border-border-subtle/60 p-3">
        {RAIL_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setRail(item.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors text-left",
              rail === item.id ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
            )}
          >
            <item.icon className="h-[15px] w-[15px] shrink-0" />
            {item.label}
          </button>
        ))}
      </aside>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-8 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight font-display">
              {RAIL_ITEMS.find((r) => r.id === rail)?.label}
            </h1>
            {rail === "projects" && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 rounded-lg bg-surface-2 border border-border-subtle px-3 py-1.5 text-xs font-semibold hover:bg-border-subtle transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            )}
          </div>

          {rail === "assets" && <GenerationsRailView emptyLabel="Every generation you've made will appear here." />}
          {rail === "favorites" && (
            <GenerationsRailView
              favoritesOnly
              emptyLabel="Nothing starred yet — hover a generation and click the star to favorite it."
            />
          )}
          {rail === "uploads" && <UploadsView />}
          {rail === "trash" && <TrashView />}

          {rail === "projects" && (
            <>
              {error && (
                <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger-text">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {/* New project tile */}
                <div
                  onClick={() => !creating && setCreating(true)}
                  className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface p-4 text-center hover:border-accent/50 transition-colors"
                >
                  {creating ? (
                    <div className="flex w-full flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={inputRef}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreate();
                          if (e.key === "Escape") setCreating(false);
                        }}
                        placeholder="Project name…"
                        className="w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-sm outline-none placeholder:text-muted focus:border-accent"
                      />
                      <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 p-0.5">
                        {(["personal", "team"] as ProjectType[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => setNewType(t)}
                            className={cn(
                              "flex-1 rounded-md py-1 text-[11px] font-medium capitalize transition-colors",
                              newType === t ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleCreate}
                        disabled={!newName.trim()}
                        className="rounded-lg bg-accent py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-accent-2"
                      >
                        Create
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                        <Plus className="h-4 w-4" />
                      </span>
                      <div className="text-sm font-semibold">New project</div>
                      <p className="text-xs text-muted">Personal, or team &amp; shared</p>
                    </>
                  )}
                </div>

                {loading
                  ? [...Array(3)].map((_, i) => <div key={i} className="aspect-square rounded-2xl shimmer" />)
                  : projects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setOpenProject(p)}
                        className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl transition-transform hover:-translate-y-0.5"
                        style={{ backgroundImage: projectGradient(p.color) }}
                      >
                        {p.type === "team" && (
                          <span className="absolute left-2 top-2 z-10 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                            Team
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(menuFor === p.id ? null : p.id);
                          }}
                          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-black/25 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Project options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuFor === p.id && tileMenu(p)}
                        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
                          <div>
                            <div className="text-sm font-bold text-white drop-shadow">{p.name}</div>
                            <div className="text-[11px] text-white/80 drop-shadow">
                              {counts[p.id] ?? "…"} generation{(counts[p.id] ?? 0) === 1 ? "" : "s"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
              </div>
            </>
          )}
        </div>
      </div>

      {deleting && (
        <ConfirmModal
          title={`Delete project "${deleting.name}"?`}
          description="Moved to Trash — restore it there within reach, or its generations stay in your Library either way, just unfiled from this project."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteProject(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

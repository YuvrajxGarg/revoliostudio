"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  Download,
  ExternalLink,
  GraduationCap,
  Images,
  LayoutGrid,
  Palette,
  Pencil,
  Plug,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useResources, type Resource, type ResourceCategory } from "@/hooks/useResources";
import { ResourceEditorModal } from "./ResourceEditorModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const CATEGORY_TABS: { id: ResourceCategory | "all"; label: string; icon: typeof LayoutGrid }[] = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "editing", label: "Editing", icon: SlidersHorizontal },
  { id: "design", label: "Design", icon: Palette },
  { id: "ai-tools", label: "AI Tools", icon: Bot },
  { id: "plugins", label: "Plugins", icon: Plug },
  { id: "stock", label: "Stock", icon: Images },
  { id: "learning", label: "Learning", icon: GraduationCap },
];

/**
 * The resources bank — an admin-curated library of editing/design/AI
 * tools, plugins and stock sources, with thumbnails and download links.
 */
export function ResourcesView({ isAdmin }: { isAdmin: boolean }) {
  const { resources, loading, addResource, updateResource, deleteResource } = useResources();
  const [tab, setTab] = useState<ResourceCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Resource | "new" | null>(null);
  const [deleting, setDeleting] = useState<Resource | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      if (tab !== "all" && r.category !== tab) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [resources, tab, query]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-8 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight font-display">Resources</h1>
            <p className="text-sm text-muted mt-1">
              A curated bank of editing, design and AI tools — with direct links and downloads.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 focus-within:border-accent transition-colors">
              <Search className="h-3.5 w-3.5 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search resources…"
                className="w-40 bg-transparent text-xs outline-none placeholder:text-muted"
              />
            </div>
            {isAdmin && (
              <button
                onClick={() => setEditing("new")}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-2"
              >
                <Plus className="h-3.5 w-3.5" /> Add resource
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface p-1 w-fit flex-wrap">
          {CATEGORY_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === t.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-36 rounded-2xl shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-subtle p-10 text-center text-sm text-muted">
            {resources.length === 0
              ? "The resources bank is empty. Run the 0014 migration to load the starter set, or add entries with the button above."
              : "Nothing matches the current filter."}
            {resources.length > 0 && (tab !== "all" || query.trim()) && (
              <button
                onClick={() => {
                  setTab("all");
                  setQuery("");
                }}
                className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-2 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="group relative flex flex-col rounded-2xl border border-border-subtle bg-surface p-4 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
                    {r.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumbnail_url} alt="" className="h-6 w-6 object-contain" />
                    ) : (
                      <ExternalLink className="h-4 w-4 text-muted" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.title}</span>
                      <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                        {r.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted line-clamp-2">{r.description}</p>
                  </div>
                </div>

                {r.tags.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className="rounded-full border border-border-subtle px-1.5 py-0.5 text-[10px] text-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 pt-1">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs hover:bg-border-subtle transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" /> Visit
                  </a>
                  {r.download_url && (
                    <a
                      href={r.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1 text-xs text-accent hover:bg-accent/25 transition-colors"
                    >
                      <Download className="h-3 w-3" /> Download
                    </a>
                  )}
                </div>

                {isAdmin && (
                  <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditing(r)} title="Edit" className="icon-btn-round !h-7 !w-7">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setDeleting(r)}
                      title="Delete"
                      className="icon-btn-round !h-7 !w-7 hover:!bg-danger/20"
                    >
                      <Trash2 className="h-3 w-3 text-danger-text" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <ResourceEditorModal
          resource={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            const err =
              editing === "new" ? await addResource(input) : await updateResource(editing.id, input);
            if (!err) setEditing(null);
            return err;
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title={`Delete "${deleting.title}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteResource(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Bookmark, Check, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTemplates, type Template } from "@/hooks/useTemplates";
import { useComposerStore } from "@/store/composerStore";
import { MODELS, type Category } from "@/lib/models";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/**
 * "My templates" tab in a studio's main area — Magnific-style reusable
 * setups. Clicking "Use" loads the template straight into the composer.
 */
export function TemplatesPanel({ category }: { category: Category }) {
  const { templates, loading, deleteTemplate } = useTemplates(category);
  const { setModelId, setPrompt, updateSettings, addReference } = useComposerStore();
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [justUsedId, setJustUsedId] = useState<string | null>(null);

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setModelId(t.model_id);
    setPrompt(t.prompt);
    updateSettings(t.settings ?? {});
    t.reference_urls.forEach((url) => addReference(url, undefined, 8));
    setJustUsedId(id);
    window.setTimeout(() => setJustUsedId((cur) => (cur === id ? null : cur)), 1100);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 rounded-2xl shimmer" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Bookmark className="h-6 w-6 text-muted" />
        <div className="text-sm font-medium">Build your first template</div>
        <p className="max-w-xs text-xs text-muted">
          Set up a prompt, model and settings in the panel, then hit “Save template” to reuse the
          whole setup in one click.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
      {templates.map((t) => {
        const model = MODELS.find((m) => m.id === t.model_id);
        return (
          <div
            key={t.id}
            className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-surface hover:border-accent/50 transition-colors"
          >
            <div className="aspect-video w-full bg-surface-2">
              {t.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center accent-gradient opacity-60" />
              )}
            </div>
            <div className="p-3">
              <div className="truncate text-sm font-medium">{t.name}</div>
              <div className="mt-0.5 truncate text-xs text-muted">
                {model?.label ?? t.model_id}
                {t.prompt ? ` · ${t.prompt}` : ""}
              </div>
            </div>
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => applyTemplate(t.id)}
                title="Load into composer"
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-white transition-all duration-200",
                  justUsedId === t.id ? "scale-[1.05] bg-emerald-500" : "bg-accent hover:bg-accent-2"
                )}
              >
                {justUsedId === t.id ? (
                  <>
                    <Check className="h-3 w-3" /> Added
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" /> Use
                  </>
                )}
              </button>
              <button
                onClick={() => setDeleting(t)}
                title="Delete template"
                className="icon-btn-round !h-6 !w-6"
              >
                <Trash2 className="h-3 w-3 text-danger-text" />
              </button>
            </div>
          </div>
        );
      })}

      {deleting && (
        <ConfirmModal
          title={`Delete template "${deleting.name}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteTemplate(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

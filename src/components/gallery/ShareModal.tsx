"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X, Check, Search, Share2 } from "lucide-react";
import type { Generation } from "@/lib/types";

interface SearchedUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

function initials(u: SearchedUser): string {
  const name = u.display_name || u.email;
  return name.charAt(0).toUpperCase();
}

/**
 * Recipient picker for sharing a generation with other users on the site.
 * Debounced search against /api/users/search, multi-select, then submits to
 * POST /api/shares (which also fires a targeted notification per recipient).
 */
export function ShareModal({
  generation,
  onClose,
  onShared,
}: {
  generation: Generation;
  onClose: () => void;
  onShared?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Map<string, SearchedUser>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data: { users?: SearchedUser[] }) => setResults(data.users ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function toggle(u: SearchedUser) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(u.id)) next.delete(u.id);
      else next.set(u.id, u);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: generation.id, toUserIds: Array.from(selected.keys()) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to share");
      }
      setDone(true);
      onShared?.();
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[85vh] overflow-hidden rounded-2xl border border-border-subtle bg-surface flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
          <span className="text-sm font-semibold">Share generation</span>
          <button onClick={onClose} className="icon-btn-round" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 pb-0 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-lg border border-border-subtle bg-surface-2 pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted outline-none"
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 shrink-0">
            {Array.from(selected.values()).map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 rounded-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs"
              >
                {u.display_name || u.email}
                <button onClick={() => toggle(u)} className="text-muted hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 py-2 mt-2 min-h-[8rem]">
          {searching ? (
            <div className="flex items-center justify-center py-8 text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted">
              {query.trim() ? "No users found" : "Start typing to find someone"}
            </div>
          ) : (
            results.map((u) => {
              const isSelected = selected.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-2 transition-colors"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 border border-border-subtle text-xs font-semibold overflow-hidden">
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials(u)
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{u.display_name || u.email}</div>
                    {u.display_name && <div className="text-[11px] text-muted truncate">{u.email}</div>}
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-accent shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {error && <div className="px-4 pb-2 text-xs text-danger-text shrink-0">{error}</div>}

        <div className="p-4 pt-3 border-t border-border-subtle shrink-0">
          <button
            onClick={handleSubmit}
            disabled={selected.size === 0 || submitting || done}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 hover:brightness-95 transition-[filter]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done ? (
              <Check className="h-4 w-4" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {done ? "Shared" : selected.size > 0 ? `Share with ${selected.size}` : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

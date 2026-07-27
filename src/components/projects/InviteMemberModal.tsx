"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X, Check, Search, UserPlus } from "lucide-react";

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
 * Recipient picker for adding a member to a team project — same
 * search-existing-users pattern as ShareModal.tsx (debounced /api/users/search,
 * then POST). Single-select and immediate-add (no batch queue) since joining
 * a team project is a bigger deal per-person than sharing one generation.
 */
export function InviteMemberModal({
  projectName,
  existingMemberIds,
  onClose,
  onInvite,
}: {
  projectName: string;
  existingMemberIds: Set<string>;
  onClose: () => void;
  onInvite: (userId: string) => Promise<string | null>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
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

  async function handleAdd(u: SearchedUser) {
    if (addingId || existingMemberIds.has(u.id) || addedIds.has(u.id)) return;
    setAddingId(u.id);
    setError(null);
    const err = await onInvite(u.id);
    setAddingId(null);
    if (err) setError(err);
    else setAddedIds((prev) => new Set(prev).add(u.id));
  }

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[85vh] overflow-hidden rounded-2xl border border-border-subtle bg-surface flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
          <div>
            <span className="text-sm font-semibold">Invite to team project</span>
            <p className="text-[11px] text-muted truncate max-w-[220px]">{projectName}</p>
          </div>
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
          <p className="mt-2 text-[11px] text-muted">
            Only finds people who already have a Revolio account — they get access immediately, no email invite step.
          </p>
        </div>

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
              const already = existingMemberIds.has(u.id) || addedIds.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => handleAdd(u)}
                  disabled={already || addingId === u.id}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-2 transition-colors disabled:hover:bg-transparent"
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
                  {addingId === u.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted shrink-0" />
                  ) : already ? (
                    <Check className="h-4 w-4 text-accent shrink-0" />
                  ) : (
                    <UserPlus className="h-4 w-4 text-muted shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {error && <div className="px-4 py-2 text-xs text-danger-text shrink-0">{error}</div>}
      </div>
    </div>
  );
}

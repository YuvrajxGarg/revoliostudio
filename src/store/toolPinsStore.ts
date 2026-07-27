"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ALL_TOOLS } from "@/lib/tools";

interface ToolPinsState {
  pinnedHrefs: string[];
  /**
   * Every tool href this browser's persisted state has ever known about.
   * Needed to tell apart two cases that otherwise look identical (both are
   * simply "absent from pinnedHrefs"): a tool added to the app after the
   * user's last visit (should auto-pin if defaultPinned) vs. a tool the
   * user explicitly unpinned on purpose (must stay unpinned across
   * refresh). Without this, unpinning any default-pinned tool — Typography
   * Generator, Home, etc. — got silently undone by `merge` on the next reload.
   */
  seenHrefs: string[];
  /**
   * False until the persisted localStorage state has actually been read on
   * the client. The store's initial in-memory value (every `defaultPinned`
   * tool pinned) is only a guess — if the user had actually unpinned one of
   * those tools, `merge` corrects it a tick later once hydration resolves.
   * Consumers (AppSidebar) must not render the pinned-tools nav from
   * `pinnedHrefs` while this is false, or an unpinned default tool (e.g.
   * Typography Generator) visibly flashes in the sidebar for a moment
   * before disappearing once the real state loads — exactly the bug this
   * flag exists to prevent.
   */
  hasHydrated: boolean;
  isPinned: (href: string) => boolean;
  togglePin: (href: string) => void;
  /**
   * Drag-to-reorder support — moves `activeHref` to sit immediately before
   * `overHref` within `pinnedHrefs`. Operates on the single flat array
   * regardless of which sidebar section (Workspace vs Tools) the drag
   * happened in — since both sections are rendered as filtered
   * subsequences of this same array (see AppSidebar.tsx), reinserting
   * `activeHref` next to another item from the same group correctly
   * reorders it within that subsequence without disturbing the other
   * group's relative order. A no-op if either href isn't actually pinned.
   */
  reorderPinned: (activeHref: string, overHref: string) => void;
}

/**
 * Which tools show in the sidebar (Magnific/Higgsfield-style tool drawer +
 * pinning). Starts with every tool pinned EXCEPT ones explicitly opted out
 * via `defaultPinned: false` in tools.ts (the config-driven single-purpose
 * tool studios — Character/Headshot/Logo/etc. — which are meant to stay
 * reachable only via the "All tools" drawer until pinned on purpose, so the
 * sidebar doesn't get crowded). Unpinning (or pinning) any tool from the
 * drawer just toggles it here; nothing is ever deleted, only hidden from
 * the sidebar. Per-browser only via localStorage — same pattern as the
 * sidebar's own collapsed/expanded state, not synced to Supabase since it's
 * pure UI preference, not user data.
 */
export const useToolPinsStore = create<ToolPinsState>()(
  persist(
    (set, get) => ({
      pinnedHrefs: ALL_TOOLS.filter((t) => t.defaultPinned !== false).map((t) => t.href),
      seenHrefs: ALL_TOOLS.map((t) => t.href),
      hasHydrated: false,
      isPinned: (href) => get().pinnedHrefs.includes(href),
      togglePin: (href) =>
        set((state) => ({
          pinnedHrefs: state.pinnedHrefs.includes(href)
            ? state.pinnedHrefs.filter((h) => h !== href)
            : [...state.pinnedHrefs, href],
        })),
      reorderPinned: (activeHref, overHref) =>
        set((state) => {
          if (activeHref === overHref) return state;
          if (!state.pinnedHrefs.includes(activeHref) || !state.pinnedHrefs.includes(overHref)) return state;
          const next = state.pinnedHrefs.filter((h) => h !== activeHref);
          const overIndex = next.indexOf(overHref);
          next.splice(overIndex, 0, activeHref);
          return { pinnedHrefs: next };
        }),
    }),
    {
      name: "revolio-tool-pins",
      storage: createJSONStorage(() => localStorage),
      // Newly-added tools (e.g. the Typography Generator release) should
      // show up pinned by default for existing users too, not silently
      // vanish because their persisted array predates the new href — but a
      // tool the user has already seen and deliberately unpinned must NOT
      // come back. `seenHrefs` is what makes those two cases distinguishable.
      merge: (persisted, current) => {
        const p = persisted as Partial<ToolPinsState> | undefined;
        if (!p?.pinnedHrefs) return current;
        const known = new Set(ALL_TOOLS.map((t) => t.href));
        // Back-compat for state persisted before `seenHrefs` existed: treat
        // everything already in the (old) pinnedHrefs array as seen. This
        // means already-known tools won't get incorrectly re-pinned, only
        // genuinely new hrefs added after this fix will auto-pin.
        const prevSeen = new Set(p.seenHrefs && p.seenHrefs.length > 0 ? p.seenHrefs : p.pinnedHrefs);
        const pinned = new Set(p.pinnedHrefs.filter((h) => known.has(h)));
        for (const t of ALL_TOOLS) {
          if (!prevSeen.has(t.href) && t.defaultPinned !== false) pinned.add(t.href);
        }
        return { ...current, pinnedHrefs: Array.from(pinned), seenHrefs: Array.from(known) };
      },
      // Same proven pattern as composerStore.ts's hydration flag: always
      // flip `hasHydrated`, even on a corrupted/missing persisted blob,
      // so a consumer gating render on it never gets stuck waiting forever.
      onRehydrateStorage: () => () => {
        try {
          useToolPinsStore.setState({ hasHydrated: true });
        } catch {
          useToolPinsStore.setState({ hasHydrated: true });
        }
      },
    }
  )
);

// Safety net — see composerStore.ts's identical block for the full
// rationale (dev-mode HMR, blocked localStorage, etc. can all leave
// `onRehydrateStorage` from firing promptly). Force it true after a short
// grace period no matter what, so the sidebar's pinned-tools nav can never
// get stuck permanently empty.
if (typeof window !== "undefined") {
  setTimeout(() => {
    if (!useToolPinsStore.getState().hasHydrated) {
      useToolPinsStore.setState({ hasHydrated: true });
    }
  }, 400);
}

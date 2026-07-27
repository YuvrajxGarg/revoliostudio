"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Category } from "@/lib/models";
import type { ReferenceImage } from "@/lib/types";

export interface ComposerSettings {
  aspectRatio: string;
  duration?: number;
  resolution?: string;
  numImages: number;
  seed?: number;
  // ── 3D (Meshy) ──────────────────────────────────────────────────────────
  topology?: "triangle" | "quad";
  targetPolycount?: number;
  shouldRemesh?: boolean;
  symmetryMode?: "off" | "auto" | "on";
  enablePbr?: boolean;
  poseMode?: "" | "a-pose" | "t-pose";
  texturePrompt?: string;
  shouldTexture?: boolean;
  meshyMode?: "preview" | "full";
  enablePromptExpansion?: boolean;
  /** Client-side only — muapi has no matching field for this yet. */
  enableSafetyChecker?: boolean;
  // ── Video audio ──────────────────────────────────────────────────────────
  /** Only sent when the selected model's live schema actually exposes an audio-generation field. */
  generateAudio?: boolean;
  // ── OpenAI gpt-image family ──────────────────────────────────────────────
  /** Requests a real alpha-channel PNG via OpenAI's native `background` param. See generate.ts for the server-side equivalent. */
  transparentBackground?: boolean;
  // ── Audio (Suno / MMAudio) ────────────────────────────────────────────
  /** Genre/mood tags, e.g. "upbeat lo-fi hip hop" — sent alongside the main prompt when the model's live schema exposes a distinct style field. */
  musicStyle?: string;
  /** Custom lyrics — left blank to let the model write its own. */
  lyrics?: string;
  /** Skip vocals entirely (music-only). */
  instrumental?: boolean;
}

/**
 * A preset/template that's been "selected" but not yet baked into the
 * visible prompt textarea. Its own `prompt` text is shown as a preview card
 * at the top of the composer (thumbnail + title) instead of being dumped
 * into the textarea — the textarea stays free for the user's own added
 * detail, and the two are combined only at generate time. Mirrors the
 * pattern in Higgsfield's own composer (active-preset card + "Change").
 */
export interface ActivePreset {
  id: string;
  title: string;
  /** The preset's own baked-in instruction — merged with the user's typed prompt at submit time. */
  prompt: string;
  previewVideo?: string;
  previewImage?: string;
  group?: string;
}

/** Everything that should be scoped to one composer (one category) rather than shared globally — see the `_byCategory` doc comment below. */
interface ComposerSlice {
  modelId: string | null;
  prompt: string;
  references: ReferenceImage[];
  startFrame: ReferenceImage | null;
  endFrame: ReferenceImage | null;
  /**
   * A single optional video attached alongside the normal image reference(s)
   * — for models like an i2v/omni-reference model whose live schema also
   * exposes a distinct video field (e.g. a character-replace workflow that
   * takes one image reference + one motion/scene video). Lives in the same
   * slot as `references` in the UI (PromptComposer's ReferenceTray area)
   * rather than requiring a separate Edit Video tab. Unrelated to
   * `startFrame`/`endFrame` (frame-lock models) or the dedicated v2v/motion
   * composers, which already have their own primary video input.
   */
  videoReference: ReferenceImage | null;
  settings: ComposerSettings;
  /** Currently selected preset/template, shown as a preview card — see `ActivePreset` above. */
  activePreset: ActivePreset | null;
}

function emptySlice(): ComposerSlice {
  return {
    modelId: null,
    prompt: "",
    references: [],
    startFrame: null,
    endFrame: null,
    videoReference: null,
    settings: { aspectRatio: "1:1", numImages: 1 },
    activePreset: null,
  };
}

interface ComposerState extends ComposerSlice {
  category: Category;
  isSubmitting: boolean;
  /**
   * False until the persisted localStorage state has actually been read on
   * the client. Consumers (PromptComposer) must not pick or render a
   * "default" model while this is false — reading it lets them show
   * nothing for one tick instead of flashing the registry's first model
   * (e.g. Nano Banana Pro) and then swapping to the real last-used one a
   * moment later, which is what happened before this flag existed.
   */
  hasHydrated: boolean;
  /** Active project every new generation gets tagged with (null = none). */
  projectId: string | null;
  /**
   * Snapshot of every other category's composer, taken the moment you
   * switch away from it. The top-level fields above (prompt, references,
   * modelId, settings, frames) are always "whichever category is active
   * right now" — without this, Image and Video (and every config-driven
   * tool studio) shared one flat prompt/reference/settings, so typing in
   * one and switching tabs — or just refreshing — leaked it into the
   * other. `setCategory` below is what does the swap.
   */
  _byCategory: Partial<Record<Category, ComposerSlice>>;

  setCategory: (c: Category) => void;
  setProjectId: (id: string | null) => void;
  setModelId: (id: string) => void;
  setPrompt: (p: string) => void;
  /** Adds a reference. If `name` is omitted, auto-assigns "Image N". `category` (Reference Library category) is undefined for a plain upload. `promptModifier` carries a curated pick's admin-authored description, stored on the reference so it can be re-assembled into the prompt at generate time. */
  addReference: (url: string, name?: string, max?: number, category?: string, promptModifier?: string) => ReferenceImage | null;
  removeReference: (id: string) => void;
  renameReference: (id: string, name: string) => void;
  setStartFrame: (ref: ReferenceImage | null) => void;
  setEndFrame: (ref: ReferenceImage | null) => void;
  setVideoReference: (ref: ReferenceImage | null) => void;
  updateSettings: (partial: Partial<ComposerSettings>) => void;
  setActivePreset: (preset: ActivePreset | null) => void;
  setSubmitting: (v: boolean) => void;
  resetAfterSubmit: () => void;
}

export const useComposerStore = create<ComposerState>()(
  persist(
    (set, get) => ({
      category: "image",
      ...emptySlice(),
      isSubmitting: false,
      hasHydrated: false,
      projectId: null,
      _byCategory: {},

      setCategory: (c) => {
        const state = get();
        if (state.category === c) return;
        const { modelId, prompt, references, startFrame, endFrame, videoReference, settings, activePreset } = state;
        const byCategory = {
          ...state._byCategory,
          [state.category]: { modelId, prompt, references, startFrame, endFrame, videoReference, settings, activePreset },
        };
        const incoming = byCategory[c] ?? emptySlice();
        set({ category: c, _byCategory: byCategory, ...incoming });
      },
      setProjectId: (id) => set({ projectId: id }),
      setModelId: (id) => set({ modelId: id }),
      setPrompt: (p) => set({ prompt: p }),

      addReference: (url, name, max = 4, category, promptModifier) => {
        const current = get().references;
        if (current.length >= max) return null;
        if (current.some((r) => r.url === url)) return null;
        const autoName = name?.trim() || `Image ${current.length + 1}`;
        const ref: ReferenceImage = { id: nanoid(8), url, name: autoName, category, promptModifier };
        set({ references: [...current, ref] });
        return ref;
      },
      removeReference: (id) =>
        set({ references: get().references.filter((r) => r.id !== id) }),
      renameReference: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set({
          references: get().references.map((r) => (r.id === id ? { ...r, name: trimmed } : r)),
        });
      },

      setStartFrame: (ref) => set({ startFrame: ref }),
      setEndFrame: (ref) => set({ endFrame: ref }),
      setVideoReference: (ref) => set({ videoReference: ref }),

      updateSettings: (partial) =>
        set({ settings: { ...get().settings, ...partial } }),

      setActivePreset: (preset) => set({ activePreset: preset }),

      setSubmitting: (v) => set({ isSubmitting: v }),

      resetAfterSubmit: () =>
        set({ prompt: "", references: [], startFrame: null, endFrame: null, videoReference: null }),
    }),
    {
      // Everything the user set up survives a refresh — prompt, model,
      // settings, references, active project — scoped per category so a
      // refresh restores the composer you were actually looking at, not a
      // merge of whatever every tab last had.
      name: "revolio-composer",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        category: state.category,
        projectId: state.projectId,
        _byCategory: {
          ...state._byCategory,
          [state.category]: {
            modelId: state.modelId,
            prompt: state.prompt,
            references: state.references,
            startFrame: state.startFrame,
            endFrame: state.endFrame,
            videoReference: state.videoReference,
            settings: state.settings,
            activePreset: state.activePreset,
          },
        },
      }),
      // The persisted blob only carries `category` + `_byCategory` (see
      // partialize above) — the top-level fields consumers actually read
      // (prompt, references, modelId, settings, frames) need to be
      // re-derived from `_byCategory[category]` once localStorage loads,
      // otherwise they'd sit at the store's hardcoded initial defaults.
      onRehydrateStorage: () => (state) => {
        // Always flip hasHydrated, even if there was nothing in
        // localStorage yet (brand-new browser) — PromptComposer is waiting
        // on this flag before it picks/renders any model at all.
        try {
          if (!state) {
            useComposerStore.setState({ hasHydrated: true });
            return;
          }
          const slice = state._byCategory?.[state.category] ?? emptySlice();
          useComposerStore.setState({ ...slice, hasHydrated: true });
        } catch {
          // A corrupted/malformed persisted blob (or any other unexpected
          // failure here) must never leave the composer permanently blank —
          // fall back to a clean slate rather than getting stuck.
          useComposerStore.setState({ hasHydrated: true });
        }
      },
    }
  )
);

// Safety net: `onRehydrateStorage`'s callback above is the normal path, but
// nothing guarantees it always fires promptly in every environment (a
// blocked/disabled localStorage, an exception thrown before this file's own
// try/catch was added, a dev-mode hot-reload leaving a stale module
// instance around, etc.) — and every consumer (ModelSelector, ReferenceTray,
// SettingsBar) is gated on `hasHydrated`, so if it never flips true the
// entire composer renders permanently blank with no way to recover short of
// a hard refresh. Force it true after a short grace period no matter what.
if (typeof window !== "undefined") {
  setTimeout(() => {
    if (!useComposerStore.getState().hasHydrated) {
      useComposerStore.setState({ hasHydrated: true });
    }
  }, 400);
}

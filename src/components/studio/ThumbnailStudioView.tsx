"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Plus,
  RotateCcw,
  SquarePlay,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { uploadReferenceFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { formatErrorMessage } from "@/lib/errorFormat";
import { useGenerations } from "@/hooks/useGenerations";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { GenerationCard } from "@/components/gallery/GenerationCard";
import { GridSizeSlider } from "@/components/gallery/GridSizeSlider";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { Generation } from "@/lib/types";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { YouTubePreviewModal } from "@/components/studio/YouTubePreviewModal";
import type { ThumbnailAnalysis } from "@/app/api/thumbnail/analyze/route";
import { buildThumbnailPrompt, resolveThumbnailReferences, type ThumbnailCharacterInput, type SceneImageSource } from "@/lib/thumbnailPrompt";
import {
  EMOTION_PRESETS,
  SCENE_CATEGORIES,
  RIM_LIGHT_COLORS,
  THUMBNAIL_ASPECT_RATIOS,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_RIM_LIGHT_COLOR_ID,
  MAX_CHARACTERS,
  type EmotionPresetId,
  type SceneCategoryId,
} from "@/lib/thumbnailPresets";
import { THUMBNAIL_MODEL_FAMILIES, DEFAULT_THUMBNAIL_MODEL_FAMILY } from "@/lib/thumbnailModels";

const TOOL_ID = "thumbnail";

// Longer, scene-ready phrasing for each quick-pick button — clicking one
// fills the category's text field with this instead of just the short
// button label, so it reads like a real description from the start.
const SCENE_PRESET_DESCRIPTIONS: Record<string, string> = {
  "Selfie mid-action": "A tight selfie-style shot capturing the subject mid-action, arm slightly in frame, energy frozen at its peak.",
  "Pointing at the reveal": "The subject points dramatically toward the main reveal, body angled toward camera, a big reaction on their face.",
  "Close-up reaction": "An extreme close-up on the subject's face, capturing a huge, exaggerated reaction.",
  "Running / escape": "The subject is caught mid-run or mid-escape, motion and urgency frozen in the frame.",
  "Money rain": "Cash bills frozen mid-air, raining down around the subject.",
  "Fire vs Ice": "A dramatic fire-versus-ice visual split — flames on one side, frost and ice on the other.",
  "Half 3D-clay render": "Half of the frame rendered in a stylized 3D-clay look, contrasting with the photoreal half.",
  "Arrows + highlight": "Bold graphic arrows and a glowing highlight circle draw the eye straight to the key object.",
  "Rooftop daylight": "A rooftop setting in bright daylight, open sky in the background.",
  "Neon night city": "A neon-lit city street at night, glowing signage and wet pavement reflections.",
  "Luxury mansion": "An opulent mansion interior — marble, gold accents, dramatic scale.",
  "Desert wasteland": "A stark desert wasteland, dry cracked ground stretching to the horizon.",
  "Subject right third": "Subject placed in the right third of the frame, eye-level camera, clean negative space on the left.",
  "Centered power pose": "Subject centered in frame in a strong, symmetrical power pose.",
  "Dutch-angle chaos": "A tilted dutch-angle shot amplifying the chaos and energy of the moment.",
  "Big foreground object": "A large foreground object anchors the shot, subject slightly behind it for depth.",
  "Dissolving 3D grid": "The background dissolves into a stylized glowing 3D grid pattern.",
  "Explosive light rays": "Bright light rays burst outward from behind the subject.",
  "Blurred chaos": "A heavily blurred, chaotic background keeps all focus on the subject.",
  "Clean studio gradient": "A smooth, clean solid-color studio gradient background.",
};

interface CharacterState {
  id: string;
  photoUrl: string | null;
  uploading: boolean;
  emotionPresetId: EmotionPresetId;
  emotionCustom: string;
}

type Step = 1 | 2 | 3 | 4;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "Reference" },
  { id: 2, label: "Casting" },
  { id: 3, label: "Scene" },
  { id: 4, label: "Render" },
];

function newCharacter(emotionPresetId: EmotionPresetId = "charismatic_calm"): CharacterState {
  return { id: crypto.randomUUID(), photoUrl: null, uploading: false, emotionPresetId, emotionCustom: "" };
}

function emptySceneImages(): Record<SceneCategoryId, string | null> {
  return {
    subjectActionPose: null,
    keyElements: null,
    location: null,
    composition: null,
    backgroundTreatment: null,
  };
}

function emptySceneImageUploading(): Record<SceneCategoryId, boolean> {
  return {
    subjectActionPose: false,
    keyElements: false,
    location: false,
    composition: false,
    backgroundTreatment: false,
  };
}

export function ThumbnailStudioView() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 — reference (optional)
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ThumbnailAnalysis | null>(null);
  // Whether the uploaded reference is ALSO attached as a loose layout/mood
  // image guide (lowest priority in the 4-image budget) — on by default once
  // a reference exists, but the user can opt out and use it purely for the
  // text analysis that seeds the Scene fields.
  const [useReferenceAsGuide, setUseReferenceAsGuide] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [frameLayout, setFrameLayout] = useState<"single" | "split">("single");

  // Step 2 — casting
  const [peopleEnabled, setPeopleEnabled] = useState(true);
  const [characters, setCharacters] = useState<CharacterState[]>([newCharacter()]);

  // Step 3 — scene
  const [subjectActionPose, setSubjectActionPose] = useState("");
  const [keyElements, setKeyElements] = useState("");
  const [location, setLocation] = useState("");
  const [composition, setComposition] = useState("");
  const [backgroundTreatment, setBackgroundTreatment] = useState("");
  const [rimLightColorId, setRimLightColorId] = useState(DEFAULT_RIM_LIGHT_COLOR_ID);
  const [bakeText, setBakeText] = useState(false);
  const [bakedText, setBakedText] = useState("");
  // Optional per-category reference photo (e.g. a real product shot for
  // "Key elements") — a second image channel alongside character face
  // photos, sharing the same 4-image budget (see resolveThumbnailReferences).
  const [sceneImages, setSceneImages] = useState<Record<SceneCategoryId, string | null>>(emptySceneImages());
  const [sceneImageUploading, setSceneImageUploading] = useState<Record<SceneCategoryId, boolean>>(emptySceneImageUploading());

  // Step 4 — render
  const [modelFamily, setModelFamily] = useState(DEFAULT_THUMBNAIL_MODEL_FAMILY);
  const [numVariations, setNumVariations] = useState(1);
  const [promptDraft, setPromptDraft] = useState("");
  const [promptTouched, setPromptTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [previewGeneration, setPreviewGeneration] = useState<Generation | null>(null);
  const [colWidth, setColWidth] = usePersistentState("revolio-grid-width", 220);

  // Main panel now has two views: "generate" (the current/latest render,
  // shown big — the Higgsfield-style single-result canvas) and "gallery"
  // (every past render, in the old grid). Defaults to "generate" and jumps
  // there automatically the moment a new render is submitted, so hitting
  // Render always surfaces the thing that just started.
  const [mainTab, setMainTab] = useState<"generate" | "gallery">("generate");

  const referenceInputRef = useRef<HTMLInputElement>(null);

  const { items, loading, hasMore, loadMore, prepend, removeItem, pollNow } = useGenerations(undefined, {
    toolId: TOOL_ID,
  });

  async function handleUploadReference(file: File) {
    setReferenceUploading(true);
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setReferenceUrl(url);
      setUseReferenceAsGuide(true);
      setAnalyzing(true);
      const res = await fetch("/api/thumbnail/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Analysis failed");
      }
      const result = (await res.json()) as ThumbnailAnalysis;
      setAnalysis(result);
      setSubjectActionPose(result.subjectActionPose);
      setKeyElements(result.keyElements);
      setLocation(result.location);
      setComposition(result.composition);
      setBackgroundTreatment(result.backgroundTreatment);
      setPeopleEnabled(result.peopleCount > 0);
      setCharacters(
        result.peopleCount > 0
          ? Array.from({ length: result.peopleCount }, (_, i) => newCharacter(result.suggestedEmotions[i] ?? "charismatic_calm"))
          : [newCharacter()]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze reference");
    } finally {
      setReferenceUploading(false);
      setAnalyzing(false);
    }
  }

  function clearReference() {
    setReferenceUrl(null);
    setAnalysis(null);
    setUseReferenceAsGuide(true);
  }

  async function handleSceneImageUpload(categoryId: SceneCategoryId, file: File) {
    setSceneImageUploading((prev) => ({ ...prev, [categoryId]: true }));
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setSceneImages((prev) => ({ ...prev, [categoryId]: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setSceneImageUploading((prev) => ({ ...prev, [categoryId]: false }));
    }
  }

  function removeSceneImage(categoryId: SceneCategoryId) {
    setSceneImages((prev) => ({ ...prev, [categoryId]: null }));
  }

  function updateCharacter(id: string, patch: Partial<CharacterState>) {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function handleCharacterPhoto(id: string, file: File) {
    updateCharacter(id, { uploading: true });
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      updateCharacter(id, { photoUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      updateCharacter(id, { uploading: false });
    }
  }

  function addCharacter() {
    if (characters.length >= MAX_CHARACTERS) return;
    setCharacters((prev) => [...prev, newCharacter()]);
  }

  function removeCharacter(id: string) {
    setCharacters((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  }

  const characterInputs: ThumbnailCharacterInput[] = useMemo(
    () =>
      peopleEnabled
        ? characters.map((c) => ({ emotionPresetId: c.emotionPresetId, emotionCustom: c.emotionCustom }))
        : [],
    [peopleEnabled, characters]
  );

  // Category text values, in the same order/shape used by the server's
  // CATEGORY_TEXT lookup — kept here so a scene image's ELEMENT REFERENCE
  // line can carry its category's current description.
  const sceneCategoryValues: Record<SceneCategoryId, string> = useMemo(
    () => ({ subjectActionPose, keyElements, location, composition, backgroundTreatment }),
    [subjectActionPose, keyElements, location, composition, backgroundTreatment]
  );

  const sceneImageSources: SceneImageSource[] = useMemo(
    () =>
      SCENE_CATEGORIES.filter((cat) => sceneImages[cat.id]).map((cat) => ({
        categoryLabel: cat.label,
        description: sceneCategoryValues[cat.id],
        imageUrl: sceneImages[cat.id]!,
      })),
    [sceneImages, sceneCategoryValues]
  );

  // Same priority-ordered budget resolver the server uses (characters >
  // scene elements > loose layout guide), so the live preview here always
  // matches exactly what actually gets submitted.
  const resolvedReferences = useMemo(
    () =>
      resolveThumbnailReferences({
        characterPhotoUrls: characterInputs.map((_, i) => characters[i]?.photoUrl).filter((u): u is string => !!u),
        sceneImages: sceneImageSources,
        layoutReferenceUrl: useReferenceAsGuide ? referenceUrl : null,
      }),
    [characterInputs, characters, sceneImageSources, useReferenceAsGuide, referenceUrl]
  );

  const computedPrompt = useMemo(
    () =>
      buildThumbnailPrompt({
        frameLayout,
        aspectRatio,
        characters: characterInputs,
        sceneImageRefs: resolvedReferences.sceneImageRefs,
        subjectActionPose: subjectActionPose.trim() || "The main subject reacts directly to camera",
        keyElements,
        location: location.trim() || "A simple, clean studio background",
        composition,
        backgroundTreatment,
        rimLightColorId,
        bakedText: bakeText ? bakedText : null,
        hasLayoutReference: resolvedReferences.hasLayoutReference,
      }),
    [frameLayout, aspectRatio, characterInputs, resolvedReferences, subjectActionPose, keyElements, location, composition, backgroundTreatment, rimLightColorId, bakeText, bakedText]
  );

  // The Render step's textarea always mirrors the computed prompt UNTIL the
  // user actually edits it — after that, their edit wins even if they flip
  // back and tweak an earlier step, since they've taken over authorship.
  useEffect(() => {
    if (!promptTouched) setPromptDraft(computedPrompt);
  }, [computedPrompt, promptTouched]);

  function goToStep(target: Step) {
    setError(null);
    setStep(target);
  }

  function handleNext() {
    if (step === 3) {
      if (!subjectActionPose.trim()) {
        setError('"Subject action and pose" is required');
        return;
      }
      if (!location.trim()) {
        setError('"Location" is required');
        return;
      }
    }
    setError(null);
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  }

  function handleReset() {
    setStep(1);
    setReferenceUrl(null);
    setAnalysis(null);
    setUseReferenceAsGuide(true);
    setAspectRatio(DEFAULT_ASPECT_RATIO);
    setFrameLayout("single");
    setPeopleEnabled(true);
    setCharacters([newCharacter()]);
    setSubjectActionPose("");
    setKeyElements("");
    setLocation("");
    setComposition("");
    setBackgroundTreatment("");
    setRimLightColorId(DEFAULT_RIM_LIGHT_COLOR_ID);
    setBakeText(false);
    setBakedText("");
    setSceneImages(emptySceneImages());
    setSceneImageUploading(emptySceneImageUploading());
    setPromptTouched(false);
    setError(null);
  }

  async function handleGenerate() {
    if (submitting) return;
    if (!subjectActionPose.trim() || !location.trim()) {
      setError("Fill in the required Scene fields first");
      setStep(3);
      return;
    }
    if (peopleEnabled && characters.some((c) => !c.photoUrl)) {
      setError("Every character needs a face photo");
      setStep(2);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/thumbnail/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frameLayout,
          aspectRatio,
          characters: peopleEnabled
            ? characters.map((c) => ({ photoUrl: c.photoUrl, emotionPresetId: c.emotionPresetId, emotionCustom: c.emotionCustom }))
            : [],
          referenceImageUrl: useReferenceAsGuide ? referenceUrl : null,
          sceneImages: Object.fromEntries(
            SCENE_CATEGORIES.filter((cat) => sceneImages[cat.id]).map((cat) => [cat.id, sceneImages[cat.id]])
          ),
          subjectActionPose,
          keyElements,
          location,
          composition,
          backgroundTreatment,
          rimLightColorId,
          bakedText: bakeText ? bakedText : null,
          numVariations,
          modelFamily,
          prompt: promptDraft,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed to start");
      }
      const submitted = (await res.json()) as Generation;
      prepend(submitted);
      pollNow(submitted.id);
      setMainTab("generate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // Everything below the header lives in one centered column now — no left
  // rail. The Generate tab is the wizard (stepper + current step's card +
  // nav) with the live result shown big, above the stepper, once one exists
  // — like a canvas sitting above its own controls. The Gallery tab breaks
  // out to the full panel width since a packed grid wants the space.
  const stepCard = (
    <>
      {/* Step 1 — Reference */}
        {step === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted leading-relaxed">
              Upload a thumbnail whose look you want to build on — yours, a competitor's, anything. It gets broken
              down into the archetype, action, location, and styling that seed every field below, so Casting and
              Scene start from a strong, specific direction instead of a blank page. You can attach the image itself
              as a loose layout guide when rendering, or skip that and use it for the breakdown only. Skipping this
              step entirely works too, but you'll be filling in every field by hand from scratch.
            </p>

            {!referenceUrl ? (
              <button
                onClick={() => referenceInputRef.current?.click()}
                disabled={referenceUploading}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-subtle py-8 text-muted hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
              >
                {referenceUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <span className="text-xs">{referenceUploading ? "Uploading…" : "Upload a reference image"}</span>
              </button>
            ) : (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={referenceUrl} alt="" className="w-full rounded-xl border border-border-subtle object-cover aspect-video" />
                <button
                  onClick={clearReference}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground shadow-md hover:bg-danger/10 hover:text-danger-text"
                >
                  <X className="h-3 w-3" />
                </button>
                {analyzing && (
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-xl bg-black/60 text-xs text-white">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…
                  </div>
                )}
              </div>
            )}

            {referenceUrl && (
              <label className="flex items-start gap-2 rounded-xl border border-border-subtle bg-surface-2 p-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={useReferenceAsGuide}
                  onChange={(e) => setUseReferenceAsGuide(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-foreground">Use as layout reference</span>
                  <span className="block text-[11px] text-muted">
                    Attach this image to the render as a loose framing/mood guide (lowest priority if the 4-image
                    budget is full). Turn off to use it only for the text analysis above.
                  </span>
                </span>
              </label>
            )}
            <input
              ref={referenceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadReference(f);
                e.target.value = "";
              }}
            />

            {analysis && (
              <div className="rounded-xl border border-border-subtle bg-surface-2 p-2.5 text-xs text-muted">
                <span className="font-medium text-foreground">{analysis.archetype}</span> — scene fields on the next
                steps were pre-filled from this reference; edit anything you like.
              </div>
            )}

            <div>
              <div className="panel-label mb-1.5">Aspect ratio</div>
              <div className="flex flex-wrap gap-1.5">
                {THUMBNAIL_ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar.id}
                    onClick={() => setAspectRatio(ar.id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      aspectRatio === ar.id
                        ? "border-accent/60 bg-accent/10 text-foreground"
                        : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
                    )}
                  >
                    {ar.label}
                    {ar.note && <span className="ml-1 text-[10px] text-muted">{ar.note}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="panel-label mb-1.5">Frame layout</div>
              <div className="flex gap-1.5">
                {(["single", "split"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFrameLayout(v)}
                    className={cn(
                      "flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      frameLayout === v
                        ? "border-accent/60 bg-accent/10 text-foreground"
                        : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
                    )}
                  >
                    {v === "single" ? "Single unified frame" : "Split frame"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Casting */}
        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div>
              <div className="panel-label mb-1.5">People in the thumbnail?</div>
              <div className="flex gap-1.5">
                {([true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setPeopleEnabled(v)}
                    className={cn(
                      "flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      peopleEnabled === v
                        ? "border-accent/60 bg-accent/10 text-foreground"
                        : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
                    )}
                  >
                    {v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted">Up to {MAX_CHARACTERS} characters.</p>
            </div>

            {peopleEnabled && (
              <div className="flex flex-col gap-3">
                {characters.map((c, i) => (
                  <div key={c.id} className="rounded-xl border border-border-subtle bg-surface-2 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Character {i + 1}</span>
                      {characters.length > 1 && (
                        <button onClick={() => removeCharacter(c.id)} className="text-muted hover:text-danger-text">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      {c.photoUrl ? (
                        <div className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border border-border-subtle">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={c.photoUrl}
                            alt=""
                            onClick={() => setViewingUrl(c.photoUrl)}
                            className="h-full w-full object-cover cursor-pointer hover:brightness-90"
                          />
                          <button
                            onClick={() => updateCharacter(c.id, { photoUrl: null })}
                            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground shadow-md hover:bg-danger/10 hover:text-danger-text"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border-subtle text-muted hover:text-foreground hover:border-foreground/40">
                          {c.uploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleCharacterPhoto(c.id, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                      <span className="text-[11px] text-muted">Face photo</span>
                    </div>

                    <div className="mt-2.5">
                      <div className="panel-label mb-1">Cast the emotion</div>
                      <div className="grid grid-cols-2 gap-1">
                        {EMOTION_PRESETS.map((e) => (
                          <button
                            key={e.id}
                            onClick={() => updateCharacter(c.id, { emotionPresetId: e.id })}
                            className={cn(
                              "truncate rounded-md border px-2 py-1 text-left text-[11px] transition-colors",
                              c.emotionPresetId === e.id
                                ? "border-accent/60 bg-accent/10 text-foreground"
                                : "border-border-subtle bg-surface text-muted hover:text-foreground"
                            )}
                          >
                            {e.label}
                          </button>
                        ))}
                      </div>
                      {c.emotionPresetId === "other" && (
                        <input
                          value={c.emotionCustom}
                          onChange={(e) => updateCharacter(c.id, { emotionCustom: e.target.value })}
                          placeholder="Describe the expression…"
                          className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent"
                        />
                      )}
                    </div>
                  </div>
                ))}

                {characters.length < MAX_CHARACTERS && (
                  <button
                    onClick={addCharacter}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-subtle py-2 text-xs text-muted hover:text-foreground hover:border-foreground/40"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add character
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Scene */}
        {step === 3 && (
          <div className="flex flex-col gap-3">
            {SCENE_CATEGORIES.map((cat) => (
              <SceneCategoryField
                key={cat.id}
                categoryId={cat.id}
                label={cat.label}
                required={cat.required}
                presets={cat.presets}
                value={
                  cat.id === "subjectActionPose"
                    ? subjectActionPose
                    : cat.id === "keyElements"
                      ? keyElements
                      : cat.id === "location"
                        ? location
                        : cat.id === "composition"
                          ? composition
                          : backgroundTreatment
                }
                onChange={(v) => {
                  if (cat.id === "subjectActionPose") setSubjectActionPose(v);
                  else if (cat.id === "keyElements") setKeyElements(v);
                  else if (cat.id === "location") setLocation(v);
                  else if (cat.id === "composition") setComposition(v);
                  else setBackgroundTreatment(v);
                }}
                imageUrl={sceneImages[cat.id]}
                uploading={sceneImageUploading[cat.id]}
                onUploadImage={(file) => handleSceneImageUpload(cat.id, file)}
                onRemoveImage={() => removeSceneImage(cat.id)}
              />
            ))}

            <div>
              <div className="panel-label mb-1.5">Rim light color</div>
              <div className="flex flex-wrap gap-1.5">
                {RIM_LIGHT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    title={c.label}
                    onClick={() => setRimLightColorId(c.id)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors",
                      rimLightColorId === c.id ? "border-accent" : "border-transparent"
                    )}
                  >
                    <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: c.swatch }} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="panel-label mb-1.5">Text baked into the image?</div>
              <div className="flex gap-1.5">
                {([false, true] as const).map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setBakeText(v)}
                    className={cn(
                      "flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      bakeText === v
                        ? "border-accent/60 bg-accent/10 text-foreground"
                        : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
                    )}
                  >
                    {v ? "Yes, bake text" : "No text (recommended)"}
                  </button>
                ))}
              </div>
              {bakeText && (
                <input
                  value={bakedText}
                  onChange={(e) => setBakedText(e.target.value)}
                  placeholder="The exact words to render…"
                  className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent"
                />
              )}
            </div>
          </div>
        )}

        {/* Step 4 — Render */}
        {step === 4 && (
          <div className="flex flex-col gap-3">
            <div>
              <div className="panel-label mb-1.5">Image model</div>
              <div className="flex flex-col gap-1.5">
                {THUMBNAIL_MODEL_FAMILIES.map((family) => (
                  <button
                    key={family.id}
                    onClick={() => setModelFamily(family.id)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                      modelFamily === family.id
                        ? "border-accent/60 bg-accent/10"
                        : "border-border-subtle bg-surface-2 hover:border-foreground/30"
                    )}
                  >
                    <span className="text-xs font-medium">{family.label}</span>
                    <span className="text-[10px] text-muted">{family.tagline}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="panel-label mb-1.5">Variations</div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumVariations(n)}
                    className={cn(
                      "flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors",
                      numVariations === n
                        ? "border-accent/60 bg-accent/10 text-foreground"
                        : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div className="panel-label">Assembled prompt</div>
                {promptTouched && (
                  <button
                    onClick={() => {
                      setPromptTouched(false);
                      setPromptDraft(computedPrompt);
                    }}
                    className="text-[11px] text-muted hover:text-foreground"
                  >
                    Reset to auto
                  </button>
                )}
              </div>
              <textarea
                value={promptDraft}
                onChange={(e) => {
                  setPromptTouched(true);
                  setPromptDraft(e.target.value);
                }}
                rows={10}
                className="mt-1 w-full resize-y rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-[11px] leading-relaxed outline-none focus:border-accent"
              />
              <p className="mt-1 text-[10px] text-muted">Edit freely — this exact text is what gets sent to the image model.</p>
            </div>

            {/* The current/latest render — only shown here, on the Render
                step itself, once one exists. Not shown on the earlier steps
                or anywhere above the wizard. */}
            {items[0] && (
              <div className="pt-1">
                <div className="panel-label mb-1.5">Current render</div>
                <CurrentGenerationPanel
                  generation={items[0]}
                  onDeleted={removeItem}
                  onPreview={setPreviewGeneration}
                  onOpenGallery={() => setMainTab("gallery")}
                />
              </div>
            )}
          </div>
        )}
    </>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-3 pb-6 pt-3">
      {/* Header — title/reset on the left, Generate/Gallery tabs on the
          right, both centered to the same column width the wizard uses
          below so nothing here reads as a sidebar. */}
      <div className="mx-auto flex w-full max-w-2xl shrink-0 items-center justify-between pb-4">
        <h1 className="text-base font-semibold flex items-center gap-1.5">
          <SquarePlay className="h-4 w-4" /> Thumbnail Generator
        </h1>
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 p-0.5">
          <button
            onClick={() => setMainTab("generate")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              mainTab === "generate" ? "bg-accent text-white" : "text-muted hover:text-foreground"
            )}
          >
            <Wand2 className="h-3.5 w-3.5" /> Generate
          </button>
          <button
            onClick={() => setMainTab("gallery")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              mainTab === "gallery" ? "bg-accent text-white" : "text-muted hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Gallery
            {items.length > 0 && <span className="text-[10px] opacity-70">({items.length})</span>}
          </button>
        </div>
      </div>

      {mainTab === "gallery" ? (
        // Gallery intentionally breaks out to the full panel width — a
        // packed justified-rows grid wants the space a centered column
        // would waste.
        <div className="flex flex-col gap-3">
          {items.length > 0 && (
            <div className="flex justify-end">
              <GridSizeSlider value={colWidth} onChange={setColWidth} />
            </div>
          )}
          <GenerationGrid
            items={items}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            emptyLabel="Your generated thumbnails will appear here — walk through Reference, Casting, and Scene, then Render."
            onDeleted={removeItem}
            onPreview={setPreviewGeneration}
            columnWidth={colWidth}
          />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          {/* Stepper */}
          <div className="flex items-center justify-center">
            {STEPS.map((s, i) => (
              <div key={s.id} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                <button
                  onClick={() => goToStep(s.id)}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap text-sm font-medium",
                    step === s.id ? "text-accent" : step > s.id ? "text-foreground/70" : "text-muted"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                      step === s.id ? "bg-accent text-white" : step > s.id ? "bg-foreground/20" : "bg-surface-2"
                    )}
                  >
                    {step > s.id ? <Check className="h-3 w-3" /> : s.id}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <div className="mx-3 h-px flex-1 bg-border-subtle" />}
              </div>
            ))}
          </div>

          {/* Step content, in its own centered card */}
          <div className="rounded-2xl border border-border-subtle/60 bg-surface/50 backdrop-blur-md shadow-lg p-5">
            {stepCard}
          </div>

          {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => goToStep((step - 1) as Step)}
                className="flex items-center justify-center gap-1 rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-medium hover:bg-surface-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={handleNext}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-2 transition-colors py-2.5"
              >
                Next <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40 hover:bg-accent-2 transition-colors py-2.5"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SquarePlay className="h-4 w-4" />}
                {submitting ? "Rendering…" : "Render"}
              </button>
            )}
          </div>

          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle px-3 py-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        </div>
      )}

      {viewingUrl && <ImageLightbox url={viewingUrl} onClose={() => setViewingUrl(null)} />}
      {previewGeneration?.output_urls?.[0] && (
        <YouTubePreviewModal imageUrl={previewGeneration.output_urls[0]} onClose={() => setPreviewGeneration(null)} />
      )}
    </div>
  );
}

/**
 * The "Generate" tab's main-panel content — a single big view of the most
 * recent render (queued/processing/completed/failed), reusing GenerationCard
 * as-is so it inherits the exact same behavior every other gallery gets for
 * free: the in-progress dot-ripple overlay, the failed-state retry/delete,
 * the hover toolbar (download, favorite, "Preview in feed", use as
 * reference, delete), and multi-output browsing via the detail viewer. This
 * intentionally does NOT reimplement any of that — it's the same card, just
 * shown alone and large instead of packed into a grid.
 */
function CurrentGenerationPanel({
  generation,
  onDeleted,
  onPreview,
  onOpenGallery,
}: {
  generation: Generation | null;
  onDeleted: (id: string) => void;
  onPreview: (generation: Generation) => void;
  onOpenGallery: () => void;
}) {
  if (!generation) {
    return (
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-2 text-center text-muted">
        <SquarePlay className="h-8 w-8 opacity-30" />
        <p className="max-w-xs text-sm">
          Your generated thumbnail will appear here — walk through Reference, Casting, and Scene, then hit Render.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 py-4">
      <div className="w-full max-w-2xl">
        <GenerationCard generation={generation} onDeleted={onDeleted} onPreview={onPreview} />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <span>{generation.model_label}</span>
        {generation.output_urls.length > 1 && <span>· {generation.output_urls.length} variations — click to browse</span>}
        <button onClick={onOpenGallery} className="underline hover:text-foreground">
          View all renders
        </button>
      </div>
    </div>
  );
}

function SceneCategoryField({
  categoryId,
  label,
  required,
  presets,
  value,
  onChange,
  imageUrl,
  uploading,
  onUploadImage,
  onRemoveImage,
}: {
  categoryId: SceneCategoryId;
  label: string;
  required: boolean;
  presets: string[];
  value: string;
  onChange: (value: string) => void;
  imageUrl: string | null;
  uploading: boolean;
  onUploadImage: (file: File) => void;
  onRemoveImage: () => void;
}) {
  const activePreset = presets.find((p) => SCENE_PRESET_DESCRIPTIONS[p] === value) ?? null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="panel-label">
          {label}
          {required ? <span className="text-danger-text"> *</span> : <span className="text-muted"> · optional</span>}
        </div>
        {imageUrl ? (
          <div className="relative h-8 w-8 shrink-0 rounded-md overflow-hidden border border-border-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            <button
              onClick={onRemoveImage}
              className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground shadow-md hover:bg-danger/10 hover:text-danger-text"
            >
              <X className="h-2 w-2" />
            </button>
          </div>
        ) : (
          <label
            title="Attach a real reference photo for this category"
            className="flex h-6 items-center gap-1 rounded-md border border-dashed border-border-subtle px-1.5 text-[10px] text-muted hover:text-foreground hover:border-foreground/40 cursor-pointer"
          >
            {uploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <ImagePlus className="h-2.5 w-2.5" />}
            Ref photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadImage(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange(SCENE_PRESET_DESCRIPTIONS[p] ?? p)}
            className={cn(
              "rounded-md border px-2 py-1 text-[11px] transition-colors",
              activePreset === p
                ? "border-accent/60 bg-accent/10 text-foreground"
                : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
            )}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => {
            /* "Other" doesn't overwrite existing text — it just signals
               free-form mode; the textarea below is always the real value. */
          }}
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] transition-colors",
            !activePreset
              ? "border-accent/60 bg-accent/10 text-foreground"
              : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
          )}
        >
          Other
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={`Describe the ${label.toLowerCase()}…`}
        className="mt-1.5 w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs leading-relaxed outline-none placeholder:text-muted focus:border-accent"
        id={categoryId}
      />
    </div>
  );
}

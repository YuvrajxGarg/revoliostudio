"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Check,
  Download,
  Eye,
  Fingerprint,
  Loader2,
  RotateCcw,
  Scan,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { uploadReferenceFile } from "@/lib/upload";
import { useUserReferences } from "@/hooks/useUserReferences";
import { formatErrorMessage } from "@/lib/errorFormat";
import { formatCostUSD, formatCostINR } from "@/lib/pricing";
import { compositeCharacterSheetPoster } from "@/lib/characterSheetCompositor";
import {
  SECTION_ORDER,
  SECTION_LABELS,
  SECTION_STAGE_LABELS,
  DEFAULT_SELECTED_SLOT_IDS,
  currentSection,
} from "@/lib/characterSheetSlots";
import { DEFAULT_CHARACTER_MODEL_ID, getCharacterModelOption } from "@/lib/characterSheetModels";
import { ShotPicker } from "./ShotPicker";
import { FaceScanOverlay, ScanTerminal } from "./FaceScanOverlay";
import { CharacterModelSelector } from "./CharacterModelSelector";
import type { CharacterSheet, CharacterSheetQuality } from "@/lib/characterSheet-types";

const POLL_INTERVAL_MS = 2000;

export function GenerateTab({
  pendingFaceUrl,
  onConsumePendingFaceUrl,
}: {
  /** Set by CharacterStudioView when "Use this character" is picked in My
   * Characters — consumed once (see the effect below) rather than kept as
   * a controlled prop, since the user should be free to upload something
   * else afterward without this snapping back. */
  pendingFaceUrl?: string | null;
  onConsumePendingFaceUrl?: () => void;
}) {
  const [faceUrl, setFaceUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [quality, setQuality] = useState<CharacterSheetQuality>("compact");
  const [modelId, setModelId] = useState(DEFAULT_CHARACTER_MODEL_ID);
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(() => new Set(DEFAULT_SELECTED_SLOT_IDS));
  const [starting, setStarting] = useState(false);
  const [sheet, setSheet] = useState<CharacterSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compositing, setCompositing] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [showSaveRow, setShowSaveRow] = useState(false);
  const [saveNameDraft, setSaveNameDraft] = useState("");
  const [savingCharacter, setSavingCharacter] = useState(false);
  const [saved, setSaved] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { saveUserReference } = useUserReferences();

  const modelOption = getCharacterModelOption(modelId);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!sheet || sheet.status !== "generating") return;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/character-sheet/${sheet.id}`);
      if (res.ok) setSheet(await res.json());
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sheet]);

  // Once every shot has settled, composite the poster client-side — see
  // characterSheetCompositor.ts. A failed/missing shot still renders (as a
  // placeholder tile), so this always runs once, not per-slot.
  useEffect(() => {
    if (!sheet || sheet.status !== "completed" || posterUrl || compositing) return;
    setCompositing(true);
    const images = sheet.slots.map((slot) => ({
      slot,
      proxyUrl: slot.status === "completed" ? `/api/character-sheet/${sheet.id}/image?slot=${slot.index}` : null,
    }));
    compositeCharacterSheetPoster(images)
      .then((blob) => setPosterUrl(URL.createObjectURL(blob)))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to build the poster"))
      .finally(() => setCompositing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.status]);

  useEffect(() => () => {
    if (posterUrl) URL.revokeObjectURL(posterUrl);
  }, [posterUrl]);

  function resetForNewSource() {
    setSheet(null);
    setPosterUrl(null);
    setShowSaveRow(false);
    setSaveNameDraft("");
    setSaved(false);
  }

  // Full reset, not just "new source" — also drops the photo itself and the
  // shot selection back to the curated default, so a user who wants to try a
  // completely different character isn't left with a stale selection from
  // the last run.
  function startOver() {
    setFaceUrl(null);
    resetForNewSource();
    setSelectedSlotIds(new Set(DEFAULT_SELECTED_SLOT_IDS));
    setQuality("compact");
    setModelId(DEFAULT_CHARACTER_MODEL_ID);
    setError(null);
  }

  useEffect(() => {
    if (!pendingFaceUrl) return;
    setFaceUrl(pendingFaceUrl);
    resetForNewSource();
    onConsumePendingFaceUrl?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFaceUrl]);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadReferenceFile(file);
      setFaceUrl(url);
      resetForNewSource();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload this photo");
    } finally {
      setUploading(false);
    }
  }

  function toggleSlot(id: string) {
    setSelectedSlotIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate() {
    if (!faceUrl || starting || selectedSlotIds.size === 0) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/character-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceUrl,
          quality,
          modelId,
          selectedSlotIds: Array.from(selectedSlotIds),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start this sheet");
      setSheet(data as CharacterSheet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStarting(false);
    }
  }

  // Manual save, on request — never assumed. The name defaults to a blank
  // field the user fills in themselves (a truncated anchor phrase would be
  // an odd default to have to overwrite), per the user's own "ask me, don't
  // assume" request.
  async function handleConfirmSave() {
    if (!faceUrl || !saveNameDraft.trim() || savingCharacter) return;
    setSavingCharacter(true);
    // Carry the sheet's own generated shots along with the saved character —
    // raw outputUrl values (not the /api/character-sheet/[id]/image proxy,
    // which is only needed to keep the poster canvas untainted and has no
    // reason to outlive that one sheet row) so Library still shows them if
    // this character_sheets row is ever cleaned up later.
    const shotUrls =
      sheet?.slots.filter((s) => s.status === "completed" && s.outputUrl).map((s) => s.outputUrl!) ?? [];
    // The composited poster only exists as an in-memory blob URL (posterUrl)
    // until now — re-fetch it as a real Blob and persist it to Storage so
    // Library has an actual URL to show/download later, not just this tab's
    // ephemeral object URL.
    let posterStorageUrl: string | undefined;
    if (posterUrl) {
      try {
        const blob = await fetch(posterUrl).then((r) => r.blob());
        const file = new File([blob], "character-sheet-poster.png", { type: "image/png" });
        const { url } = await uploadReferenceFile(file);
        posterStorageUrl = url;
      } catch {
        // Non-fatal — the character still saves with its face photo + shots,
        // just without a poster preview.
      }
    }
    const err = await saveUserReference({
      category: "character",
      name: saveNameDraft.trim(),
      image_url: faceUrl,
      source: "upload",
      shot_urls: shotUrls,
      poster_url: posterStorageUrl,
    });
    setSavingCharacter(false);
    if (!err) {
      setSaved(true);
      setShowSaveRow(false);
    } else {
      setError(err);
    }
  }

  const completedCount = sheet?.slots.filter((s) => s.status === "completed" || s.status === "failed").length ?? 0;
  const totalCount = sheet?.slots.length ?? selectedSlotIds.size;
  const section = sheet ? currentSection(sheet.slots) : null;
  const buttonLabel = starting
    ? "Analyzing photo…"
    : sheet?.status === "generating" && section
      ? SECTION_STAGE_LABELS[section]
      : sheet?.status === "generating"
        ? "Finishing up…"
        : "Generate sheet";
  const busy = starting || sheet?.status === "generating";
  const estimatedCost = selectedSlotIds.size * modelOption.costPerImageUsd;

  return (
    // Centered as a whole while there's nothing generating yet (matches the
    // reference's roomier landing feel instead of everything hugging the
    // top with a dead zone below); once a sheet exists, the page reads
    // top-down as a growing document instead, since progress/poster content
    // appends below.
    <div className={cn("min-h-full flex flex-col items-center px-4 md:px-6 py-10", !sheet ? "justify-center" : "justify-start")}>
      <div className="mx-auto max-w-5xl w-full flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-8 items-center">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <Fingerprint className="h-3.5 w-3.5" /> Character Studio
              </div>
              {faceUrl && (
                <button
                  onClick={startOver}
                  disabled={starting}
                  className="flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Start over
                </button>
              )}
            </div>
            <h1 className="mt-3 font-display text-3xl md:text-4xl font-bold tracking-tight leading-tight">
              Lock your character.
              <br />
              Forever.
            </h1>
            <p className="mt-3 text-sm text-muted leading-relaxed max-w-sm">
              One reference image → a full studio character sheet. Headshots, poses, expressions and
              lighting — locked to your character.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-accent" /> {selectedSlotIds.size} shots
              </span>
              <span>{quality === "studio" ? "4:3 landscape" : "1:1 square"}</span>
              <span className="text-accent">
                {formatCostUSD(estimatedCost)} · {formatCostINR(estimatedCost)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface p-4 flex flex-col gap-4">
            <div className="relative rounded-xl border border-dashed border-border-subtle bg-surface-2/40 p-4 flex flex-col items-center gap-2">
              {faceUrl ? (
                <div className="w-full flex flex-col items-center">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={faceUrl} alt="Reference" className="max-h-48 rounded-lg border border-border-subtle object-contain" />
                    <FaceScanOverlay active={starting} />
                    <button
                      onClick={() => {
                        setFaceUrl(null);
                        resetForNewSource();
                      }}
                      disabled={busy}
                      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-surface shadow-md hover:bg-danger/10 hover:text-danger-text disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-full max-w-xs">
                    <ScanTerminal active={starting} />
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 py-6 text-muted hover:text-foreground transition-colors">
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  <span className="text-sm font-medium">Upload a reference photo</span>
                  <span className="text-xs">One clear, well-lit face — front-facing works best.</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}

              {sheet?.metadata && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[11px] text-muted">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3 text-accent" /> Eyes: {sheet.metadata.eyes}
                  </span>
                  <span className="flex items-center gap-1">
                    <Scan className="h-3 w-3 text-accent" /> Hair: {sheet.metadata.hair}
                  </span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-accent" /> Skin mapped
                  </span>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Sheet detail</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setQuality("compact")}
                  disabled={busy}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors disabled:opacity-50",
                    quality === "compact" ? "border-accent bg-accent/10" : "border-border-subtle bg-surface-2/40"
                  )}
                >
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Zap className="h-3.5 w-3.5" /> 1K Compact
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">~30s · square crop</div>
                </button>
                <button
                  onClick={() => setQuality("studio")}
                  disabled={busy}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors disabled:opacity-50",
                    quality === "studio" ? "border-accent bg-accent/10" : "border-border-subtle bg-surface-2/40"
                  )}
                >
                  <div className="text-sm font-medium">2K Studio</div>
                  <div className="mt-0.5 text-[11px] text-muted">~90s · 4:3 frame</div>
                </button>
              </div>
            </div>

            <CharacterModelSelector value={modelId} onChange={setModelId} disabled={busy} />

            <button
              onClick={handleGenerate}
              disabled={!faceUrl || busy || selectedSlotIds.size === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-2 disabled:opacity-40 transition-colors"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {buttonLabel}
            </button>

            {sheet && sheet.status === "generating" && (
              <div className="text-center text-[11px] text-muted">
                {completedCount}/{totalCount} shots done
              </div>
            )}

            {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}
          </div>
        </div>

        {/* Once a sheet exists, the picker is just a read-only record of what
            was requested — progress/results matter more at that point, so it
            moves below them instead of sitting between the hero and the
            progress view. */}
        {!sheet && (
          <ShotPicker
            selectedIds={selectedSlotIds}
            onToggle={toggleSlot}
            costPerImageUsd={modelOption.costPerImageUsd}
            disabled={busy}
          />
        )}

        {sheet && sheet.status === "generating" && (
          <div className="rounded-2xl border border-border-subtle bg-surface p-4">
            {SECTION_ORDER.map((s) => {
              const items = sheet.slots.filter((slot) => slot.section === s);
              if (items.length === 0) return null;
              return (
                <div key={s} className="mb-4 last:mb-0">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {SECTION_LABELS[s]}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((slot) => (
                      <div
                        key={slot.index}
                        title={slot.label}
                        className="flex h-16 w-16 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 overflow-hidden"
                      >
                        {slot.status === "completed" && slot.outputUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={slot.outputUrl} alt={slot.label} className="h-full w-full object-cover" />
                        ) : slot.status === "failed" ? (
                          <X className="h-4 w-4 text-danger-text" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-muted" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {sheet && sheet.status === "completed" && (
          <div className="rounded-2xl border border-border-subtle bg-surface p-4 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              {compositing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Building the poster…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 text-accent" /> Character Sheet Ready
                </>
              )}
            </div>
            {posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt="Character sheet" className="max-w-full rounded-xl border border-border-subtle" />
            )}
            {sheet.total_cost_usd != null && (
              <div className="text-xs text-muted">
                {formatCostUSD(sheet.total_cost_usd)} · {formatCostINR(sheet.total_cost_usd)}
              </div>
            )}

            <div className="flex w-full max-w-md flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                {posterUrl && (
                  <a
                    href={posterUrl}
                    download="character-sheet.png"
                    className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-2 transition-colors"
                  >
                    <Download className="h-4 w-4" /> Download
                  </a>
                )}
                {!showSaveRow && (
                  <button
                    onClick={() => {
                      if (saved) return;
                      setShowSaveRow(true);
                    }}
                    disabled={saved}
                    className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-border-subtle disabled:opacity-50 transition-colors"
                  >
                    {saved ? <Check className="h-4 w-4 text-accent" /> : null}
                    {saved ? "Saved to Library" : "Save character…"}
                  </button>
                )}
                {saved && (
                  <Link href="/library?category=character" className="text-xs text-accent hover:underline">
                    View in Library
                  </Link>
                )}
              </div>

              {showSaveRow && (
                <div className="flex w-full items-center gap-2 rounded-xl border border-border-subtle bg-surface-2/40 p-2">
                  <input
                    autoFocus
                    value={saveNameDraft}
                    onChange={(e) => setSaveNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirmSave()}
                    placeholder='Name this character, e.g. "Alex"'
                    className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                  />
                  <button
                    onClick={handleConfirmSave}
                    disabled={!saveNameDraft.trim() || savingCharacter}
                    className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-2 disabled:opacity-50"
                  >
                    {savingCharacter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                  </button>
                  <button
                    onClick={() => setShowSaveRow(false)}
                    className="shrink-0 text-xs text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reappears here (read-only view of what was requested) once a sheet
            exists — see the comment above the other instance. */}
        {sheet && (
          <ShotPicker
            selectedIds={selectedSlotIds}
            onToggle={toggleSlot}
            costPerImageUsd={modelOption.costPerImageUsd}
            disabled
          />
        )}
      </div>
    </div>
  );
}

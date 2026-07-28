"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, EyeOff, Loader2 } from "lucide-react";
import { SourcePanel } from "./SourcePanel";
import { EffectControls } from "./EffectControls";
import { BeforeAfterPreview, type VideoTransport } from "./BeforeAfterPreview";
import { getEffect } from "@/lib/effects/registry";
import { defaultParamValues, type EffectCategory, type EffectDefinition, type EffectParamValues } from "@/lib/effects/types";
import { DEFAULT_GLOBAL_ADJUSTMENTS, type GlobalAdjustmentValues } from "@/lib/effects/globalAdjustments";
import { computeWorkingSize, renderEffect, PREVIEW_CAPS } from "@/lib/effects/pipeline";

interface Source {
  file: File;
  url: string;
  kind: "image" | "video";
}

const VIDEO_EXPORT_CAP = 1280;

/**
 * Effects Studio — a real, client-side procedural image/video effects
 * builder (Revolio's own take on Ladybug's studio). Every effect is a pure
 * ImageData->ImageData function (src/lib/effects/algorithms/*), run through
 * a shared pipeline (src/lib/effects/pipeline.ts) that the still-image path,
 * the live video-preview loop, and the export pass all call identically —
 * just at different resolutions/cadences. See the Effects Studio plan for
 * the deliberate v1 scope cuts (8 curated effects, no Gallery integration,
 * download-only export).
 */
export function EffectsStudioView() {
  const [source, setSource] = useState<Source | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [activeCategory, setActiveCategory] = useState<EffectCategory | "all">("all");
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  const [paramValuesByEffect, setParamValuesByEffect] = useState<Record<string, EffectParamValues>>({});
  const [globalAdjustments, setGlobalAdjustments] = useState<GlobalAdjustmentValues>(DEFAULT_GLOBAL_ADJUSTMENTS);
  const [splitPosition, setSplitPosition] = useState(50);
  const [showOriginal, setShowOriginal] = useState(false);
  const [interacting, setInteracting] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(true);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  // Offscreen scratch canvas — never mounted, so it's lazily created once via
  // the standard "ref holding a non-DOM value" pattern rather than an effect.
  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  if (!workingCanvasRef.current && typeof document !== "undefined") {
    workingCanvasRef.current = document.createElement("canvas");
  }
  const exportingRef = useRef(false);

  const interactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markInteracting = useCallback(() => {
    setInteracting(true);
    if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
    interactTimerRef.current = setTimeout(() => setInteracting(false), 150);
  }, []);
  useEffect(() => () => {
    if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
  }, []);

  // Revoke the previous source's object URL whenever it's replaced/unmounted
  // — otherwise every Replace leaks a blob URL for the session's lifetime.
  useEffect(() => () => {
    if (source) URL.revokeObjectURL(source.url);
  }, [source]);

  const effect: EffectDefinition | null = selectedEffectId ? getEffect(selectedEffectId) ?? null : null;
  const paramValues: EffectParamValues = selectedEffectId ? paramValuesByEffect[selectedEffectId] ?? {} : {};
  const workingCap = source
    ? interacting
      ? PREVIEW_CAPS[source.kind].interacting
      : PREVIEW_CAPS[source.kind].idle
    : PREVIEW_CAPS.image.idle;

  // Mirrors the latest render inputs for the continuous video loop below —
  // that loop is set up once per source and must keep reading fresh values
  // every tick without restarting (which would stutter playback).
  const latestRef = useRef({ effect, paramValues, globalAdjustments, naturalSize, workingCap });
  latestRef.current = { effect, paramValues, globalAdjustments, naturalSize, workingCap };

  const renderOnce = useCallback(() => {
    const media = source?.kind === "video" ? videoRef.current : imageRef.current;
    const working = workingCanvasRef.current;
    const output = outputCanvasRef.current;
    if (!media || !working || !output || !naturalSize || exportingRef.current) return;
    const { width, height } = computeWorkingSize(naturalSize.width, naturalSize.height, workingCap);
    renderEffect(media, working, output, width, height, effect, paramValues, globalAdjustments);
  }, [source?.kind, naturalSize, workingCap, effect, paramValues, globalAdjustments]);

  const renderOnceRef = useRef(renderOnce);
  renderOnceRef.current = renderOnce;

  // Still image: recompute on any relevant change. Video while paused: same
  // (the continuous loop below only fires for newly-decoded frames, which
  // stop arriving once paused/scrubbed-to-a-stop).
  useEffect(() => {
    if (!source) return;
    if (source.kind === "image" || videoRef.current?.paused) renderOnce();
  }, [source, renderOnce]);

  // Video source lifecycle — playback state + an immediate re-render right
  // after a seek (scrubbing while paused wouldn't otherwise trigger a
  // repaint, since nothing in the effect above's deps actually changes).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || source?.kind !== "video") return;
    function onLoaded() {
      setDuration(video!.duration || 0);
      renderOnceRef.current();
    }
    function onTime() {
      setCurrentTime(video!.currentTime);
    }
    function onPlay() {
      setPlaying(true);
    }
    function onPause() {
      setPlaying(false);
    }
    function onSeeked() {
      renderOnceRef.current();
    }
    video.muted = muted;
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.url, source?.kind]);

  // Continuous per-frame render loop while a video is playing — driven by
  // requestVideoFrameCallback (falls back to rAF where unsupported), reading
  // `latestRef` each tick so adjusting a slider mid-playback never needs to
  // restart this loop. Skips entirely while an export is in flight — see
  // `exportingRef` — so the two don't fight over the same output canvas.
  useEffect(() => {
    if (source?.kind !== "video") return;
    const video = videoRef.current;
    const working = workingCanvasRef.current;
    const output = outputCanvasRef.current;
    if (!video || !working || !output) return;
    let cancelled = false;
    let rafId: number | null = null;

    function tick() {
      if (cancelled) return;
      if (!exportingRef.current) {
        const { effect, paramValues, globalAdjustments, naturalSize, workingCap } = latestRef.current;
        if (naturalSize) {
          const { width, height } = computeWorkingSize(naturalSize.width, naturalSize.height, workingCap);
          renderEffect(video!, working!, output!, width, height, effect, paramValues, globalAdjustments);
        }
      }
      schedule();
    }
    function schedule() {
      if (cancelled) return;
      const rvfc = (video as unknown as { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
      if (typeof rvfc === "function") rvfc.call(video, tick);
      else rafId = requestAnimationFrame(tick);
    }
    schedule();
    return () => {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [source?.kind, source?.url]);

  function handleUpload(file: File) {
    setError(null);
    const kind: Source["kind"] = file.type.startsWith("video/") ? "video" : "image";
    const url = URL.createObjectURL(file);
    setSource({ file, url, kind });
    setNaturalSize(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setShowOriginal(false);
  }

  function handleSelectEffect(id: string | null) {
    setSelectedEffectId(id);
    if (id && !paramValuesByEffect[id]) {
      const def = getEffect(id);
      if (def) setParamValuesByEffect((prev) => ({ ...prev, [id]: defaultParamValues(def) }));
    }
  }

  function handleParamChange(id: string, value: number | string | boolean) {
    if (!selectedEffectId) return;
    setParamValuesByEffect((prev) => ({
      ...prev,
      [selectedEffectId]: { ...prev[selectedEffectId], [id]: value },
    }));
  }

  function handleResetEffect() {
    if (!selectedEffectId) return;
    const def = getEffect(selectedEffectId);
    if (def) setParamValuesByEffect((prev) => ({ ...prev, [selectedEffectId]: defaultParamValues(def) }));
  }

  function handleResetAll() {
    setParamValuesByEffect({});
    setGlobalAdjustments(DEFAULT_GLOBAL_ADJUSTMENTS);
    setSelectedEffectId(null);
  }

  function handleGlobalAdjustmentChange(id: string, value: number) {
    setGlobalAdjustments((prev) => ({ ...prev, [id]: value }));
  }

  function handlePlayPause() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function handleSeek(t: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = t;
    setCurrentTime(t);
  }

  function handleMuteToggle() {
    setMuted((m) => {
      if (videoRef.current) videoRef.current.muted = !m;
      return !m;
    });
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleDownloadImage() {
    const media = imageRef.current;
    if (!media || !naturalSize) return;
    // A fresh, throwaway canvas pair at full natural resolution — never
    // touches the live-preview canvases, so there's nothing to coordinate
    // with the render loop above (unlike video export, which must reuse the
    // exact canvas whose stream gets captured).
    const working = document.createElement("canvas");
    const output = document.createElement("canvas");
    renderEffect(media, working, output, naturalSize.width, naturalSize.height, effect, paramValues, globalAdjustments);
    output.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${effect?.id ?? "original"}.png`);
    }, "image/png");
  }

  async function handleExportVideo() {
    const video = videoRef.current;
    const working = workingCanvasRef.current;
    const output = outputCanvasRef.current;
    if (!video || !working || !output || !naturalSize || exporting) return;

    setError(null);
    setExporting(true);
    exportingRef.current = true;
    const wasPlaying = !video.paused;
    video.pause();

    try {
      await new Promise<void>((resolve) => {
        if (video.currentTime === 0) resolve();
        else {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          video.addEventListener("seeked", onSeeked);
          video.currentTime = 0;
        }
      });

      const { width, height } = computeWorkingSize(naturalSize.width, naturalSize.height, VIDEO_EXPORT_CAP);
      renderEffect(video, working, output, width, height, effect, paramValues, globalAdjustments);

      const videoTrack = output.captureStream(30).getVideoTracks()[0];
      const tracks: MediaStreamTrack[] = [videoTrack];
      try {
        const withAudio = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
        const audioSource = withAudio.captureStream?.() ?? withAudio.mozCaptureStream?.();
        audioSource?.getAudioTracks().forEach((t) => tracks.push(t));
      } catch {
        // Best-effort — export still works video-only if audio capture isn't available.
      }
      const stream = new MediaStream(tracks);

      const mimeCandidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordingDone = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      let rafId: number | null = null;
      // Non-null alias — TS doesn't carry the `!video` guard's narrowing
      // into this nested function declaration's closure over the outer
      // `const video`.
      const videoEl = video;
      function frameTick() {
        if (videoEl.ended) return;
        renderEffect(videoEl, working!, output!, width, height, effect, paramValues, globalAdjustments);
        setExportProgress(videoEl.duration ? videoEl.currentTime / videoEl.duration : 0);
        const rvfc = (videoEl as unknown as { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
        if (typeof rvfc === "function") rvfc.call(videoEl, frameTick);
        else rafId = requestAnimationFrame(frameTick);
      }

      const ended = new Promise<void>((resolve) => {
        video.addEventListener("ended", () => resolve(), { once: true });
      });

      recorder.start(250);
      await video.play();
      frameTick();
      await ended;
      if (rafId != null) cancelAnimationFrame(rafId);
      recorder.stop();
      await recordingDone;

      const blob = new Blob(chunks, { type: mimeType });
      downloadBlob(blob, `${effect?.id ?? "original"}.webm`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      exportingRef.current = false;
      setExporting(false);
      setExportProgress(0);
      video.pause();
      video.currentTime = 0;
      if (wasPlaying) video.play();
    }
  }

  const transport: VideoTransport | null =
    source?.kind === "video"
      ? { playing, currentTime, duration, muted, onPlayPause: handlePlayPause, onSeek: handleSeek, onMuteToggle: handleMuteToggle }
      : null;

  return (
    <div className="flex-1 flex min-h-0 gap-3 px-3 pb-3 pt-3">
      <SourcePanel
        sourceName={source?.file.name ?? null}
        onUpload={handleUpload}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        selectedEffectId={selectedEffectId}
        onSelectEffect={handleSelectEffect}
      />

      <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-border-subtle bg-surface/30 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-2.5 shrink-0">
          <span className="text-sm font-medium truncate">{source?.file.name ?? "Effects Studio"}</span>
          <div className="flex items-center gap-2 shrink-0">
            {source && (
              <button
                onClick={() => setShowOriginal((v) => !v)}
                title={showOriginal ? "Show effect" : "Show original"}
                className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs font-medium hover:bg-border-subtle transition-colors"
              >
                {showOriginal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showOriginal ? "Original" : "Compare"}
              </button>
            )}
            {source && (
              <button
                onClick={source.kind === "video" ? handleExportVideo : handleDownloadImage}
                disabled={exporting || !naturalSize}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-2 disabled:opacity-50 transition-colors"
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {exporting ? `Exporting… ${Math.round(exportProgress * 100)}%` : "Download"}
              </button>
            )}
          </div>
        </div>

        {!source ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-muted px-4">
            <p className="text-sm">Upload a photo or short video clip to start.</p>
            <p className="text-xs max-w-sm">
              Effects run entirely in your browser — nothing is uploaded anywhere until you hit Download.
            </p>
          </div>
        ) : (
          <BeforeAfterPreview
            sourceKind={source.kind}
            sourceUrl={source.url}
            aspectRatio={naturalSize ? `${naturalSize.width} / ${naturalSize.height}` : null}
            imageRef={imageRef}
            videoRef={videoRef}
            outputCanvasRef={outputCanvasRef}
            onMediaLoaded={(w, h) => setNaturalSize({ width: w, height: h })}
            splitPosition={splitPosition}
            onSplitPositionChange={setSplitPosition}
            showOriginal={showOriginal}
            transport={transport}
          />
        )}

        {exporting && source?.kind === "video" && (
          <div className="px-4 pb-2 text-[11px] text-muted">
            Exporting plays through the clip once, then downloads a WebM file — there's no way to render faster
            than real time without a much heavier video pipeline.
          </div>
        )}
        {error && <div className="px-4 pb-3 text-xs text-danger-text">{error}</div>}
      </div>

      <EffectControls
        effect={effect}
        paramValues={paramValues}
        onParamChange={handleParamChange}
        onResetEffect={handleResetEffect}
        globalAdjustments={globalAdjustments}
        onGlobalAdjustmentChange={handleGlobalAdjustmentChange}
        onResetAll={handleResetAll}
        onInteractStart={markInteracting}
      />
    </div>
  );
}

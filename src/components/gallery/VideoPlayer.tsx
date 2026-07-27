"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayTriangleIcon } from "@/components/ui/PlayTriangleIcon";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Custom-styled video player replacing the browser's native `<video controls>`
 * UI (which looks inconsistent across browsers and clashes with the rest of
 * the app's dark/orange theme). Used for the large studio preview and the
 * generation detail panel — anywhere a video deserves a proper "native app"
 * feeling player rather than a raw embed.
 */
export function VideoPlayer({
  src,
  className,
  autoPlay = false,
  loop = false,
}: {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    function onFsChange() {
      setFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    if (!v) return;
    const t = Number(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
  }

  return (
    <div
      ref={containerRef}
      className={cn("group/player relative flex items-center justify-center bg-black", className)}
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        loop={loop}
        playsInline
        className="max-w-full max-h-full"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          if (!seeking) setCurrentTime(e.currentTarget.currentTime);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
      />

      {!playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
          title="Play"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white transition-transform hover:scale-105">
            <PlayTriangleIcon className="h-7 w-7" />
          </span>
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8 opacity-0 transition-opacity group-hover/player:opacity-100">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          onMouseDown={() => setSeeking(true)}
          onMouseUp={() => setSeeking(false)}
          className="slider-thin w-full"
        />
        <div className="flex items-center gap-3">
          <button onClick={togglePlay} title={playing ? "Pause" : "Play"} className="text-white/90 hover:text-white">
            {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <PlayTriangleIcon className="h-4 w-4" />}
          </button>
          <span className="text-[11px] tabular-nums text-white/70">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="flex-1" />
          <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"} className="text-white/90 hover:text-white">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="text-white/90 hover:text-white"
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

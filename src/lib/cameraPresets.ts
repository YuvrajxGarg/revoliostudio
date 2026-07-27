"use client";

const KEY = "revolio-camera-presets";
const MAX = 8;

export interface CameraPreset {
  id: string;
  label: string;
  rotate: number;
  vertical: number;
  zoom: number;
}

/** Local-only saved camera angles for the Angle Generator tool's "Save as preset" — mirrors recentTools.ts's localStorage pattern. */
export function saveCameraPreset(preset: Omit<CameraPreset, "id">): CameraPreset {
  const saved: CameraPreset = { ...preset, id: crypto.randomUUID() };
  try {
    const current = getCameraPresets();
    const next = [saved, ...current].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — preset just won't persist, non-critical
  }
  return saved;
}

export function getCameraPresets(): CameraPreset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (p): p is CameraPreset =>
            p && typeof p.id === "string" && typeof p.label === "string" && typeof p.rotate === "number"
        )
      : [];
  } catch {
    return [];
  }
}

export function deleteCameraPreset(id: string) {
  try {
    const next = getCameraPresets().filter((p) => p.id !== id);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // non-critical
  }
}

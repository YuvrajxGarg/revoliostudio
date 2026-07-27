"use client";

const KEY = "revolio-recent-tools";
const MAX = 5;

/** Records a visit to a tool destination (its `href` from ALL_TOOLS), most-recent-first, deduped. Powers the Home command palette's "Recents" section. */
export function pushRecentTool(href: string) {
  try {
    const current = getRecentTools();
    const next = [href, ...current.filter((h) => h !== href)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — recents just won't persist, non-critical
  }
}

export function getRecentTools(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === "string") : [];
  } catch {
    return [];
  }
}

const USAGE_KEY = "revolio-tool-usage-counts";

/**
 * A raw per-tool visit counter, separate from the recency list above —
 * powers Home's "Tools" section, which is meant to surface what a user
 * actually opens most rather than just what they last opened or have
 * pinned. Deliberately simple (no decay/weighting): good enough for "what
 * do I use most" without standing up real analytics.
 */
export function recordToolUse(href: string) {
  try {
    const counts = getToolUsageCounts();
    counts[href] = (counts[href] ?? 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(counts));
  } catch {
    // localStorage unavailable — usage ranking just won't persist
  }
}

export function getToolUsageCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Night / bright mode switch. The theme is a `.light` class on <html>
 * (dark is the default), persisted in localStorage and applied before
 * first paint by an inline script in the root layout.
 *
 * `light` starts as `null` ("not yet known") rather than defaulting to
 * `false` — this button is server-rendered (it's part of the normal
 * AccountBar/MobileNav tree, not behind any client-only gate), and the
 * server has no access to localStorage, so it can't know the real theme.
 * The old code guessed `false` (dark/Sun) on both server and client, then
 * corrected itself a tick later in a useEffect once it could read the
 * actual class off <html> — which is exactly why the icon visibly flipped
 * from the wrong icon to the right one on every single page load/refresh
 * (more noticeable on heavier pages where that "wrong" frame lingers
 * longer before the correction lands). The actual page theme itself was
 * never wrong — only this button's own icon was guessing badly.
 *
 * Rendering a neutral placeholder for that first tick instead of a guess
 * means the icon only ever appears once, correctly — never flips.
 *
 * Cross-tab sync: toggling the theme in one tab used to have zero effect
 * on any OTHER tab already open on the site — that tab's <html> class and
 * this button's own `light` state were only ever set once, at that tab's
 * own mount time, with nothing watching for the value changing elsewhere.
 * So switching to light in tab A left an already-open tab B sitting on
 * whatever it loaded with, and later actions in tab B (including a plain
 * refresh, which re-reads localStorage but tab B's memory of "what it just
 * set" was never the issue — the OTHER tab's write is) could look like the
 * theme "randomly" flipping back. The browser fires a `storage` event on
 * every other same-origin tab (never the tab that made the write) whenever
 * localStorage changes — listening for it here keeps every open tab's
 * class + icon in lockstep the instant any one of them toggles.
 */
// Keeps the browser-chrome color (mobile status bar / tab color) in sync
// with the theme — the initial value is set once from Metadata.viewport and
// only ever matched dark, so switching to light left the OS chrome dark
// while the page itself went light.
function syncThemeColorMeta(isLight: boolean) {
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", isLight ? "#fafafa" : "#0f0f0f");
}

export function ThemeToggle({ className }: { className?: string }) {
  const [light, setLight] = useState<boolean | null>(null);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== "revolio-theme") return;
      const isLight = e.newValue === "light";
      document.documentElement.classList.add("theme-transition");
      window.setTimeout(() => document.documentElement.classList.remove("theme-transition"), 220);
      setLight(isLight);
      document.documentElement.classList.toggle("light", isLight);
      syncThemeColorMeta(isLight);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function toggle() {
    const next = !(light ?? false);
    // Briefly makes ~every element's color-related properties transition
    // instead of snapping, so the light/dark swap crossfades — removed a
    // moment later so it never lingers and fight with anything else's own
    // transitions. See the `html.theme-transition` rule in globals.css.
    document.documentElement.classList.add("theme-transition");
    window.setTimeout(() => document.documentElement.classList.remove("theme-transition"), 220);
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    syncThemeColorMeta(next);
    try {
      localStorage.setItem("revolio-theme", next ? "light" : "dark");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={light === null ? undefined : light ? "Switch to night mode" : "Switch to bright mode"}
      className={
        "flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-muted hover:text-foreground transition-colors " +
        (className ?? "")
      }
    >
      {light === null ? null : light ? (
        <Moon key="moon" className="animate-icon-swap h-4 w-4" />
      ) : (
        <Sun key="sun" className="animate-icon-swap h-4 w-4" />
      )}
    </button>
  );
}

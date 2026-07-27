"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImageIcon, Clapperboard, AudioLines, Box, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Same icon-per-category mapping as the sidebar's nav (see Sidebar.tsx /
// TopNav.tsx) — reusing it here keeps "Image"/"Video"/"Audio"/"3D" visibly
// the same concept whether you're looking at the sidebar or these in-page
// tabs.
const TABS = [
  { href: "/studio/image", label: "Image", icon: ImageIcon },
  { href: "/studio/video", label: "Video", icon: Clapperboard },
  { href: "/studio/audio", label: "Audio", icon: AudioLines },
  { href: "/studio/3d", label: "3D", icon: Box },
];

/**
 * Magnific-style media-type tabs shown at the top of every studio panel.
 * When the row is too narrow to fit every tab, this shows small chevron
 * buttons at whichever edge still has hidden tabs — instead of the native
 * horizontal scrollbar, which reads as a stray UI element in this compact a
 * space and doesn't hint that there's more to scroll to. The row itself
 * still scrolls via wheel/trackpad/drag; the scrollbar track is just hidden
 * (see .no-scrollbar in globals.css) and the arrows drive scrollBy().
 *
 * The arrows float on top of the row (absolute, over a fade gradient)
 * rather than reserving padding on the scroller itself — an earlier version
 * added conditional pl-7/pr-7 to the scroll container when an arrow showed,
 * but that changes the container's own scrollWidth/clientWidth the instant
 * it renders, which flips canScrollRight back on right after a scroll lands
 * near the end and gets the row stuck showing both arrows. Keeping the
 * scroller's box model constant regardless of arrow visibility avoids that
 * feedback loop.
 */
export function StudioTabs() {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateArrows() {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver(updateArrows);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  function scrollByAmount(dir: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: dir * 120, behavior: "smooth" });
  }

  return (
    <div className="relative flex items-center">
      <div ref={scrollerRef} onScroll={updateArrows} className="no-scrollbar flex items-center gap-1 overflow-x-auto scroll-smooth">
        {TABS.map((t) => {
          const active = pathname?.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Link>
          );
        })}
      </div>
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center bg-gradient-to-r from-surface via-surface/90 to-transparent pr-3">
          <button
            onClick={() => scrollByAmount(-1)}
            title="Scroll left"
            className="pointer-events-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-muted shadow-md hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center bg-gradient-to-l from-surface via-surface/90 to-transparent pl-3">
          <button
            onClick={() => scrollByAmount(1)}
            title="Scroll right"
            className="pointer-events-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-muted shadow-md hover:text-foreground"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

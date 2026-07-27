"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Autoplaying muted preview clip (Featured Templates cards, the composer's
 * active-preset card) that only starts fetching + playing once it scrolls
 * near the viewport, and pauses again once it scrolls away.
 *
 * Without this, every card's `<video autoPlay>` started downloading and
 * decoding the instant it mounted — the "All" filter on Featured Templates
 * can render 100+ cards at once, so that meant 100+ videos all fetching and
 * decoding simultaneously on page load, which is what made the grid slow to
 * load and janky to scroll. Gating both the fetch (via a conditional `src`)
 * and playback (via play()/pause()) behind IntersectionObserver means only
 * the handful of cards actually on-screen ever cost anything.
 *
 * `src` is only ever attached once the element has entered the viewport at
 * least once (`hasEntered`) — after that it stays attached (so scrolling
 * back doesn't re-fetch), but playback still pauses/resumes with
 * visibility to keep CPU/decode load down while scrolled away.
 */
export function LazyPreviewVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // rootMargin gives cards a couple hundred px of lead time so playback is
    // already running by the time they're actually scrolled fully into view.
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting) setHasEntered(true);
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasEntered) return;
    if (isVisible) {
      // Autoplay can still reject (e.g. a browser policy edge case) — this
      // is a silent muted background loop, so a rejected play() isn't worth
      // surfacing as an error anywhere.
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isVisible, hasEntered]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={ref}
      src={hasEntered ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      className={className}
    />
  );
}

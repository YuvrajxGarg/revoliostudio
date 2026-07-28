"use client";

import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicProfileStats } from "@/lib/types";

type Tier = "common" | "rare" | "epic" | "legendary";

interface Achievement {
  key: string;
  emoji: string;
  label: string;
  /** how it's earned — shown on hover */
  hint: string;
  value: number;
  target: number;
  tier: Tier;
}

const TIER_STYLES: Record<Tier, { chip: string; label: string }> = {
  common: {
    chip: "border-border-subtle bg-surface-2/60 hover:border-muted/50",
    label: "text-foreground",
  },
  rare: {
    chip: "border-series-image/40 bg-series-image/[0.08] hover:border-series-image/70",
    label: "text-foreground",
  },
  epic: {
    chip: "border-stat-violet/40 bg-stat-violet/[0.10] hover:border-stat-violet/70",
    label: "text-foreground",
  },
  legendary: {
    chip: "border-accent/50 bg-gradient-to-r from-accent/[0.18] via-yellow-500/[0.10] to-accent/[0.18] hover:border-accent shadow-[0_0_14px_-4px_var(--accent)]",
    label: "text-foreground",
  },
};

/**
 * The full catalog. Tiers escalate within each family so there is always a
 * next rung, and the legendary rungs are deliberately brutal — they exist
 * to be chased, not collected.
 */
function buildAchievements(stats: PublicProfileStats): Achievement[] {
  const total = stats.total_generations;
  const streak = stats.longest_streak;
  const days = stats.active_days;
  const models = stats.distinct_models;
  const peak = stats.peak_hour_utc;
  const isNightOwl = peak !== null && (peak >= 22 || peak < 5);
  const isEarlyBird = peak !== null && peak >= 5 && peak < 9;

  const categories = [stats.image_count, stats.video_count, stats.model3d_count].filter((c) => c > 0).length;
  const tripleCrown = Math.min(stats.image_count, stats.video_count, stats.model3d_count);

  // best single day, and how many distinct hours-of-day they've ever created in
  const bestDay = Math.max(0, ...Object.values(stats.daily_counts ?? {}).map((d) => d.total));
  const hoursCovered = Object.values(stats.hourly_counts ?? {}).filter((c) => c > 0).length;

  return [
    // ── volume ──
    { key: "first", emoji: "🌱", label: "First Spark", hint: "Make your first generation", value: total, target: 1, tier: "common" },
    { key: "ten", emoji: "🚀", label: "Getting Going", hint: "10 generations", value: total, target: 10, tier: "common" },
    { key: "century", emoji: "💯", label: "Century Club", hint: "100 generations", value: total, target: 100, tier: "common" },
    { key: "prolific", emoji: "⚡", label: "Prolific", hint: "500 generations", value: total, target: 500, tier: "rare" },
    { key: "machine", emoji: "🏭", label: "The Machine", hint: "1,000 generations", value: total, target: 1000, tier: "epic" },
    { key: "everest", emoji: "🏔️", label: "Everest", hint: "5,000 generations", value: total, target: 5000, tier: "legendary" },
    { key: "cosmos", emoji: "🌌", label: "Ten Thousand", hint: "10,000 generations", value: total, target: 10000, tier: "legendary" },

    // ── streaks ──
    { key: "spark3", emoji: "✨", label: "Warming Up", hint: "A 3-day streak", value: streak, target: 3, tier: "common" },
    { key: "fire7", emoji: "🔥", label: "On Fire", hint: "A 7-day streak", value: streak, target: 7, tier: "common" },
    { key: "fire14", emoji: "🌋", label: "Unstoppable", hint: "A 14-day streak", value: streak, target: 14, tier: "rare" },
    { key: "fire30", emoji: "👑", label: "Iron Will", hint: "A 30-day streak", value: streak, target: 30, tier: "epic" },
    { key: "fire100", emoji: "💎", label: "Diamond Streak", hint: "A 100-day streak", value: streak, target: 100, tier: "legendary" },

    // ── consistency ──
    { key: "regular", emoji: "📅", label: "Regular", hint: "30 active days", value: days, target: 30, tier: "common" },
    { key: "devoted", emoji: "🗓️", label: "Devoted", hint: "100 active days", value: days, target: 100, tier: "rare" },
    { key: "marathon", emoji: "🏃", label: "Marathon", hint: "200 active days", value: days, target: 200, tier: "epic" },
    { key: "grandmaster", emoji: "🧙", label: "Grandmaster", hint: "365 active days", value: days, target: 365, tier: "legendary" },

    // ── exploration ──
    { key: "curious", emoji: "🔍", label: "Curious", hint: "Try 5 different models", value: models, target: 5, tier: "common" },
    { key: "explorer", emoji: "🧭", label: "Explorer", hint: "Try 10 different models", value: models, target: 10, tier: "common" },
    { key: "connoisseur", emoji: "🎩", label: "Connoisseur", hint: "Try 20 different models", value: models, target: 20, tier: "rare" },
    { key: "omniscient", emoji: "🔮", label: "Omniscient", hint: "Try 35 different models", value: models, target: 35, tier: "legendary" },

    // ── craft: image ──
    { key: "imagesmith", emoji: "🖼️", label: "Image Smith", hint: "100 image generations", value: stats.image_count, target: 100, tier: "common" },
    { key: "gallery", emoji: "🎨", label: "Gallery", hint: "500 image generations", value: stats.image_count, target: 500, tier: "rare" },

    // ── craft: video ──
    { key: "motion", emoji: "🎬", label: "Motion Maker", hint: "10 video generations", value: stats.video_count, target: 10, tier: "common" },
    { key: "director", emoji: "🎥", label: "Director", hint: "50 video generations", value: stats.video_count, target: 50, tier: "rare" },
    { key: "auteur", emoji: "🎞️", label: "Auteur", hint: "200 video generations", value: stats.video_count, target: 200, tier: "epic" },

    // ── craft: 3D ──
    { key: "dimension", emoji: "🧊", label: "3rd Dimension", hint: "Generate in 3D", value: stats.model3d_count, target: 1, tier: "common" },
    { key: "sculptor", emoji: "🗿", label: "Sculptor", hint: "10 3D generations", value: stats.model3d_count, target: 10, tier: "rare" },
    { key: "monument", emoji: "🗼", label: "Monument", hint: "100 3D generations", value: stats.model3d_count, target: 100, tier: "epic" },

    // ── range & rhythm ──
    { key: "polymath", emoji: "🎭", label: "Polymath", hint: "Create in image, video and 3D", value: categories, target: 3, tier: "rare" },
    { key: "triplecrown", emoji: "🥇", label: "Triple Crown", hint: "100+ generations in all three categories", value: tripleCrown, target: 100, tier: "legendary" },
    { key: "comet", emoji: "🌠", label: "Comet", hint: "50 generations in a single day", value: bestDay, target: 50, tier: "rare" },
    { key: "bigbang", emoji: "💥", label: "Big Bang", hint: "100 generations in a single day", value: bestDay, target: 100, tier: "epic" },
    { key: "clock", emoji: "🕐", label: "Round the Clock", hint: "Create in all 24 hours of the day", value: hoursCovered, target: 24, tier: "legendary" },
    { key: "owl", emoji: "🦉", label: "Night Owl", hint: "Most active after 10 PM", value: isNightOwl ? 1 : 0, target: 1, tier: "common" },
    { key: "bird", emoji: "🐦", label: "Early Bird", hint: "Most active before 9 AM", value: isEarlyBird ? 1 : 0, target: 1, tier: "common" },
  ];
}

function Chip({ a, earned, delay }: { a: Achievement; earned: boolean; delay: number }) {
  const [hovered, setHovered] = useState(false);
  const pct = Math.min(a.value / a.target, 1);
  const style = TIER_STYLES[a.tier];

  return (
    <div
      className={cn(
        "animate-stat-tile-in relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-200",
        earned
          ? cn(style.chip, "hover:-translate-y-0.5")
          : "border-border-subtle/50 bg-surface-2/25 hover:border-border-subtle"
      )}
      style={{ animationDelay: `${delay}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={cn("text-sm leading-none", !earned && "opacity-30 grayscale")}>{a.emoji}</span>
      <span className={cn("font-medium", earned ? style.label : "text-muted")}>{a.label}</span>

      {!earned && (
        <span className="ml-0.5 flex items-center gap-1">
          <span className="h-1 w-8 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full bg-muted/60 transition-[width] duration-700"
              style={{ width: `${pct * 100}%` }}
            />
          </span>
          <span className="text-[10px] tabular-nums text-muted/70">
            {a.value >= 1000 ? `${(a.value / 1000).toFixed(1)}k` : a.value}/
            {a.target >= 1000 ? `${a.target / 1000}k` : a.target}
          </span>
        </span>
      )}

      {hovered && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-[11px] text-muted shadow-lg">
          <span className="capitalize text-foreground">{a.tier}</span>
          <span className="opacity-40">·</span>
          {a.hint}
        </span>
      )}
    </div>
  );
}

/**
 * Unlockable achievement chips. Earned ones are always shown; locked ones
 * collapse behind a toggle (with the three closest-to-unlocking surfaced as
 * a teaser) so a mostly-locked profile doesn't read as a wall of grey.
 */
export function AchievementBadges({ stats }: { stats: PublicProfileStats }) {
  const [showLocked, setShowLocked] = useState(false);
  const achievements = buildAchievements(stats);

  const rank: Record<Tier, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
  const earned = achievements
    .filter((a) => a.value >= a.target)
    .sort((a, b) => rank[a.tier] - rank[b.tier]);
  const locked = achievements
    .filter((a) => a.value < a.target)
    .sort((a, b) => b.value / b.target - a.value / a.target);

  const teaser = locked.slice(0, 3);
  const hidden = locked.slice(3);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-sm text-muted">Achievements</p>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
          {earned.length}/{achievements.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {earned.map((a, i) => (
          <Chip key={a.key} a={a} earned delay={i * 30} />
        ))}
        {teaser.map((a, i) => (
          <Chip key={a.key} a={a} earned={false} delay={(earned.length + i) * 30} />
        ))}
        {showLocked && hidden.map((a, i) => <Chip key={a.key} a={a} earned={false} delay={i * 20} />)}

        {hidden.length > 0 && (
          <button
            type="button"
            onClick={() => setShowLocked((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-border-subtle/60 bg-surface-2/30 px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-border-subtle hover:text-foreground"
          >
            <Lock className="h-3 w-3" />
            {showLocked ? "Hide locked" : `${hidden.length} more`}
            <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", showLocked && "rotate-180")} />
          </button>
        )}
      </div>
    </div>
  );
}

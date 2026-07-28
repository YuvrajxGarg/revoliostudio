"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, subDays } from "date-fns";
import {
  Compass,
  Crown,
  Film,
  Loader2,
  Palette,
  Clapperboard,
  Layers,
  CalendarDays,
  Sparkles,
  Images,
  Wand2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { usePublicUserGenerations } from "@/hooks/usePublicUserGenerations";
import { usePublicProfileStats } from "@/hooks/usePublicProfileStats";
import { useCountUp } from "@/hooks/useCountUp";
import { ContributionGraph } from "@/components/profile/ContributionGraph";
import { CategoryBreakdownBar } from "@/components/profile/CategoryBreakdownBar";
import { StreakCard } from "@/components/profile/StreakCard";
import { PeakHourDial } from "@/components/profile/PeakHourDial";
import { AchievementBadges } from "@/components/profile/AchievementBadges";
import { MiniBars, WeekdayRhythm, DotCollection, ShareBar } from "@/components/profile/StatVisuals";
import {
  PROFILE_ROLE_LABELS,
  type DailyCategoryCounts,
  type ProfileRole,
  type PublicProfile,
} from "@/lib/types";

/** Last 14 days of totals (with display labels) for the Generations tile's bar chart. */
function recentDailyTotals(dailyCounts: Record<string, DailyCategoryCounts>) {
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => subDays(today, 13 - i));
  return {
    values: days.map((d) => dailyCounts[format(d, "yyyy-MM-dd")]?.total ?? 0),
    labels: days.map((d) => format(d, "MMM d")),
  };
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Totals bucketed by day of week, for the Active days tile's rhythm chart. */
function weekdayTotals(dailyCounts: Record<string, DailyCategoryCounts>) {
  const buckets = new Array(7).fill(0) as number[];
  for (const [day, counts] of Object.entries(dailyCounts ?? {})) {
    // parse as local midnight — `new Date("YYYY-MM-DD")` is UTC and can
    // land on the previous weekday for negative-offset viewers
    const [y, m, d] = day.split("-").map(Number);
    buckets[new Date(y, m - 1, d).getDay()] += counts.total;
  }
  return buckets;
}

const ROLE_ICONS: Record<ProfileRole, typeof Compass> = {
  strategist: Compass,
  designer: Palette,
  producer: Clapperboard,
  video_editor: Film,
  founder: Crown,
};

/**
 * Public, no-login profile page — mirrors SharedGenerationView's public
 * chrome (same header/CTA), reads through the get_public_profile_by_username
 * RPC (0032 migration) so only non-sensitive columns are ever exposed.
 */
export function UserProfileView({ username }: { username: string }) {
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const { items, loading: itemsLoading, hasMore, loadMore } = usePublicUserGenerations(profile?.id ?? null);
  const stats = usePublicProfileStats(profile?.id ?? null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("get_public_profile_by_username", { p_username: username })
      .then((res: { data: unknown }) => {
        const rows = res.data as PublicProfile[] | PublicProfile | null;
        const row = Array.isArray(rows) ? rows[0] ?? null : rows;
        setProfile(row ?? null);
      });
  }, [username]);

  const initial = (profile?.display_name || profile?.username || "?")[0]?.toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-border-subtle/60">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-6 w-6 text-foreground" />
          <span className="text-base font-semibold tracking-tight">Revolio</span>
        </Link>
        <Link
          href="/studio/image"
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-2 transition-colors"
        >
          Try Revolio
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center gap-8 px-4 py-10">
        {profile === undefined ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted mt-16" />
        ) : profile === null ? (
          <div className="text-center text-muted mt-16">
            <p className="text-sm">This profile doesn&apos;t exist.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 text-center max-w-xl">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-full accent-gradient flex items-center justify-center text-2xl font-semibold text-black">
                  {initial}
                </div>
              )}
              <div>
                <h1 className="text-xl font-semibold">{profile.display_name || `@${profile.username}`}</h1>
                {profile.username && <p className="text-sm text-muted">@{profile.username}</p>}
              </div>
              {profile.role && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2/70 py-1 pl-1.5 pr-3 text-xs font-medium text-foreground">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-accent">
                    {(() => {
                      const RoleIcon = ROLE_ICONS[profile.role];
                      return <RoleIcon className="h-3 w-3" />;
                    })()}
                  </span>
                  {PROFILE_ROLE_LABELS[profile.role]}
                </span>
              )}
              {profile.bio && <p className="text-sm text-muted leading-relaxed">{profile.bio}</p>}
            </div>

            {stats && stats.total_generations > 0 && (
              <div className="w-full max-w-6xl rounded-2xl border border-border-subtle/60 bg-surface/40 p-5 sm:p-8">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StreakCard current={stats.current_streak} longest={stats.longest_streak} />
                  <PeakHourDial hourlyCounts={stats.hourly_counts} />

                  <StatTile
                    index={0}
                    icon={Sparkles}
                    label="Generations"
                    value={stats.total_generations}
                    colorVar="var(--accent)"
                    visual={
                      <MiniBars
                        values={recentDailyTotals(stats.daily_counts).values}
                        labels={recentDailyTotals(stats.daily_counts).labels}
                        colorVar="var(--accent)"
                      />
                    }
                    caption="last 14 days"
                  />
                  {(() => {
                    const weekdays = weekdayTotals(stats.daily_counts);
                    const topDay = weekdays.indexOf(Math.max(...weekdays));
                    return (
                      <StatTile
                        index={1}
                        icon={CalendarDays}
                        label="Active days"
                        value={stats.active_days}
                        colorVar="var(--series-image)"
                        visual={<WeekdayRhythm counts={weekdays} colorVar="var(--series-image)" />}
                        caption={`busiest on ${WEEKDAY_NAMES[topDay]}s`}
                      />
                    );
                  })()}
                  <StatTile
                    index={2}
                    icon={Layers}
                    label="Models used"
                    value={stats.distinct_models}
                    colorVar="var(--series-3d)"
                    visual={
                      <DotCollection owned={stats.distinct_models} total={40} colorVar="var(--series-3d)" />
                    }
                    caption={`${Math.max(0, 40 - stats.distinct_models)} left to try`}
                  />
                  <StatTile
                    index={3}
                    icon={Wand2}
                    label="Favorite model"
                    value={stats.favorite_model_label ?? "—"}
                    isText
                    colorVar="var(--stat-pink)"
                    visual={
                      stats.total_generations > 0 && stats.favorite_model_count > 0 ? (
                        <ShareBar
                          ratio={stats.favorite_model_count / stats.total_generations}
                          colorVar="var(--stat-pink)"
                        />
                      ) : undefined
                    }
                    caption={
                      stats.favorite_model_count > 0
                        ? `${Math.round((stats.favorite_model_count / stats.total_generations) * 100)}% of all work`
                        : "most reached for"
                    }
                  />
                </div>

                <div className="my-6 h-px bg-border-subtle/60" />

                <AchievementBadges stats={stats} />

                <div className="my-6 h-px bg-border-subtle/60" />

                <CategoryBreakdownBar
                  imageCount={stats.image_count}
                  videoCount={stats.video_count}
                  model3dCount={stats.model3d_count}
                />

                <div className="my-6 h-px bg-border-subtle/60" />

                <ContributionGraph dailyCounts={stats.daily_counts} />
              </div>
            )}

            <div className="w-full max-w-6xl">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Images className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-base font-semibold text-foreground">Published generations</h2>
                {items.length > 0 && <span className="text-sm text-muted">({items.length}{hasMore ? "+" : ""})</span>}
              </div>
              <GenerationGrid
                items={items}
                loading={itemsLoading}
                hasMore={hasMore}
                onLoadMore={loadMore}
                emptyLabel="No published generations yet."
                readOnly
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatTile({
  index,
  icon: Icon,
  label,
  value,
  suffix,
  isText,
  className,
  colorVar = "var(--accent)",
  visual,
  caption,
}: {
  index: number;
  icon: typeof Sparkles;
  label: string;
  value: string | number;
  suffix?: string;
  isText?: boolean;
  className?: string;
  colorVar?: string;
  /** optional chart (bars, rhythm, share bar…) rendered under the value */
  visual?: React.ReactNode;
  caption?: string;
}) {
  const animatedValue = useCountUp(typeof value === "number" ? value : 0);

  return (
    <div
      className={cn(
        "animate-stat-tile-in group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border-subtle/60 bg-surface-2/60 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        className
      )}
      style={{ animationDelay: `${index * 40}ms`, ["--tile-color" as string]: colorVar }}
    >
      {/* soft tint that blooms in on hover, tinted to the tile's own color */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--tile-color) 12%, transparent), transparent 70%)" }}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-muted">{label}</p>
          <p
            className={cn(
              "mt-1 font-semibold text-foreground",
              isText ? "line-clamp-2 text-sm leading-snug" : "text-2xl leading-none"
            )}
            title={isText ? String(value) : undefined}
          >
            {isText ? value : animatedValue}
            {suffix ?? ""}
          </p>
        </div>

        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: "color-mix(in srgb, var(--tile-color) 16%, transparent)", color: "var(--tile-color)" }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>

      {visual && <div className="relative mt-auto pt-1">{visual}</div>}
      {caption && <p className="relative text-[10px] text-muted/80">{caption}</p>}
    </div>
  );
}

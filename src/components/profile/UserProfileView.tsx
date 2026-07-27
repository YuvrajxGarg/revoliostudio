"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { Badge } from "@/components/ui/Badge";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { usePublicUserGenerations } from "@/hooks/usePublicUserGenerations";
import { PROFILE_ROLE_LABELS, type PublicProfile } from "@/lib/types";

/**
 * Public, no-login profile page — mirrors SharedGenerationView's public
 * chrome (same header/CTA), reads through the get_public_profile_by_username
 * RPC (0032 migration) so only non-sensitive columns are ever exposed.
 */
export function UserProfileView({ username }: { username: string }) {
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const { items, loading: itemsLoading, hasMore, loadMore } = usePublicUserGenerations(profile?.id ?? null);

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
                <Badge className="border-accent/40 bg-accent/10 text-accent">
                  {PROFILE_ROLE_LABELS[profile.role]}
                </Badge>
              )}
              {profile.bio && <p className="text-sm text-muted leading-relaxed">{profile.bio}</p>}
            </div>

            <div className="w-full max-w-6xl">
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Music2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import type { Generation } from "@/lib/types";

/**
 * Public, no-login view of a single generation shared by token. Reads through
 * the SECURITY DEFINER `get_shared_generation` RPC (0027 migration) so a
 * private generation that was explicitly shared is viewable by anyone holding
 * the link, without loosening RLS on the table.
 */
export function SharedGenerationView({ token }: { token: string }) {
  const [gen, setGen] = useState<(Generation & { shared_url?: string | null }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    // The RPC returns a JSON blob (generation fields + our stored `shared_url`
    // + expires_at); an expired or missing token returns null.
    supabase.rpc("get_shared_generation", { share_token: token }).then((res: { data: unknown }) => {
      setGen((res.data as (Generation & { shared_url?: string | null }) | null) ?? null);
      setLoading(false);
    });
  }, [token]);

  // Prefer our own stored copy (doesn't depend on the origin CDN), fall back
  // to the original output URL if the copy wasn't made.
  const media = gen?.shared_url || gen?.output_urls?.[0];

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

      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        ) : !gen || !media ? (
          <div className="text-center text-muted">
            <p className="text-sm">This shared link is no longer available.</p>
          </div>
        ) : (
          <>
            <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-2xl border border-border-subtle bg-surface-2">
              {gen.category === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={media} controls loop className="max-h-[70vh] max-w-full" />
              ) : gen.category === "audio" ? (
                <div className="flex flex-col items-center gap-3 p-10">
                  <Music2 className="h-10 w-10 text-muted" />
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio src={media} controls className="w-72" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media} alt={gen.prompt} className="max-h-[70vh] max-w-full object-contain" />
              )}
            </div>
            {gen.prompt && (
              <p className="max-w-2xl text-center text-sm text-muted leading-relaxed">{gen.prompt}</p>
            )}
            <span className="text-xs text-muted">Made with {gen.model_label} on Revolio</span>
          </>
        )}
      </main>
    </div>
  );
}

"use client";

import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { AsciiLogoPanel } from "@/components/ui/AsciiLogoPanel";

export default function LoginPage() {
  async function signInWithGoogle() {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden pixel-grid-bg text-foreground">
      <AsciiLogoPanel className="absolute inset-0" focalX={0.66} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />

      {/* pointer-events-none here so this (mostly-empty) full-page row never
          blocks the ascii canvas underneath from seeing the cursor — only
          the card itself re-enables pointer events. */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 pointer-events-none sm:justify-start sm:pl-[10%] lg:pl-[15%]">
        <div className="pointer-events-auto w-full max-w-sm text-center">
          <Logo className="mx-auto mb-6 h-9 w-9 text-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Revolio Studio</h1>
          <p className="mt-2 text-sm text-muted">
            Image, video &amp; 3D generation — powered by Revolio AI.
          </p>

          <button
            onClick={signInWithGoogle}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm font-medium hover:bg-surface-2 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-xs text-muted">
            By continuing you agree to Revolio&apos;s usage terms.
          </p>
        </div>
      </div>
    </div>
  );
}

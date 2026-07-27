import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/types";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  username: string | null;
  bio: string | null;
  role: ProfileRole | null;
}

/**
 * Server-only: fetch the current authenticated user + profile.
 *
 * Wrapped in React's `cache()` so multiple call sites within the same
 * request (e.g. the (app) layout AND a page like /admin or /usage, which
 * both need the user) share one underlying auth+profile round-trip instead
 * of each paying for it separately — this was doubling the auth latency on
 * every navigation to those pages.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, display_name, avatar_url, is_admin, username, bio, role")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    isAdmin: profile?.is_admin ?? false,
    username: profile?.username ?? null,
    bio: profile?.bio ?? null,
    role: (profile?.role as ProfileRole | null) ?? null,
  };
});

/**
 * Guard for admin-only API routes: returns the current user if they're an
 * admin, otherwise null. Callers should 403 on null. Used to keep in-progress
 * features (Spaces, Flows) locked to admins even at the API layer, not just in
 * the UI.
 */
export async function requireAdmin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

/**
 * Fast path for the (app) layout ONLY. Reads the session locally (from
 * cookies, no network call) instead of `getUser()`'s round-trip to the
 * Supabase Auth server to re-validate the JWT.
 *
 * This is safe *only* because `src/middleware.ts` matches every route under
 * (app) and already ran the real, network-validated `getUser()` check —
 * redirecting away any request without a valid session before it ever
 * reaches this layout. Re-validating a second time in the layout was a
 * second full network round-trip on every single navigation for no extra
 * security, and was the single biggest contributor to slow page switching.
 *
 * Do NOT use this outside the (app) layout — API routes and anything not
 * exclusively gated by that middleware matcher should keep using the
 * network-verified `getCurrentUser()` above.
 */
export async function getCurrentUserForLayout(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, display_name, avatar_url, is_admin, username, bio, role")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    isAdmin: profile?.is_admin ?? false,
    username: profile?.username ?? null,
    bio: profile?.bio ?? null,
    role: (profile?.role as ProfileRole | null) ?? null,
  };
}

"use client";

import { createBrowserClient } from "@supabase/ssr";

// Memoized as a module-level singleton rather than constructed fresh on
// every call — this is called from dozens of components/hooks (useGenerations
// alone calls it on every fetchPage), and each call to createBrowserClient
// used to spin up its own GoTrueClient (auth listener + storage polling),
// which is wasted setup/teardown work every time a hook using it
// mounts/remounts across navigations. Supabase's own client libraries are
// safe to share a single instance across a whole browser tab.
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}

import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { AutopilotView } from "@/components/studio/AutopilotView";

export default async function AutopilotPage() {
  // Save-as-Flow, and the "+" menu's "Use a Flow" / quick-start Flow cards,
  // are all part of the (currently admin-only) Flows feature, so only admins
  // get those entry points in Pilot.
  const user = await getCurrentUser();
  // Suspense boundary required — AutopilotView uses useSearchParams (the
  // ?run=<id> deep link from "Run flow").
  return (
    <Suspense fallback={null}>
      <AutopilotView
        canSaveFlow={!!user?.isAdmin}
        canUseFlows={!!user?.isAdmin}
        displayName={user?.displayName ?? null}
        email={user?.email ?? ""}
      />
    </Suspense>
  );
}

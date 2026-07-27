import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { FlowsView } from "@/components/flows/FlowsView";

// Admin-only for now — see spaces/page.tsx.
export default async function FlowsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/studio/image");
  return <FlowsView />;
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SpacesHub } from "@/components/spaces/SpacesHub";

// Spaces (and its Flows tab) is admin-only for now — hidden from general users
// while it's still in development. Non-admins are bounced to the Image Studio.
export default async function SpacesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/studio/image");
  return <SpacesHub />;
}

import { getCurrentUserForLayout } from "@/lib/auth";
import { ResourcesView } from "@/components/resources/ResourcesView";

export default async function ResourcesPage() {
  const user = await getCurrentUserForLayout();
  return <ResourcesView isAdmin={user?.isAdmin ?? false} />;
}

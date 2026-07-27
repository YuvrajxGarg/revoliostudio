import { getCurrentUserForLayout } from "@/lib/auth";
import { HomeDashboard } from "@/components/home/HomeDashboard";

export default async function HomePage() {
  const user = await getCurrentUserForLayout();
  return <HomeDashboard displayName={user?.displayName ?? null} email={user?.email ?? ""} />;
}

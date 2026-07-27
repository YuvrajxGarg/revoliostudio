import { redirect } from "next/navigation";
import { getCurrentUserForLayout } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AccountBar } from "@/components/layout/AccountBar";
import { MobileNav } from "@/components/layout/MobileNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Fast local-session read — middleware already did the real, network-
  // validated auth check for every route this layout wraps. See the
  // doc comment on getCurrentUserForLayout for why this is safe.
  const user = await getCurrentUserForLayout();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground canvas-bg">
      <AppSidebar isAdmin={user.isAdmin} />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <MobileNav isAdmin={user.isAdmin} />
        <AccountBar email={user.email} displayName={user.displayName} avatarUrl={user.avatarUrl} isAdmin={user.isAdmin} />
        {children}
      </div>
    </div>
  );
}

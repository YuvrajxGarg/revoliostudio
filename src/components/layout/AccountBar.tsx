"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserMenu } from "./UserMenu";
import { ProjectPicker } from "@/components/projects/ProjectPicker";

/**
 * Slim Magnific-style top-right cluster: Usage/Admin icon buttons + theme
 * switch + account menu. Rendered above the page content on md+ screens
 * (the mobile header has its own copy of the account menu). Usage and Admin
 * used to be full nav rows in the sidebar — they live here now as plain
 * circular icon buttons, same treatment as the theme switch right next to
 * them, so the sidebar's "Tools" list stays focused on actual studios/tools.
 */
export function AccountBar({
  email,
  displayName,
  avatarUrl,
  isAdmin,
}: {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  return (
    <div className="hidden md:flex items-center justify-between gap-2 px-4 pt-3 shrink-0">
      {/* Project selector lives in this top bar (only in the studios, where
          "which project do new generations file into" is meaningful) so it
          costs no vertical space in the composer panel — matching
          Higgsfield's top-left project bar and freeing up the prompt box.
          An empty spacer keeps the right-hand cluster pinned right on other
          pages. */}
      <div className="min-w-0">{pathname?.startsWith("/studio") && <ProjectPicker />}</div>
      <div className="flex items-center gap-2 shrink-0">
      <Link
        href="/usage"
        title="Usage"
        className={cn("icon-btn-round", pathname?.startsWith("/usage") && "bg-surface-2 text-foreground")}
      >
        <Activity className="h-4 w-4" />
      </Link>
      {isAdmin && (
        <Link
          href="/admin"
          title="Admin"
          className={cn("icon-btn-round", pathname?.startsWith("/admin") && "bg-surface-2 text-foreground")}
        >
          <ShieldCheck className="h-4 w-4" />
        </Link>
      )}
      <ThemeToggle />
      <UserMenu email={email} displayName={displayName} avatarUrl={avatarUrl} />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImageIcon, Clapperboard, Box, LayoutGrid, ShieldCheck, Rocket, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { UserMenu } from "./UserMenu";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

const NAV_ITEMS = [
  { href: "/studio/image", label: "Image", icon: ImageIcon },
  { href: "/studio/video", label: "Video", icon: Clapperboard },
  { href: "/studio/3d", label: "3D", icon: Box },
  { href: "/gallery", label: "Gallery", icon: LayoutGrid },
  { href: "/usage", label: "Usage", icon: Activity },
];

export function TopNav({
  isAdmin,
  email,
  displayName,
  avatarUrl,
}: {
  isAdmin: boolean;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();

  return (
    <header className="flex items-center gap-2 mx-3 mt-3 mb-1 rounded-2xl border border-border-subtle/60 bg-surface/50 backdrop-blur-md shadow-lg px-4 md:px-5 h-14 shrink-0 z-20">
      <Link href="/studio/image" className="flex items-center gap-2 pr-3 shrink-0">
        <Logo className="h-6 w-6 text-foreground" />
        <span className="hidden sm:inline text-base font-semibold tracking-tight">Revolio</span>
      </Link>

      <nav className="flex items-center gap-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:bg-surface hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ml-1 border-l border-border-subtle pl-3",
              pathname?.startsWith("/admin")
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:bg-surface hover:text-foreground"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin
          </Link>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <Link
          href="/release-notes"
          title="Release notes"
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            pathname?.startsWith("/release-notes")
              ? "bg-surface-2 text-foreground"
              : "text-muted hover:bg-surface hover:text-foreground"
          )}
        >
          <Rocket className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Release notes</span>
        </Link>
        <NotificationCenter />
        {/* username isn't plumbed into TopNav because nothing renders TopNav
            any more (AccountBar replaced it) — null just degrades the profile
            row to the "set up your profile" prompt. */}
        <UserMenu email={email} displayName={displayName} avatarUrl={avatarUrl} username={null} />
      </div>
    </header>
  );
}

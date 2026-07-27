"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImageIcon, Clapperboard, Box, LayoutGrid, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";

const NAV_ITEMS = [
  { href: "/studio/image", label: "Image", icon: ImageIcon },
  { href: "/studio/video", label: "Video", icon: Clapperboard },
  { href: "/studio/3d", label: "3D", icon: Box },
  { href: "/gallery", label: "Gallery", icon: LayoutGrid },
];

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border-subtle bg-background px-3 py-4">
      <Link href="/studio/image" className="flex items-center gap-2 px-2 py-2 mb-6">
        <Logo className="h-6 w-6 text-foreground" />
        <span className="text-lg font-semibold tracking-tight">Revolio</span>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:bg-surface hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors mt-4 border-t border-border-subtle pt-4",
              pathname?.startsWith("/admin")
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:bg-surface hover:text-foreground"
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            Admin
          </Link>
        )}
      </nav>

      <div className="mt-auto px-2 pt-4 text-[11px] text-muted">
        Revolio Studio
      </div>
    </aside>
  );
}

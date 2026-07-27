"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioLines, Box, Clapperboard, Home, Image as ImageIcon, Library, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/studio/image", label: "Image", icon: ImageIcon },
  { href: "/studio/video", label: "Video", icon: Clapperboard },
  { href: "/studio/audio", label: "Audio", icon: AudioLines },
  { href: "/studio/3d", label: "3D", icon: Box },
  { href: "/gallery", label: "Library", icon: Library },
];

/** Compact top bar shown only below the md breakpoint, where the sidebar is hidden. */
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <header className="md:hidden flex items-center gap-1 border-b border-border-subtle/60 bg-surface/60 px-3 h-12 shrink-0 overflow-x-auto">
      <Link href="/home" className="pr-2 shrink-0">
        <Logo className="h-5 w-5 text-foreground" />
      </Link>
      {ITEMS.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium",
              active ? "bg-surface-2 text-foreground" : "text-muted"
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link href="/admin" className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin
        </Link>
      )}
      <div className="ml-auto shrink-0">
        <ThemeToggle className="!h-7 !w-7" />
      </div>
    </header>
  );
}

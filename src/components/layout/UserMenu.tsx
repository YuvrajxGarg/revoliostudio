"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, LogOut, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

/**
 * Account menu hanging off the avatar in the top-right AccountBar.
 *
 * Styling follows the house dropdown vocabulary rather than inventing its
 * own: `shadow-2xl` + `p-1.5` inset rows + `animate-menu-pop-in`, matching
 * `ui/ContextMenu.tsx` and `ui/Dropdown.tsx`. It used to be the one menu in
 * the app that was full-bleed rows divided by borders, which is why it read
 * as unfinished next to everything else.
 *
 * `username` is nullable (a user only gets one after saving it in
 * /settings), so the profile row degrades to a "Set up your profile" prompt
 * pointing at settings instead of linking to a /u/ route that would 404.
 */
export function UserMenu({
  email,
  displayName,
  avatarUrl,
  username,
}: {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  username: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [openRight, setOpenRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (displayName || email)[0]?.toUpperCase();
  const itemClass =
    "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-surface-2 transition-colors";
  const iconClass =
    "h-4 w-4 shrink-0 text-muted transition-transform duration-150 group-hover:scale-110";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setOpenUp(rect.top > window.innerHeight / 2);
            setOpenRight(rect.left < 280);
          }
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-2 py-1.5 hover:bg-surface-2 transition-colors"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <div className="h-6 w-6 rounded-full accent-gradient flex items-center justify-center text-[11px] font-semibold text-black">
            {initial}
          </div>
        )}
        <span className="hidden sm:inline text-sm text-foreground pr-1">
          {displayName || email}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "animate-menu-pop-in absolute w-64 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-2xl z-50",
            openUp ? "bottom-full mb-2" : "top-full mt-2",
            openRight ? "left-0" : "right-0"
          )}
        >
          {/* Identity block. Shows the handle when there is one, since that's
              what the public profile is addressed by; falls back to email so
              the block is never just a bare display name. */}
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full accent-gradient text-sm font-semibold text-black">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{displayName || "Revolio user"}</div>
              <div className="truncate text-xs text-muted">
                {username ? `@${username}` : email}
              </div>
            </div>
          </div>

          <div className="my-1 border-t border-border-subtle" />

          <Link
            href={username ? `/u/${username}` : "/settings"}
            role="menuitem"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <User className={iconClass} />
            {username ? "My profile" : "Set up your profile"}
          </Link>
          <Link href="/usage" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <Activity className={iconClass} />
            My usage
          </Link>
          <Link href="/settings" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <Settings className={iconClass} />
            Settings
          </Link>

          <div className="my-1 border-t border-border-subtle" />

          <button
            onClick={signOut}
            role="menuitem"
            className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-danger-text hover:bg-danger/10 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

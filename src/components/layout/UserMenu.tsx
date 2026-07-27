"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function UserMenu({
  email,
  displayName,
  avatarUrl,
}: {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [openRight, setOpenRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (displayName || email)[0]?.toUpperCase();

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
          className={cn(
            "absolute w-56 rounded-xl border border-border-subtle bg-surface shadow-xl overflow-hidden z-50",
            openUp ? "bottom-full mb-2" : "top-full mt-2",
            openRight ? "left-0" : "right-0"
          )}
        >
          <div className="px-3 py-2.5 border-b border-border-subtle">
            <div className="text-sm font-medium truncate">{displayName || "Revolio user"}</div>
            <div className="text-xs text-muted truncate">{email}</div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface-2 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

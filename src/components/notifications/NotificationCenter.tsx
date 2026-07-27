"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Rocket, X } from "lucide-react";
import { formatRelativeTime, cn } from "@/lib/utils";
import { RELEASE_NOTES } from "@/lib/releaseNotes";

// Body text past this length gets clamped to 2 lines in the Inbox list with
// a "Read more" toggle — short notifications just render in full.
const READ_MORE_THRESHOLD = 100;

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

const TOAST_DURATION_MS = 8000;
const MAX_TOASTS = 4;
const POLL_INTERVAL_MS = 15000;

function NotificationToast({ item, onClose }: { item: NotificationItem; onClose: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onClose(item.id), TOAST_DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <div className="pointer-events-auto w-80 rounded-xl border border-border-subtle bg-surface shadow-2xl p-3 flex gap-3 items-start animate-toast-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full accent-gradient">
        <Bell className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{item.title}</div>
        {item.body && <div className="mt-0.5 text-xs text-muted line-clamp-2">{item.body}</div>}
        <div className="mt-1 text-[11px] text-muted">{formatRelativeTime(item.created_at)}</div>
      </div>
      <button
        onClick={() => onClose(item.id)}
        className="shrink-0 text-muted hover:text-foreground transition-colors"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Bell + Magnific-style notifications drawer. The drawer is portaled to
 * <body> and slides out full-height right next to the sidebar (the old
 * in-place popover was clipped by the sidebar's backdrop-blur stacking
 * context). Two tabs: "What's new" (release notes) and "Inbox" (admin
 * broadcasts). Toasts are portaled too, for the same reason.
 */
export function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [unseenBadge, setUnseenBadge] = useState(0);
  const [toastQueue, setToastQueue] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"news" | "inbox">("news");
  const [drawerLeft, setDrawerLeft] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || drawerRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const poll = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data: { notifications?: NotificationItem[] }) => {
        const items = data.notifications ?? [];
        setNotifications(items);
        setLoaded(true);

        const unread = items.filter((n) => !n.read && !seenIds.current.has(n.id));
        if (unread.length > 0) {
          unread.forEach((n) => seenIds.current.add(n.id));
          setUnseenBadge((b) => b + unread.length);
          setToastQueue((q) => [...q, ...unread].slice(-MAX_TOASTS));
          fetch("/api/notifications/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: unread.map((n) => n.id) }),
          }).catch(() => {});
        }
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    poll();

    let interval: ReturnType<typeof setInterval> | null = null;
    function startPolling() {
      if (interval) return;
      interval = setInterval(poll, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        poll();
        startPolling();
      } else {
        stopPolling();
      }
    }
    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  function dismissToast(id: string) {
    setToastQueue((q) => q.filter((n) => n.id !== id));
  }

  function openDrawer() {
    // Anchor the drawer to the right edge of the sidebar the bell lives in.
    const aside = ref.current?.closest("aside");
    setDrawerLeft(aside ? aside.getBoundingClientRect().right + 8 : 8);
    setOpen((v) => !v);
    setUnseenBadge(0);
    setNotifications((items) => items.map((n) => ({ ...n, read: true })));
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button onClick={openDrawer} title="Notifications" className="relative icon-btn-round">
          <Bell className="h-3.5 w-3.5" />
          {unseenBadge > 0 && (
            <span className="timeline-dot-latest absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
              {unseenBadge > 9 ? "9+" : unseenBadge}
            </span>
          )}
        </button>
      </div>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={drawerRef}
            style={{ left: drawerLeft, width: Math.min(380, window.innerWidth - drawerLeft - 12) }}
            className="fixed top-2 bottom-2 z-[70] flex flex-col rounded-2xl border border-border-subtle bg-surface shadow-2xl animate-toast-in"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
              <span className="text-sm font-semibold">Notifications</span>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-2 shrink-0">
              <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface-2 p-1">
                {(
                  [
                    { id: "news", label: "What's new" },
                    { id: "inbox", label: "Inbox" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      tab === t.id ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {tab === "news" ? (
                <div className="px-2 pb-2">
                  {RELEASE_NOTES.map((note) => (
                    <div key={note.version} className="rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2/60">
                      <div className="flex items-center gap-2">
                        <Rocket className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span className="text-sm font-medium truncate">{note.title}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted">
                        {note.version} · {note.tag}
                      </div>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {note.highlights.slice(0, 3).map((h, i) => (
                          <li key={i} className="text-xs text-muted line-clamp-2">
                            • {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : !loaded ? (
                <div className="px-3 py-10 text-center text-sm text-muted">Loading…</div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-3 py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2">
                    <Bell className="h-5 w-5 text-muted" />
                  </span>
                  <div className="text-sm font-semibold">No notifications to show yet</div>
                  <p className="text-xs text-muted">You&apos;ll see helpful info here soon. Stay tuned!</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const isExpanded = expandedIds.has(n.id);
                  const isLong = n.body.length > READ_MORE_THRESHOLD;
                  return (
                    <div key={n.id} className="px-4 py-2.5 border-b border-border-subtle/60 last:border-0">
                      <div className="text-sm font-medium break-words">{n.title}</div>
                      {n.body && (
                        <div
                          className={cn(
                            "mt-0.5 text-xs text-muted whitespace-pre-wrap break-words",
                            !isExpanded && isLong && "line-clamp-2"
                          )}
                        >
                          {n.body}
                        </div>
                      )}
                      {isLong && (
                        <button
                          onClick={() => toggleExpanded(n.id)}
                          className="mt-1 text-[11px] font-medium text-accent hover:underline"
                        >
                          {isExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                      <div className="mt-1 text-[11px] text-muted">{formatRelativeTime(n.created_at)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}

      {mounted &&
        createPortal(
          <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
            {toastQueue.map((item) => (
              <NotificationToast key={item.id} item={item} onClose={dismissToast} />
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

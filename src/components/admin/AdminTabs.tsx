"use client";

import { useState, type ReactNode } from "react";
import { Users, CreditCard, Bell, MessageSquareWarning, Images } from "lucide-react";
import { cn } from "@/lib/utils";

type AdminTab = "usage" | "billing" | "notifications" | "feedback" | "references";

const TABS: { id: AdminTab; label: string; icon: typeof Users }[] = [
  { id: "usage", label: "Usage & Users", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "feedback", label: "Feedback", icon: MessageSquareWarning },
  { id: "references", label: "Reference Library", icon: Images },
];

export function AdminTabs({
  usage,
  billing,
  notifications,
  feedback,
  references,
}: {
  usage: ReactNode;
  billing: ReactNode;
  notifications: ReactNode;
  feedback?: ReactNode;
  references?: ReactNode;
}) {
  const [active, setActive] = useState<AdminTab>("usage");

  const content =
    active === "usage"
      ? usage
      : active === "billing"
      ? billing
      : active === "feedback"
      ? feedback
      : active === "references"
      ? references
      : notifications;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1 rounded-xl border border-border-subtle p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition-colors",
                isActive ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>{content}</div>
    </div>
  );
}

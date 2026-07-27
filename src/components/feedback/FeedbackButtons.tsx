"use client";

import { useRef, useState } from "react";
import { Bug, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeedbackModal, type FeedbackType } from "./FeedbackModal";

/** Sidebar-footer actions: request a resource/feature + report a bug. */
export function FeedbackButtons({ collapsed }: { collapsed: boolean }) {
  const [openType, setOpenType] = useState<FeedbackType | null>(null);
  const [drawerLeft, setDrawerLeft] = useState(8);
  const wrapRef = useRef<HTMLDivElement>(null);

  function openDrawer(type: FeedbackType) {
    const aside = wrapRef.current?.closest("aside");
    setDrawerLeft(aside ? aside.getBoundingClientRect().right + 8 : 8);
    setOpenType(type);
  }

  return (
    <div ref={wrapRef} className={cn("flex gap-2", collapsed ? "flex-col items-center" : "flex-row items-center")}>
      <button
        onClick={() => openDrawer("feature")}
        title="Request a resource or feature"
        className="icon-btn-round"
      >
        <Lightbulb className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => openDrawer("bug")} title="Report a bug" className="icon-btn-round">
        <Bug className="h-3.5 w-3.5" />
      </button>
      {openType && <FeedbackModal type={openType} left={drawerLeft} onClose={() => setOpenType(null)} />}
    </div>
  );
}

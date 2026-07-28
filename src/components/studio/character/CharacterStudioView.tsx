"use client";

import { useState } from "react";
import { BookOpen, Sparkles, Images, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { GenerateTab } from "./GenerateTab";
import { HowItWorksTab } from "./HowItWorksTab";
import { MyCharactersTab } from "./MyCharactersTab";
import { MyGenerationsTab } from "./MyGenerationsTab";

type Tab = "generate" | "how" | "characters" | "generations";

const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: "generate", label: "Generate", icon: Sparkles },
  { id: "how", label: "How it works", icon: BookOpen },
  { id: "characters", label: "My characters", icon: Users },
  { id: "generations", label: "My generations", icon: Images },
];

/**
 * Character Sheet — Revolio's take on Higgsfield's "CharLock" app: one
 * reference photo becomes a full studio character sheet (vision-LLM
 * metadata card + 24 consistent-character shots across 5 sections,
 * composited into one poster — see GenerateTab). Fully bespoke, same as
 * Effects Studio — this isn't routed through ToolStudioView, since the flow
 * (async batch generation + client-side compositing) doesn't fit its
 * generation-grid assumptions.
 *
 * The tab bar's exact 4 entries are an inference from the reference
 * screenshots — only 3 labels (How it works / My characters / My
 * generations) were ever visible alongside the tab bar itself; "Generate"
 * as the 4th/default is assumed rather than confirmed. See the Character
 * Sheet plan.
 */
export function CharacterStudioView() {
  const [tab, setTab] = useState<Tab>("generate");
  // Lifted above GenerateTab (rather than passed as a one-time initial
  // prop) for two reasons: "Use this character" from My Characters needs to
  // seed it after the fact, and every tab stays mounted the whole time (see
  // the `hidden` toggling below, not conditional rendering) specifically so
  // an in-progress sheet's polling state in GenerateTab survives switching
  // to another tab and back.
  const [pendingFaceUrl, setPendingFaceUrl] = useState<string | null>(null);

  function useCharacter(url: string) {
    setPendingFaceUrl(url);
    setTab("generate");
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border-subtle px-4 md:px-6 py-2.5 shrink-0 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {/* Every tab stays mounted (`hidden`, not conditional rendering) so a
          sheet mid-generation in GenerateTab isn't lost by navigating away.
          Each wrapper needs an explicit `h-full` — GenerateTab's own
          `min-h-full` (used to center its hero+card while idle) only
          resolves against a parent with a real computed height, and a plain
          block div with no height set resolves percentage heights as `auto`
          instead, silently killing the centering. */}
      <div className="flex-1 overflow-y-auto">
        <div className={cn("h-full", tab !== "generate" && "hidden")}>
          <GenerateTab pendingFaceUrl={pendingFaceUrl} onConsumePendingFaceUrl={() => setPendingFaceUrl(null)} />
        </div>
        <div className={cn("h-full", tab !== "how" && "hidden")}>
          <HowItWorksTab />
        </div>
        <div className={cn("h-full", tab !== "characters" && "hidden")}>
          <MyCharactersTab onUseCharacter={useCharacter} />
        </div>
        <div className={cn("h-full", tab !== "generations" && "hidden")}>
          <MyGenerationsTab />
        </div>
      </div>
    </div>
  );
}

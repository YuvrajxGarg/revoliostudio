import { Sparkles, TrendingUp, Wrench, Palette } from "lucide-react";
import { RELEASE_NOTES, type ReleaseNote } from "@/lib/releaseNotes";
import { cn } from "@/lib/utils";

const TAG_STYLE: Record<ReleaseNote["tag"], { className: string; icon: React.ComponentType<{ className?: string }> }> = {
  New: { className: "bg-accent/15 text-accent", icon: Sparkles },
  Improved: { className: "bg-surface-2 text-foreground border border-border-subtle", icon: TrendingUp },
  Fixed: { className: "bg-danger/10 text-danger-text", icon: Wrench },
  Redesign: { className: "bg-surface-2 text-foreground border border-border-subtle", icon: Palette },
};

export function ReleaseTimeline() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight">Release Notes</h1>
        <p className="text-sm text-muted mt-1.5">
          Everything we&apos;ve shipped in Revolio Studio, newest first.
        </p>
      </div>

      <div>
        {RELEASE_NOTES.map((note, i) => {
          const isLatest = i === 0;
          const isLast = i === RELEASE_NOTES.length - 1;
          const { className: tagClassName, icon: TagIcon } = TAG_STYLE[note.tag];

          return (
            <div
              key={note.version}
              className="timeline-item relative flex gap-5"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <div className="relative flex flex-col items-center w-3 shrink-0">
                <span
                  className={cn(
                    "mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-background z-10",
                    isLatest ? "bg-accent timeline-dot-latest" : "bg-border-subtle"
                  )}
                />
                {!isLast && <span className="flex-1 w-px bg-border-subtle mt-1" />}
              </div>

              <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-10")}>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[11px] font-mono font-semibold text-muted">{note.version}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      tagClassName
                    )}
                  >
                    <TagIcon className="h-2.5 w-2.5" />
                    {note.tag}
                  </span>
                  {isLatest && (
                    <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Latest
                    </span>
                  )}
                </div>

                <h2 className="text-base font-semibold text-foreground mb-2">{note.title}</h2>

                <ul className="flex flex-col gap-1.5">
                  {note.highlights.map((h, hi) => (
                    <li key={hi} className="flex gap-2 text-sm leading-relaxed text-foreground/80">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

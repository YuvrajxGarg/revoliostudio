import { ReleaseTimeline } from "@/components/release-notes/ReleaseTimeline";

export default function ReleaseNotesPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <ReleaseTimeline />
    </div>
  );
}

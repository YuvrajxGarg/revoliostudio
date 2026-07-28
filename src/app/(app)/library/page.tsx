import { Suspense } from "react";
import { LibraryView } from "@/components/library/LibraryView";

export default function LibraryPage() {
  // Suspense boundary required — LibraryView uses useSearchParams (the
  // ?category=<id> deep link, e.g. from Character Studio's "View in Library").
  return (
    <Suspense fallback={null}>
      <LibraryView />
    </Suspense>
  );
}

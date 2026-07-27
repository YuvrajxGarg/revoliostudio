import { Suspense } from "react";
import { VideoStudioView } from "@/components/studio/VideoStudioView";

export default function VideoStudioPage() {
  // VideoStudioView reads ?tab=/&model=/&prompt= (set by the Templates page)
  // via useSearchParams, which Next.js requires a Suspense boundary for.
  return (
    <Suspense fallback={null}>
      <VideoStudioView />
    </Suspense>
  );
}

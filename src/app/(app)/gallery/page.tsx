import { Suspense } from "react";
import { GalleryView } from "@/components/gallery/GalleryView";

export default function GalleryPage() {
  return (
    <Suspense fallback={null}>
      <GalleryView />
    </Suspense>
  );
}

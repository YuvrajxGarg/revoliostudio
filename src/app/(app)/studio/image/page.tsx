import { StudioView } from "@/components/studio/StudioView";

// Auth is already enforced once by the (app) layout + middleware — no need
// to re-fetch the user here too (that was tripling the auth round-trips on
// every tab switch and made navigation feel slow).
export default function ImageStudioPage() {
  return <StudioView category="image" />;
}

import { SharedGenerationView } from "@/components/gallery/SharedGenerationView";

export default async function SharedGenerationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedGenerationView token={decodeURIComponent(token)} />;
}

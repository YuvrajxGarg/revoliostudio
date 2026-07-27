import { handleGenerateRequest } from "@/lib/generate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleGenerateRequest("video", request);
}

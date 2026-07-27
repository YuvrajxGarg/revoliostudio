import { handleGenerateRequest } from "@/lib/generate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleGenerateRequest("3d", request);
}

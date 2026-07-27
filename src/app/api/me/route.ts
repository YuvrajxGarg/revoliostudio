import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Minimal client-safe identity check — currently only exposes `isAdmin`,
 * used by client components (e.g. the Featured Templates grid's hover-only
 * "Edit prompt" affordance) that have no server-component ancestor already
 * carrying the current user down as a prop.
 */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ isAdmin: user?.isAdmin ?? false });
}

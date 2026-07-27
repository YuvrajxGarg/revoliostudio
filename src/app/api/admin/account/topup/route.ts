import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTopupCheckoutSession, MuapiError } from "@/lib/muapi";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { amountUsd?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = Number(body.amountUsd);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Enter a valid top-up amount" }, { status: 400 });
  }

  try {
    const { checkoutUrl, raw } = await createTopupCheckoutSession(amount);
    if (!checkoutUrl) {
      // muapi responded but we couldn't find a recognizable checkout-URL
      // field in the payload — surface the raw body so the client can at
      // least fall back to muapi's hosted top-up page instead of failing
      // silently.
      return NextResponse.json({ error: "muapi didn't return a checkout URL", raw }, { status: 502 });
    }
    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    const message = err instanceof MuapiError ? err.message : "Failed to start top-up checkout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

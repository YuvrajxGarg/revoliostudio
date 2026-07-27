import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAccountBalance, getAutoTopupSettings, MuapiError } from "@/lib/muapi";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch both in parallel and let either fail independently — a broken
  // auto-topup lookup shouldn't hide a working balance, and vice versa.
  const [balanceResult, autoTopupResult] = await Promise.allSettled([
    getAccountBalance(),
    getAutoTopupSettings(),
  ]);

  return NextResponse.json({
    balance: balanceResult.status === "fulfilled" ? balanceResult.value : null,
    balanceError:
      balanceResult.status === "rejected"
        ? balanceResult.reason instanceof MuapiError
          ? balanceResult.reason.message
          : "Failed to fetch balance"
        : null,
    autoTopup: autoTopupResult.status === "fulfilled" ? autoTopupResult.value : null,
  });
}

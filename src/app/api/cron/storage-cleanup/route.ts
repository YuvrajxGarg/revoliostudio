import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Supabase free-plan total storage quota. Not queryable from the API, so
// this is hardcoded — bump it if the project moves to a paid plan.
const FREE_PLAN_QUOTA_BYTES = 1024 * 1024 * 1024; // 1GB

// Cleanup triggers once usage crosses this fraction of the quota, and
// deletes the oldest files (oldest-first) until usage drops back to
// TARGET_FRACTION, rather than trickling down to just under the alert
// threshold — otherwise the very next run would trip again almost
// immediately.
const ALERT_FRACTION = 0.8;
const TARGET_FRACTION = 0.6;

// How many of the oldest objects to pull per batch while walking back under
// the target. Reference uploads are typically a few MB each, so this is
// generous headroom for a single run without listing the entire bucket.
const BATCH_SIZE = 200;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: usageBytes, error: usageError } = await supabase.rpc("media_storage_usage_bytes");
  if (usageError) {
    console.error(`[cron:storage-cleanup] failed to read usage: ${usageError.message}`);
    return NextResponse.json({ error: usageError.message }, { status: 500 });
  }

  const totalBytes = Number(usageBytes ?? 0);
  const alertBytes = FREE_PLAN_QUOTA_BYTES * ALERT_FRACTION;
  const targetBytes = FREE_PLAN_QUOTA_BYTES * TARGET_FRACTION;

  if (totalBytes < alertBytes) {
    console.log(
      `[cron:storage-cleanup] usage ${(totalBytes / 1024 / 1024).toFixed(1)}MB is under the 80% alert threshold — nothing to do`
    );
    return NextResponse.json({ ranCleanup: false, totalBytes });
  }

  console.log(
    `[cron:storage-cleanup] usage ${(totalBytes / 1024 / 1024).toFixed(1)}MB crossed the 80% threshold — deleting oldest files down to 60%`
  );

  let remainingBytes = totalBytes;
  let deletedCount = 0;
  let deletedBytes = 0;
  let guard = 0; // safety valve against an infinite loop if deletes stop making progress

  while (remainingBytes > targetBytes && guard < 50) {
    guard++;
    const { data: oldest, error: listError } = await supabase.rpc("oldest_media_objects", {
      result_limit: BATCH_SIZE,
    });
    if (listError) {
      console.error(`[cron:storage-cleanup] failed to list oldest objects: ${listError.message}`);
      break;
    }
    if (!oldest || oldest.length === 0) break;

    const paths: string[] = [];
    let batchBytes = 0;
    for (const obj of oldest as { name: string; size: number }[]) {
      if (remainingBytes - batchBytes <= targetBytes) break;
      paths.push(obj.name);
      batchBytes += Number(obj.size) || 0;
    }
    if (paths.length === 0) break;

    const { error: removeError } = await supabase.storage.from("media").remove(paths);
    if (removeError) {
      console.error(`[cron:storage-cleanup] failed to delete batch: ${removeError.message}`);
      break;
    }

    deletedCount += paths.length;
    deletedBytes += batchBytes;
    remainingBytes -= batchBytes;
  }

  console.log(
    `[cron:storage-cleanup] deleted ${deletedCount} files (${(deletedBytes / 1024 / 1024).toFixed(1)}MB) — usage now ~${(remainingBytes / 1024 / 1024).toFixed(1)}MB`
  );

  return NextResponse.json({
    ranCleanup: true,
    startBytes: totalBytes,
    deletedCount,
    deletedBytes,
    endBytes: remainingBytes,
  });
}

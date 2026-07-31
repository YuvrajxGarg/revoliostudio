// Aggregates GitHub repo "views" traffic into a running cumulative total.
//
// GitHub's traffic API only exposes the last 14 days, so this script keeps a
// persistent per-day map in views.json and merges the latest 14-day window into
// it on every run (keyed by date, so re-runs overwrite rather than double-count).
// It then emits a shields.io endpoint file (views-badge.json) for the profile badge.
//
// Requires a token with push/administration access to the repo (the traffic
// endpoints need it). Uses secrets.TRAFFIC_TOKEN if set, else the Actions token.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = join(here, "views.json");
const BADGE_PATH = join(here, "views-badge.json");

const repo = process.env.REPO; // "owner/name"
const token = process.env.GH_TOKEN;

if (!repo || !token) {
  console.error("Missing REPO or GH_TOKEN environment variables.");
  process.exit(1);
}

async function loadHistory() {
  try {
    const raw = await readFile(HISTORY_PATH, "utf8");
    const data = JSON.parse(raw);
    return {
      days: data.days ?? {},
      totalViews: data.totalViews ?? 0,
      totalUniques: data.totalUniques ?? 0,
    };
  } catch {
    return { days: {}, totalViews: 0, totalUniques: 0 };
  }
}

async function fetchViews() {
  const res = await fetch(`https://api.github.com/repos/${repo}/traffic/views`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "revoliostudio-traffic-aggregator",
    },
  });

  if (res.status === 403) {
    console.error(
      "403 from the traffic API. The default GITHUB_TOKEN sometimes lacks " +
        "traffic access. Create a token with repo/administration:read access " +
        "and add it as the TRAFFIC_TOKEN secret.",
    );
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Traffic API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  return res.json();
}

function fmt(n) {
  return n.toLocaleString("en-US");
}

async function main() {
  const history = await loadHistory();
  const traffic = await fetchViews();

  // Merge the 14-day window in, keyed by calendar date. Overwriting keeps the
  // latest authoritative count for today's still-accumulating partial day.
  for (const day of traffic.views ?? []) {
    const date = day.timestamp.slice(0, 10);
    history.days[date] = { count: day.count, uniques: day.uniques };
  }

  let totalViews = 0;
  let totalUniques = 0;
  for (const { count, uniques } of Object.values(history.days)) {
    totalViews += count;
    totalUniques += uniques;
  }
  history.totalViews = totalViews;
  history.totalUniques = totalUniques;
  history.updated = new Date().toISOString();

  await mkdir(here, { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n");

  // Badge tracks cumulative UNIQUE visitors — a more honest "how many people
  // looked at this" number, since raw views are inflated by your own repeat
  // browsing and automation. (Raw totalViews is still kept in views.json.)
  const badge = {
    schemaVersion: 1,
    label: "unique visitors",
    message: fmt(totalUniques),
    color: "blue",
  };
  await writeFile(BADGE_PATH, JSON.stringify(badge, null, 2) + "\n");

  console.log(
    `Total views: ${fmt(totalViews)} (unique: ${fmt(totalUniques)}) across ` +
      `${Object.keys(history.days).length} tracked days.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

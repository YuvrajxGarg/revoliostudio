/**
 * Generation/submission failures ultimately come from muapi (or occasionally
 * a raw network/HTTP layer) and land in the UI as whatever string happened
 * to be in the response body — a FastAPI validation blob
 * (`{"detail":[{"loc":...,"msg":"field required"}]}`), a raw HTML error
 * page, a Python traceback, or an already-readable sentence. Showing that
 * verbatim in a red box reads as "random code" to anyone who isn't the
 * developer. This turns whatever we got into a short, human sentence, and
 * keeps the original around as optional "technical details" for anyone who
 * does want to see the raw text.
 */
export interface FormattedError {
  /** Short, human-readable summary — always safe to render directly. */
  message: string;
  /** Original raw text, only set when it differs meaningfully from `message`. */
  details?: string;
}

const FALLBACK = "Something went wrong. Please try again.";
const MAX_MESSAGE_LEN = 200;

function truncate(s: string, max: number): string {
  const trimmed = s.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

function capitalizeAndPunctuate(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?…]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

/** Looks like a stack trace / raw code dump rather than a sentence someone wrote. */
function looksLikeCodeOrTrace(s: string): boolean {
  if (/traceback|\bat \S+\(|\.py",? line \d+|^\s*File "/i.test(s)) return true;
  if (/<!doctype html|<html[\s>]/i.test(s)) return true;
  // A long string dense with braces/brackets/quotes reads as a data dump,
  // not prose.
  const structuralChars = (s.match(/[{}[\]"\\]/g) ?? []).length;
  return s.length > 120 && structuralChars / s.length > 0.08;
}

// Known failure patterns mapped to a clear, actionable sentence. Checked
// against the extracted candidate message (case-insensitive substring).
const KNOWN_PATTERNS: { test: RegExp; message: string }[] = [
  {
    test: /nsfw|content[\s_-]?polic|safety filter|flagged|does not comply|platform regulations/i,
    message: "This generation was blocked by the content safety filter. Try adjusting your prompt or reference image.",
  },
  {
    test: /out of memory|cuda oom|oom killed/i,
    message: "The model ran out of memory processing this request. Try a smaller size, fewer images, or a shorter duration.",
  },
  {
    test: /rate limit|too many requests|\b429\b/i,
    message: "You're sending requests too quickly. Wait a moment and try again.",
  },
  {
    test: /insufficient (credit|balance|fund)|payment required|\b402\b/i,
    message: "Your API account balance is too low for this generation. Top up credits and try again.",
  },
  {
    test: /unauthorized|invalid api key|\b401\b/i,
    message: "There's an authentication problem with the generation service. Please contact support.",
  },
  {
    test: /bad gateway|service unavailable|\b50[234]\b/i,
    message: "The generation service is temporarily unavailable. Please try again shortly.",
  },
  {
    test: /econnrefused|fetch failed|network error|failed to fetch/i,
    message: "Couldn't reach the generation service. Check your connection and try again.",
  },
];

/** Pull a candidate human message out of a parsed JSON error body. */
function extractFromParsedJson(parsed: unknown): string | null {
  if (typeof parsed === "string") return parsed;
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  // FastAPI/pydantic validation errors: { detail: [{ loc, msg, type }, ...] }
  if (Array.isArray(obj.detail)) {
    const msgs = obj.detail
      .map((d) => (d && typeof d === "object" && typeof (d as Record<string, unknown>).msg === "string"
        ? (d as Record<string, unknown>).msg as string
        : null))
      .filter((m): m is string => !!m);
    if (msgs.length > 0) {
      const unique = Array.from(new Set(msgs));
      return `Invalid request: ${unique.join("; ")}`;
    }
  }

  if (typeof obj.detail === "string") return obj.detail;
  // muapi's poll-result failures on some models come back as
  // { detail: { id, status, error } } — e.g. content-policy rejections —
  // rather than a top-level "error"/"message". Without this, the whole raw
  // JSON blob falls through to the code/trace heuristic below and the real,
  // actionable reason (e.g. "content does not comply with platform
  // regulations") gets swallowed into a generic "unexpected error".
  if (obj.detail && typeof obj.detail === "object" && !Array.isArray(obj.detail)) {
    const nested = obj.detail as Record<string, unknown>;
    if (typeof nested.error === "string") return nested.error;
    if (typeof nested.message === "string") return nested.message;
  }
  if (typeof obj.message === "string") return obj.message;
  if (typeof obj.error === "string") return obj.error;
  if (obj.error && typeof obj.error === "object") {
    const nested = obj.error as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
  }

  return null;
}

/**
 * Turn a raw error string (from a generation's `error` column, or a thrown
 * API error message) into something safe to show a user.
 */
export function formatErrorMessage(raw: string | null | undefined): FormattedError {
  const trimmedRaw = raw?.trim();
  if (!trimmedRaw) return { message: FALLBACK };

  let candidate: string | null = null;
  try {
    const parsed = JSON.parse(trimmedRaw);
    candidate = extractFromParsedJson(parsed);
  } catch {
    // Not JSON — use the raw text itself as the candidate below.
  }
  candidate = candidate ?? trimmedRaw;

  const known = KNOWN_PATTERNS.find((p) => p.test.test(candidate!));
  if (known) {
    return {
      message: known.message,
      details: trimmedRaw !== known.message ? trimmedRaw : undefined,
    };
  }

  if (looksLikeCodeOrTrace(candidate)) {
    return { message: "The generation failed with an unexpected error.", details: trimmedRaw };
  }

  const cleaned = capitalizeAndPunctuate(truncate(candidate, MAX_MESSAGE_LEN));
  const wasTruncated = candidate.trim().length > MAX_MESSAGE_LEN;
  return {
    message: cleaned || FALLBACK,
    details: wasTruncated || candidate !== trimmedRaw ? trimmedRaw : undefined,
  };
}

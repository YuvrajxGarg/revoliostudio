/**
 * Thin server-side client for the muapi.ai REST API.
 *
 * Pattern (confirmed from muapi's official CLI source):
 *   POST {BASE_URL}/{endpoint_slug}          -> { request_id, status, ... }
 *   GET  {BASE_URL}/predictions/{id}/result   -> { status, output/outputs, error }
 *   POST {BASE_URL}/upload_file (multipart)   -> { url }
 * Auth header: x-api-key: <MUAPI_API_KEY>
 *
 * This file must only be imported from server code (route handlers) —
 * it reads the secret API key from the environment.
 */

const BASE_URL = process.env.MUAPI_BASE_URL || "https://api.muapi.ai/api/v1";

function getApiKey(): string {
  const key = process.env.MUAPI_API_KEY;
  if (!key) {
    throw new MuapiError(
      "MUAPI_API_KEY is not set. Add it to your environment variables.",
      0
    );
  }
  return key;
}

export class MuapiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "MuapiError";
    this.status = status;
  }
}

function headers(): Record<string, string> {
  return {
    "x-api-key": getApiKey(),
    "Content-Type": "application/json",
  };
}

export interface MuapiSubmitResponse {
  request_id?: string;
  id?: string;
  status?: string;
  [key: string]: unknown;
}

export interface MuapiResultResponse {
  status: "queued" | "processing" | "completed" | "failed" | string;
  output?: string | string[];
  outputs?: string[];
  error?: string;
  has_nsfw_contents?: boolean[];
  [key: string]: unknown;
}

/** Submit a generation job to a given muapi endpoint slug. Returns immediately. */
export async function submitJob(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<MuapiSubmitResponse> {
  const res = await fetch(`${BASE_URL}/${endpoint.replace(/^\//, "")}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new MuapiError(text || `muapi request to ${endpoint} failed`, res.status);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { status: "processing" };
  }
}

/** Poll the current status/result of a previously submitted job. */
export async function getResult(requestId: string): Promise<MuapiResultResponse> {
  const res = await fetch(`${BASE_URL}/predictions/${requestId}/result`, {
    headers: headers(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new MuapiError(text || `failed to fetch result for ${requestId}`, res.status);
  }
  return JSON.parse(text);
}

export interface MuapiModelSchemaField {
  type?: string;
  default?: unknown;
  enum?: string[];
  minValue?: number;
  maxValue?: number;
  step?: number;
  [key: string]: unknown;
}

export interface MuapiModelSchema {
  name: string;
  cost?: number;
  cost_currency?: string;
  input_schema?: {
    schemas?: {
      input_data?: {
        properties?: Record<string, MuapiModelSchemaField>;
      };
    };
  };
  [key: string]: unknown;
}

/** Fetch a single model's real input schema (params, enums, min/max) from muapi. */
export async function getModelSchema(name: string): Promise<MuapiModelSchema> {
  const res = await fetch(`${BASE_URL}/models/${name.replace(/^\//, "")}`, {
    headers: headers(),
    // Schemas change rarely — cache for an hour.
    next: { revalidate: 3600 },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new MuapiError(text || `failed to fetch schema for ${name}`, res.status);
  }
  return JSON.parse(text);
}

/** Upload a file (e.g. a pasted reference image) and get back a hosted URL. */
export async function uploadFile(file: Blob, filename: string): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file, filename);
  const res = await fetch(`${BASE_URL}/upload_file`, {
    method: "POST",
    headers: { "x-api-key": getApiKey() },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new MuapiError(text || "muapi upload_file failed", res.status);
  }
  const data = JSON.parse(text);
  const url = data.url || data.file_url || (Array.isArray(data.output) ? data.output[0] : data.output);
  if (!url) throw new MuapiError("muapi upload_file returned no URL", 500);
  return { url };
}

/** Normalize a completed result's outputs into a flat string[] of media URLs. */
export function extractOutputUrls(result: MuapiResultResponse): string[] {
  if (Array.isArray(result.outputs)) return result.outputs.filter(Boolean) as string[];
  if (Array.isArray(result.output)) return result.output.filter(Boolean) as string[];
  if (typeof result.output === "string") return [result.output];
  return [];
}

// ── Account balance & credits ───────────────────────────────────────────
//
// Real endpoints, confirmed against muapi's own live OpenAPI spec
// (https://api.muapi.ai/openapi.json): GET /account/balance, POST
// /account/topup, GET /account/auto-topup. The spec doesn't declare typed
// response bodies for any of these (FastAPI emitted `{}` — no response
// model attached), so field names below are educated guesses from common
// naming conventions rather than a documented contract. We probe several
// candidate keys and fall back to null/raw-passthrough rather than
// assuming one exact shape, so the UI can degrade gracefully instead of
// breaking outright if muapi's real field names differ.

export interface MuapiAccountBalance {
  /** Raw JSON response, kept for debugging and as a display fallback. */
  raw: Record<string, unknown>;
  /** Parsed credit balance, if a recognizable field was found. */
  credits: number | null;
  /** Parsed USD-equivalent balance, if a recognizable field was found. */
  usd: number | null;
}

const BALANCE_CREDIT_KEYS = ["credits", "credit_balance", "balance_credits", "available_credits", "balance"];
const BALANCE_USD_KEYS = ["balance_usd", "usd_balance", "amount_usd", "usd"];

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

async function parseJsonSafe(text: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/** Fetch the authenticated account's real credit balance from muapi. */
export async function getAccountBalance(): Promise<MuapiAccountBalance> {
  const res = await fetch(`${BASE_URL}/account/balance`, { headers: headers(), cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new MuapiError(text || "Failed to fetch account balance", res.status);
  }
  const raw = await parseJsonSafe(text);
  return {
    raw,
    credits: pickNumber(raw, BALANCE_CREDIT_KEYS),
    usd: pickNumber(raw, BALANCE_USD_KEYS),
  };
}

/** Fetch the authenticated account's auto-topup configuration (read-only display). */
export async function getAutoTopupSettings(): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/account/auto-topup`, { headers: headers(), cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new MuapiError(text || "Failed to fetch auto-topup settings", res.status);
  }
  return parseJsonSafe(text);
}

const CHECKOUT_URL_KEYS = ["checkout_url", "url", "payment_url", "session_url"];

/**
 * Create a Stripe checkout session to top up credits, per muapi's own docs
 * ("Create a Stripe checkout session for topping up credits. Returns a
 * checkout URL."). The spec shows no declared request body for this POST,
 * so the amount is sent both as a query param and a JSON body key to
 * maximize the chance of matching whatever muapi actually reads — extra
 * unrecognized fields are normally just ignored by REST APIs. The caller
 * opens the returned checkout URL directly on muapi's own Stripe-hosted
 * page; this app never touches card details.
 */
export async function createTopupCheckoutSession(
  amountUsd: number
): Promise<{ checkoutUrl: string | null; raw: Record<string, unknown> }> {
  const res = await fetch(`${BASE_URL}/account/topup?amount=${encodeURIComponent(amountUsd)}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ amount: amountUsd }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new MuapiError(text || "Failed to create topup checkout session", res.status);
  }
  const raw = await parseJsonSafe(text);
  const checkoutUrl = (CHECKOUT_URL_KEYS.map((k) => raw[k]).find((v) => typeof v === "string") as string) ?? null;
  return { checkoutUrl, raw };
}

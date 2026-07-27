/**
 * Every general-purpose chat/reasoning LLM Pilot can use — for Assistant
 * mode's own "brain" and for Autopilot mode's planning step — all routed
 * through muapi.ai's unified LLM endpoint group (same submit-then-poll
 * pattern as every image/video model, see src/lib/gemini.ts), so switching
 * model is just a different endpoint slug, no new API key or vendor
 * account. Revolio already has a MUAPI_API_KEY and billing relationship.
 *
 * Pulled from muapi's own public model pages (playground/group/llm,
 * checked 2026-07-17) — 25 of their ~28 listed "Text to Text" endpoints.
 * Deliberately excludes: `generate-social-video-script` and `gpt-5-mini`
 * (both are single-purpose prompt tools built on an LLM, not general chat
 * models — offering them here as a "brain" would be misleading) and
 * `gemini-3-5-flash-openai` (an OpenAI-API-compatible wrapper around the
 * exact same underlying model as `gemini-3-5-flash`, already listed below —
 * including both would just be a confusing duplicate).
 *
 * Pricing is muapi's own listed per-million-token rate where they publish
 * one. A few (noted per-model) don't publish a per-token rate — those show
 * as "Pricing not listed" in the UI rather than a guessed number.
 */

export interface LlmModelOption {
  /** muapi endpoint slug, e.g. POST /api/v1/{id}. */
  id: string;
  label: string;
  provider: "Anthropic" | "Google" | "OpenAI" | "xAI";
  description: string;
  /** USD per million input/output tokens, per muapi's own published rate — null when muapi doesn't publish one. */
  inputPerM: number | null;
  outputPerM: number | null;
  /** Shown in a small "Recommended" section at the top of the picker. */
  recommended?: boolean;
}

export const LLM_MODELS: LlmModelOption[] = [
  // ── Anthropic ──────────────────────────────────────────────────────────
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    provider: "Anthropic",
    description: "Anthropic's flagship balanced model — cost vs. state-of-the-art performance for coding, reasoning, and multimodal analysis.",
    inputPerM: 3.0,
    outputPerM: 15.0,
    recommended: true,
  },
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    provider: "Anthropic",
    description: "Anthropic's most capable model — complex coding, long-context reasoning, agentic workflows.",
    inputPerM: 3.0,
    outputPerM: 15.0,
  },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", provider: "Anthropic", description: "Highly capable — complex coding, long-context reasoning, agentic workflows.", inputPerM: 3.0, outputPerM: 15.0 },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "Anthropic", description: "Most capable for complex coding, long-context reasoning, agentic workflows.", inputPerM: 3.0, outputPerM: 15.0 },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5", provider: "Anthropic", description: "Highly capable for complex coding, long-context reasoning, agentic workflows.", inputPerM: 3.0, outputPerM: 15.0 },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "Anthropic", description: "Strong reasoning, advanced coding, native computer-use — up to 1M token context.", inputPerM: 1.8, outputPerM: 9.0 },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic", description: "High intelligence, speed, and efficiency for code generation, writing, and logical analysis.", inputPerM: 1.8, outputPerM: 9.0 },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
    description: "Anthropic's fastest, most cost-effective model — high-frequency queries, simple tasks, near-instant responses.",
    inputPerM: 0.6,
    outputPerM: 3.0,
    recommended: true,
  },
  { id: "claude-fable-5", label: "Claude Fable 5", provider: "Anthropic", description: "Anthropic's latest flagship — advanced reasoning and creative capabilities.", inputPerM: 8.0, outputPerM: 40.0 },

  // ── Google ─────────────────────────────────────────────────────────────
  { id: "gemini-3-1-pro", label: "Gemini 3.1 Pro", provider: "Google", description: "Google's next-gen multimodal model — complex reasoning, planning, coding, multi-turn conversation.", inputPerM: 4.0, outputPerM: 24.0 },
  { id: "gemini-3-pro", label: "Gemini 3 Pro", provider: "Google", description: "Google's powerful multimodal reasoning model — complex problem solving, coding, logic.", inputPerM: 4.0, outputPerM: 24.0 },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", provider: "Google", description: "Fast, multimodal — real-time text generation, function calling, Google Search grounding.", inputPerM: 0.3, outputPerM: 1.8 },
  { id: "gemini-3-5-flash", label: "Gemini 3.5 Flash", provider: "Google", description: "High-speed, multimodal — built for real-time text generation.", inputPerM: 0.6, outputPerM: 3.6 },
  {
    id: "gemini-2-5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    description: "Google's high-speed multimodal model — rapid text generation, real-time image understanding, high-frequency tasks.",
    inputPerM: 0.3,
    outputPerM: 2.5,
    recommended: true,
  },
  { id: "gemini-2-5-pro", label: "Gemini 2.5 Pro", provider: "Google", description: "Google's advanced multimodal reasoning model — complex coding, logic, deep analysis.", inputPerM: 1.25, outputPerM: 10.0 },

  // ── OpenAI ─────────────────────────────────────────────────────────────
  { id: "gpt-5-6-terra", label: "GPT 5.6 Terra", provider: "OpenAI", description: "OpenAI's balanced multimodal reasoning model — general business and analytical tasks.", inputPerM: 5.0, outputPerM: 30.0 },
  { id: "gpt-5-6-luna", label: "GPT 5.6 Luna", provider: "OpenAI", description: "OpenAI's fast, cost-effective multimodal reasoning model.", inputPerM: 2.0, outputPerM: 12.0 },
  { id: "gpt-5-6-sol", label: "GPT 5.6 Sol", provider: "OpenAI", description: "OpenAI's flagship reasoning model — complex math, programming, scientific research.", inputPerM: 10.0, outputPerM: 60.0 },
  {
    id: "gpt-5-nano",
    label: "GPT-5 Nano",
    provider: "OpenAI",
    description: "Lightweight, high-speed — instant text generation for chatbots, assistants, and real-time tools. (Pricing not listed by muapi.)",
    inputPerM: null,
    outputPerM: null,
    recommended: true,
  },
  { id: "gpt-5-5", label: "GPT 5.5", provider: "OpenAI", description: "OpenAI's state-of-the-art flagship reasoning model for high-complexity problems.", inputPerM: 2.4, outputPerM: 16.0 },
  { id: "gpt-5-4", label: "GPT-5.4", provider: "OpenAI", description: "Powerful reasoning, coding, and professional knowledge work.", inputPerM: 1.25, outputPerM: 9.0 },
  { id: "gpt-5-2", label: "GPT 5.2", provider: "OpenAI", description: "Lightweight reasoning model — fast responses, deep coding capabilities.", inputPerM: 1.25, outputPerM: 9.0 },
  { id: "gpt-codex", label: "GPT Codex", provider: "OpenAI", description: "Advanced coding capabilities with scalable reasoning depth.", inputPerM: 1.25, outputPerM: 9.0 },

  // ── xAI ────────────────────────────────────────────────────────────────
  { id: "grok-4-3", label: "Grok 4.3", provider: "xAI", description: "Highly capable multimodal reasoning model — adjustable reasoning effort, integrated web search.", inputPerM: 2.5, outputPerM: 5.0 },
  { id: "grok-4-5", label: "Grok 4.5", provider: "xAI", description: "Highly capable multimodal reasoning model — adjustable reasoning effort, integrated web search.", inputPerM: 1.6, outputPerM: 4.8 },
];

export const DEFAULT_LLM_MODEL = "gemini-2-5-flash";

export function getLlmModel(id: string | null | undefined): LlmModelOption {
  return LLM_MODELS.find((m) => m.id === id) ?? LLM_MODELS.find((m) => m.id === DEFAULT_LLM_MODEL)!;
}

/** e.g. "$3.00 / $15.00 per M tokens" or "Pricing not listed" when muapi doesn't publish a rate. */
export function formatLlmPricing(model: LlmModelOption): string {
  if (model.inputPerM == null || model.outputPerM == null) return "Pricing not listed";
  return `$${model.inputPerM.toFixed(2)} / $${model.outputPerM.toFixed(2)} per M tokens`;
}

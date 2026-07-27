-- A thread's Chats-rail label used to just be `brief` (the raw opening
-- message, truncated with CSS) — for a long or rambly first message that
-- reads badly in a 220px-wide rail. `title` is a short (2-3 word) name
-- generated once by an LLM call right when the thread is created (see
-- generateChatTitle in lib/gemini.ts, wired in from
-- /api/orchestrator/plan/route.ts), stored alongside `brief` rather than
-- replacing it — `brief` still doubles as the actual opening message shown
-- in the transcript itself. Nullable: generation is best-effort (a failure
-- shouldn't block creating the thread), and older rows predate this column
-- entirely — both cases fall back to showing `brief` in the rail instead.
alter table public.orchestrator_runs
  add column if not exists title text;

# Revolio Studio

Revolio Studio is an AI creative studio — image, video, and 3D generation in one app — built on
top of a single unified generation REST API (muapi.ai) that fronts Nano Banana, Seedream,
Seedance, Kling, Meshy, and 100+ other models behind one API key. Users sign in with Google,
compose prompts (with reference images, start/end frame locking, @-mention tagging of gallery
images), submit jobs, and watch them complete in a live-polling gallery. Every generation is
recorded permanently per-user in Postgres; there's an admin usage dashboard gated to a single
hardcoded email.

## Stack

- **Framework**: Next.js 15/16 (App Router) + TypeScript + Tailwind CSS v4
- **Backend**: Supabase — Postgres (`generations`, `profiles` tables), Google OAuth, Storage
  (reference images / media bucket)
- **Generation provider**: unified REST API at `api.muapi.ai` — `x-api-key` auth, submit-then-poll
  pattern (`POST /{endpoint}` → `request_id`, `GET /predictions/{id}/result`)
- **Deployment**: Vercel

Scripts: `npm run dev`, `npm run build`, `npm start`, `npm run lint` (eslint).

## Key files

- [src/lib/models.ts](src/lib/models.ts) — the model registry (`MODELS: ModelConfig[]`). Large,
  mostly-declarative catalog mapping Revolio's internal model IDs to real muapi endpoint slugs,
  per-model input shapes (image/video reference keys, start/end frame support, aspect ratios,
  durations, mask support, etc). Adding a model here is enough to surface it in the composer —
  nothing else needs to change. Many entries carry doc-comments recording hard-won fixes for
  muapi slug/endpoint quirks (e.g. `submitEndpoint` overrides where the POST route differs from
  the GET schema-lookup slug) — read those comments before "fixing" a slug that looks wrong.
- [src/lib/muapi.ts](src/lib/muapi.ts) — thin server-only REST client for muapi.ai: `submitJob`,
  `getResult`, `getModelSchema` (live schema probe, used to discover real field names since muapi
  doesn't standardize them across providers), `uploadFile`, account balance/top-up helpers.
- [src/lib/generate.ts](src/lib/generate.ts) — `handleGenerateRequest`, the shared handler used by
  every category's API route. Validates the request against the model registry, builds the
  muapi payload (probing the live schema for real field names when the static registry is
  unreliable), inserts a `generations` row immediately (status `queued`), fires the muapi job
  without blocking on completion, and updates the row's status/outputs. Also special-cases
  `externalProvider` models (currently Photoroom background removal) that bypass muapi entirely.
- [src/components/composer/](src/components/composer/) — the unified prompt bar and its
  specialized variants (model selector, reference tray, start/end frame slots, @-mentions,
  settings bar, per-mode composers like Motion Control / Edit Video / 3D / Relight).
- [src/components/gallery/](src/components/gallery/) — the live-updating generation grid (used
  inline per-studio-page and on the full `/gallery` page), plus detail/compare/inpaint/upscale
  modals and video history views.

## Working rules

- Default scope for reads/edits is `src/` only.
- Only open `supabase/migrations/` when a task explicitly involves DB schema changes.
- Never read research/notes/docs files (e.g. `REVAMP-NOTES.md`, files in the parent
  `Revolio Ai Studio/` folder like `research.md`, `PROJECT_CONTEXT.md`, `higgsfield-apps-research.md`)
  unless the user asks for them in that turn.
- Prefer targeted greps/reads over exploring the whole repo tree — `src/lib/models.ts` in
  particular is huge (2000+ lines) and mostly repetitive catalog entries; grep for the specific
  model ID or field rather than reading it end to end.
- Ask for the specific file/module if a request is ambiguous, rather than searching broadly.
- **Sync with git before reading/editing anything.** At the start of a work session (or before
  making changes), run `git fetch origin` and check `git status` / `git log main..origin/main`
  for drift before touching local files. The user runs `deploy.bat`, which auto-commits, pushes
  to `origin/main`, and deploys to Vercel prod — local files can be ahead of or (if pushed from
  elsewhere) behind the remote, so confirm which is true rather than assuming local is the source
  of truth. Local branch is `main`, tracking `origin/main`, authenticated via Git Credential
  Manager (Windows) — `git fetch`/`pull`/`push` should all work without prompting.

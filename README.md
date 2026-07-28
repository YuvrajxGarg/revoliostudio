# Revolio Studio

An AI creative studio for Revolio — image, video and 3D generation in one place,
backed by a single unified generation API (Nano Banana, Seedream, Seedance, Kling,
Meshy and 100+ other models behind one API key).

## Features

- **Image** generation & editing (Nano Banana Pro/2, Seedream v4) with up to 4 reference images
- **Video** generation & editing (Seedance 2.0, Kling v3) with reference images, start+end frame
  locking, and multi-reference "omni" mode
- **3D** generation (Meshy) — text-to-3D and image-to-3D, previewed in-browser via `<model-viewer>`
- Paste an image straight into the prompt bar to attach it as a reference
- Type `@` in the prompt to tag any image from your own gallery as a reference
- Every generation appears in the gallery instantly and keeps polling until done —
  you can keep generating while earlier jobs are still processing
- Full generation history, never deleted, per user
- Google sign-in, with an admin panel  showing every
  user's usage broken down by model/category

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase: Postgres (generations + profiles), Google OAuth, Storage (reference images)
- Unified generation REST API (`x-api-key` auth, submit → poll pattern)
- Deployed on Vercel

## One-time setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/migrations/0001_init.sql` — this creates the
   `profiles` / `generations` tables, RLS policies, the `media` storage bucket, and
   the `admin_user_usage` view. It also auto-grants admin to `admin@email` the
   moment that account signs in.
3. In **Authentication -> Sign In / Providers -> Google**, enable Google and add your
   OAuth Client ID + Secret (create these in Google Cloud Console -> APIs & Services ->
   Credentials -> OAuth Client ID -> Web application). Add these authorized redirect URIs:
   - `https://<your-project>.supabase.co/auth/v1/callback`
   - `https://revoliostudio.vercel.app/auth/callback` (and your local dev URL while testing)
4. Copy **Project URL**, **anon public key**, and **service_role key** from
   Project Settings -> API.

### 2. Generation provider

1. Get your API key from your generation provider's dashboard -> API Keys.
2. That's it — no other provider accounts needed, one key covers Nano Banana,
   Seedream, Seedance, Kling and Meshy.
3. The exact Meshy endpoint slugs weren't publicly documented at build time — if
   3D generation errors with "not found", check your provider's API playground for
   the real slug and set `MUAPI_MESHY_IMAGE_TO_3D_ENDPOINT` / `MUAPI_MESHY_TEXT_TO_3D_ENDPOINT`
   env vars to match (see `.env.example`).

### 3. Environment variables

Copy `.env.example` to `.env.local` (for local dev) and fill in the values above.
On Vercel, add the same variables under Project Settings -> Environment Variables.

### 4. Run locally

```bash
npm install
npm run dev
```

### 5. Deploy

Push to a Git repo and import into Vercel, or deploy directly — the project has no
build-time requirement beyond the env vars above.

## Project structure

- `src/lib/models.ts` — the model registry. Add a new model here and it
  shows up in the composer automatically.
- `src/lib/api.ts` — the generation provider's REST client (submit / poll / upload).
- `src/lib/generate.ts` — shared handler that builds the request payload per model
  mode and writes the `generations` row.
- `src/components/composer/` — the unified prompt bar (reference tray, start/end
  frame slots, @-mentions, model + settings selectors).
- `src/components/gallery/` — the live-updating generation grid, used both inline
  on each studio page and on the full `/gallery` page.
- `src/app/(app)/admin/` — usage dashboard.

## Notes

- Usage is currently unmetered (no per-user credit caps) — the admin panel is
  visibility-only. Add a `credits` column to `profiles` and check it in
  `lib/generate.ts` if you want to enforce limits later.
- Generated media URLs are whatever the generation provider returns; the
  app does not currently re-host them in Supabase Storage. If you need long-term
  guaranteed availability, add a step in `/api/jobs/[id]` that downloads the
  output and re-uploads it to the `media` bucket on completion.

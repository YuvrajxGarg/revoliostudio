# Magnific-style revamp — what changed & how to run it

## One required step: database migration
New features (projects, templates, resources bank) need new tables.
Open **Supabase Dashboard → SQL Editor** and run, once each:
1. `supabase/migrations/0014_magnific_revamp.sql` (projects, templates, resources + seeds)
2. `supabase/migrations/0015_feedback.sql` (feature requests & bug reports)

## Run locally
```
npm install        # picks up the new Google fonts automatically at build time
npm run dev        # http://localhost:3000
```

## What's new
- **Design system**: Magnific neutrals (#0f0f0f / #1a1a1a) + Revolio orange accent,
  Geist + Geist Mono fonts, Schibsted Grotesk for display headings,
  10px uppercase panel labels, 16px card / 8px button radii.
- **Night & bright mode**: toggle in the sidebar footer, persisted per browser.
- **App shell**: Magnific-style left nav (Create button, Home / Library / Projects /
  Resources / Usage, TOOLS group, utilities pinned at bottom). Compact top bar on mobile.
- **Home dashboard** (`/home`): greeting, prompt search, tool tiles, recent work, what's new.
- **Projects**: create/rename/delete projects (`/projects`), file new generations under a
  project via the chip in each studio panel, filter the Library by project chips.
- **Templates**: save any composer setup (model + prompt + settings + references) with the
  "Template" button in a studio panel header; reuse from the "My templates" tab.
- **Model picker**: searchable, grouped by provider with counts, Featured section,
  capability badges (Refs / mode / price).
- **Settings**: aspect ratios now show Magnific-style names (1:1 — Square, 16:9 — Widescreen…).
- **Audio Generator** (`/studio/audio`): fully wired (page + API route + gallery tab), but
  muapi's verified catalog has no audio models yet — add one entry to `src/lib/models.ts`
  with `category: "audio"` when a slug is available and it lights up automatically.
- **Resources bank** (`/resources`): admin-managed library of editing/design/AI tools with
  thumbnails, tags, Visit/Download links. Admins get Add/Edit/Delete; everyone can browse.

## 2026-07-15 — Start/end frames, batch outputs, Templates, Tool Drawer, Typography

- **Start/End frame everywhere it's real**: `supportsStartEndFrame` now also covers
  Seedance 2.0 VIP i2v (2-image start+end transition) and Kling v3 4K i2v (separate
  `last_image` field, previously unwired) — both now show explicit Start/End frame
  slots instead of a generic reference tray. `generate.ts`'s payload builder handles
  both muapi shapes (images_list pair, or image_url + a named end-frame field).
- **Multiple outputs**: when a model generates several images in one job
  (`numImages` > 1), the gallery card shows a "×N" badge and the detail panel gets a
  thumbnail strip to page through outputs, download one, or "Download all".
- **Templates page** (`/templates`, `src/lib/presets.ts`): curated, admin-defined
  presets (Motion Control, Performance Transfer, Video Effects, Start/End Frame,
  Image Effects) — pick one, add your own image/video, generate. Backed by real
  verified muapi endpoints, including newly-added Kling v3/v2.6 Motion Control,
  AI Dance Effects, AI Video Face Swap, Luma Flash Reframe, Autocrop, and Video
  Watermark Remover (see `src/lib/models.ts`, "Motion control & video effects").
  Linked from the sidebar and from both studio headers.
- **Tool Drawer**: grid icon in the sidebar header opens an app-launcher-style list
  of every studio/workspace destination (`src/lib/tools.ts`); pin any of them and
  they show up in a "Pinned" section of the sidebar (`src/store/toolPinsStore.ts`,
  per-browser via localStorage, same pattern as the collapsed-sidebar state).
- **Typography Slate** (`/studio/typography`): upload a lettering-style reference,
  type the text you want, optionally override the color or add extra instructions.
  Runs an image-edit model to match the font/color/effect, then automatically chains
  into the existing background remover to output a transparent PNG.

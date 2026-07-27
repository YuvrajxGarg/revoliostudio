-- Revolio Studio — Magnific-style revamp: projects, templates, resources.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ── projects ─────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  color text not null default '#e85002',
  created_at timestamptz not null default now()
);

create index if not exists projects_user_idx on public.projects (user_id, created_at desc);

alter table public.projects enable row level security;

drop policy if exists "users read own projects" on public.projects;
create policy "users read own projects"
  on public.projects for select using (auth.uid() = user_id);
drop policy if exists "users insert own projects" on public.projects;
create policy "users insert own projects"
  on public.projects for insert with check (auth.uid() = user_id);
drop policy if exists "users update own projects" on public.projects;
create policy "users update own projects"
  on public.projects for update using (auth.uid() = user_id);
drop policy if exists "users delete own projects" on public.projects;
create policy "users delete own projects"
  on public.projects for delete using (auth.uid() = user_id);

-- Generations can optionally belong to a project.
alter table public.generations
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists generations_project_idx on public.generations (project_id);

-- ── templates ────────────────────────────────────────────────────────────
-- A saved composer setup: model + prompt + settings, reusable in one click.
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  category text not null,
  model_id text not null,
  prompt text not null default '',
  settings jsonb not null default '{}'::jsonb,
  reference_urls text[] not null default '{}',
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create index if not exists templates_user_idx on public.templates (user_id, category, created_at desc);

alter table public.templates enable row level security;

drop policy if exists "users read own templates" on public.templates;
create policy "users read own templates"
  on public.templates for select using (auth.uid() = user_id);
drop policy if exists "users insert own templates" on public.templates;
create policy "users insert own templates"
  on public.templates for insert with check (auth.uid() = user_id);
drop policy if exists "users update own templates" on public.templates;
create policy "users update own templates"
  on public.templates for update using (auth.uid() = user_id);
drop policy if exists "users delete own templates" on public.templates;
create policy "users delete own templates"
  on public.templates for delete using (auth.uid() = user_id);

-- ── resources ────────────────────────────────────────────────────────────
-- Admin-curated bank of editing/design/AI tools, plugins and learning
-- material. Every signed-in user can browse; only admins manage entries.
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null check (category in ('editing','design','ai-tools','plugins','learning','stock')),
  url text not null,
  download_url text,
  thumbnail_url text,
  tags text[] not null default '{}',
  sort_order int not null default 100,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists resources_category_idx on public.resources (category, sort_order, created_at desc);

alter table public.resources enable row level security;

drop policy if exists "authenticated users read resources" on public.resources;
create policy "authenticated users read resources"
  on public.resources for select using (auth.role() = 'authenticated');
drop policy if exists "admins insert resources" on public.resources;
create policy "admins insert resources"
  on public.resources for insert with check (public.is_admin());
drop policy if exists "admins update resources" on public.resources;
create policy "admins update resources"
  on public.resources for update using (public.is_admin());
drop policy if exists "admins delete resources" on public.resources;
create policy "admins delete resources"
  on public.resources for delete using (public.is_admin());

-- ── starter content for the resources bank ──────────────────────────────
-- Only seeds once: skipped entirely if any resources already exist.
do $seed$
begin
  if exists (select 1 from public.resources limit 1) then
    return;
  end if;
insert into public.resources (title, description, category, url, download_url, thumbnail_url, tags, sort_order) values
  ('DaVinci Resolve', 'Hollywood-grade video editing, color grading and Fusion VFX — the free tier is fully usable for professional work.', 'editing', 'https://www.blackmagicdesign.com/products/davinciresolve', 'https://www.blackmagicdesign.com/products/davinciresolve', 'https://www.google.com/s2/favicons?domain=blackmagicdesign.com&sz=128', '{video,color,free}', 10),
  ('CapCut Desktop', 'Fast social-first video editor with auto-captions, templates and effects. Great for shorts and reels.', 'editing', 'https://www.capcut.com', 'https://www.capcut.com/tools/desktop-video-editor', 'https://www.google.com/s2/favicons?domain=capcut.com&sz=128', '{video,shorts,free}', 20),
  ('Photopea', 'Full Photoshop-style editor that runs in the browser — opens PSD, XCF, Sketch and exports anything.', 'editing', 'https://www.photopea.com', null, 'https://www.google.com/s2/favicons?domain=photopea.com&sz=128', '{photo,psd,free,browser}', 30),
  ('GIMP', 'Open-source image editor for retouching, compositing and authoring. Fully scriptable.', 'editing', 'https://www.gimp.org', 'https://www.gimp.org/downloads/', 'https://www.google.com/s2/favicons?domain=gimp.org&sz=128', '{photo,open-source,free}', 40),
  ('Figma', 'Collaborative interface design, prototyping and whiteboarding. The free tier covers most solo work.', 'design', 'https://www.figma.com', null, 'https://www.google.com/s2/favicons?domain=figma.com&sz=128', '{ui,prototyping,collab}', 10),
  ('Blender', 'The open-source 3D suite — modeling, sculpting, geometry nodes, animation and rendering.', 'design', 'https://www.blender.org', 'https://www.blender.org/download/', 'https://www.google.com/s2/favicons?domain=blender.org&sz=128', '{3d,open-source,free}', 20),
  ('Inkscape', 'Open-source vector editor for logos, icons and illustration — the free Illustrator alternative.', 'design', 'https://inkscape.org', 'https://inkscape.org/release/', 'https://www.google.com/s2/favicons?domain=inkscape.org&sz=128', '{vector,open-source,free}', 30),
  ('Coolors', 'Instant palette generator with contrast checking and export to every format.', 'design', 'https://coolors.co', null, 'https://www.google.com/s2/favicons?domain=coolors.co&sz=128', '{color,palette,free}', 40),
  ('Google Fonts', 'The full open-source font library with pairing previews and variable-font playground.', 'design', 'https://fonts.google.com', null, 'https://www.google.com/s2/favicons?domain=fonts.google.com&sz=128', '{fonts,free}', 50),
  ('ComfyUI', 'Node-based Stable Diffusion / Flux workflow builder — the power-user way to run local image models.', 'ai-tools', 'https://www.comfy.org', 'https://www.comfy.org/download', 'https://www.google.com/s2/favicons?domain=comfy.org&sz=128', '{diffusion,local,node-based}', 10),
  ('Civitai', 'The biggest hub for community image-model checkpoints, LoRAs and embeddings.', 'ai-tools', 'https://civitai.com', null, 'https://www.google.com/s2/favicons?domain=civitai.com&sz=128', '{models,lora,community}', 20),
  ('Hugging Face', 'Models, datasets and Spaces for every modality — the GitHub of machine learning.', 'ai-tools', 'https://huggingface.co', null, 'https://www.google.com/s2/favicons?domain=huggingface.co&sz=128', '{models,datasets,community}', 30),
  ('Upscayl', 'Free desktop AI upscaler (Real-ESRGAN family) that runs entirely on your own GPU.', 'ai-tools', 'https://upscayl.org', 'https://upscayl.org/download', 'https://www.google.com/s2/favicons?domain=upscayl.org&sz=128', '{upscale,local,free}', 40),
  ('Frame.io Transfer', 'Fast large-file review and hand-off for video teams.', 'plugins', 'https://frame.io', null, 'https://www.google.com/s2/favicons?domain=frame.io&sz=128', '{review,video,collab}', 20),
  ('Unsplash', 'Free high-resolution photography, safe for commercial use.', 'stock', 'https://unsplash.com', null, 'https://www.google.com/s2/favicons?domain=unsplash.com&sz=128', '{photos,free}', 10),
  ('Pexels', 'Free stock photos and video footage with a generous license.', 'stock', 'https://www.pexels.com', null, 'https://www.google.com/s2/favicons?domain=pexels.com&sz=128', '{photos,video,free}', 20),
  ('Mixkit', 'Free stock video, music and sound effects for edits and reels.', 'stock', 'https://mixkit.co', null, 'https://www.google.com/s2/favicons?domain=mixkit.co&sz=128', '{video,music,sfx,free}', 30)
;
end
$seed$;

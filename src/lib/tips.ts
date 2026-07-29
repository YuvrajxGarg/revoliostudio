/**
 * "Tip of the day" copy for the Home dashboard — one random tip shown per
 * page load. Every tip should point at something the user can actually go
 * do in Revolio (a real studio, model, or feature), not generic AI advice.
 */
export const TIPS: string[] = [
  // Image Studio
  "In the Image Studio, switch models without losing your prompt — try the same prompt on Nano Banana Pro and Seedream v4 to compare styles side by side.",
  "Need on-brand product shots? Use the \"Studio Product Shot\" featured template in Templates — it drops your photo onto a clean studio background with proper lighting in one click.",
  "GPT Image 2 and Midjourney v7/v8 are both in the Image Studio's model picker — GPT Image 2 follows instructions more literally, Midjourney leans more stylized.",
  "Use an Edit model (like Nano Banana 2 Edit or Flux Kontext Pro) instead of a fresh text-to-image generation when you want to change one thing in an existing photo without redrawing the whole scene.",
  "Ideogram v3 in the Image Studio is worth reaching for specifically when your image needs legible text or lettering baked in.",
  "Flux PuLID is built for face-consistent generations — use it when you need the same character's face across multiple images.",
  "The \"Background Swap\" featured template keeps your subject untouched and only replaces what's behind them — faster than prompting a full re-generation.",
  "Upscale & Enhance uses Topaz — run it on any generation from your Library that came out a little soft before you export it.",
  "Imagen 4 Ultra and Seedream 5.0 Pro are your highest-fidelity image options when a client-facing deliverable needs the extra detail.",

  // Video Studio — Create
  "Create Video isn't limited to one model — Kling v3, Veo 3.1, Sora 2, and Pixverse v6 are all in the same tab, so you can test a prompt across providers before committing credits to a long render.",
  "Sora 2 Pro and Veo 4 are worth the extra cost specifically for shots with complex physics or crowds — cheaper models tend to fall apart there.",
  "Kling v3 4K is the one to reach for when the output is going straight to a big screen or a paid ad placement.",
  "Wan 2.7 and Seedance Lite are good picks when you're iterating fast and don't need final-quality output yet — save the premium models for your last pass.",

  // Video Studio — Edit / Motion Control
  "Wan 2.2 Animate is in the Motion Control tab now — switch to \"Replace\" mode to swap a character into an existing video while keeping the original motion.",
  "Some Create Video models accept an optional video reference right alongside your image — look for the \"Video reference (optional)\" slot under References when a model supports it.",
  "The \"Motion Control\" tab lets you apply a camera move — dolly, orbit, crane, hyperlapse — to a video you already have, instead of re-generating the whole clip from scratch.",
  "\"Dolly In\" under Motion Control in Featured Templates is the fastest way to add a tension-building push-in to any clip without hand-writing the camera-move prompt yourself.",
  "Pick any Featured Template and it now shows as a preview card at the top of the composer instead of filling the prompt box — type extra detail in the prompt box if you want, both get combined when you hit Generate.",
  "\"Act As Character\" under Performance Transfer needs two uploads — a performance video and a character photo — and it maps the performance onto your character.",
  "Reframe to Vertical (Luma Flash) expands a landscape clip to 9:16 instead of cropping it — better for Reels/TikTok when your subject is near the frame edge.",
  "Smart Autocrop tracks the subject automatically, which beats a fixed crop when your subject moves around the frame.",
  "\"Remove Watermark\" in Video Effects can clean stray logos or overlaid text off a clip before you reuse it.",
  "\"Dance It\" adds dance motion to a character clip in one click — handy for quick social content without a full animation prompt.",
  "Face Swap in the Edit Video tab carries over expression and lighting, not just the face shape — for best results use a source clip with clear, well-lit faces.",
  "Morph Between Two Shots (Seedance 2.0) and Locked Start & End (Kling v3 4K) both let you lock a start and end frame — use these when you need a specific opening and closing shot, not just \"something in between.\"",
  "Seamless Transition (Pixverse) is purpose-built for cutting between two unrelated shots smoothly — better than a hard cut when the mood should carry through.",

  // Typography Generator
  "The Typography Generator tool studies an existing lettering style from your reference and renders new text in that same style — great for matching a logo's font on new copy.",
  "Toggle \"transparent background\" on in Typography Generator to get a real alpha-channel PNG straight from GPT Image 2 — no green screen or separate cutout step needed.",
  "Flip transparent background off in Typography Generator and you get a clean chroma-key green plate from Nano Banana 2 instead — useful if you want to key it out yourself in an external editor.",
  "Typography Generator accepts up to 4 reference images — feed it multiple angles or letters of the same style for a more consistent match.",

  // Thumbnail Generator
  "Thumbnail Generator's reference upload is optional — skip straight to Casting and Scene if you'd rather build a look from scratch.",
  "Before you hit Render, the exact prompt Thumbnail Generator is about to send is shown and fully editable — tweak it directly if you want more control than the form gives you.",
  "Use \"Preview in feed\" on a finished thumbnail to see how it actually reads next to a title, both in the feed and in search results, before you ship it.",
  "Each Scene category in Thumbnail Generator can take its own reference photo, not just a text description — upload a real product shot or location photo for a closer match, alongside character face photos.",
  "Thumbnail Generator's reference image has a \"Use as layout reference\" checkbox — leave it on to attach the image as a loose framing guide, or turn it off to use the reference for its text analysis only.",

  // Explainer Storyboard Generator
  "Explainer Storyboard Generator works from a rough topic too, not just a finished script — Claude will expand it into a narrative before breaking it into shots.",
  "You can render just one shot in Explainer Storyboard Generator instead of the whole batch — each panel has its own Render/Redo button.",
  "Upload a brand kit page or icon set as a style reference in Explainer Storyboard Generator and every shot will match its look, not just the first one.",

  // Background removal
  "The \"Remove Background\" tool runs on Photoroom under the hood, not a generic AI cutout — it's the one to reach for when edges (hair, fur, thin objects) need to stay clean.",
  "\"Transparent Cutout\" in Featured Templates is the same background remover, pre-wired so you don't have to pick the model yourself.",

  // 3D Studio
  "The 3D Studio's Meshy models can go from a single image straight to a textured 3D mesh — no need to draw or model anything by hand.",
  "Meshy Multi-Image to 3D takes several angles of the same object and produces a more accurate mesh than a single photo alone.",
  "Text to 3D in the 3D Studio skips images entirely — describe the object and Meshy builds the mesh from the prompt.",

  // Audio Studio
  "The Audio Studio isn't just for music — try it for quick voice-over or sound-effect generation to pair with a video you just made.",
  "The Audio Studio now includes Suno and MMAudio — Suno lets you set a music style and write your own lyrics (or leave the lyrics box blank to let the model write them).",
  "Toggle \"Instrumental\" on in the Audio Studio to skip vocals entirely and get a music-only track.",

  // Templates / Presets
  "Featured templates are pre-wired combinations of a model + prompt + settings — using one saves you from hand-tuning a prompt that's already been tested.",
  "\"My templates\" saves your own composer setup (model, prompt, settings, references) so you can rerun a winning combo without rebuilding it from scratch.",
  "Featured templates are grouped by category — filter by \"Motion Control,\" \"Video Effects,\" or \"Image Effects\" in Templates to browse just the presets relevant to what you're making.",
  "Save a template right after a generation you're happy with — the settings that worked are easiest to capture in the moment, before you forget what you changed.",
  "Motion Control now has 30 presets covering the full standard camera-move vocabulary — whip pans, dolly zoom, drone rise/descend, arcs, rack focus pulls, and more — not just the original four.",
  "Try the \"Viral Scene Drops,\" \"Character & Game Styles,\" and \"Retro & Art Styles\" template groups for one-click single-photo effects — upload a photo, pick a template, no prompting needed.",
  "Image Generator's My Templates tab now shows Featured Templates too, same as Video — no need to leave the Image Studio to browse curated presets.",

  // Library / Gallery / Projects
  "Select one generation in the Library and you can click straight across other cards to add them to the selection — no need to hunt for each checkbox — then batch-delete or file them all into a project at once.",
  "Open any generation's details panel to see every reference image, frame, or video that went into it, not just the prompt.",
  "The Library search bar on Home searches by prompt text — if you remember roughly what you typed, you can find an old generation faster than scrolling.",
  "Group related generations into a Project when you're working on a multi-shot piece — it keeps every version and variant in one place instead of scattered through your Library.",
  "Switch the Library between list and grid view depending on the task — grid is faster for visually scanning many outputs, list is better for comparing prompts side by side.",
  "Every completed generation in your Library has quick tool actions (upscale, remove background, and more) right on the card — you don't need to reopen the studio to run a follow-up edit.",

  // Resources
  "The Resources page curates external editing & design tools alongside Revolio's own generators — check it before assuming you need to leave the app for something.",

  // Workflow / general
  "Click the expand icon next to any composer's prompt box (or press ⌘E / Ctrl+E) to open the Prompt editor — a bigger writing surface plus an AI panel that can chat, suggest a random or auto-expanded prompt, or turn a reference image into prompt text for you.",
  "Pin your most-used studios and tools to the sidebar from the \"All tools\" drawer — unpin anything you don't touch often to keep the nav focused.",
  "When a model has both a base and an \"Edit\" version (e.g. Nano Banana 2 vs. Nano Banana 2 Edit), the base is for generating from scratch and Edit is for modifying something you upload.",
  "\"Turbo\" and \"Fast\" variants (like Flux.2 Klein 4B Turbo) trade a little quality for speed — use them for drafts, then switch to the full model for your final pass.",
  "Check the Usage page periodically if you're running a lot of generations — it's the fastest way to see where your credits are actually going.",
  "Release notes are the quickest way to find out about a newly added model or feature without having to dig through every studio to notice what changed.",
  "If a generation comes out close but not quite right, an Edit model with a references image of your own output is often faster than rewriting the prompt from zero.",
  "Kling, Seedance, and Veo each have multiple tiers (Standard/Pro/4K or similar) — start on the cheaper tier while you're dialing in the prompt, then re-run on the top tier once it's right.",

  // Autopilot
  "Autopilot plans a multi-step brief for you — describe the end result (\"a product ad for these headphones\") and it picks real models and chains the steps, instead of you building each generation by hand.",
  "Always review Autopilot's plan and cost estimate before running it — it shows exactly which models it picked and what each step will cost, and you can discard a plan you don't like with no charge.",
  "Autopilot results land straight into a new Project, so a multi-step run stays grouped together instead of scattering across your Library.",
  "Autopilot is a real conversation now — after a plan finishes (or before you even run it), send a follow-up like \"also make a square version\" and it adds new steps onto the same thread instead of starting over.",
  "Use the @ button in Autopilot to attach a reference image — upload one or pull from your Library — and it'll tell the planner which step should actually use it.",
  "Pick Autopilot's planning model with the pill next to the input — it's locked in per thread, so start a new chat if you want to compare a brief across different planners.",

  // Pilot (Assistant + Autopilot)
  "Autopilot is now one half of Pilot — the other half, Assistant mode, is a normal chat for brainstorming or asking questions, with no generation ability of its own. Switch between them with the toggle at the top of a new Pilot chat.",
  "Pilot's model picker has 25 chat models — Claude, Gemini, GPT, and Grok — with real per-million-token pricing shown right in the list, so you can pick on cost as easily as on capability.",
  "Cheaper isn't always worse for Pilot's Assistant mode — Gemini 2.5 Flash or GPT-5 Nano are plenty for quick questions; save the pricier flagship models (Claude Opus, GPT 5.6 Sol) for genuinely hard reasoning.",
  "In Autopilot mode, a follow-up like \"change step 2 to Seedance\" edits that step in place — it won't add a duplicate. Only steps that haven't run yet can be edited or removed this way.",
  "Attaching more than one reference image to a Pilot brief? Type a quick label under each one (e.g. \"main character\", \"background\") — it helps the planner actually use the right image for the right step instead of guessing.",
  "Every Pilot chat gets a short auto-generated name in the Chats rail as soon as you send your first message — no need to rename threads yourself to tell them apart.",

  // Sidebar / navigation
  "Drag any pinned tool in the sidebar to put your most-used ones right at the top — the order is saved and sticks around after you refresh.",
  "Pin a tool from \"All tools\" and it lands under the Tools section, ready to reorder however you like.",
  "The sidebar's Create menu jumps straight into Thumbnail Generator or Explainer Storyboard without pinning them first — handy for a one-off.",
  "Sensitive to on-screen motion? Turning on \"Reduce motion\" in your OS settings shortens or removes Revolio's decorative animations automatically.",

  // Account menu
  "Set a username in Settings and you get a public profile page: your published work, your stats, and a year of activity at a glance. Open it any time from My profile in the account menu.",
  "Wondering where the credits went? My usage in the account menu breaks your spend down by model, with weekly and monthly charts.",
  "Your account menu lives behind your avatar in the top right. Profile, usage and settings are all one click from there.",

  // Reference Library
  "Hit the Style or Character button next to References in any composer to open the Reference Library — browse Style, Character, Location, and Element picks, or one-click prompt tags for Camera, Effects, and Color.",
  "Upload an image into the Reference Library and give it a name to save it as a reusable Style or Character — pick it by name in any future generation instead of re-uploading it each time.",

  // Projects, Trash, Favorites & Library
  "Deleting a generation or project doesn't remove it right away — it goes to Trash on the Projects page, where you can restore it or delete it forever.",
  "Star a generation from its hover toolbar in any gallery to add it to Favorites — find every starred generation in one place on the Projects page.",
  "Create a \"Team\" project instead of a Personal one to share it — invite another Revolio user by name or email and they'll see and can add to that project's generations too.",
  "The new Library page (not just the composer's picker) is where to manage your saved Style/Character/Location/Element references — including deleting ones you no longer need.",
  "Attaching multiple reference categories at once (Style + Character + Location, say)? Each one now gets tagged by its image position in the prompt automatically, so the model knows exactly which attached image each description refers to.",
  "Your prompt box stays exactly what you type — reference category labels (Style, Character, etc.) are woven in automatically right when you hit Generate, not the moment you attach the image, so reordering or removing a reference beforehand won't leave a stale label behind.",
  "Need better character consistency? Hit the small + on a filled Character reference tile to add more photos of the same person to that same slot — they're described to the model as one consistent subject, not separate characters.",
  "Only need to change one part of an image? Hover it in any gallery and hit the brush icon — Inpaint lets you paint over just that area and describe the change, leaving the rest of the photo untouched.",
  "Long prompt in a side-panel composer (Image/Video/Audio generator)? The prompt box now caps its height and scrolls internally instead of pushing the Generate button off screen — no need to shorten what you type.",
  "A generation failed? Hit Retry right on the card — it re-runs the exact same prompt and settings without you rebuilding anything.",
  "Want to judge two results head-to-head? Open a generation's details and use Compare — pick another generation and see them side-by-side at the same size.",
  "Proud of a generation? Open its details and hit Publish to share it on the Community feed — or grab a public link anyone can open without an account.",
  "Need a wider shot? Open an image's details and use Generative Expand to grow the canvas and let the model paint what's beyond the original edges.",
  "Every gallery has a search box and a Filters button now — narrow by date, tool, favorited, or aspect ratio to find any past generation fast.",
  "Working in a Team project? Drop comments on any generation right in its detail panel so your collaborators see your notes.",
  "Do the same multi-step thing often? Plan it once in Pilot, hit “Save as Flow,” and re-run it anytime with a new input — find your Flows in the sidebar.",
  "Publish a Flow to the Community and anyone can run it; “Personalize” someone else's Flow to save an editable copy of your own.",
  "Open Spaces in the sidebar to build a workflow visually — wire Image and Text nodes into a Generate node, then Run it. Flows live in a tab there too.",
  "In Spaces, drag a node's bottom edge to make it taller, or its bottom-right corner to resize both ways — expand a Generate node to see its output large.",
  "Hover any node in Spaces for a floating toolbar: Run it, Duplicate it, or Delete it without hunting through menus.",
  "Organise a busy Space with Group frames — drop a titled frame down for each section (Character, Product, Scene) — and drop Sticky notes anywhere to leave yourself notes.",
];

/** Picks one tip at random. Client components can call this on every render/refresh for a rotating tip. */
export function randomTip(): string {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

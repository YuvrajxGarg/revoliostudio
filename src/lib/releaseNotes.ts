export interface ReleaseNote {
  version: string;
  title: string;
  tag: "New" | "Improved" | "Fixed" | "Redesign";
  highlights: string[];
}

/**
 * Newest first. This is a hand-maintained changelog — add an entry here
 * whenever a batch of shipped work is worth surfacing to users on the
 * /release-notes page.
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "v1.76",
    title: "Home's Tools section now shows your most-used custom tools",
    tag: "Improved",
    highlights: [
      "Tools on Home now shows only the single-purpose studios — Thumbnail Generator, Explainer Storyboard, Typography, Character, Headshot, Logo, Restore, Product, Reframe, Upscale, Stickers, Relight, Angle — never Image/Video/Audio/3D (already their own tiles) or Gallery/Projects/Library/Resources/Templates.",
      "This list is no longer tied to what's pinned in the sidebar — it's ranked by which of these tools you actually open most, and updates as your usage does.",
    ],
  },
  {
    version: "v1.75",
    title: "Home: real Tools, Templates & Library sections",
    tag: "New",
    highlights: [
      "Added three new sections to Home, below Recent work — Tools (your pinned studios, plus an All tools link), Templates (a Featured Templates preview you can apply straight from Home), and Library (a peek at your saved Style/Character/Location/Element references).",
      "Removed the sitewide orange keyboard-focus outline — it was showing up as a harsh box on text inputs (search bars, prompt boxes) even on a normal click, not just keyboard navigation.",
    ],
  },
  {
    version: "v1.74",
    title: "Home: a fuller quick-tile row, and boxed Recent work",
    tag: "Improved",
    highlights: [
      "The row of quick tiles under the search bar now also includes Gallery, Projects, Templates, and an \"All tools\" tile that opens the same drawer as the sidebar — not just Image/Video/Audio/3D/Pilot/Library/Resources.",
      "Recent work now shows as a clean, evenly-gapped grid of boxed cards with rounded corners and a colored category badge, instead of a tightly packed collage.",
      "Trimmed the sidebar's Create quick-menu back down to just Image, Video, Audio, and 3D — everything else stays reachable from All tools.",
    ],
  },
  {
    version: "v1.73",
    title: "Create menu: Thumbnail Generator, Explainer Storyboard, Browse Templates",
    tag: "Improved",
    highlights: [
      "The sidebar's Create quick-menu now includes Thumbnail Generator and Explainer Storyboard alongside Image/Video/Audio/3D/Typography.",
      "Added a \"Browse Templates\" link at the bottom of the Create menu, separated by a divider, for jumping straight to Templates.",
    ],
  },
  {
    version: "v1.72",
    title: "Micro animations across the whole app",
    tag: "Improved",
    highlights: [
      "Buttons everywhere now give a small press-down feedback and smoother hover transitions by default — no more dead, instant clicks.",
      "Modals, dropdowns, context menus, and the Create/All-tools menus now fade and scale in instead of snapping open.",
      "The night/bright mode toggle now crossfades the whole page's colors instead of hard-cutting, and its icon animates in on switch.",
      "The notification bell's unread badge now pulses gently, matching the timeline's own pulse styling.",
      "Added a visible focus ring for keyboard navigation, and full support for \"reduce motion\" system settings.",
    ],
  },
  {
    version: "v1.71",
    title: "All tools drawer: real categories, more compact",
    tag: "Redesign",
    highlights: [
      "Replaced the old \"All / Studios / Workspace\" split with real categories — Image, Video, Audio, 3D, Design, Flows, Workspace — so tools are findable by what they actually do.",
      "Each tool is now a compact single-line row (icon, name, one-line description) instead of a bigger card, so more fit on screen at once.",
      "Added subtle entrance and hover motion — rows fade/slide in staggered, icons nudge on hover.",
    ],
  },
  {
    version: "v1.70",
    title: "New: Explainer Storyboard Generator",
    tag: "New",
    highlights: [
      "Paste a script — or just a topic — and Claude breaks it into an ordered, editable shot-by-shot storyboard: an on-screen line and a specific motion-graphics visual (icons, diagrams, illustrated metaphors) per shot.",
      "Pick a visual style (flat vector, isometric 3D, whiteboard doodle, kinetic typography, corporate clean, glass/UI, retro halftone, 3D clay) or describe your own, plus up to 4 style/design reference images every shot stays consistent with.",
      "Edit any shot's line or visual, reorder, add or remove shots, then render the whole storyboard (or just one shot) as a grid of motion-graphics-style panels.",
      "Same centered wizard and Generate/Gallery tabs as Thumbnail Generator.",
    ],
  },
  {
    version: "v1.69",
    title: "Thumbnail Generator: centered, no more side panel",
    tag: "Redesign",
    highlights: [
      "Dropped the left sidebar — the Reference/Casting/Scene/Render wizard now sits in one centered column, with a bigger stepper and each step's fields in their own card.",
      "The current render shows big, right above the wizard, as soon as one exists — a single centered canvas instead of a split layout.",
      "Gallery still breaks out to the full width so the grid has room to pack tightly.",
    ],
  },
  {
    version: "v1.68",
    title: "Thumbnail Generator: Generate/Gallery tabs",
    tag: "Redesign",
    highlights: [
      "The main panel now has two tabs: Generate shows only your current/latest render, large — Higgsfield-style — instead of a full grid; Gallery holds every past render in the old grid view.",
      "Hitting Render automatically jumps you to the Generate tab so you immediately see the new render start.",
      "The Reference/Casting/Scene/Render wizard sidebar is unchanged.",
    ],
  },
  {
    version: "v1.67",
    title: "Thumbnail Generator: layout reference toggle + per-scene image refs",
    tag: "Improved",
    highlights: [
      "Uploaded reference now has a \"Use as layout reference\" checkbox — on by default, it attaches the image itself to the render as a loose framing/mood guide alongside its text analysis; turn it off to use the reference for text only.",
      "Every Scene category (subject/pose, key elements, location, composition, background) can now take its own optional reference photo — e.g. a real product shot or an actual location photo — in addition to its text description.",
      "All image references (character face photos, scene reference photos, the layout guide) share one 4-image budget, prioritized in that order — the assembled prompt and what actually gets attached always match exactly.",
    ],
  },
  {
    version: "v1.66",
    title: "Thumbnail Generator rebuilt: Reference, Casting, Scene, Render",
    tag: "Redesign",
    highlights: [
      "New 4-step flow: upload an optional reference (analyzed into text only — the image itself is never sent to the render or saved), cast up to 3 characters with a face photo and an emotion pick, fill in the scene (action/pose, key elements, location, composition, background, rim light color, optional baked-in text), then render.",
      "The exact prompt that will be sent is now shown before rendering, fully editable — tweak anything and your edit is used verbatim.",
      "Prompt structure is now a fixed, reliable template (no extra LLM step to assemble it) with an explicit identity-lock instruction per character, a safe-zone crop guard, and a consistent lighting/color-grade recipe — instead of a freeform description that could vary run to run.",
      "New \"Preview in feed\" action on any generated thumbnail — see how it reads next to a video title in a feed card and a search result mockup.",
      "Choose the aspect ratio (16:9, 4:3, 9:16, 1:1), frame layout (single frame or split), and how many variations to render per take.",
    ],
  },
  {
    version: "v1.65",
    title: "Thumbnail Generator: sharper, better-anchored prompts",
    tag: "Improved",
    highlights: [
      "Prompt assembly now runs on Claude instead of a fast/cheap default model — noticeably more detailed, structured prompts instead of short generic ones.",
      "Every uploaded photo is now explicitly anchored to its exact position (\"the first attached photo\", \"the second\"...) instead of only a loose description — fixes faces/subjects getting mixed up in multi-person thumbnails.",
    ],
  },
  {
    version: "v1.64",
    title: "Thumbnail Generator: fixed an analysis error, added the original reference as a style guide",
    tag: "Fixed",
    highlights: [
      "Fixed an occasional \"model's response wasn't valid JSON\" error during reference analysis — it now recovers automatically and retries on a fallback model if needed.",
      "The final render now always includes your original reference thumbnail as an extra loose guide for overall composition and mood — it's never copied exactly, just used for framing/vibe alongside your own filled-in slots.",
    ],
  },
  {
    version: "v1.63",
    title: "Thumbnail Generator: deeper breakdowns, choice of image model",
    tag: "Improved",
    highlights: [
      "Reference analysis now does a much more thorough breakdown — typically 5-10 slots instead of just 1-2, covering every distinct subject, prop, inset, color, and text overlay actually visible in your reference.",
      "Pick which image model renders your thumbnail — Nano Banana 2, Nano Banana Pro, GPT Image 2, or Flux 2 Klein — right from the tool's sidebar.",
    ],
  },
  {
    version: "v1.62",
    title: "New: Thumbnail Generator",
    tag: "New",
    highlights: [
      "Upload a reference thumbnail and it's analyzed into a small set of fillable slots — main subject, location, accent color, background characters, whatever that specific reference actually uses.",
      "Fill in your own photos/text for each slot (multi-add supported where it makes sense) and generate a fresh thumbnail built from your content in that same composition.",
      "Find it under Studios as \"Thumbnail Generator\", or pin it from the All tools drawer.",
    ],
  },
  {
    version: "v1.61",
    title: "Consistent composer width, and in-place template prompt editing",
    tag: "Improved",
    highlights: [
      "Image, Video, and 3D studio sidebars are now all the same width — no more layout jump when switching between them.",
      "Admins can now hover any Featured Template card and hit the pencil icon to view/edit its underlying prompt right there, or reset it back to the original.",
      "Prompt edits take effect immediately for everyone the next time that template is used — no deploy needed.",
    ],
  },
  {
    version: "v1.60",
    title: "Template picks now show a preview card, not a pre-filled prompt",
    tag: "Improved",
    highlights: [
      "Picking a template/preset now shows a preview card (thumbnail + name) at the top of the composer instead of dumping its prompt into the text box.",
      "The prompt box stays empty so you can add extra detail the effect might need; your text and the preset's own prompt are combined automatically when you hit Generate.",
      "Hit \"Change\" on the preview card to drop the template and start fresh.",
      "Every \"Use template\"/\"Use\" button now gives a quick visual confirmation (checkmark + \"Added\") when clicked.",
    ],
  },
  {
    version: "v1.59",
    title: "Featured Templates rebuilt with 178 new presets",
    tag: "Redesign",
    highlights: [
      "Replaced the old template catalog with 178 new templates — Basic + Epic Camera Control, Catch the Pulse, Mix, Viral Effects (chain + superhero presets), and curated image style moodboards.",
      "Every prompt was hand-written (or adapted from published preset descriptions where available) so results match the intended look.",
      "Five new template groups replace the old ones: Motion Control, Viral Effects, Catch the Pulse, Mix Effects, and Image Styles.",
    ],
  },
  {
    version: "v1.58",
    title: "Spaces — resizable nodes, big outputs, groups & sticky notes",
    tag: "Improved",
    highlights: [
      "Generate nodes now show their result front and centre — with the model name badged on the image and a regenerate control on hover.",
      "Resize any node: drag the bottom edge to make it taller, or the bottom-right corner to resize both ways. Expand an output to see it large.",
      "Hover a node for a floating toolbar — Run, Duplicate and Delete — right where you need it.",
      "New Group frames: drop a titled frame onto the canvas to organise your nodes into sections (Character, Product, Scene…).",
      "New Sticky notes: leave colour-coded notes anywhere on the canvas to annotate your workflow.",
      "Duplicate clones a node (offset a little) so you can branch a workflow without rebuilding it.",
    ],
  },
  {
    version: "v1.57",
    title: "Spaces — a node-based canvas for building workflows",
    tag: "New",
    highlights: [
      "New Spaces: a visual canvas where you wire Image, Text, List, Assistant and Generate nodes into a workflow. Drag an output dot and drop anywhere on a Generate/Assistant node to connect (with a highlighted drop target).",
      "Reference connected nodes by name in a prompt with @Name (e.g. name a Text node \"Character\", then write @Character in the Generate/Assistant prompt) — click the @-chips on the node to insert them. They're substituted with that node's value at run time, and connected images become references.",
      "Assistant node: an LLM that combines your wired-in text into a single polished prompt, which then feeds a Generate node.",
      "Full canvas UX: a + palette to add nodes, a left tool rail, scroll-zoom + fit, undo/redo (⌘Z / ⌘⇧Z), click a connection to delete it, rename any node, a settings panel (bezier/straight edges), and Run all in dependency order.",
      "Spaces is now the hub in the sidebar, with Flows living inside it as a tab. Everything autosaves.",
    ],
  },
  {
    version: "v1.56",
    title: "Flows — save a workflow once, reuse it forever",
    tag: "New",
    highlights: [
      "New Flows: plan a multi-step run in Pilot (Autopilot), then hit “Save as Flow” to turn it into a reusable workflow with a named input.",
      "Run a Flow with a fresh input and it seeds a ready-to-go Autopilot run — review the cost and execute, no re-prompting.",
      "Browse your Flows on the new Flows page, publish them to the Community so anyone can run them, and “Personalize” someone else's flow to make it your own.",
      "Use {{input}} anywhere in a step's prompt to control exactly where the runner's input lands.",
    ],
  },
  {
    version: "v1.55",
    title: "Tabbed detail panel, right-click menu & expiring share links",
    tag: "Improved",
    highlights: [
      "The generation detail panel is now organized into Info, Tools, and Comments tabs — with a collapsible \"See all\" prompt, all the edit tools in one place, and the comment thread on its own tab.",
      "Right-click any generation for a quick menu — Open, Compare, Inpaint, Generative Expand, Use as reference, Download, Favorite, Delete — instead of the browser's menu.",
      "Public share links now copy the media into Revolio's own storage and expire after 24 hours (with an in-app heads-up when you copy one); expired links are cleaned up automatically.",
      "Fixed the Compare view opening behind the image preview, and tidied the sidebar spacing above Community.",
    ],
  },
  {
    version: "v1.54",
    title: "Community feed, comments, share links, expand, filters & search",
    tag: "New",
    highlights: [
      "New Community page: publish any generation from its detail panel and it shows up in a public Explore feed; unpublish anytime. Only what you choose to share is ever public.",
      "Public share links — copy a link to a single generation that anyone can open (no account needed) from its detail panel.",
      "Comments on generations — leave notes on your own work or on team-project generations, right in the detail panel.",
      "Generative Expand (outpaint): grow an image's canvas on any side and let the model fill the new space, continuing the scene beyond the original edges.",
      "Every gallery now has a search box (matches prompt and model) plus a filter popover — date range, tool, favorited, and aspect ratio.",
    ],
  },
  {
    version: "v1.53",
    title: "Retry failed generations & A/B compare",
    tag: "New",
    highlights: [
      "Failed generations now have a one-click Retry — it re-runs with the exact same settings and drops the fresh result in place, no need to rebuild the prompt.",
      "New Compare tool in a generation's detail panel: open it, pick any other generation, and view the two side-by-side at matched size to judge them directly.",
      "Galleries auto-load the next page as you scroll instead of a Load more button.",
    ],
  },
  {
    version: "v1.52",
    title: "Gallery, composer, and Pilot polish pass",
    tag: "Fixed",
    highlights: [
      "The gallery now uses a justified-rows layout (like Google Photos): each row shares one height and every image keeps its true aspect ratio — a 4:3 shows up wider than a 9:16 beside it — while filling the row edge-to-edge. New generations always land top-left and flow left-to-right then down, fixing the old column masonry that could drop a new card in a random middle/right slot.",
      "In-progress cards now show a full-card rippling dot field with a soft radial glow (theme-aware) instead of a small spinning circle.",
      "The Image/Video/Audio generator's side-panel prompt box no longer grows without limit and spilling past the Generate button — it now caps its height and scrolls internally for long prompts, just like the compact composer already did.",
      "Pilot's message box (Autopilot and Assistant) now grows with what you type instead of staying a fixed small size.",
      "Sending a message in Pilot now shows your message and a thinking/planning indicator right in the chat immediately, instead of leaving you on the empty start screen with just the Send button showing a loading label.",
    ],
  },
  {
    version: "v1.51",
    title: "Inpaint — paint over part of an image and describe the change",
    tag: "New",
    highlights: [
      "Hover any completed image generation and hit the brush icon to open Inpaint: paint over the region you want to change, describe the replacement, and everything outside the painted area stays untouched.",
      "Works with Nano Banana 2 Edit, Nano Banana Pro Edit, and GPT Image 2 Edit — pick the model right in the Inpaint panel.",
      "Optionally attach a second reference image (e.g. a product photo) to drop directly into the painted area instead of describing it from scratch.",
    ],
  },
  {
    version: "v1.50",
    title: "Sharper, less plastic-looking output from Headshot, Character, Restore & Product Photography",
    tag: "Improved",
    highlights: [
      "Headshot Studio, Character Studio, and Photo Restoration now explicitly preserve real skin texture (pores, fine hair, natural asymmetry) instead of letting the model default to an over-smoothed, airbrushed look.",
      "Product Photography now explicitly grounds the product in its backdrop with an accurate contact shadow and scale, fixing the common \"pasted-on\" look AI product shots can have.",
    ],
  },
  {
    version: "v1.49",
    title: "Multiple photos in one reference slot now read as one subject",
    tag: "Fixed",
    highlights: [
      "Adding several images to the same reference category (e.g. three photos of one character via the tray's \"add more\" button) now produces one combined prompt clause covering all of them (\"Images 2, 3, and 4 are reference photos of the same character — keep this character consistent\") instead of a separate, misleading clause per photo that read as unrelated characters.",
    ],
  },
  {
    version: "v1.48",
    title: "Reference categories now tell the model which image is which",
    tag: "Fixed",
    highlights: [
      "Attaching a Style, Character, Location, or Element reference now labels it by position in the prompt (\"Image 2 is the style reference\") instead of a generic unindexed phrase — so attaching several categories at once (Style + Character + Location) no longer leaves the model guessing which image each description refers to.",
      "That labeling is now assembled right when you hit Generate, not the moment you pick a reference — your prompt box stays exactly what you typed, and the image numbering always matches whatever references are actually attached (in whatever order) at generate time, even if you added or removed one in between.",
    ],
  },
  {
    version: "v1.47",
    title: "A real Library page, and a rebuilt Projects page with Trash, Favorites & Team projects",
    tag: "New",
    highlights: [
      "New Library page — browse and manage your Style/Character/Location/Element/Color/Effects/Camera references full-screen instead of only inside the composer's picker, including deleting your own saved ones.",
      "Projects is now a full-featured page: All projects, All assets, Favorites, Uploads, and Trash live in a left rail, and opening a project shows its generations inline instead of jumping to the Gallery.",
      "Deleting a generation or project now moves it to Trash instead of removing it immediately — restore it or delete it forever from the new Trash view.",
      "Star any generation to add it to Favorites — the star toggle lives right in the gallery card's hover toolbar.",
      "Projects can now be \"Team\" projects: invite another Revolio user by name or email and they can see and add to that project's generations too, not just you.",
    ],
  },
  {
    version: "v1.46",
    title: "Scroll arrows instead of a scrollbar on the studio tabs",
    tag: "Improved",
    highlights: [
      "The Image/Video/Audio/3D tab row at the top of each studio panel now shows small left/right arrow buttons when it doesn't fit, instead of a plain horizontal scrollbar.",
    ],
  },
  {
    version: "v1.45",
    title: "Fixed References row alignment",
    tag: "Fixed",
    highlights: [
      "The References row (Style/Character/Location/etc.) now lays out as an even 4-column grid that fills the panel edge-to-edge — picking an image no longer shifts later boxes to a different row.",
    ],
  },
  {
    version: "v1.44",
    title: "Reference Library: multiple picks per category, plus Pexels import",
    tag: "Improved",
    highlights: [
      "Style, Character, Location and Element now each fill in their own box in the References row instead of tacking a new tile onto the end — pick a second Character and it lands right next to the first, with an \"add more\" tile after so you can keep stacking.",
      "The \"+\" for a plain upload now sits first in the row, ahead of the category boxes.",
      "Admins can now search Pexels' free stock library right from the Reference Library admin tab and add results straight in — no downloading and re-uploading needed.",
    ],
  },
  {
    version: "v1.43",
    title: "Reference Library — Style, Character, Location & more",
    tag: "New",
    highlights: [
      "New Style and Character buttons next to References in the composer open a full browsable picker — Style, Character, Location, and Element as image references, plus Camera, Effects, and Color as one-click prompt tags. Everything is optional and stacks with your own uploaded references.",
      "Upload an image into any of the four image categories and save it with a name to reuse it in future generations — your own reusable \"Style\" or \"Character\", not just a one-off.",
      "Admins can now add curated \"By Revolio\" picks to the library from a new Reference Library tab in Admin.",
    ],
  },
  {
    version: "v1.42",
    title: "Fixed a model-picker console error",
    tag: "Fixed",
    highlights: [
      "The model picker's favorite-star button was nested inside its row's clickable button — invalid HTML that React flagged as a hydration error in the console. Restructured so clicking the row still selects the model and the star still toggles favorites independently, without the invalid nesting.",
    ],
  },
  {
    version: "v1.41",
    title: "UI/UX polish pass — empty states, motion, accessibility",
    tag: "Improved",
    highlights: [
      "Empty states now give you something to click instead of just text — \"Try an example\" on every Creations tab, \"No projects yet\" on the Home dashboard, and \"Clear filters\" in Resources all take direct action.",
      "The Generate button now shows a live \"Generating…\" state while your request is in flight, and finished generations get a quick highlight pop in the gallery so new results are easy to spot.",
      "Fixed low-contrast error/danger text and icons in dark mode.",
      "The animated login logo and the browser's tab/status-bar color now correctly follow bright mode instead of staying tuned for dark mode only.",
    ],
  },
  {
    version: "v1.40",
    title: "Icons on every tab, and a clearer Prompt editor icon",
    tag: "Improved",
    highlights: [
      "Tab bars across the app — the Image/Video/Audio/3D switcher, Creations/My templates, Create/Edit/Motion Control in the Video Studio, and the Resources categories — now show an icon next to each label instead of text alone, so they're easier to scan at a glance.",
      "The Prompt editor's trigger icon no longer looks like a generic expand arrow — it's a proper edit icon now, matching what it actually does.",
      "Cleaned up a couple of inconsistent labels (\"Usage & Users\", \"AI Tools\") to match the app's title-case convention.",
    ],
  },
  {
    version: "v1.39",
    title: "Fixed the off-center play icon on video thumbnails",
    tag: "Fixed",
    highlights: [
      "The play triangle inside every video thumbnail's play button was visibly sitting left of center — same for the big play button on the full video preview. It's actually centered now.",
    ],
  },
  {
    version: "v1.38",
    title: "Prompt editor for Image, Video, Audio, and 3D",
    tag: "New",
    highlights: [
      "A new expand icon next to the prompt box opens a full Prompt editor — a bigger writing surface plus an AI side panel, on every composer (Image, Video, Audio, 3D). Open it anytime with ⌘E / Ctrl+E.",
      "Chat with the AI panel about your prompt — ask it to rewrite, expand, or just brainstorm — and apply any reply straight into your draft with one click.",
      "Random prompt and Auto prompt buttons give you a ready-made example or expand your current draft into a fuller one instantly.",
      "Image to prompt turns any reference image you've already attached into descriptive prompt text, so you don't have to write it from scratch.",
    ],
  },
  {
    version: "v1.37",
    title: "Pilot chats get real names",
    tag: "New",
    highlights: [
      "Every new Pilot thread is now auto-named with a short 2-3 word title (e.g. \"Coffee Ad Video\") the moment you send your first message, instead of showing your raw, truncated opening message in the Chats rail.",
      "Free — it reuses the same planning model your thread is already using, generated in parallel with the actual reply/plan so it doesn't add wait time.",
    ],
  },
  {
    version: "v1.36",
    title: "Fixed the theme toggle flickering on load",
    tag: "Fixed",
    highlights: [
      "The night/bright mode icon in the top corner used to briefly show the wrong icon on every page load or refresh before flipping to the right one — it only ever shows the correct icon now. Your actual theme was never really changing, just that one icon's guess.",
    ],
  },
  {
    version: "v1.35",
    title: "Real confirmation dialogs, and a couple of gallery fixes",
    tag: "Fixed",
    highlights: [
      "Deleting generations, projects, templates, or resources now shows an actual in-app confirmation instead of the browser's own popup — and adding/removing generations to a project asks first too, since that used to happen with no confirmation at all.",
      "Reference and result thumbnails across the app (generation details, frame slots, Motion Control, Typography Generator, Pilot) now open in the same full-screen preview instead of a new browser tab.",
      "Fixed the selected-image border looking broken/clipped on the Home dashboard's Recent work preview.",
    ],
  },
  {
    version: "v1.34",
    title: "Drag to reorder your pinned tools, plus faster load times",
    tag: "Improved",
    highlights: [
      "Pinning a tool from \"All tools\" now always lands it under the Tools section, not at the top of the sidebar above Home.",
      "Pinned tools (both the top section and Tools) can now be dragged into any order you like — it's saved and stays put after a refresh.",
      "Template preview clips are now ~90% smaller (re-encoded from GIF to video) and load noticeably faster on the Templates page.",
      "General performance pass: the 3D viewer's script now only loads when you actually open a 3D generation instead of on every page, and the tool drawer only loads when you open it.",
    ],
  },
  {
    version: "v1.33",
    title: "Pilot actually uses your reference images now",
    tag: "Fixed",
    highlights: [
      "Attached images were only getting a text mention before — Pilot's planner can now be given a short tag per image (type your own, or leave it blank and Pilot captions it automatically) so it reliably knows what's in every attached image, not just the first one.",
      "Steps that used an attached reference image now show a small thumbnail of it, so you can see at a glance whether a step actually picked it up.",
      "Sending a message no longer leaves it sitting in the box until the whole reply comes back — it moves into the conversation immediately with a \"thinking\" indicator while Pilot works.",
      "Fixed the Library's full-size image/video viewer sometimes opening squashed or clipped instead of full-screen.",
    ],
  },
  {
    version: "v1.32",
    title: "Pilot follow-ups edit steps in place instead of piling up",
    tag: "Fixed",
    highlights: [
      "A follow-up like \"change step 2 to a different model\" now actually edits that step instead of adding a duplicate one alongside it.",
      "\"Remove step 3\" or \"keep only the image step\" now really removes the steps you meant, instead of adding more on top.",
      "Only steps that haven't run yet can be edited or removed this way — anything already running, completed, or failed is left alone as history, and a redo of one of those becomes a genuinely new step instead.",
    ],
  },
  {
    version: "v1.31",
    title: "Autopilot is now Pilot — with a chat Assistant mode",
    tag: "Redesign",
    highlights: [
      "Autopilot has a new name and a new sibling: Pilot, with a mode toggle right at the top — Assistant for a normal back-and-forth conversation, Autopilot for the existing plan-and-run flow.",
      "Assistant mode is a plain chat — ask questions, brainstorm, get feedback — with no generation ability of its own; it'll point you at Autopilot mode when you actually want something made.",
      "The model picker now lists 25 chat/reasoning models — Claude, Gemini, GPT, and Grok — grouped by provider with real per-million-token pricing shown for each, same picker style as the Image/Video studios.",
      "Every thread in the Chats rail shows a small icon so you can tell Assistant and Autopilot conversations apart at a glance.",
    ],
  },
  {
    version: "v1.30",
    title: "Autopilot is now a real conversation",
    tag: "Redesign",
    highlights: [
      "Autopilot is now a full back-and-forth chat — send a follow-up after seeing a plan or a finished result (\"make it more colorful\", \"now animate that\") and it plans new steps onto the same thread instead of starting over.",
      "Pick the planning model per thread — Gemini 2.5 Flash, Gemini 3.5 Flash, GPT-5 Nano, or Claude Haiku 4.5 — no extra key needed.",
      "Attach reference images with the @ button — upload fresh or pull from your Library — and tell Autopilot which step should use which image.",
      "New layout: a Chats rail to jump between past threads, and a live Gallery panel on the right showing every result from the current thread as it generates.",
      "Cost is always visible — a running thread total up top, plus the exact cost of each new batch of steps before you approve it.",
    ],
  },
  {
    version: "v1.29",
    title: "Autopilot: describe a brief, let it plan and run",
    tag: "New",
    highlights: [
      "New Autopilot tool — type a plain-language brief (\"make a product photo of my headphones, then turn it into a 5s ad\") and it plans a short multi-step sequence, auto-picking real models from the registry.",
      "Shows the total estimated cost before anything runs — review and approve the plan, or discard it.",
      "Each step executes through the same generate pipeline every studio uses, and results land together in a new Project.",
      "Planning runs on Gemini 2.5 Flash — no new API key needed, it uses the same key every other tool already runs on.",
    ],
  },
  {
    version: "v1.28",
    title: "Wan Animate, and a gallery cleanup pass",
    tag: "Improved",
    highlights: [
      "Added Wan 2.2 Animate to Motion Control, with a real model picker plus Mode (Animate/Replace) and Resolution toggles — Motion Control was previously locked to Runway Act-Two.",
      "Create Video now accepts an optional video reference in the same reference slot as your image, for models whose live schema supports it — no need to jump to Edit Video for a character-replace-style workflow.",
      "Selecting one generation in the Library now lets you click anywhere on other cards to add them to the selection, instead of opening the viewer — with a new batch Delete button alongside Add to project.",
      "Reference thumbnails across the app (composer, Motion Control, Typography Generator) now show a Remove button on the corner edge and open full-size in a new tab on click.",
      "The generation details panel now shows every reference/frame/video used to make it, and highlights @mentions in the saved prompt.",
      "Typography Generator now has its own gallery of past generations instead of a single one-shot preview.",
      "Usage and Admin moved from the sidebar into icon buttons next to the theme switch (top right); Release notes moved to the sidebar's bottom icon row.",
      "Smoothed out the Home search bar's open animation — the backdrop blur used to snap in instantly.",
    ],
  },
  {
    version: "v1.27",
    title: "Wan 2.2 Animate for character replacement",
    tag: "New",
    highlights: [
      "Added Wan 2.2 Animate to the model registry, purpose-built for swapping a character into an existing video while keeping the original motion.",
    ],
  },
  {
    version: "v1.26",
    title: "60 new templates, better organized",
    tag: "New",
    highlights: [
      "Added 30 Motion Control presets covering the full standard camera-move vocabulary — whip pans, dolly zoom, drone rise/descend, arcs, rack focus, and more — not just the original four.",
      "Added 29 new single-photo templates across five new categories: Character & Game Styles, Viral Scene Drops, Retro & Art Styles, Meme & Social, and Product & Marketing.",
      "Templates page and every studio's Featured Templates tab now filter cleanly by these new groups.",
    ],
  },
  {
    version: "v1.25",
    title: "Composer & sidebar, without the flicker",
    tag: "Fixed",
    highlights: [
      "Fixed the sidebar briefly showing an unpinned tool (like Typography Generator) on every refresh before it disappeared again.",
      "Fixed the Image Generator's model selector flashing to Nano Banana Pro for a moment before switching to your actual last-used model.",
      "Fixed generations made in one tool (e.g. Sticker Pack Generator) showing up in another tool's gallery — each tool's gallery is now scoped to only what it actually created.",
      "Added Suno and MMAudio models to the Audio Generator, with style, lyrics, and instrumental-only controls.",
      "Added a Featured Templates section to the Image Generator's My Templates tab, matching Video.",
      "Renamed Typography Slate to Typography Generator.",
    ],
  },
  {
    version: "v1.24",
    title: "Uploads you can trust",
    tag: "Fixed",
    highlights: [
      "Fixed a bug where a large reference image could silently fail to upload, with no error shown — you'd just wonder why nothing happened.",
      "The video composer's reference-image tray is now always visible, with clearer drag-and-drop feedback.",
    ],
  },
  {
    version: "v1.23",
    title: "Getting the numbers right",
    tag: "Fixed",
    highlights: [
      "Fixed Kling O1 Video Edit's price (was showing $1.09, corrected to $0.654) and Veo 3, which had been overcharging by 5x ($2.50 → $0.50).",
      "Fixed Seedance 2.0 Mini, Seedream 5.0 Pro, and GPT Image 2 — all three charge different rates depending on the resolution or quality you pick, and the estimate wasn't accounting for that.",
      "Fixed a deeper bug where your chosen resolution/quality setting could silently fail to save, meaning both the price shown and what actually got generated could default to something you never picked. Fixed for every model with a resolution or quality control.",
      "Corrected historical spend totals in Usage and Admin to match what was actually billed.",
    ],
  },
  {
    version: "v1.22",
    title: "Seedream 5.0 arrives",
    tag: "New",
    highlights: [
      "Added Seedream 5.0 Pro and Lite models, replacing an earlier mis-configured entry.",
      "Model picker rows now show both USD and INR pricing inline.",
      "Simplified the model list to a flat alphabetical view.",
    ],
  },
  {
    version: "v1.21",
    title: "Recommended models, faster navigation",
    tag: "Improved",
    highlights: [
      "Added a Recommended section to the model picker — a curated set of reliable, affordable models.",
      "Nano Banana 2 is now the default image model.",
      "Every error message across the app now goes through one consistent, readable formatter instead of raw API text.",
      "General page-switching and navigation speed improvements.",
    ],
  },
  {
    version: "v1.20",
    title: "A gallery that behaves",
    tag: "Fixed",
    highlights: [
      "Fixed the gallery grid getting stuck in a single column on load, and cards getting stuck on a loading placeholder.",
      "Fixed new generations landing in a random spot or stacking vertically instead of spreading across the grid.",
      "Fixed processing cards disappearing and reappearing mid-generation, and gave them an orange shimmer while they work.",
      "Fixed the batch-size control being missing on some models that actually support generating more than one image at once.",
      "Added a dedicated video player with a sidebar, matching the reference-image viewer.",
    ],
  },
  {
    version: "v1.19",
    title: "Share your work",
    tag: "New",
    highlights: [
      "Added a Share button on any generation — send it to another user, who gets a notification.",
      "New Shared tab in the gallery shows everything that's been shared with you.",
      "Every aspect-ratio dropdown now shows a matching icon instead of just plain text.",
    ],
  },
  {
    version: "v1.18",
    title: "Notifications",
    tag: "New",
    highlights: [
      "Added a notification bell with an inbox and toast pop-ups.",
      "Admins can now send a notification straight to any user from the admin panel.",
    ],
  },
  {
    version: "v1.17",
    title: "Real dollars, real usage",
    tag: "New",
    highlights: [
      "Removed the confusing \"credits\" unit — costs are shown in real dollars everywhere now.",
      "Added a personal Usage page so you can see your own generation history and spend.",
      "Added a credit balance and top-up view to the admin panel, with usage graphs.",
      "Fixed a pricing bug that was undercounting Seedance Omni generations, and every generation now shows its calculated cost.",
    ],
  },
  {
    version: "v1.16",
    title: "More (and more reliable) models",
    tag: "New",
    highlights: [
      "Added a batch of cheaper image-edit and video models to the catalog, including Kling 2.5 Turbo.",
      "Reference-image limits are now pulled live from each model instead of a fixed cap of 4 — some models now accept many more.",
      "Fixed several models pointing at the wrong endpoint or expecting the wrong upload field, found by auditing every model against its real API schema.",
      "Fixed Nano Banana Pro silently switching to its pricier Edit variant the moment you attached a reference image.",
    ],
  },
  {
    version: "v1.15",
    title: "Video and 3D composer polish",
    tag: "Improved",
    highlights: [
      "Fixed a bug where generating more than one image at a time only ever produced one result.",
      "Video and 3D composers now show an estimated cost in INR alongside USD.",
      "Restyled the Edit Video and Motion Control dropdowns to match the rest of the app.",
      "Video cards now have a play/pause toggle, and models that support audio let you turn it on or off.",
      "Your prompt and reference images now stick around after you hit Generate, instead of clearing out.",
    ],
  },
  {
    version: "v1.14",
    title: "Generate, right where it belongs",
    tag: "Redesign",
    highlights: [
      "Moved the Generate button inside the composer bar, sitting on the same row as your model and settings pills — matching the Reference layout and padding instead of floating off to the side.",
    ],
  },
  {
    version: "v1.13",
    title: "A dedicated Upscale tool",
    tag: "New",
    highlights: [
      "Upscale now opens its own panel instead of firing a fixed model instantly — pick the model (Topaz for images, AI Video Upscaler for video), see a live preview, and set the real parameters.",
      "Images: choose an upscale factor (1×, 2×, 4×, 8×). Video: choose target resolution (720p–4K) and whether to copy the original audio.",
    ],
  },
  {
    version: "v1.12",
    title: "Toggles that behave",
    tag: "Fixed",
    highlights: [
      "Fixed toggle switches across the 3D and Edit Video composers snapping out of their track instead of sliding smoothly.",
      "Fixed the Upscale tool returning a \"detail not found\" error — it was hitting the wrong API endpoint.",
      "Redesigned the generation detail panel with icon-badge tool rows, a status indicator, and a cleaner action row — closer to the Reference's polish.",
    ],
  },
  {
    version: "v1.11",
    title: "Composer fixes",
    tag: "Fixed",
    highlights: [
      "The Generate button no longer stretches vertically when an image is attached.",
      "The prompt box now grows with your text instead of just scrolling.",
      "Fixed an error on GPT Image 2 Edit caused by a mismatched payload shape.",
      "Tagged reference images now highlight properly in the prompt and are auto-named \"Image 1\", \"Image 2\"… instead of showing the full source prompt as a title.",
    ],
  },
  {
    version: "v1.10",
    title: "An entrance worth remembering",
    tag: "New",
    highlights: [
      "Added a rippling background effect to the sign-in page, tinted with the Revolio orange palette.",
      "Added a cursor-reactive ASCII-art logo panel — hover to see the characters scramble and physically displace away from your cursor.",
    ],
  },
  {
    version: "v1.9",
    title: "Dialed in the palette",
    tag: "Improved",
    highlights: [
      "Landed on the black / dark-gray + orange theme after a couple of rounds of experimentation.",
      "Cut redundant auth round-trips when navigating between pages, for snappier loads.",
      "Fixed range sliders showing the browser's native filled track instead of the app's styling.",
      "Added favorite models to the model selector for quicker access.",
    ],
  },
  {
    version: "v1.8",
    title: "Top nav, not sidebar",
    tag: "Redesign",
    highlights: [
      "Replaced the left sidebar with a floating top navigation bar.",
      "Compacted the composer bar and removed the \"Unlimited\" toggle and the credit-count badge on Generate.",
      "Removed a non-functional \"Draw\" button rather than ship something that didn't work.",
      "Every settings dropdown now uses a custom-styled panel instead of the browser's native menu.",
    ],
  },
  {
    version: "v1.7",
    title: "A darker, sharper look",
    tag: "Redesign",
    highlights: [
      "Sitewide visual redesign — dark canvas background, tighter spacing, more modern overall feel.",
    ],
  },
  {
    version: "v1.6",
    title: "Gallery & composer polish",
    tag: "Improved",
    highlights: [
      "Fixed a silent permissions bug that could stop a generation from actually being deleted.",
      "Redesigned the prompt bar to match the Reference layout.",
      "Added a thumbnail size slider to the gallery.",
      "@mentions now highlight inline as you type them into a prompt.",
      "Built out a full settings panel for the 3D studio.",
    ],
  },
  {
    version: "v1.5",
    title: "A dedicated home for video",
    tag: "New",
    highlights: [
      "Added real video endpoints — Kling video edit and Runway Act-Two motion control.",
      "Uploads now accept video files, not just images.",
      "New left-sidebar Video studio with Create, Edit, and Motion Control tabs.",
      "Added list/grid view toggle for video generation history.",
    ],
  },
  {
    version: "v1.4",
    title: "Edit straight from the gallery",
    tag: "New",
    highlights: [
      "Added a post-generation edit sidebar so you can act on a result without starting over.",
      "You can now delete generations — including failed ones — right from the gallery.",
      "Esc closes the detail panel.",
      "Gallery now uses a proper masonry grid, and got a new logo and favicon.",
    ],
  },
  {
    version: "v1.3",
    title: "Nothing gets stuck",
    tag: "Fixed",
    highlights: [
      "Fixed generations that could get permanently stuck showing \"processing\".",
      "Added a dynamic duration slider and resolution selector driven by each model's real capabilities.",
      "Started tracking estimated spend per generation, with a new admin billing/usage view.",
    ],
  },
  {
    version: "v1.2",
    title: "Faster, smarter generations",
    tag: "Improved",
    highlights: [
      "Generation status now syncs instantly instead of waiting on a slow polling loop.",
      "Fixed a \"detail not found\" error on Meshy 3D generations caused by a wrong endpoint.",
      "Reference images can now be named and tagged, and every generation gets a friendly ID like revoliostudio_001.",
      "Model picker now surfaces popular models first, and shows a live cost estimate next to Generate.",
    ],
  },
  {
    version: "v1.1",
    title: "Reference-style composer",
    tag: "Redesign",
    highlights: [
      "Moved the prompt composer into a docked bottom bar.",
      "Expanded the model registry to the API's full catalog.",
      "Downloads now save a real PNG instead of a screenshot-quality export.",
      "Cleaned the API's own branding out of the UI — this is Revolio Studio, end to end.",
    ],
  },
  {
    version: "v1.0",
    title: "Revolio Studio goes live",
    tag: "New",
    highlights: [
      "Image, Video, and 3D generation studios, all backed by our API's model catalog.",
      "A persistent gallery of everything you've generated, with Supabase-backed auth and storage.",
      "An admin usage dashboard.",
      "Deployed and live on Vercel.",
    ],
  },
];

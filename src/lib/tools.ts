/**
 * Every destination in the app that's reasonable to "pin" to the sidebar,
 * shown in the Tool Drawer (Magnific-style pinnable tool launcher). Kept
 * separate from AppSidebar's own nav arrays so the drawer can list things
 * (like Templates or Resources) alongside the four generation studios
 * without AppSidebar having to know about pinning at all.
 */
/**
 * Finer-grained than `group` — powers the Tool Drawer's category tabs
 * (Image/Video/Audio/3D/Design/Flows/Workspace) so tools are findable by
 * what they actually work on rather than one flat "Studios" bucket. `group`
 * stays separate and unchanged: it's what AppSidebar uses to split pinned
 * tools into its two sidebar sections, which has nothing to do with media
 * type.
 */
export type ToolCategory = "Image" | "Video" | "Audio" | "3D" | "Design" | "Flows" | "Workspace";

export interface ToolEntry {
  href: string;
  label: string;
  description: string;
  /** lucide-react icon name, resolved by ToolDrawer's/AppSidebar's icon map. */
  icon: string;
  /**
   * Which sidebar section a pinned tool lands in: "Workspace" (Home, Pilot,
   * …, top of the sidebar), "Content" (Gallery/Projects/Templates/Library/
   * Resources — a second, labeled group nested under "Tools"), or "Studios"
   * (the actual generation studios, also under "Tools"). Also what the
   * drawer's grid uses to size its two visual buckets — purely
   * presentational there.
   */
  group: "Studios" | "Workspace" | "Content";
  /** Drives the Tool Drawer's category tabs — see ToolCategory doc comment. */
  category: ToolCategory;
  /** Defaults to true (pinned) when omitted — set false for tools that should only be reachable via the "All tools" drawer until the user opts to pin them. */
  defaultPinned?: boolean;
}

export const ALL_TOOLS: ToolEntry[] = [
  {
    href: "/studio/image",
    label: "Image Generator",
    description: "Text-to-image and reference-guided edits",
    icon: "Image",
    group: "Studios",
    category: "Image",
  },
  {
    href: "/studio/video",
    label: "Video Generator",
    description: "Text/image-to-video, edit video, motion control",
    icon: "Clapperboard",
    group: "Studios",
    category: "Video",
  },
  {
    href: "/studio/audio",
    label: "Audio Generator",
    description: "Generate audio and music",
    icon: "AudioLines",
    group: "Studios",
    category: "Audio",
  },
  {
    href: "/studio/3d",
    label: "3D Studio",
    description: "Text or image to a textured 3D mesh",
    icon: "Box",
    group: "Studios",
    category: "3D",
  },
  {
    href: "/studio/typography",
    label: "Typography Generator",
    description: "Match a lettering style, render new text as a transparent PNG",
    icon: "Type",
    group: "Studios",
    category: "Design",
  },
  {
    href: "/studio/thumbnail",
    label: "Thumbnail Generator",
    description: "Analyze a reference thumbnail into fillable slots, then generate your own",
    icon: "SquarePlay",
    group: "Studios",
    category: "Design",
    defaultPinned: false,
  },
  {
    href: "/studio/explainer",
    label: "Explainer Storyboard",
    description: "Claude breaks a script into shots, then renders a motion-graphics storyboard",
    icon: "Workflow",
    group: "Studios",
    category: "Design",
    defaultPinned: false,
  },
  {
    href: "/autopilot",
    label: "Pilot",
    description: "Your AI copilot — chat with Assistant mode, or switch to Autopilot to plan and run real generations",
    icon: "Bot",
    // "Workspace" on purpose — sits alongside Home/Community at the top of
    // the sidebar rather than under "Tools", once pinned.
    group: "Workspace",
    category: "Flows",
    defaultPinned: false,
  },
  {
    href: "/home",
    label: "Home",
    description: "Your dashboard and recent work",
    icon: "Home",
    group: "Workspace",
    category: "Workspace",
  },
  {
    href: "/gallery",
    label: "Gallery",
    description: "Every generation you've made",
    icon: "Images",
    group: "Content",
    category: "Workspace",
  },
  {
    href: "/projects",
    label: "Projects",
    description: "Organize generations by project, favorites, uploads & trash",
    icon: "FolderKanban",
    group: "Content",
    category: "Workspace",
  },
  {
    href: "/library",
    label: "Library",
    description: "Your styles, characters, locations, elements & tags",
    icon: "Library",
    group: "Content",
    category: "Workspace",
  },
  {
    href: "/resources",
    label: "Resources",
    description: "Curated editing & design tools",
    icon: "LayoutGrid",
    group: "Content",
    category: "Workspace",
  },
  {
    href: "/templates",
    label: "Templates",
    description: "Curated motion control & effect presets",
    icon: "LayoutTemplate",
    group: "Content",
    category: "Workspace",
  },
  // ── Config-driven single-purpose tools (src/lib/toolStudios.ts) — pin
  // from here if you use one often; unpinned by default so the sidebar
  // doesn't get crowded with tools most people won't touch every day. ──
  {
    href: "/studio/character",
    label: "Character Studio",
    description: "Keep a face consistent across new scenes, outfits & poses",
    icon: "UserRound",
    group: "Studios",
    category: "Image",
    defaultPinned: false,
  },
  {
    href: "/studio/headshot",
    label: "Headshot Studio",
    description: "Turn a selfie into a polished professional headshot",
    icon: "Contact",
    group: "Studios",
    category: "Image",
    defaultPinned: false,
  },
  {
    href: "/studio/logo",
    label: "Logo Studio",
    description: "Generate a wordmark or icon logo, export with a real transparent background",
    icon: "PenTool",
    group: "Studios",
    category: "Design",
    defaultPinned: false,
  },
  {
    href: "/studio/restore",
    label: "Photo Restoration",
    description: "Repair scratches & fading, colorize old photos naturally",
    icon: "Wand2",
    group: "Studios",
    category: "Image",
    defaultPinned: false,
  },
  {
    href: "/studio/product",
    label: "Product Photography",
    description: "Studio backdrop, lighting & shadow for any product photo",
    icon: "Package",
    group: "Studios",
    category: "Image",
    defaultPinned: false,
  },
  {
    href: "/studio/reframe",
    label: "Reframe & Autocrop",
    description: "Expand or crop an image/video to a new aspect ratio",
    icon: "Crop",
    group: "Studios",
    category: "Image",
    defaultPinned: false,
  },
  {
    href: "/studio/upscale",
    label: "Upscale Studio",
    description: "Sharper detail, higher resolution for photos & video",
    icon: "Maximize2",
    group: "Studios",
    category: "Image",
    defaultPinned: false,
  },
  {
    href: "/studio/stickers",
    label: "Sticker Pack Generator",
    description: "A batch of consistent character stickers, transparent background",
    icon: "Sticker",
    group: "Studios",
    category: "Design",
    defaultPinned: false,
  },
  {
    href: "/studio/relight",
    label: "Relight",
    description: "Change a photo's light direction, color & mood — or transfer lighting from a reference",
    icon: "Sun",
    group: "Studios",
    category: "Image",
    defaultPinned: false,
  },
  {
    href: "/studio/angle",
    label: "Angle Generator",
    description: "Orbit an interactive camera around a photo and re-render it from a new angle",
    icon: "Camera",
    group: "Studios",
    category: "Image",
    defaultPinned: false,
  },
];

export function getTool(href: string): ToolEntry | undefined {
  return ALL_TOOLS.find((t) => t.href === href);
}

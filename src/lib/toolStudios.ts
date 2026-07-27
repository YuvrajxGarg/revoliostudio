import type { Category } from "@/lib/models";
import type { ComposerSettings } from "@/store/composerStore";
import { GROUNDED_PHYSICS, PHOTOREAL_SKIN } from "@/lib/promptQuality";

/**
 * Config-driven "single-purpose tool" studios — Revolio's answer to
 * dedicated AI tools (headshot generators, logo makers, upscalers, etc.)
 * that other apps ship as standalone products. Unlike Typography Generator
 * (a fully bespoke one-shot component), every tool here is just a config
 * object rendered by the shared `ToolStudioView` — it reuses the exact same
 * PromptComposer / ModelSelector / SettingsBar / pricing / gallery
 * components as the main Image/Video studios, scoped down to a curated
 * model set. That's deliberate: it means every tool gets a real gallery,
 * concurrent generation (the composer never blocks on a job finishing —
 * see PromptComposer.handleSubmit), full live muapi parameters via
 * SettingsBar, and accurate cost estimates for free, with zero bespoke
 * plumbing per tool.
 *
 * Every modelId below must already exist in `src/lib/models.ts` — this
 * file only curates prompts/defaults on top of already-verified endpoints,
 * same rule as `src/lib/presets.ts`.
 */

export interface ToolStudioTab {
  id: string;
  label: string;
  category: Category;
  /** Restricts the composer's model picker to just these ids — put the preferred default first. */
  modelIds: string[];
  referenceHint?: string;
}

export interface StylePreset {
  label: string;
  /** Full prompt text — replaces whatever's in the box when clicked. */
  prompt: string;
}

export interface ToolStudioConfig {
  /** Slug — page lives at /studio/{id}. */
  id: string;
  title: string;
  /** lucide-react icon name. */
  icon: string;
  description: string;
  tabs: ToolStudioTab[];
  emptyLabel: string;
  promptPlaceholder?: string;
  /** Prefilled into the prompt box on first load of each tab (still fully editable) — for tools with a curated default instruction rather than pure open-ended creativity. */
  defaultPrompt?: string;
  /** Quick style chips shown above the prompt box. Clicking one replaces the current prompt. */
  stylePresets?: StylePreset[];
  /** Applied to composerStore.settings on mount (e.g. Sticker Pack defaults transparentBackground:true, numImages:4 so hitting Generate with no changes actually produces a transparent batch, not a single opaque image). */
  defaultSettings?: Partial<ComposerSettings>;
  /** Wraps the user's typed prompt with a fixed style template right before submit (visible textarea is untouched) — see PromptComposer's transformPrompt prop. Use this whenever the tool's whole premise depends on a stylistic treatment the underlying model won't infer on its own (e.g. "sticker" needs an explicit die-cut/outline/flat-illustration instruction, or a bare subject like "kratos from god of war" just comes back photoreal). */
  promptTransform?: (prompt: string) => string;
}

export const TOOL_STUDIOS: ToolStudioConfig[] = [
  {
    id: "character",
    title: "Character Studio",
    icon: "UserRound",
    description:
      "Upload a face once, then generate that same person in new scenes, outfits, and poses — the identity stays consistent across every result.",
    tabs: [
      {
        id: "image",
        label: "Image",
        category: "image",
        modelIds: ["flux-pulid"],
        referenceHint: "One clear, well-lit photo of the face — front-facing works best.",
      },
    ],
    emptyLabel: "No characters yet — upload a face and describe a new scene, outfit, or pose.",
    promptPlaceholder:
      "Describe the new scene — e.g. \"astronaut floating in space, cinematic lighting\" or \"wearing a red leather jacket, city street at night\"…",
    // flux-pulid's whole job is identity consistency — but consistency of a
    // face that's already come out over-smoothed just reproduces the same
    // plastic look in every new scene. Appending this doesn't touch the
    // user's own creative direction, only the skin-texture failure mode.
    promptTransform: (prompt) => `${prompt.trim()} ${PHOTOREAL_SKIN}`,
  },
  {
    id: "headshot",
    title: "Headshot Studio",
    icon: "Contact",
    description: "Turn any selfie into a polished, professional headshot — business attire, studio lighting, clean background.",
    tabs: [
      {
        id: "image",
        label: "Image",
        category: "image",
        modelIds: ["nano-banana-2-edit", "gpt-image-2-edit", "seedream-v4-edit"],
        referenceHint: "A clear front-facing selfie or photo works best.",
      },
    ],
    emptyLabel: "No headshots yet — upload a selfie, pick a style below, and hit Generate.",
    // PHOTOREAL_SKIN appended to every variant here: "natural professional
    // retouching" alone is the exact instruction that invites the
    // over-smoothed "plastic AI face" look — see promptQuality.ts for why.
    defaultPrompt:
      `Transform this into a professional headshot: tailored business attire, soft studio lighting, clean neutral background, natural professional retouching. Keep the person's facial identity, expression, and features unchanged. ${PHOTOREAL_SKIN}`,
    stylePresets: [
      {
        label: "Corporate",
        prompt:
          `Transform this into a professional corporate headshot: dark business suit, soft studio lighting, plain light-gray background, natural professional retouching. Keep the person's facial identity and features unchanged. ${PHOTOREAL_SKIN}`,
      },
      {
        label: "Studio B&W",
        prompt:
          `Transform this into a dramatic black-and-white studio headshot: sharp Rembrandt lighting, plain dark background, high-contrast professional retouching. Keep the person's facial identity and features unchanged. ${PHOTOREAL_SKIN}`,
      },
      {
        label: "Outdoor Natural",
        prompt:
          `Transform this into a natural-light outdoor headshot: soft business-casual attire, warm golden-hour lighting, softly blurred outdoor background. Keep the person's facial identity and features unchanged. ${PHOTOREAL_SKIN}`,
      },
      {
        label: "Creative Bold",
        prompt:
          `Transform this into a bold creative headshot: modern stylish outfit, colorful gradient studio background, confident dramatic lighting. Keep the person's facial identity and features unchanged. ${PHOTOREAL_SKIN}`,
      },
    ],
  },
  {
    id: "logo",
    title: "Logo Studio",
    icon: "PenTool",
    description: "Generate a wordmark or icon logo and export it as a real transparent PNG — no green screen needed.",
    tabs: [
      {
        id: "image",
        label: "Image",
        category: "image",
        modelIds: ["gpt-image-2", "gpt-image-2-edit", "ideogram-v3"],
        referenceHint: "Optional — attach a sketch or inspiration image to guide the style.",
      },
    ],
    emptyLabel: "No logos yet — describe your brand and hit Generate.",
    promptPlaceholder:
      "Describe your logo — brand name, style, colors, mood — e.g. \"minimalist mountain-peak logo for a coffee brand, warm earthy tones, clean geometric lines\"…",
    // The whole point of Logo Studio is a ready-to-use transparent export —
    // default the toggle on instead of making people discover it themselves.
    defaultSettings: { transparentBackground: true },
  },
  {
    id: "restore",
    title: "Photo Restoration",
    icon: "Wand2",
    description: "Repair scratches, tears, and fading on an old photo, and colorize it naturally if it's black-and-white.",
    tabs: [
      {
        id: "image",
        label: "Image",
        category: "image",
        modelIds: ["nano-banana-2-edit", "gpt-image-2-edit", "seedream-v4-edit"],
        referenceHint: "The old or damaged photo you want restored.",
      },
    ],
    emptyLabel: "No restorations yet — upload an old photo and hit Generate.",
    // "Sharpen fine detail" without a texture anchor is exactly how these
    // models overcorrect into the smoothed, waxy look old-photo restoration
    // is especially prone to — PHOTOREAL_SKIN keeps the sharpening honest.
    defaultPrompt:
      `Restore this old or damaged photo: repair scratches, tears, creases and fading, correct the color balance, and colorize naturally if it's black-and-white. Sharpen fine detail without altering the people, their expressions, or the original composition. ${PHOTOREAL_SKIN}`,
    stylePresets: [
      {
        label: "Restore & colorize",
        prompt:
          `Restore this old or damaged photo: repair scratches, tears, creases and fading, correct the color balance, and colorize naturally if it's black-and-white. Sharpen fine detail without altering the people, their expressions, or the original composition. ${PHOTOREAL_SKIN}`,
      },
      {
        label: "Restore, keep B&W",
        prompt:
          `Restore this old or damaged photo: repair scratches, tears, creases and fading, balance the contrast and tones. Keep it black-and-white — do not colorize. Sharpen fine detail without altering the people, their expressions, or the original composition. ${PHOTOREAL_SKIN}`,
      },
    ],
  },
  {
    id: "product",
    title: "Product Photography",
    icon: "Package",
    description: "Drop a raw product photo onto a clean studio backdrop with professional lighting and shadow.",
    tabs: [
      {
        id: "image",
        label: "Image",
        category: "image",
        modelIds: ["nano-banana-2-edit", "seedream-v4-edit", "gpt-image-2-edit"],
        referenceHint: "A clear photo of the product, ideally already on a plain background.",
      },
    ],
    emptyLabel: "No product shots yet — upload a product photo, pick a backdrop, and hit Generate.",
    // GROUNDED_PHYSICS appended everywhere: the single most common "AI
    // product photo" tell is a product that reads as pasted onto its
    // backdrop rather than sitting in it — mentioning contact shadow once
    // in the prompt (as the original text did for 2 of 5 presets) isn't
    // reliably enough weight; naming grounding/scale explicitly is.
    defaultPrompt:
      `Place this product on a clean seamless white studio background with soft professional lighting and a subtle contact shadow — e-commerce catalog style. Keep the product itself completely unchanged. ${GROUNDED_PHYSICS}`,
    stylePresets: [
      {
        label: "White Studio",
        prompt:
          `Place this product on a clean seamless white studio background with soft professional lighting and a subtle contact shadow — e-commerce catalog style. Keep the product itself completely unchanged. ${GROUNDED_PHYSICS}`,
      },
      {
        label: "Marble Surface",
        prompt:
          `Place this product on an elegant white-and-gray marble surface with soft natural light and a gentle reflection — premium editorial style. Keep the product itself completely unchanged. ${GROUNDED_PHYSICS}`,
      },
      {
        label: "Outdoor Lifestyle",
        prompt:
          `Place this product in a naturally lit outdoor lifestyle setting appropriate to the product, softly blurred background, warm daylight. Keep the product itself completely unchanged. ${GROUNDED_PHYSICS}`,
      },
      {
        label: "Gradient Backdrop",
        prompt:
          `Place this product on a smooth studio gradient backdrop (soft complementary colors), dramatic professional lighting, subtle shadow. Keep the product itself completely unchanged. ${GROUNDED_PHYSICS}`,
      },
      {
        label: "Wood & Natural",
        prompt:
          `Place this product on a warm natural wood surface with soft window light and a light, airy feel — organic lifestyle style. Keep the product itself completely unchanged. ${GROUNDED_PHYSICS}`,
      },
    ],
  },
  {
    id: "reframe",
    title: "Reframe & Autocrop",
    icon: "Crop",
    description: "Expand or crop an image or video to a new aspect ratio while keeping the subject intact.",
    tabs: [
      {
        id: "image",
        label: "Image",
        category: "image",
        modelIds: ["ideogram-reframe"],
        referenceHint: "The image you want reframed to a new aspect ratio.",
      },
      {
        id: "video",
        label: "Video",
        category: "video",
        modelIds: ["luma-flash-reframe", "autocrop"],
        referenceHint: "The video you want reframed or autocropped.",
      },
    ],
    emptyLabel: "Nothing reframed yet — upload an image or video, pick a target aspect ratio, and hit Generate.",
    promptPlaceholder: "Optional — any extra direction for the reframe (leave blank for a straightforward result)…",
  },
  {
    id: "upscale",
    title: "Upscale Studio",
    icon: "Maximize2",
    description: "Sharper detail, higher resolution — for a photo or a video clip.",
    tabs: [
      {
        id: "image",
        label: "Image",
        category: "image",
        modelIds: ["topaz-image-upscale", "ai-image-upscaler"],
        referenceHint: "The image you want upscaled.",
      },
      {
        id: "video",
        label: "Video",
        category: "video",
        modelIds: ["ai-video-upscaler"],
        referenceHint: "The video you want upscaled.",
      },
    ],
    emptyLabel: "Nothing upscaled yet — upload a photo or video and hit Generate.",
    promptPlaceholder: "Optional — leave blank for a straightforward upscale.",
  },
  {
    id: "stickers",
    title: "Sticker Pack Generator",
    icon: "Sticker",
    description: "Generate a batch of consistent character stickers with a transparent background, ready to drop into chats or designs.",
    tabs: [
      {
        id: "image",
        label: "Image",
        category: "image",
        modelIds: ["gpt-image-2", "gpt-image-2-edit"],
        referenceHint: "Optional — attach a reference of the character to keep it consistent.",
      },
    ],
    emptyLabel: "No stickers yet — describe your character and hit Generate.",
    promptPlaceholder:
      "Describe your character/sticker — e.g. \"cute cartoon fox mascot, waving, big round eyes\" or \"kratos from god of war\"…",
    // Sticker Pack Generator's whole premise breaks without these two: no
    // transparency = a flat opaque square, batch size 1 = "a sticker",
    // singular, not a "pack". Both now default on so Generate-with-no-
    // changes actually delivers what the tool promises.
    defaultSettings: { transparentBackground: true, numImages: 4 },
    // Left to itself, a general-purpose image model reads a bare subject
    // description as a request for a normal (often photoreal) image —
    // confirmed by "kratos from god of war" coming back as a cinematic
    // game-screenshot-style portrait instead of a sticker. This forces the
    // die-cut/flat-illustration treatment regardless of what the subject is.
    promptTransform: (prompt) =>
      `${prompt.trim()}. Die-cut sticker style: bold thick white outline like a vinyl sticker border, flat cel-shaded cartoon illustration (not photorealistic), vibrant saturated colors, simple clean shading, centered, no background scene or props behind it — just the isolated character/object, ready to be cut out.`,
  },
  {
    id: "relight",
    title: "Relight",
    icon: "Sun",
    description: "Change a photo's light direction, color, and mood with an interactive light preview — or transfer the lighting from a reference image.",
    tabs: [
      {
        id: "image",
        label: "Image",
        category: "image",
        modelIds: ["nano-banana-2-edit", "gpt-image-2-edit", "seedream-v4-edit"],
        referenceHint: "The photo you want relit.",
      },
    ],
    emptyLabel: "Nothing relit yet — upload a photo, position the light, and hit Generate.",
    // Relight's whole UI (upload, mode toggle, interactive light dial, color/
    // rotate/elevation/intensity/count controls) doesn't fit PromptComposer's
    // model-picker + textarea + settings-bar shape, so ToolStudioView special-
    // cases tool.id === "relight" to render RelightComposer instead — same
    // pattern as needsVideoUpload does for EditVideoComposer. defaultPrompt/
    // stylePresets/promptTransform are unused for this tool.
  },
  {
    id: "angle",
    title: "Angle Generator",
    icon: "Camera",
    description: "Orbit an interactive camera around a photo and re-render it from a new angle, height, or zoom.",
    tabs: [
      {
        id: "image",
        label: "Image",
        category: "image",
        modelIds: ["nano-banana-2-edit", "gpt-image-2-edit", "seedream-v4-edit"],
        referenceHint: "The photo you want a new camera angle of.",
      },
    ],
    emptyLabel: "Nothing generated yet — upload a photo, orbit the camera, and hit Generate.",
    // Same rationale as "relight" above — AngleComposer's orbit-ring dial
    // doesn't fit PromptComposer's shape, so ToolStudioView special-cases
    // tool.id === "angle" too.
  },
];

export function getToolStudio(id: string): ToolStudioConfig | undefined {
  return TOOL_STUDIOS.find((t) => t.id === id);
}

/** Every model id this tool touches, across all its tabs — used to scope its own gallery. */
export function toolStudioModelIds(tool: ToolStudioConfig): string[] {
  return Array.from(new Set(tool.tabs.flatMap((t) => t.modelIds)));
}

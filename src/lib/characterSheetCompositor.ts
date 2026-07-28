import type { CharacterSheetSlot } from "@/lib/characterSheet-types";
import { SECTION_ORDER } from "@/lib/characterSheetSlots";

export interface CompositeSlotImage {
  slot: CharacterSheetSlot;
  /** Same-origin proxy URL (see /api/character-sheet/[id]/image) — never the
   * raw muapi output URL, which would taint the canvas on export. */
  proxyUrl: string | null;
}

// This poster went through two earlier designs — a full metadata card +
// labeled sections, then a narrower "size the grid to the selection" version
// — before landing here. Both still burned text (titles, field labels,
// section headers, per-tile captions) into the image, which is exactly the
// wrong shape once the poster itself became the thing fed back into
// generation as a reference (see characterAssetUrls in useUserReferences.ts,
// and MentionPopover/ReferencePicker's switch to "poster only, no shots"):
// a model asked to match "the character reference" doesn't benefit from
// grid lines, badges, and paragraphs of metadata sharing the frame — it
// needs the clearest possible look at the actual face/body. So this version
// is deliberately text-free: every completed shot, tiled edge-to-edge into
// the squarest grid that fits them, at a large enough tile size to still
// read clearly once this one poster is the only image the model sees.
const IDEAL_TILE = 480;
const GAP = 10;
const MIN_COLS = 2;
const MAX_COLS = 6;
const BG = "#0f0f0f";

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Draws `img` covering the given box (crop-to-fill, like CSS object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/**
 * Composites every completed shot into one dense image grid — no title, no
 * metadata, no labels, just the photos themselves tiled to fill the canvas.
 * Ordered by section (so angles/poses/details/expressions/lighting still
 * flow together) but drawn with no header text separating them. A
 * failed/never-generated slot is simply skipped rather than rendered as an
 * empty placeholder — an empty tile would itself be exactly the wasted space
 * this layout exists to avoid.
 */
export async function compositeCharacterSheetPoster(images: CompositeSlotImage[]): Promise<Blob> {
  const ordered = SECTION_ORDER.flatMap((section) =>
    images.filter((i) => i.slot.section === section).sort((a, b) => a.slot.index - b.slot.index)
  );

  const loaded = await Promise.all(
    ordered.map((i) => (i.slot.status === "completed" && i.proxyUrl ? loadImage(i.proxyUrl) : Promise.resolve(null)))
  );
  const photos = loaded.filter((img): img is HTMLImageElement => img !== null);

  const n = Math.max(1, photos.length);
  const cols = Math.min(MAX_COLS, Math.max(MIN_COLS, Math.round(Math.sqrt(n))));
  const rows = Math.ceil(n / cols);

  const canvas = document.createElement("canvas");
  canvas.width = cols * IDEAL_TILE + (cols - 1) * GAP;
  canvas.height = rows * IDEAL_TILE + (rows - 1) * GAP;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  photos.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (IDEAL_TILE + GAP);
    const y = row * (IDEAL_TILE + GAP);
    drawCover(ctx, img, x, y, IDEAL_TILE, IDEAL_TILE);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to export the poster"))), "image/png");
  });
}

import type { CharacterMetadata, CharacterSheetSlot } from "@/lib/characterSheet-types";
import { SECTION_LABELS, SECTION_ORDER } from "@/lib/characterSheetSlots";

export interface CompositeSlotImage {
  slot: CharacterSheetSlot;
  /** Same-origin proxy URL (see /api/character-sheet/[id]/image) — never the
   * raw muapi output URL, which would taint the canvas on export. */
  proxyUrl: string | null;
}

// A fixed canvas width (1280, then 1600 before that) always left dead space
// when a selection's biggest section had fewer items than a row could hold —
// row-centering alone only masks that, it doesn't reclaim the width. Instead
// the whole canvas width is now derived from the selection itself: tile size
// and tile-count-per-row are picked so the *largest* section fills its row,
// and everything else (canvas width, metadata panel width) follows from that.
// A ~10-shot default sheet (2-4 per section) ends up a compact ~800-900px
// poster instead of a 1280px one with a section or two of real content.
const BASE_CONTENT_WIDTH = 900;
const MIN_TILES_PER_ROW = 2;
const MAX_TILES_PER_ROW = 5;
const MIN_TILE_W = 170;
const MAX_TILE_W = 300;
const TILE_ASPECT = 260 / 210; // height:width, matches the original 210x260 tile
const MARGIN = 48;
const TILE_GAP = 18;
const BG = "#0f0f0f";
const SURFACE = "#181818";
const SURFACE_2 = "#212121";
const BORDER = "#2e2e2e";
const FOREGROUND = "#f7f7f7";
const MUTED = "#a3a3a3";
const ACCENT = "#e85002";

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Short values that read fine in a compact multi-column grid.
const SHORT_METADATA_FIELDS: { key: keyof CharacterMetadata; label: string }[] = [
  { key: "age", label: "Age" },
  { key: "ethnicity", label: "Ethnicity" },
  { key: "height", label: "Height" },
  { key: "build", label: "Build" },
  { key: "eyes", label: "Eyes" },
  { key: "skinTone", label: "Skin Tone" },
  { key: "distinguishingMarks", label: "Distinguishing Marks" },
];
// Longer descriptive values (hair styling, outfit/style) get their own
// full-width row instead of being squeezed into the same grid and
// truncated — this is exactly what was cut off as "…" before.
const LONG_METADATA_FIELDS: { key: keyof CharacterMetadata; label: string }[] = [
  { key: "hair", label: "Hair" },
  { key: "style", label: "Style" },
];

/**
 * Composites the metadata card + all shots into one poster canvas, grouped
 * into the same labeled sections the reference uses (Head Angles, Full Body
 * Poses, Details, Expressions, Lighting References), stacked vertically. A
 * sparse row (fewer items than fit per row) is centered rather than left-
 * anchored, so a small selection doesn't read as a mostly-empty page. A
 * failed/missing shot renders as a clearly-marked placeholder tile instead
 * of blocking the whole poster.
 */
export async function compositeCharacterSheetPoster(
  metadata: CharacterMetadata,
  images: CompositeSlotImage[]
): Promise<Blob> {
  const bySection = new Map<string, CompositeSlotImage[]>();
  for (const section of SECTION_ORDER) {
    bySection.set(
      section,
      images.filter((i) => i.slot.section === section).sort((a, b) => a.slot.index - b.slot.index)
    );
  }

  const loaded = new Map<number, HTMLImageElement | null>();
  await Promise.all(
    images.map(async (i) => {
      loaded.set(i.slot.index, i.proxyUrl ? await loadImage(i.proxyUrl) : null);
    })
  );

  // Size the grid off the biggest section in this selection, not a fixed
  // page width — this is what actually removes the leftover empty width for
  // a small/sparse selection, rather than just centering it.
  const maxSectionCount = Math.max(
    1,
    ...SECTION_ORDER.map((s) => bySection.get(s)?.length ?? 0)
  );
  const tilesPerRow = Math.min(MAX_TILES_PER_ROW, Math.max(MIN_TILES_PER_ROW, maxSectionCount));
  const rawTileW = (BASE_CONTENT_WIDTH - (tilesPerRow - 1) * TILE_GAP) / tilesPerRow;
  const TILE_W = Math.min(MAX_TILE_W, Math.max(MIN_TILE_W, Math.round(rawTileW)));
  const TILE_H = Math.round(TILE_W * TILE_ASPECT);
  const TILE_LABEL_H = 30;
  const SECTION_HEADER_H = 44;
  const SECTION_GAP = 40;

  const contentWidth = tilesPerRow * TILE_W + (tilesPerRow - 1) * TILE_GAP;
  const CANVAS_WIDTH = contentWidth + MARGIN * 2;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d")!;
  mctx.font = "italic 15px sans-serif";
  const anchorLines = wrapText(mctx, metadata.anchorPhrase, contentWidth - 48);

  const shortFieldsPerRow = 4;
  const shortFieldRowH = 52;
  const longFieldRowH = 44;
  const shortRows = Math.ceil(SHORT_METADATA_FIELDS.length / shortFieldsPerRow);
  const longRows = LONG_METADATA_FIELDS.length;
  const metadataPanelH =
    40 /* "CHARACTER METADATA" header */ +
    shortRows * shortFieldRowH +
    longRows * longFieldRowH +
    16 +
    28 /* "Anchor phrase" label */ +
    anchorLines.length * 22 +
    36;

  let contentHeight = metadataPanelH + SECTION_GAP;
  for (const section of SECTION_ORDER) {
    const count = bySection.get(section)?.length ?? 0;
    if (count === 0) continue;
    const rows = Math.ceil(count / tilesPerRow);
    contentHeight += SECTION_HEADER_H + rows * (TILE_H + TILE_LABEL_H + TILE_GAP) + SECTION_GAP;
  }

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = MARGIN * 2 + 64 /* title */ + contentHeight;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = MARGIN;
  ctx.fillStyle = FOREGROUND;
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("Character Sheet", MARGIN, y + 28);
  ctx.fillStyle = MUTED;
  ctx.font = "13px sans-serif";
  ctx.fillText(new Date().toLocaleDateString(), MARGIN, y + 52);
  y += 64 + 24;

  // Metadata panel — a subtle accent top-bar gives it a clear "profile card"
  // identity distinct from the shot sections below.
  ctx.fillStyle = SURFACE;
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  roundRect(ctx, MARGIN, y, contentWidth, metadataPanelH, 18);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  roundRect(ctx, MARGIN, y, contentWidth, 4, 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.restore();

  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = ACCENT;
  ctx.fillText("CHARACTER METADATA", MARGIN + 28, y + 34);

  let fieldY = y + 60;
  const shortColWidth = (contentWidth - 56) / shortFieldsPerRow;
  SHORT_METADATA_FIELDS.forEach((f, i) => {
    const col = i % shortFieldsPerRow;
    const row = Math.floor(i / shortFieldsPerRow);
    const fx = MARGIN + 28 + col * shortColWidth;
    const fy = fieldY + row * shortFieldRowH;
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText(f.label.toUpperCase(), fx, fy);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = FOREGROUND;
    ctx.fillText(truncate(ctx, String(metadata[f.key] ?? "—"), shortColWidth - 20), fx, fy + 22);
  });
  fieldY += shortRows * shortFieldRowH + 8;

  // Divider between the compact grid and the full-width long fields.
  ctx.strokeStyle = BORDER;
  ctx.beginPath();
  ctx.moveTo(MARGIN + 28, fieldY - 4);
  ctx.lineTo(MARGIN + contentWidth - 28, fieldY - 4);
  ctx.stroke();
  fieldY += 12;

  LONG_METADATA_FIELDS.forEach((f, i) => {
    const fy = fieldY + i * longFieldRowH;
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText(f.label.toUpperCase(), MARGIN + 28, fy);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = FOREGROUND;
    ctx.fillText(truncate(ctx, String(metadata[f.key] ?? "—"), contentWidth - 56), MARGIN + 28, fy + 22);
  });
  fieldY += longRows * longFieldRowH + 12;

  ctx.font = "bold 10px sans-serif";
  ctx.fillStyle = ACCENT;
  ctx.fillText("ANCHOR PHRASE — USE IN EVERY PROMPT", MARGIN + 28, fieldY);
  ctx.font = "italic 15px sans-serif";
  ctx.fillStyle = FOREGROUND;
  anchorLines.forEach((line, i) => ctx.fillText(line, MARGIN + 28, fieldY + 24 + i * 22));

  y += metadataPanelH + SECTION_GAP;

  // Section rows
  for (const section of SECTION_ORDER) {
    const items = bySection.get(section) ?? [];
    if (items.length === 0) continue;

    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = FOREGROUND;
    const headerText = SECTION_LABELS[section].toUpperCase();
    ctx.fillText(headerText, MARGIN, y + 18);
    const headerW = ctx.measureText(headerText).width;

    // Count badge — a small pill instead of a bare number glued to the title.
    const badgeText = String(items.length);
    ctx.font = "bold 10px sans-serif";
    const badgeTextW = ctx.measureText(badgeText).width;
    const badgeW = badgeTextW + 14;
    const badgeX = MARGIN + headerW + 12;
    ctx.fillStyle = SURFACE_2;
    roundRect(ctx, badgeX, y + 5, badgeW, 18, 9);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    ctx.fillText(badgeText, badgeX + badgeW / 2, y + 17);
    ctx.textAlign = "left";

    y += SECTION_HEADER_H;

    const rows = Math.ceil(items.length / tilesPerRow);
    for (let r = 0; r < rows; r++) {
      const rowItems = items.slice(r * tilesPerRow, r * tilesPerRow + tilesPerRow);
      const rowWidth = rowItems.length * TILE_W + (rowItems.length - 1) * TILE_GAP;
      // Center a sparse row instead of anchoring it to the left margin —
      // this is what actually fixes the "mostly empty" look for any section
      // with fewer than a full row's worth of shots.
      let x = MARGIN + Math.max(0, (contentWidth - rowWidth) / 2);

      rowItems.forEach((item) => {
        const img = loaded.get(item.slot.index);
        const failed = item.slot.status === "failed";

        if (img) {
          ctx.fillStyle = SURFACE;
          ctx.strokeStyle = BORDER;
          roundRect(ctx, x, y, TILE_W, TILE_H, 12);
          ctx.fill();
          ctx.stroke();
          ctx.save();
          roundRect(ctx, x, y, TILE_W, TILE_H, 12);
          ctx.clip();
          drawCover(ctx, img, x, y, TILE_W, TILE_H);
          ctx.restore();
        } else {
          // Clearly a placeholder, not a broken image — dashed border, no
          // solid fill pretending to be a real tile.
          ctx.save();
          ctx.strokeStyle = failed ? "#5a3a3a" : BORDER;
          ctx.setLineDash([6, 5]);
          roundRect(ctx, x, y, TILE_W, TILE_H, 12);
          ctx.stroke();
          ctx.restore();
          ctx.font = "20px sans-serif";
          ctx.fillStyle = failed ? "#8a5a5a" : MUTED;
          ctx.textAlign = "center";
          ctx.fillText("×", x + TILE_W / 2, y + TILE_H / 2 - 6);
          ctx.font = "11px sans-serif";
          ctx.fillText(failed ? "Generation failed" : "Not generated", x + TILE_W / 2, y + TILE_H / 2 + 16);
          ctx.textAlign = "left";
        }

        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = FOREGROUND;
        ctx.textAlign = "center";
        ctx.fillText(item.slot.label.toUpperCase(), x + TILE_W / 2, y + TILE_H + 20);
        ctx.textAlign = "left";
        x += TILE_W + TILE_GAP;
      });
      y += TILE_H + TILE_LABEL_H + TILE_GAP;
    }
    y += SECTION_GAP - TILE_GAP;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to export the poster"))), "image/png");
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws `img` covering the given box (crop-to-fill, like CSS object-fit: cover) — assumes the caller already clipped to the box. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

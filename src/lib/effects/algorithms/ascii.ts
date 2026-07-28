import type { EffectDefinition, EffectParamValues } from "../types";
import { luminance } from "../colorUtils";

// Sparse -> dense. Darker source cells get a denser (more "ink") character
// by default — the classic ASCII-art convention — independent of whichever
// text/background colors are actually picked.
const RAMP = " .:-=+*#%@";

/**
 * The one effect that needs a real 2D context internally (rasterizing glyph
 * shapes purely from pixel math isn't practical without a bitmap font) — the
 * function still keeps the same ImageData-in/ImageData-out contract every
 * other effect uses, this is just an implementation detail.
 */
function apply(imageData: ImageData, params: EffectParamValues): ImageData {
  const { width, height, data: src } = imageData;
  const cellSize = Math.max(6, Math.round(Number(params.cellSize)));
  const invert = Boolean(params.invert);
  const textColor = String(params.textColor);
  const backgroundColor = String(params.backgroundColor);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = textColor;
  ctx.font = `${cellSize}px monospace`;
  ctx.textBaseline = "top";

  for (let cy = 0; cy < height; cy += cellSize) {
    const ch = Math.min(cellSize, height - cy);
    for (let cx = 0; cx < width; cx += cellSize) {
      const cw = Math.min(cellSize, width - cx);
      let total = 0;
      let count = 0;
      for (let y = 0; y < ch; y += 2) {
        for (let x = 0; x < cw; x += 2) {
          const o = ((cy + y) * width + (cx + x)) * 4;
          total += luminance(src[o], src[o + 1], src[o + 2]);
          count++;
        }
      }
      const avg = count > 0 ? total / count : 255;
      let rampIndex = Math.round((1 - avg / 255) * (RAMP.length - 1));
      if (invert) rampIndex = RAMP.length - 1 - rampIndex;
      const char = RAMP[Math.max(0, Math.min(RAMP.length - 1, rampIndex))];
      if (char !== " ") ctx.fillText(char, cx, cy);
    }
  }

  return ctx.getImageData(0, 0, width, height);
}

export const asciiEffect: EffectDefinition = {
  id: "ascii",
  name: "ASCII",
  category: "type",
  description: "Redraws the image as characters — denser glyphs stand in for darker areas.",
  params: [
    { type: "slider", id: "cellSize", label: "Cell size", min: 6, max: 32, default: 10, format: (v) => `${v}px` },
    { type: "toggle", id: "invert", label: "Invert density", default: false },
    { type: "color", id: "textColor", label: "Text color", default: "#39ff6a" },
    { type: "color", id: "backgroundColor", label: "Background", default: "#0a0a0a" },
  ],
  apply,
};

import type { EffectDefinition, EffectParamValues } from "../types";
import { hexToRgb, luminance, type Rgb } from "../colorUtils";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

function apply(imageData: ImageData, params: EffectParamValues): ImageData {
  const { width, height, data: src } = imageData;
  const mode = String(params.mode);
  const shadow = hexToRgb(String(params.shadowColor));
  const mid = hexToRgb(String(params.midColor));
  const highlight = hexToRgb(String(params.highlightColor));
  const out = new Uint8ClampedArray(src.length);

  for (let i = 0; i < src.length; i += 4) {
    const l = luminance(src[i], src[i + 1], src[i + 2]) / 255;
    let color: Rgb;
    if (mode === "tritone") {
      color = l < 0.5 ? lerpRgb(shadow, mid, l * 2) : lerpRgb(mid, highlight, (l - 0.5) * 2);
    } else {
      color = lerpRgb(shadow, highlight, l);
    }
    out[i] = color.r;
    out[i + 1] = color.g;
    out[i + 2] = color.b;
    out[i + 3] = src[i + 3];
  }
  return new ImageData(out, width, height);
}

export const duotoneEffect: EffectDefinition = {
  id: "duotone",
  name: "Duotone",
  category: "color",
  description: "Remaps every pixel's brightness onto a 2 or 3 color gradient — the classic Riso-print look.",
  params: [
    {
      type: "select",
      id: "mode",
      label: "Mode",
      options: [
        { value: "duotone", label: "Duotone (2 color)" },
        { value: "tritone", label: "Tritone (3 color)" },
      ],
      default: "duotone",
    },
    { type: "color", id: "shadowColor", label: "Shadows", default: "#1a1a6e" },
    { type: "color", id: "midColor", label: "Midtones", default: "#e8503f" },
    { type: "color", id: "highlightColor", label: "Highlights", default: "#fdf3d8" },
  ],
  apply,
};

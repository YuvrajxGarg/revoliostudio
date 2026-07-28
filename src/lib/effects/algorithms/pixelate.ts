import type { EffectDefinition, EffectParamValues } from "../types";

function apply(imageData: ImageData, params: EffectParamValues): ImageData {
  const { width, height, data: src } = imageData;
  const block = Math.max(2, Math.round(Number(params.blockSize)));
  const out = new Uint8ClampedArray(src.length);

  for (let by = 0; by < height; by += block) {
    const bh = Math.min(block, height - by);
    for (let bx = 0; bx < width; bx += block) {
      const bw = Math.min(block, width - bx);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      const count = bw * bh;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const o = ((by + y) * width + (bx + x)) * 4;
          r += src[o];
          g += src[o + 1];
          b += src[o + 2];
          a += src[o + 3];
        }
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      a = Math.round(a / count);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const o = ((by + y) * width + (bx + x)) * 4;
          out[o] = r;
          out[o + 1] = g;
          out[o + 2] = b;
          out[o + 3] = a;
        }
      }
    }
  }
  return new ImageData(out, width, height);
}

export const pixelateEffect: EffectDefinition = {
  id: "pixelate",
  name: "Pixelate",
  category: "pixel",
  description: "Averages square blocks of pixels into flat mosaic tiles.",
  params: [
    { type: "slider", id: "blockSize", label: "Block size", min: 2, max: 64, default: 12, format: (v) => `${v}px` },
  ],
  apply,
};

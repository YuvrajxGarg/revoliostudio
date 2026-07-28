import type { EffectDefinition, EffectParamValues } from "../types";

/** Small deterministic PRNG (mulberry32) — seeded by the `seed` slider so the
 * same param values always reproduce the same glitch pattern instead of
 * jittering on every recompute (which would make the "Seed" control
 * pointless and make the live preview flicker while idle). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function apply(imageData: ImageData, params: EffectParamValues): ImageData {
  const { width, height, data: src } = imageData;
  const amount = Number(params.amount) / 100;
  const sliceCount = Math.max(1, Math.round(Number(params.sliceCount)));
  const channelShift = Math.round(Number(params.channelShift));
  const seed = Math.round(Number(params.seed));
  const rand = mulberry32(seed);

  // Pass 1: random horizontal slice displacement, row by row within bands.
  const shifted = new Uint8ClampedArray(src.length);
  const bandHeight = Math.max(1, Math.ceil(height / sliceCount));
  for (let band = 0; band * bandHeight < height; band++) {
    const y0 = band * bandHeight;
    const y1 = Math.min(height, y0 + bandHeight);
    const offset = Math.round((rand() * 2 - 1) * amount * width * 0.15);
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < width; x++) {
        const srcX = ((x - offset) % width + width) % width;
        const so = (y * width + srcX) * 4;
        const o = (y * width + x) * 4;
        shifted[o] = src[so];
        shifted[o + 1] = src[so + 1];
        shifted[o + 2] = src[so + 2];
        shifted[o + 3] = src[so + 3];
      }
    }
  }

  // Pass 2: chromatic-aberration-style channel shift — red left, blue right.
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const rx = Math.min(width - 1, Math.max(0, x - channelShift));
      const bx = Math.min(width - 1, Math.max(0, x + channelShift));
      const ro = (y * width + rx) * 4;
      const bo = (y * width + bx) * 4;
      out[o] = shifted[ro];
      out[o + 1] = shifted[o + 1];
      out[o + 2] = shifted[bo + 2];
      out[o + 3] = shifted[o + 3];
    }
  }
  return new ImageData(out, width, height);
}

export const glitchEffect: EffectDefinition = {
  id: "glitch",
  name: "Glitch",
  category: "glitch",
  description: "Random horizontal slice displacement plus a chromatic-aberration channel shift.",
  params: [
    { type: "slider", id: "amount", label: "Displacement", min: 0, max: 100, default: 35, format: (v) => `${v}%` },
    { type: "slider", id: "sliceCount", label: "Slices", min: 2, max: 60, default: 18 },
    { type: "slider", id: "channelShift", label: "Channel shift", min: 0, max: 20, default: 4, format: (v) => `${v}px` },
    { type: "slider", id: "seed", label: "Seed", min: 0, max: 1000, default: 42 },
  ],
  apply,
};

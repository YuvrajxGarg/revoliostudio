import type { EffectDefinition, EffectParamValues } from "../types";
import { luminance } from "../colorUtils";

function apply(imageData: ImageData, params: EffectParamValues): ImageData {
  const cutoff = Number(params.threshold);
  const invert = Boolean(params.invert);
  const data = new Uint8ClampedArray(imageData.data);
  for (let i = 0; i < data.length; i += 4) {
    const l = luminance(data[i], data[i + 1], data[i + 2]);
    let v = l >= cutoff ? 255 : 0;
    if (invert) v = 255 - v;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  return new ImageData(data, imageData.width, imageData.height);
}

export const thresholdEffect: EffectDefinition = {
  id: "threshold",
  name: "Threshold",
  category: "edges",
  description: "Pure black and white — every pixel snaps to whichever side of the cutoff its brightness falls on.",
  params: [
    { type: "slider", id: "threshold", label: "Cutoff", min: 0, max: 255, default: 128 },
    { type: "toggle", id: "invert", label: "Invert", default: false },
  ],
  apply,
};

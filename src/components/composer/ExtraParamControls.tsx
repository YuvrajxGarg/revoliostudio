"use client";

import { Dices } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { Toggle } from "@/components/ui/Toggle";
import type { ModelSchemaInfo } from "@/lib/model-schema-types";

/**
 * The generic live-schema extras row (see src/lib/extra-params.ts for the
 * whitelist and the end-to-end flow): one Dropdown per whitelisted enum, one
 * Toggle pill per boolean, one slider per bounded number, plus the optional
 * negative-prompt and seed inputs — all driven entirely by the model's live
 * schema, no per-model wiring.
 *
 * Extracted from SettingsBar so the composers that DON'T use the shared
 * composer store (EditVideoComposer, MotionControlComposer, the 3D
 * composer's Tripo panel) can render the exact same controls against their
 * own local state — previously params those models expose (wan2.7-video-
 * edit's audio_setting, Kling motion-control's character_orientation,
 * Tripo's whole quality panel) simply never surfaced anywhere.
 *
 * Prop-driven and store-free: values/onChange own the extraParams record;
 * the negative-prompt and seed inputs render only when their onChange is
 * provided (SettingsBar wires them to the store, local composers to state).
 * Emits bare siblings — the parent supplies the flex-wrap pill row.
 */
export function ExtraParamControls({
  schema,
  values,
  onChange,
  negativePrompt,
  onNegativePromptChange,
  seed,
  onSeedChange,
  direction = "up",
}: {
  schema: ModelSchemaInfo | null;
  /** Current extraParams record, keyed by the REAL muapi field name. */
  values: Record<string, string | number | boolean>;
  onChange: (field: string, value: string | number | boolean) => void;
  negativePrompt?: string;
  onNegativePromptChange?: (value: string) => void;
  seed?: number;
  onSeedChange?: (value: number | undefined) => void;
  direction?: "up" | "down";
}) {
  // Extras are schema-discovered by definition — nothing to render while
  // loading, and an errored probe means the lists are empty anyway.
  if (!schema || schema.error) return null;

  return (
    <>
      {schema.extraEnums.map((d) => (
        <Dropdown
          key={d.field}
          value={String(values[d.field] ?? d.default)}
          options={d.values.map((v) => ({ value: v, label: v }))}
          onChange={(v) => onChange(d.field, v)}
          panelTitle={d.label}
          direction={direction}
        />
      ))}

      {schema.extraBooleans.map((d) => (
        <div key={d.field} className="control-pill">
          <span>{d.label}</span>
          <Toggle
            checked={(values[d.field] as boolean | undefined) ?? d.default}
            onChange={(v) => onChange(d.field, v)}
          />
        </div>
      ))}

      {schema.extraNumbers.map((d) => (
        <div key={d.field} className="control-pill" title={`${d.label} (${d.min}–${d.max})`}>
          <span>{d.label}</span>
          <input
            type="range"
            min={d.min}
            max={d.max}
            step={d.step}
            value={Number(values[d.field] ?? d.default)}
            onChange={(e) => onChange(d.field, Number(e.target.value))}
            className="w-20 slider-thin"
          />
          <span className="tabular-nums min-w-[2rem] text-right">{Number(values[d.field] ?? d.default)}</span>
        </div>
      ))}

      {schema.negativePromptField && onNegativePromptChange && (
        <div className="control-pill" title="What the model should avoid">
          <input
            type="text"
            value={negativePrompt ?? ""}
            onChange={(e) => onNegativePromptChange(e.target.value)}
            placeholder="Negative prompt (optional)"
            className="w-36 bg-transparent text-xs outline-none placeholder:text-muted"
          />
        </div>
      )}

      {schema.seedField && onSeedChange && (
        <div className="control-pill" title="Seed — same seed + same prompt reproduces a result. Blank = random.">
          <Dices className="h-3 w-3 text-muted shrink-0" />
          <input
            type="number"
            value={seed ?? ""}
            onChange={(e) => onSeedChange(e.target.value === "" ? undefined : Math.trunc(Number(e.target.value)))}
            placeholder="Seed"
            className="w-16 bg-transparent text-xs outline-none placeholder:text-muted [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      )}
    </>
  );
}

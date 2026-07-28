"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SliderRow } from "@/components/ui/SliderRow";
import { GLOBAL_ADJUSTMENT_PARAMS, type GlobalAdjustmentValues } from "@/lib/effects/globalAdjustments";
import type { EffectDefinition, EffectParam, EffectParamValues } from "@/lib/effects/types";

function ParamControl({
  param,
  value,
  onChange,
  onInteractStart,
}: {
  param: EffectParam;
  value: number | string | boolean;
  onChange: (v: number | string | boolean) => void;
  onInteractStart: () => void;
}) {
  if (param.type === "slider") {
    return (
      <SliderRow
        label={param.label}
        value={Number(value)}
        min={param.min}
        max={param.max}
        step={param.step ?? 1}
        format={param.format}
        onChange={(v) => {
          onInteractStart();
          onChange(v);
        }}
      />
    );
  }
  if (param.type === "select") {
    return (
      <div>
        <div className="mb-1 text-xs text-muted">{param.label}</div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface-2 p-1">
          {param.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                value === opt.value ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (param.type === "color") {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{param.label}</span>
        <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1">
          <input
            type="color"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
          />
          <span className="text-[10px] uppercase text-muted">{value}</span>
        </div>
      </div>
    );
  }
  // toggle
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5"
    >
      <span className="text-xs text-muted">{param.label}</span>
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          value ? "bg-accent" : "bg-border-subtle"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
            value ? "translate-x-3.5" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

export function EffectControls({
  effect,
  paramValues,
  onParamChange,
  onResetEffect,
  globalAdjustments,
  onGlobalAdjustmentChange,
  onResetAll,
  onInteractStart,
}: {
  effect: EffectDefinition | null;
  paramValues: EffectParamValues;
  onParamChange: (id: string, value: number | string | boolean) => void;
  onResetEffect: () => void;
  globalAdjustments: GlobalAdjustmentValues;
  onGlobalAdjustmentChange: (id: string, value: number) => void;
  onResetAll: () => void;
  onInteractStart: () => void;
}) {
  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{effect ? effect.name : "Original"}</div>
          <p className="mt-0.5 text-[11px] text-muted leading-relaxed">
            {effect ? effect.description : "No effect selected — pick one on the left, or keep the source clean."}
          </p>
        </div>
        <button onClick={onResetAll} title="Reset everything" className="icon-btn-round shrink-0">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {effect && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="panel-label">Settings</span>
            <button onClick={onResetEffect} className="text-[10px] text-muted hover:text-foreground">
              Reset effect
            </button>
          </div>
          {effect.params.map((p) => (
            <ParamControl
              key={p.id}
              param={p}
              value={paramValues[p.id]}
              onChange={(v) => onParamChange(p.id, v)}
              onInteractStart={onInteractStart}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
        <span className="panel-label">Global Adjustments</span>
        {GLOBAL_ADJUSTMENT_PARAMS.map((p) => (
          <SliderRow
            key={p.id}
            label={p.label}
            value={globalAdjustments[p.id as keyof GlobalAdjustmentValues]}
            min={p.type === "slider" ? p.min : 0}
            max={p.type === "slider" ? p.max : 0}
            format={p.type === "slider" ? p.format : undefined}
            onChange={(v) => {
              onInteractStart();
              onGlobalAdjustmentChange(p.id, v);
            }}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

/**
 * Shared label + value + `<input type="range">` row, styled via the
 * `slider-thin` CSS class (globals.css) that SettingsBar/Model3DComposer/
 * GridSizeSlider already use — extracted so Effects Studio doesn't become a
 * third copy-paste of the near-identical local `SliderRow` in
 * AngleComposer.tsx/RelightComposer.tsx. Those existing composers are left
 * alone; this is just a shared component for new call sites.
 */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-medium text-foreground">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider-thin w-full disabled:opacity-50"
      />
    </div>
  );
}

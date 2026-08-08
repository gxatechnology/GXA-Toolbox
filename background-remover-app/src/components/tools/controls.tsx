import type { ReactNode } from 'react';

interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function RangeControl({ label, value, min, max, step = 1, unit = '', onChange }: RangeControlProps) {
  return (
    <label className="range-control">
      <span><strong>{label}</strong><output>{Math.round(value * 100) / 100}{unit}</output></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel-section"><h3>{title}</h3>{children}</section>;
}

export function SegmentedButtons({ children }: { children: ReactNode }) {
  return <div className="segmented-buttons">{children}</div>;
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

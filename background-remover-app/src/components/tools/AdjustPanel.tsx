import { useEditorStore } from '../../store/editorStore';
import type { AdjustmentTarget, Adjustments } from '../../types/editor';
import { PanelSection, RangeControl, SegmentedButtons } from './controls';

const controls: { key: keyof Adjustments; label: string; min: number; max: number; step?: number; unit?: string }[] = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 200, unit: '%' },
  { key: 'contrast', label: 'Contrast', min: 0, max: 200, unit: '%' },
  { key: 'exposure', label: 'Exposure', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200, unit: '%' },
  { key: 'vibrance', label: 'Vibrance', min: -100, max: 100 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
  { key: 'whites', label: 'Whites', min: -100, max: 100 },
  { key: 'blacks', label: 'Blacks', min: -100, max: 100 },
  { key: 'temperature', label: 'Temperature', min: -100, max: 100 },
  { key: 'tint', label: 'Tint', min: -100, max: 100 },
  { key: 'gamma', label: 'Gamma', min: 20, max: 240, unit: '%' },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100 },
  { key: 'blur', label: 'Blur', min: 0, max: 20, step: 0.25, unit: ' px' },
  { key: 'fade', label: 'Fade', min: 0, max: 100 }
];

export function AdjustPanel() {
  const target = useEditorStore((state) => state.adjustmentTarget);
  const adjustments = useEditorStore((state) => state.adjustments[target]);
  const setTarget = useEditorStore((state) => state.setAdjustmentTarget);
  const setAdjustments = useEditorStore((state) => state.setAdjustments);
  return (
    <>
      <PanelSection title="Adjust target">
        <SegmentedButtons>{(['subject', 'background', 'entire'] as AdjustmentTarget[]).map((item) => <button type="button" key={item} className={target === item ? 'active' : ''} onClick={() => setTarget(item)}>{item === 'entire' ? 'Entire image' : item[0].toUpperCase() + item.slice(1)}</button>)}</SegmentedButtons>
      </PanelSection>
      <PanelSection title="Tone and color">
        {controls.map((control) => <RangeControl key={control.key} label={control.label} value={adjustments[control.key]} min={control.min} max={control.max} step={control.step} unit={control.unit} onChange={(value) => setAdjustments(target, { [control.key]: value })} />)}
        <button type="button" className="secondary-button" onClick={() => setAdjustments(target, { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temperature: 0, tint: 0, gamma: 100, sharpness: 0, blur: 0, fade: 0 })}>Reset adjustments</button>
      </PanelSection>
    </>
  );
}

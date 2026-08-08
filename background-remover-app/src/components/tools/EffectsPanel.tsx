import { useEffect, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { PanelSection } from './controls';

const presets = ['original', 'b&w', 'warm', 'cool', 'vivid', 'sepia', 'vintage', 'matte', 'high contrast', 'soft', 'fade', 'duotone', 'invert'];
const filters: Record<string, string> = {
  original: 'none', 'b&w': 'grayscale(1)', warm: 'sepia(.2) saturate(1.15)', cool: 'hue-rotate(175deg) saturate(.9)',
  vivid: 'saturate(1.45) contrast(1.1)', sepia: 'sepia(.75)', vintage: 'sepia(.35) contrast(.9)', matte: 'contrast(.82) brightness(1.06)',
  'high contrast': 'contrast(1.4)', soft: 'contrast(.86) brightness(1.05)', fade: 'contrast(.8) saturate(.8)', duotone: 'grayscale(1) sepia(.8) hue-rotate(175deg)', invert: 'invert(1)'
};

function EffectThumb({ name, source, active, onClick }: { name: string; source: HTMLImageElement | null; active: boolean; onClick: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context || !source) return;
    context.clearRect(0, 0, 120, 74);
    context.filter = filters[name];
    const scale = Math.max(120 / source.naturalWidth, 74 / source.naturalHeight);
    const width = source.naturalWidth * scale;
    const height = source.naturalHeight * scale;
    context.drawImage(source, (120 - width) / 2, (74 - height) / 2, width, height);
    context.filter = 'none';
  }, [name, source]);
  return <button type="button" className={active ? 'active' : ''} onClick={onClick}><canvas ref={canvas} width="120" height="74" /><span>{name}</span></button>;
}

export function EffectsPanel() {
  const source = useEditorStore((state) => state.originalImage);
  const effect = useEditorStore((state) => state.effect);
  const applyEffect = useEditorStore((state) => state.applyEffect);
  return <PanelSection title="Local effects"><p className="panel-help">Every thumbnail is generated from your current source image. Effects are included in export.</p><div className="effect-grid">{presets.map((name) => <EffectThumb key={name} name={name} source={source} active={effect.preset === name} onClick={() => applyEffect(name)} />)}</div></PanelSection>;
}

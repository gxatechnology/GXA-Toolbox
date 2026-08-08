import { useEditorStore } from '../../store/editorStore';
import { PanelSection } from './controls';

const presets: { label: string; ratio?: number }[] = [
  { label: 'Original' }, { label: 'Free' }, { label: '1:1', ratio: 1 }, { label: '4:5', ratio: 4 / 5 },
  { label: '3:4', ratio: 3 / 4 }, { label: '16:9', ratio: 16 / 9 }, { label: '9:16', ratio: 9 / 16 },
  { label: '3:2', ratio: 3 / 2 }, { label: '2:3', ratio: 2 / 3 }
];
const social: { label: string; ratio: number }[] = [
  { label: 'Instagram Post', ratio: 1 }, { label: 'Instagram Portrait', ratio: 4 / 5 }, { label: 'Instagram Story', ratio: 9 / 16 },
  { label: 'YouTube Thumbnail', ratio: 16 / 9 }, { label: 'YouTube Shorts', ratio: 9 / 16 }, { label: 'Facebook Post', ratio: 1200 / 630 },
  { label: 'Facebook Cover', ratio: 1640 / 624 }, { label: 'LinkedIn Post', ratio: 1200 / 627 }, { label: 'LinkedIn Banner', ratio: 1584 / 396 }
];

export function CropPanel() {
  const setCropRatio = useEditorStore((state) => state.setCropRatio);
  const setCrop = useEditorStore((state) => state.setCrop);
  const crop = useEditorStore((state) => state.crop);
  return (
    <>
      <PanelSection title="Crop ratio"><div className="preset-grid">{presets.map((preset) => <button type="button" key={preset.label} onClick={() => preset.label === 'Original' ? setCrop(null) : setCropRatio(preset.ratio)}>{preset.label}</button>)}</div></PanelSection>
      <PanelSection title="Social presets"><div className="preset-grid social">{social.map((preset) => <button type="button" key={preset.label} onClick={() => setCropRatio(preset.ratio)}>{preset.label}</button>)}</div></PanelSection>
      {crop && <div className="crop-readout"><span>X {Math.round(crop.x)} · Y {Math.round(crop.y)}</span><strong>{Math.round(crop.width)} × {Math.round(crop.height)}</strong></div>}
      <p className="panel-help">Drag inside the crop to move it. Use all eight handles to resize it.</p>
    </>
  );
}

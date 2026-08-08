import { useEditorStore } from '../../store/editorStore';
import { PanelSection, RangeControl } from './controls';

export function ErasePanel({ mode = 'erase' }: { mode?: 'erase' | 'restore' }) {
  const brush = useEditorStore((state) => state.brush);
  const setBrush = useEditorStore((state) => state.setBrush);
  return (
    <PanelSection title={mode === 'erase' ? 'Erase from mask' : 'Restore from source'}>
      <p className="panel-help">{mode === 'erase' ? 'Paint transparency into the editable alpha mask.' : 'Paint the original subject pixels back through the alpha mask.'}</p>
      <RangeControl label="Brush size" value={brush.size} min={4} max={420} unit=" px" onChange={(size) => setBrush({ size })} />
      <RangeControl label="Hardness" value={brush.hardness} min={0} max={100} unit="%" onChange={(hardness) => setBrush({ hardness })} />
      <RangeControl label="Feather" value={brush.feather} min={0} max={100} unit="%" onChange={(feather) => setBrush({ feather })} />
      <RangeControl label="Opacity" value={brush.opacity} min={1} max={100} unit="%" onChange={(opacity) => setBrush({ opacity })} />
      <RangeControl label="Flow" value={brush.flow} min={1} max={100} unit="%" onChange={(flow) => setBrush({ flow })} />
      <div className="keyboard-tip">Shortcuts: <kbd>[</kbd> and <kbd>]</kbd> resize the brush.</div>
    </PanelSection>
  );
}

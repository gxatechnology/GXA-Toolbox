import { useState } from 'react';
import { refineMask } from '../../editor/maskRefinement';
import { useEditorStore } from '../../store/editorStore';
import type { RefineSettings } from '../../workers/maskAlgorithms';
import { PanelSection, RangeControl } from './controls';

const initial: RefineSettings = { smooth: 0, feather: 0, expand: 0, shiftEdge: 0, defringe: 0, edgeContrast: 0 };

export function RefinePanel() {
  const [settings, setSettings] = useState(initial);
  const [busy, setBusy] = useState(false);
  const mask = useEditorStore((state) => state.workingMask);
  const replace = useEditorStore((state) => state.replaceWorkingMask);
  const change = (key: keyof RefineSettings, value: number) => setSettings((current) => ({ ...current, [key]: value }));
  const apply = async () => {
    if (!mask || busy) return;
    setBusy(true);
    try { replace(await refineMask(mask, settings), 'Refine edge'); }
    finally { setBusy(false); }
  };
  return (
    <PanelSection title="Refine edge">
      <p className="panel-help">These controls process the real alpha mask in a worker. Negative expand contracts the edge.</p>
      <RangeControl label="Smooth" value={settings.smooth} min={0} max={100} onChange={(value) => change('smooth', value)} />
      <RangeControl label="Feather" value={settings.feather} min={0} max={100} onChange={(value) => change('feather', value)} />
      <RangeControl label="Expand / Contract" value={settings.expand} min={-12} max={12} unit=" px" onChange={(value) => change('expand', value)} />
      <RangeControl label="Shift edge" value={settings.shiftEdge} min={-12} max={12} unit=" px" onChange={(value) => change('shiftEdge', value)} />
      <RangeControl label="Defringe" value={settings.defringe} min={0} max={100} onChange={(value) => change('defringe', value)} />
      <RangeControl label="Edge contrast" value={settings.edgeContrast} min={-50} max={100} onChange={(value) => change('edgeContrast', value)} />
      <button type="button" className="primary-button" disabled={busy} onClick={apply}>{busy ? 'Refining…' : 'Apply refinement'}</button>
    </PanelSection>
  );
}

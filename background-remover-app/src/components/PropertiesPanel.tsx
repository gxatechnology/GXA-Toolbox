import { useEditorStore } from '../store/editorStore';
import { AutoPanel } from './tools/AutoPanel';
import { ErasePanel } from './tools/ErasePanel';
import { RestorePanel } from './tools/RestorePanel';
import { RefinePanel } from './tools/RefinePanel';
import { BackgroundPanel } from './tools/BackgroundPanel';
import { CropPanel } from './tools/CropPanel';
import { AdjustPanel } from './tools/AdjustPanel';
import { EffectsPanel } from './tools/EffectsPanel';
import { DesignPanel } from './tools/DesignPanel';
import { LayerPanel } from './LayerPanel';

const titles = { auto: 'Auto cutout', erase: 'Erase', restore: 'Restore', refine: 'Refine Edge', background: 'Background', crop: 'Crop', adjust: 'Adjust', effects: 'Effects', design: 'Design', layers: 'Layers' };

export function PropertiesPanel() {
  const tool = useEditorStore((state) => state.activeTool);
  return (
    <aside className="properties-panel" aria-label={`${titles[tool]} properties`}>
      <div className="properties-heading"><span className="eyebrow">Properties</span><h2>{titles[tool]}</h2></div>
      <div className="properties-scroll">
        {tool === 'auto' && <AutoPanel />}
        {tool === 'erase' && <ErasePanel />}
        {tool === 'restore' && <RestorePanel />}
        {tool === 'refine' && <RefinePanel />}
        {tool === 'background' && <BackgroundPanel />}
        {tool === 'crop' && <CropPanel />}
        {tool === 'adjust' && <AdjustPanel />}
        {tool === 'effects' && <EffectsPanel />}
        {tool === 'design' && <DesignPanel />}
        {tool === 'layers' && <LayerPanel />}
      </div>
    </aside>
  );
}

import { useEditorStore } from '../store/editorStore';
import type { DesignLayer } from '../types/editor';
import { Icon } from './Icon';
import { PanelSection, RangeControl, Toggle } from './tools/controls';

export function LayerPanel() {
  const layers = useEditorStore((state) => state.layers);
  const selectedId = useEditorStore((state) => state.selectedLayerId);
  const select = useEditorStore((state) => state.selectLayer);
  const action = useEditorStore((state) => state.layerAction);
  const update = useEditorStore((state) => state.updateLayer);
  const subject = useEditorStore((state) => state.subject);
  const setSubject = useEditorStore((state) => state.setSubject);
  const background = useEditorStore((state) => state.background);
  const setBackground = useEditorStore((state) => state.setBackground);
  const selected = layers.find((layer) => layer.id === selectedId);
  const patch = (partial: Partial<DesignLayer>) => selected && update(selected.id, partial);
  return (
    <>
      <PanelSection title="Layers">
        <div className="layer-list">
          <div className="layer-row fixed"><span className="layer-thumb">FG</span><strong>Subject</strong><button type="button" aria-label="Toggle subject" onClick={() => setSubject({ opacity: subject.opacity > 0 ? 0 : 1 })}><Icon name="eye" size={17} /></button></div>
          {[...layers].reverse().map((layer) => <button type="button" key={layer.id} className={`layer-row ${selectedId === layer.id ? 'active' : ''}`} onClick={() => select(layer.id)}><span className="layer-thumb">{layer.type === 'text' ? 'T' : layer.type === 'shape' ? '◆' : 'IMG'}</span><strong>{layer.name}</strong><span>{layer.visible ? '●' : '○'} {layer.locked ? '🔒' : ''}</span></button>)}
          <div className="layer-row fixed"><span className="layer-thumb">BG</span><strong>Background</strong><button type="button" aria-label="Toggle background" onClick={() => setBackground({ mode: background.mode === 'transparent' ? 'solid' : 'transparent' })}><Icon name="eye" size={17} /></button></div>
        </div>
        {selected && <div className="layer-actions"><button type="button" onClick={() => action(selected.id, 'toggle')}><Icon name="eye" size={16} /> Visibility</button><button type="button" onClick={() => action(selected.id, 'lock')}><Icon name="lock" size={16} /> Lock</button><button type="button" onClick={() => action(selected.id, 'duplicate')}>Duplicate</button><button type="button" onClick={() => action(selected.id, 'forward')}>Forward</button><button type="button" onClick={() => action(selected.id, 'backward')}>Backward</button><button type="button" className="danger" onClick={() => action(selected.id, 'delete')}><Icon name="trash" size={16} /> Delete</button></div>}
      </PanelSection>
      {selected && <PanelSection title="Selected layer">
        <label className="field-control"><span>Name</span><input value={selected.name} onChange={(event) => patch({ name: event.target.value })} /></label>
        <RangeControl label="Move X" value={selected.x} min={-2000} max={4000} onChange={(x) => patch({ x })} />
        <RangeControl label="Move Y" value={selected.y} min={-2000} max={4000} onChange={(y) => patch({ y })} />
        <RangeControl label="Rotation" value={selected.rotation} min={-180} max={180} unit="°" onChange={(rotation) => patch({ rotation })} />
        <RangeControl label="Opacity" value={selected.opacity * 100} min={0} max={100} unit="%" onChange={(opacity) => patch({ opacity: opacity / 100 })} />
        {selected.type === 'text' && <>
          <label className="field-control"><span>Text</span><textarea value={selected.text} onChange={(event) => update(selected.id, { text: event.target.value })} /></label>
          <label className="field-control"><span>Font</span><select value={selected.font} onChange={(event) => update(selected.id, { font: event.target.value })}><option>Inter, sans-serif</option><option>Georgia, serif</option><option>Arial, sans-serif</option><option>monospace</option></select></label>
          <RangeControl label="Size" value={selected.size} min={8} max={320} unit=" px" onChange={(size) => update(selected.id, { size })} />
          <RangeControl label="Weight" value={selected.weight} min={100} max={900} step={100} onChange={(weight) => update(selected.id, { weight })} />
          <label className="field-control"><span>Color</span><input type="color" value={selected.color} onChange={(event) => update(selected.id, { color: event.target.value })} /></label>
          <label className="field-control"><span>Alignment</span><select value={selected.align} onChange={(event) => update(selected.id, { align: event.target.value as CanvasTextAlign })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
          <Toggle label="Shadow" checked={selected.shadow} onChange={(shadow) => update(selected.id, { shadow })} />
          <Toggle label="Outline" checked={selected.outline} onChange={(outline) => update(selected.id, { outline })} />
        </>}
        {selected.type === 'shape' && <>
          <RangeControl label="Width" value={selected.width} min={10} max={2000} onChange={(width) => update(selected.id, { width })} />
          <RangeControl label="Height" value={selected.height} min={10} max={2000} onChange={(height) => update(selected.id, { height })} />
          <label className="field-control"><span>Fill</span><input type="color" value={selected.fill} onChange={(event) => update(selected.id, { fill: event.target.value })} /></label>
          <label className="field-control"><span>Stroke</span><input type="color" value={selected.stroke} onChange={(event) => update(selected.id, { stroke: event.target.value })} /></label>
          <RangeControl label="Stroke width" value={selected.strokeWidth} min={0} max={40} onChange={(strokeWidth) => update(selected.id, { strokeWidth })} />
        </>}
        {selected.type === 'image' && <><RangeControl label="Width" value={selected.width} min={10} max={3000} onChange={(width) => update(selected.id, { width })} /><RangeControl label="Height" value={selected.height} min={10} max={3000} onChange={(height) => update(selected.id, { height })} /></>}
      </PanelSection>}
    </>
  );
}

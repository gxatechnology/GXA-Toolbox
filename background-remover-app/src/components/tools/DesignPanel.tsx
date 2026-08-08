import { useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { loadImage } from '../../utils/canvas';
import { PanelSection, RangeControl, SegmentedButtons, Toggle } from './controls';

const canvasPresets = [{ label: 'Original', ratio: 0 }, { label: '1:1', ratio: 1 }, { label: '4:5', ratio: 4 / 5 }, { label: '16:9', ratio: 16 / 9 }, { label: '9:16', ratio: 9 / 16 }];

export function DesignPanel() {
  const mask = useEditorStore((state) => state.workingMask);
  const canvasSize = useEditorStore((state) => state.canvasSize);
  const subject = useEditorStore((state) => state.subject);
  const setCanvasPreset = useEditorStore((state) => state.setCanvasPreset);
  const setSubject = useEditorStore((state) => state.setSubject);
  const addText = useEditorStore((state) => state.addTextLayer);
  const addShape = useEditorStore((state) => state.addShapeLayer);
  const addImage = useEditorStore((state) => state.addImageLayer);
  const assetInput = useRef<HTMLInputElement>(null);
  const applyRatio = (ratio: number) => {
    if (!mask) return;
    if (!ratio) return setCanvasPreset({ width: mask.width, height: mask.height });
    const area = mask.width * mask.height;
    const width = Math.sqrt(area * ratio);
    setCanvasPreset({ width: Math.round(width), height: Math.round(width / ratio) });
  };
  const uploadAsset = async (file?: File) => {
    if (!file?.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    try { addImage(await loadImage(url), url); }
    catch (error) { URL.revokeObjectURL(url); throw error; }
  };
  return (
    <>
      <PanelSection title="Canvas">
        <SegmentedButtons>{canvasPresets.map((preset) => <button type="button" key={preset.label} onClick={() => applyRatio(preset.ratio)}>{preset.label}</button>)}</SegmentedButtons>
        <div className="two-fields"><label className="field-control"><span>Width</span><input type="number" min="64" max="4096" value={Math.round(canvasSize.width)} onChange={(event) => setCanvasPreset({ ...canvasSize, width: Number(event.target.value) })} /></label><label className="field-control"><span>Height</span><input type="number" min="64" max="4096" value={Math.round(canvasSize.height)} onChange={(event) => setCanvasPreset({ ...canvasSize, height: Number(event.target.value) })} /></label></div>
      </PanelSection>
      <PanelSection title="Subject transform">
        <RangeControl label="Move X" value={subject.x} min={-canvasSize.width} max={canvasSize.width} onChange={(x) => setSubject({ x })} />
        <RangeControl label="Move Y" value={subject.y} min={-canvasSize.height} max={canvasSize.height} onChange={(y) => setSubject({ y })} />
        <RangeControl label="Scale" value={subject.scale} min={0.05} max={4} step={0.01} unit="×" onChange={(scale) => setSubject({ scale })} />
        <RangeControl label="Rotate" value={subject.rotation} min={-180} max={180} unit="°" onChange={(rotation) => setSubject({ rotation })} />
        <RangeControl label="Opacity" value={subject.opacity * 100} min={0} max={100} unit="%" onChange={(opacity) => setSubject({ opacity: opacity / 100 })} />
        <div className="button-grid"><button type="button" onClick={() => setSubject({ flipX: !subject.flipX })}>Flip H</button><button type="button" onClick={() => setSubject({ flipY: !subject.flipY })}>Flip V</button><button type="button" onClick={() => setSubject({ x: 0 })}>Align center</button><button type="button" onClick={() => setSubject({ y: 0 })}>Align middle</button></div>
      </PanelSection>
      <PanelSection title="Subject styling">
        <Toggle label="Drop shadow" checked={subject.shadow} onChange={(shadow) => setSubject({ shadow })} />
        <Toggle label="Ground shadow" checked={subject.groundShadow} onChange={(groundShadow) => setSubject({ groundShadow })} />
        <Toggle label="Outline" checked={subject.outline} onChange={(outline) => setSubject({ outline })} />
        <Toggle label="Glow" checked={subject.glow} onChange={(glow) => setSubject({ glow })} />
        {(subject.shadow || subject.groundShadow) && <><RangeControl label="Shadow blur" value={subject.shadowBlur} min={0} max={100} onChange={(shadowBlur) => setSubject({ shadowBlur })} /><RangeControl label="Shadow opacity" value={subject.shadowOpacity} min={0} max={100} unit="%" onChange={(shadowOpacity) => setSubject({ shadowOpacity })} /></>}
        {subject.outline && <><RangeControl label="Outline width" value={subject.outlineWidth} min={1} max={40} onChange={(outlineWidth) => setSubject({ outlineWidth })} /><label className="field-control"><span>Outline color</span><input type="color" value={subject.outlineColor} onChange={(event) => setSubject({ outlineColor: event.target.value })} /></label></>}
        {subject.glow && <><RangeControl label="Glow blur" value={subject.glowBlur} min={0} max={100} onChange={(glowBlur) => setSubject({ glowBlur })} /><label className="field-control"><span>Glow color</span><input type="color" value={subject.glowColor} onChange={(event) => setSubject({ glowColor: event.target.value })} /></label></>}
      </PanelSection>
      <PanelSection title="Text and shapes">
        <div className="button-grid"><button type="button" onClick={addText}>Add text</button><button type="button" onClick={() => addShape('rectangle')}>Rectangle</button><button type="button" onClick={() => addShape('rounded-rectangle')}>Rounded</button><button type="button" onClick={() => addShape('circle')}>Circle</button><button type="button" onClick={() => addShape('line')}>Line</button><button type="button" onClick={() => addShape('arrow')}>Arrow</button></div>
        <button type="button" className="secondary-button" onClick={() => assetInput.current?.click()}>Upload asset</button>
        <input ref={assetInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadAsset(event.target.files?.[0])} />
      </PanelSection>
    </>
  );
}

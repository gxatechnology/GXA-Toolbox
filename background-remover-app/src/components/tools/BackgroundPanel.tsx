import { useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { loadImage, uid } from '../../utils/canvas';
import { PanelSection, RangeControl, SegmentedButtons } from './controls';

const presets = ['#ffffff', '#f8fafc', '#0f172a', '#2563eb', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'];

export function BackgroundPanel() {
  const background = useEditorStore((state) => state.background);
  const setBackground = useEditorStore((state) => state.setBackground);
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (background.imageUrl) URL.revokeObjectURL(background.imageUrl);
      setBackground({ mode: 'image', image, imageUrl: url });
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  };
  const updateStop = (id: string, color: string) => setBackground({
    gradientStops: background.gradientStops.map((stop) => stop.id === id ? { ...stop, color } : stop)
  });
  return (
    <>
      <PanelSection title="Background">
        <SegmentedButtons>
          {(['transparent', 'solid', 'gradient', 'image', 'original-blur'] as const).map((mode) => (
            <button type="button" key={mode} className={background.mode === mode ? 'active' : ''} onClick={() => setBackground({ mode })}>
              {mode === 'original-blur' ? 'Blur original' : mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </SegmentedButtons>
      </PanelSection>
      {background.mode === 'solid' && <PanelSection title="Solid color">
        <div className="color-presets">{presets.map((color) => <button key={color} type="button" aria-label={`Use ${color}`} className={background.color === color ? 'active' : ''} style={{ background: color }} onClick={() => setBackground({ color })} />)}</div>
        <label className="field-control"><span>HEX / RGB / HSL</span><input value={background.color} onChange={(event) => setBackground({ color: event.target.value })} placeholder="#ffffff, rgb(…), or hsl(…)" /></label>
      </PanelSection>}
      {background.mode === 'gradient' && <PanelSection title="Gradient">
        <SegmentedButtons><button type="button" className={background.gradientType === 'linear' ? 'active' : ''} onClick={() => setBackground({ gradientType: 'linear' })}>Linear</button><button type="button" className={background.gradientType === 'radial' ? 'active' : ''} onClick={() => setBackground({ gradientType: 'radial' })}>Radial</button></SegmentedButtons>
        {background.gradientType === 'linear' && <RangeControl label="Angle" value={background.gradientAngle} min={0} max={360} unit="°" onChange={(gradientAngle) => setBackground({ gradientAngle })} />}
        <div className="gradient-stops">
          {background.gradientStops.map((stop, index) => <label key={stop.id}><span>Stop {index + 1}</span><input type="color" value={stop.color} onChange={(event) => updateStop(stop.id, event.target.value)} /><input type="range" min="0" max="1" step="0.01" value={stop.offset} onChange={(event) => setBackground({ gradientStops: background.gradientStops.map((item) => item.id === stop.id ? { ...item, offset: Number(event.target.value) } : item) })} /></label>)}
        </div>
        <button type="button" className="secondary-button" onClick={() => setBackground({ gradientStops: [...background.gradientStops, { id: uid('stop'), offset: 0.5, color: '#ffffff' }] })}>Add gradient stop</button>
      </PanelSection>}
      {background.mode === 'image' && <>
        <PanelSection title="Custom image">
          <button type="button" className="secondary-button" onClick={() => fileInput.current?.click()}>{background.image ? 'Replace background image' : 'Upload background image'}</button>
          <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])} />
          <SegmentedButtons><button type="button" className={background.imageFit === 'fill' ? 'active' : ''} onClick={() => setBackground({ imageFit: 'fill' })}>Fill</button><button type="button" className={background.imageFit === 'fit' ? 'active' : ''} onClick={() => setBackground({ imageFit: 'fit' })}>Fit</button></SegmentedButtons>
        </PanelSection>
        <PanelSection title="Image position">
          <RangeControl label="Move X" value={background.imageX} min={-800} max={800} onChange={(imageX) => setBackground({ imageX })} />
          <RangeControl label="Move Y" value={background.imageY} min={-800} max={800} onChange={(imageY) => setBackground({ imageY })} />
          <RangeControl label="Zoom" value={background.imageScale} min={0.2} max={4} step={0.01} unit="×" onChange={(imageScale) => setBackground({ imageScale })} />
          <RangeControl label="Rotate" value={background.imageRotation} min={-180} max={180} unit="°" onChange={(imageRotation) => setBackground({ imageRotation })} />
          <div className="button-grid"><button type="button" onClick={() => setBackground({ imageFlipX: !background.imageFlipX })}>Flip H</button><button type="button" onClick={() => setBackground({ imageFlipY: !background.imageFlipY })}>Flip V</button></div>
        </PanelSection>
        <PanelSection title="Image appearance">
          <RangeControl label="Blur" value={background.blur} min={0} max={40} unit=" px" onChange={(blur) => setBackground({ blur })} />
          <RangeControl label="Brightness" value={background.brightness} min={0} max={200} unit="%" onChange={(brightness) => setBackground({ brightness })} />
          <RangeControl label="Contrast" value={background.contrast} min={0} max={200} unit="%" onChange={(contrast) => setBackground({ contrast })} />
          <RangeControl label="Saturation" value={background.saturation} min={0} max={200} unit="%" onChange={(saturation) => setBackground({ saturation })} />
          <label className="field-control"><span>Overlay</span><input type="color" value={background.overlayColor} onChange={(event) => setBackground({ overlayColor: event.target.value })} /></label>
          <RangeControl label="Overlay opacity" value={background.overlayOpacity} min={0} max={100} unit="%" onChange={(overlayOpacity) => setBackground({ overlayOpacity })} />
        </PanelSection>
      </>}
      {background.mode === 'original-blur' && <PanelSection title="Original background blur">
        <div className="button-grid"><button type="button" onClick={() => setBackground({ blur: 8 })}>Low</button><button type="button" onClick={() => setBackground({ blur: 18 })}>Medium</button><button type="button" onClick={() => setBackground({ blur: 32 })}>High</button></div>
        <RangeControl label="Custom blur" value={background.blur} min={0} max={60} unit=" px" onChange={(blur) => setBackground({ blur })} />
      </PanelSection>}
    </>
  );
}

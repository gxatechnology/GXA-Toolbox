import type { CompareMode } from '../types/editor';

interface BeforeAfterProps {
  mode: CompareMode;
  position: number;
  onMode: (mode: CompareMode) => void;
  onPosition: (position: number) => void;
}

export function BeforeAfter({ mode, position, onMode, onPosition }: BeforeAfterProps) {
  return (
    <div className="compare-controls">
      <button type="button" className={mode === 'original' ? 'active' : ''} onClick={() => onMode(mode === 'original' ? 'final' : 'original')}>Original</button>
      <button type="button" className={mode === 'cutout' ? 'active' : ''} onClick={() => onMode(mode === 'cutout' ? 'final' : 'cutout')}>Cutout</button>
      <button type="button" className={mode === 'side-by-side' ? 'active' : ''} onClick={() => onMode('side-by-side')}>Side by side</button>
      <button
        type="button"
        onPointerDown={() => onMode('original')}
        onPointerUp={() => onMode('final')}
        onPointerLeave={() => mode === 'original' && onMode('final')}
      >Hold to view</button>
      <button type="button" className={mode === 'slider' ? 'active' : ''} onClick={() => onMode('slider')}>Slider</button>
      {mode === 'slider' && <input aria-label="Before and after slider" type="range" min="0" max="100" value={position} onChange={(event) => onPosition(Number(event.target.value))} />}
    </div>
  );
}

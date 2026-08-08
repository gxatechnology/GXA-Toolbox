import { useEditorStore } from '../../store/editorStore';
import { PanelSection } from './controls';

export function AutoPanel() {
  const requestAuto = useEditorStore((state) => state.requestAuto);
  const resetAutoMask = useEditorStore((state) => state.resetAutoMask);
  const invertMask = useEditorStore((state) => state.invertMask);
  const setBackground = useEditorStore((state) => state.setBackground);
  const provider = useEditorStore((state) => state.provider);
  const metrics = useEditorStore((state) => state.metrics);
  return (
    <>
      <PanelSection title="Automatic cutout">
        <p className="panel-help">Run the local segmentation model again or return to the first generated mask.</p>
        <div className="stacked-actions">
          <button type="button" className="primary-button" onClick={requestAuto}>Re-run Auto</button>
          <button type="button" className="secondary-button" onClick={resetAutoMask}>Reset Auto Mask</button>
          <button type="button" className="secondary-button" onClick={invertMask}>Invert Mask</button>
        </div>
      </PanelSection>
      <PanelSection title="Output intent">
        <div className="stacked-actions">
          <button type="button" className="secondary-button" onClick={() => setBackground({ mode: 'transparent' })}>Keep Foreground</button>
          <button type="button" className="secondary-button" onClick={() => setBackground({ mode: 'transparent' })}>Remove Background</button>
        </div>
      </PanelSection>
      <div className="engine-card"><strong>{provider?.toUpperCase() || 'Loading'}</strong><span>U2NetP · local ONNX</span>{metrics && <small>{Math.round(metrics.inferenceMs)} ms inference · {Math.round(metrics.totalMs)} ms total · {metrics.maskSize} mask</small>}</div>
    </>
  );
}

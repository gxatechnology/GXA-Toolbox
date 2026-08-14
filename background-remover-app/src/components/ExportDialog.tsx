import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { downloadBlob, exportImage } from '../utils/imageExport';
import { trackBackgroundTool } from '../utils/analytics';
import { Icon } from './Icon';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const settings = useEditorStore((state) => state.exportSettings);
  const setSettings = useEditorStore((state) => state.setExportSettings);
  const originalWidth = useEditorStore((state) => state.originalWidth);
  const originalHeight = useEditorStore((state) => state.originalHeight);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;
  const runExport = async () => {
    setBusy(true);
    setError('');
    try {
      const output = await exportImage(useEditorStore.getState());
      downloadBlob(output.blob, output.filename);
      trackBackgroundTool('tool_download', 'downloaded');
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed.');
    } finally { setBusy(false); }
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header><div><span className="eyebrow">Local export</span><h2 id="export-title">Download image</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close export dialog"><Icon name="close" /></button></header>
        <div className="dialog-body">
          <label className="field-control"><span>Filename</span><input value={settings.filename} onChange={(event) => setSettings({ filename: event.target.value })} /></label>
          <fieldset><legend>Format</legend><div className="segmented-buttons">{(['png', 'jpg', 'webp'] as const).map((format) => <button type="button" key={format} className={settings.format === format ? 'active' : ''} onClick={() => setSettings({ format, preserveTransparency: format !== 'jpg' })}>{format.toUpperCase()}</button>)}</div></fieldset>
          <fieldset><legend>Resolution</legend><div className="segmented-buttons">{([{ label: 'Original', value: 1 }, { label: '75%', value: .75 }, { label: '50%', value: .5 }, { label: 'Custom', value: 'custom' }] as const).map((option) => <button type="button" key={option.label} className={settings.size === option.value ? 'active' : ''} onClick={() => setSettings({ size: option.value })}>{option.label}</button>)}</div><small>Source: {originalWidth} × {originalHeight}</small></fieldset>
          {settings.size === 'custom' && <div className="two-fields"><label className="field-control"><span>Width</span><input type="number" min="1" max="12000" value={settings.customWidth} onChange={(event) => setSettings({ customWidth: Number(event.target.value) })} /></label><label className="field-control"><span>Height</span><input type="number" min="1" max="12000" value={settings.customHeight} onChange={(event) => setSettings({ customHeight: Number(event.target.value) })} /></label></div>}
          {settings.format !== 'png' && <label className="range-control"><span><strong>Quality</strong><output>{settings.quality}%</output></span><input type="range" min="25" max="100" value={settings.quality} onChange={(event) => setSettings({ quality: Number(event.target.value) })} /></label>}
          {settings.format === 'webp' && <label className="toggle-row"><span>Preserve transparency</span><input type="checkbox" checked={settings.preserveTransparency} onChange={(event) => setSettings({ preserveTransparency: event.target.checked })} /></label>}
          <label className="toggle-row"><span>Strip metadata</span><input type="checkbox" checked={settings.stripMetadata} onChange={(event) => setSettings({ stripMetadata: event.target.checked })} /></label>
          {error && <p className="dialog-error" role="alert">{error}</p>}
        </div>
        <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" disabled={busy} onClick={runExport}><Icon name="download" />{busy ? 'Rendering…' : 'Download'}</button></footer>
      </section>
    </div>
  );
}

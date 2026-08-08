import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_FILE_BYTES, MAX_SOURCE_PIXELS } from './app/defaults';
import { BeforeAfter } from './components/BeforeAfter';
import { BottomToolbar } from './components/BottomToolbar';
import { EditorCanvas } from './components/EditorCanvas';
import { ExportDialog } from './components/ExportDialog';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import { ProcessingScreen } from './components/ProcessingScreen';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ToolSidebar } from './components/ToolSidebar';
import { UploadScreen } from './components/UploadScreen';
import { segmentImage } from './segmentation/segmentImage';
import { useEditorStore } from './store/editorStore';
import type { ExecutionProvider, ProcessingStage } from './types/editor';
import { loadImage } from './utils/canvas';

function validateFile(file: File): void {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WEBP image.');
  if (file.size <= 0) throw new Error('The selected file is empty.');
  if (file.size > MAX_FILE_BYTES) throw new Error('The selected image exceeds the 30 MB limit.');
}

function stageFor(message: string): ProcessingStage {
  if (/loading/i.test(message)) return 'loading';
  if (/segment/i.test(message)) return 'segmenting';
  if (/mask/i.test(message)) return 'masking';
  if (/opening/i.test(message)) return 'opening';
  return 'reading';
}

export default function App() {
  const state = useEditorStore();
  const [exportOpen, setExportOpen] = useState(false);
  const [exportingHint, setExportingHint] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const sourceUrl = useRef('');
  const autoSeen = useRef(0);
  const replacementInput = useRef<HTMLInputElement>(null);

  const cancel = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
    sourceUrl.current = '';
    useEditorStore.getState().resetProject();
  }, []);

  const runSegmentation = useCallback(async (image: HTMLImageElement) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const forced = new URLSearchParams(window.location.search).get('provider');
    try {
      const result = await segmentImage(image, {
        forceProvider: forced === 'wasm' || forced === 'webgpu' ? forced as ExecutionProvider : undefined,
        signal: controller.signal,
        onStatus: (update) => useEditorStore.getState().setProcessing({ stage: stageFor(update.message), message: update.message, detail: update.detail })
      });
      controller.signal.throwIfAborted();
      useEditorStore.getState().setProcessing({ stage: 'opening', message: 'Opening editor', detail: 'Preparing the editable cutout workspace.' });
      document.documentElement.dataset.gxaSegmentationMetrics = JSON.stringify(result.metrics);
      useEditorStore.getState().setSegmented(result.mask, result.provider, result.metrics);
    } catch (error) {
      if (controller.signal.aborted) return;
      useEditorStore.getState().setError(error instanceof Error ? error.message : 'Background removal failed.');
    }
  }, []);

  const openFile = useCallback(async (file: File) => {
    abort.current?.abort();
    try { validateFile(file); }
    catch (error) { useEditorStore.getState().setError(error instanceof Error ? error.message : 'Invalid file.'); return; }
    if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
    const url = URL.createObjectURL(file);
    sourceUrl.current = url;
    useEditorStore.getState().beginReading(file, url);
    try {
      const image = await Promise.race([
        loadImage(url),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Image decoding timed out. The file may be corrupt.')), 15_000))
      ]);
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('The image has invalid dimensions.');
      if (image.naturalWidth * image.naturalHeight > MAX_SOURCE_PIXELS) throw new Error('This image is too large for safe browser processing (48 megapixels maximum).');
      useEditorStore.getState().beginImage(file, url, image);
      await runSegmentation(image);
    } catch (error) {
      useEditorStore.getState().setError(error instanceof Error ? error.message : 'The browser could not read this image.');
    }
  }, [runSegmentation]);

  useEffect(() => {
    if (state.autoRequest <= autoSeen.current) return;
    autoSeen.current = state.autoRequest;
    if (state.originalImage) runSegmentation(state.originalImage);
  }, [state.autoRequest, state.originalImage, runSegmentation]);

  useEffect(() => () => {
    abort.current?.abort();
    if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
  }, []);

  useEffect(() => {
    if (!exportingHint) return;
    const timeout = window.setTimeout(() => setExportingHint(false), 1000);
    return () => window.clearTimeout(timeout);
  }, [exportingHint]);

  const editing = state.phase === 'editing';
  return (
    <div className={`app-shell phase-${state.phase}`}>
      <Header editing={editing} onDownload={() => setExportOpen(true)} />
      {state.phase === 'idle' && <UploadScreen onFile={openFile} />}
      {state.phase === 'error' && <UploadScreen error={state.error} onFile={openFile} />}
      {state.phase === 'processing' && <ProcessingScreen sourceUrl={state.sourceUrl} processing={state.processing} onCancel={cancel} />}
      {editing && <main className="editor-page">
        <div className="editor-commandbar">
          <div><strong>Background Remover</strong><span>{state.originalWidth} × {state.originalHeight} · {state.provider?.toUpperCase()}</span></div>
          <div className="command-actions">
            <button type="button" onClick={state.undo} disabled={!state.undoCount} aria-label="Undo"><Icon name="undo" /></button>
            <button type="button" onClick={state.redo} disabled={!state.redoCount} aria-label="Redo"><Icon name="redo" /></button>
            <button type="button" onClick={() => replacementInput.current?.click()}><Icon name="upload" /><span>New image</span></button>
            <input ref={replacementInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && openFile(event.target.files[0])} />
          </div>
        </div>
        <div className="editor-workspace">
          <ToolSidebar active={state.activeTool} onChange={state.setActiveTool} />
          <section className="canvas-column">
            <EditorCanvas />
            <div className="canvas-statusbar">
              <BeforeAfter mode={state.compareMode} position={state.comparePosition} onMode={state.setCompareMode} onPosition={state.setComparePosition} />
              <div className="zoom-controls"><button type="button" onClick={() => state.setZoom(state.zoom - .1)}>−</button><select aria-label="Canvas zoom" value={Math.round(state.zoom * 100)} onChange={(event) => state.setZoom(Number(event.target.value) / 100)}><option value="25">25%</option><option value="50">50%</option><option value="100">100%</option><option value="200">200%</option></select><button type="button" onClick={() => state.setZoom(state.zoom + .1)}>+</button><button type="button" onClick={() => { state.setZoom(1); state.setPan({ x: 0, y: 0 }); }}>Fit</button></div>
            </div>
          </section>
          <PropertiesPanel />
        </div>
        <BottomToolbar active={state.activeTool} onChange={state.setActiveTool} />
      </main>}
      {exportingHint && <div className="toast">Preparing full-resolution export…</div>}
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}

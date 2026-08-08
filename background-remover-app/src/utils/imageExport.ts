import type { useEditorStore } from '../store/editorStore';
import { renderExport } from '../editor/exportRenderer';
import { canvasToBlob } from './canvas';

type EditorState = ReturnType<typeof useEditorStore.getState>;

export async function exportImage(state: EditorState): Promise<{ blob: Blob; filename: string }> {
  const started = performance.now();
  const canvas = renderExport(state);
  const rendered = performance.now();
  const format = state.exportSettings.format;
  const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const blob = await canvasToBlob(canvas, mime, state.exportSettings.quality / 100);
  const encoded = performance.now();
  performance.measure('gxa-export-render', { start: started, end: rendered });
  performance.measure('gxa-export-encode', { start: rendered, end: encoded });
  console.info('[Background Remover] Export ready', {
    width: canvas.width,
    height: canvas.height,
    renderMs: rendered - started,
    encodeMs: encoded - rendered,
    bytes: blob.size,
    mime
  });
  document.documentElement.dataset.gxaExportMetrics = JSON.stringify({
    width: canvas.width,
    height: canvas.height,
    renderMs: rendered - started,
    encodeMs: encoded - rendered,
    bytes: blob.size,
    mime
  });
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(blob);
    bitmap.close();
  }
  const safeBase = (state.exportSettings.filename || 'gxa-cutout').replace(/[^a-z0-9-_]+/gi, '-');
  return { blob, filename: `${safeBase}.${format}` };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

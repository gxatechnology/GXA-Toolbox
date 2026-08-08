import type { useEditorStore } from '../store/editorStore';
import { renderComposition } from './compositor';
import { createCanvas, getContext } from '../utils/canvas';

type EditorState = ReturnType<typeof useEditorStore.getState>;

export function renderExport(state: EditorState): HTMLCanvasElement {
  const output = renderComposition(state, {
    fullResolution: true,
    includeCrop: true,
    forceOpaque: state.exportSettings.format === 'jpg' || !state.exportSettings.preserveTransparency
  });
  const size = state.exportSettings.size;
  let width = output.width;
  let height = output.height;
  if (size === 'custom') {
    width = Math.max(1, Math.round(state.exportSettings.customWidth));
    height = Math.max(1, Math.round(state.exportSettings.customHeight));
  } else if (size !== 1) {
    width = Math.max(1, Math.round(width * size));
    height = Math.max(1, Math.round(height * size));
  }
  if (width === output.width && height === output.height) return output;
  const resized = createCanvas(width, height);
  const context = getContext(resized);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(output, 0, 0, width, height);
  return resized;
}

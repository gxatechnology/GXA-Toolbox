import type { useEditorStore } from '../store/editorStore';
import { cropHandles } from './cropEngine';
import { renderComposition, renderOriginal } from './compositor';
import { drawCheckerboard, getContext } from '../utils/canvas';

type EditorState = ReturnType<typeof useEditorStore.getState>;

function drawCropOverlay(context: CanvasRenderingContext2D, state: EditorState): void {
  if (!state.crop) return;
  const crop = state.crop;
  context.save();
  context.fillStyle = 'rgba(2,6,23,.58)';
  context.beginPath();
  context.rect(0, 0, state.canvasSize.width, state.canvasSize.height);
  context.rect(crop.x, crop.y, crop.width, crop.height);
  context.fill('evenodd');
  context.strokeStyle = '#ffffff';
  context.lineWidth = Math.max(2, state.canvasSize.width / 800 * 2);
  context.strokeRect(crop.x, crop.y, crop.width, crop.height);
  context.strokeStyle = 'rgba(255,255,255,.45)';
  context.lineWidth = 1;
  for (let index = 1; index < 3; index += 1) {
    context.beginPath();
    context.moveTo(crop.x + crop.width * index / 3, crop.y);
    context.lineTo(crop.x + crop.width * index / 3, crop.y + crop.height);
    context.moveTo(crop.x, crop.y + crop.height * index / 3);
    context.lineTo(crop.x + crop.width, crop.y + crop.height * index / 3);
    context.stroke();
  }
  const handleSize = Math.max(8, state.canvasSize.width / 140);
  context.fillStyle = '#ffffff';
  Object.values(cropHandles(crop)).forEach((point) => context.fillRect(point.x - handleSize / 2, point.y - handleSize / 2, handleSize, handleSize));
  context.restore();
}

export function renderEditorCanvas(canvas: HTMLCanvasElement, state: EditorState): void {
  canvas.width = Math.max(1, Math.round(state.canvasSize.width));
  canvas.height = Math.max(1, Math.round(state.canvasSize.height));
  const context = getContext(canvas);
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (state.background.mode === 'transparent' || state.compareMode === 'cutout') drawCheckerboard(context, canvas.width, canvas.height, Math.max(12, canvas.width / 70));
  const final = renderComposition(state, { includeCrop: false });
  const original = renderOriginal(state);
  if (state.compareMode === 'original') context.drawImage(original, 0, 0, canvas.width, canvas.height);
  else if (state.compareMode === 'side-by-side') {
    context.save();
    context.beginPath();
    context.rect(0, 0, canvas.width / 2, canvas.height);
    context.clip();
    context.drawImage(original, 0, 0, canvas.width, canvas.height);
    context.restore();
    context.save();
    context.beginPath();
    context.rect(canvas.width / 2, 0, canvas.width / 2, canvas.height);
    context.clip();
    context.drawImage(final, 0, 0, canvas.width, canvas.height);
    context.restore();
  } else if (state.compareMode === 'slider') {
    const split = canvas.width * state.comparePosition / 100;
    context.drawImage(final, 0, 0, canvas.width, canvas.height);
    context.save();
    context.beginPath();
    context.rect(0, 0, split, canvas.height);
    context.clip();
    context.drawImage(original, 0, 0, canvas.width, canvas.height);
    context.restore();
    context.fillStyle = '#ffffff';
    context.fillRect(split - 2, 0, 4, canvas.height);
  } else context.drawImage(final, 0, 0, canvas.width, canvas.height);
  if (state.activeTool === 'crop') drawCropOverlay(context, state);
}

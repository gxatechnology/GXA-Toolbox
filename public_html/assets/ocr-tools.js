import { runJob } from './engine-jobs.js';
export function languagePath(lang) {
  if (!['eng', 'spa', 'fra', 'deu', 'hin'].includes(lang)) throw new Error('Select a supported OCR language.');
  return `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}@1.0.0/4.0.0_best_int`;
}
export async function prepare(source, width, height, mode = 'original', rotation = 0) {
  if (!['original', 'contrast', 'adaptive'].includes(mode) || ![0, 90, 180, 270].includes(rotation)) throw new Error('Invalid OCR preprocessing settings.');
  if (width * height > 24000000) throw new Error('OCR input exceeds 24 megapixels.');
  if (mode !== 'original' && width * height > 8000000) throw new Error('Preprocessing is limited to 8 megapixels. Resize the image or choose Original.');
  const canvas = document.createElement('canvas');
  canvas.width = rotation % 180 ? height : width;
  canvas.height = rotation % 180 ? width : height;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: mode !== 'original' });
    if (!ctx) throw new Error('Canvas is required for OCR preprocessing.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180);
    ctx.drawImage(source, -width / 2, -height / 2, width, height);
    if (mode !== 'original') {
      const input = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = await runJob('ocr-preprocess', { width: input.width, height: input.height, data: input.data }, { mode }, 'ocr-preprocess', 15000);
      ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), canvas.width, canvas.height), 0, 0);
    }
    return canvas;
  } catch (error) { canvas.width = canvas.height = 0; throw error; }
}

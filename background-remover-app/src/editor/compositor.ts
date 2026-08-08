import type { useEditorStore } from '../store/editorStore';
import type { Adjustments, BackgroundSettings, DesignLayer, EffectSettings, SubjectTransform } from '../types/editor';
import { createCanvas, getContext } from '../utils/canvas';

type EditorState = ReturnType<typeof useEditorStore.getState>;

function rgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((value) => value + value).join('') : clean.padEnd(6, '0');
  const numeric = Number.parseInt(full.slice(0, 6), 16);
  return `rgba(${numeric >> 16 & 255}, ${numeric >> 8 & 255}, ${numeric & 255}, ${alpha})`;
}

function adjustmentFilter(values: Adjustments, effect?: EffectSettings): string {
  const exposureBrightness = Math.pow(2, values.exposure / 100) * 100;
  return [
    `brightness(${values.brightness * exposureBrightness / 100}%)`,
    `contrast(${values.contrast}%)`,
    `saturate(${values.saturation}%)`,
    `blur(${Math.max(0, values.blur)}px)`,
    `sepia(${effect?.sepia || 0}%)`,
    `invert(${effect?.invert || 0}%)`,
    `grayscale(${effect?.grayscale || 0}%)`
  ].join(' ');
}

function needsPixelPass(values: Adjustments, effect?: EffectSettings): boolean {
  return Boolean(values.vibrance || values.highlights || values.shadows || values.whites || values.blacks ||
    values.temperature || values.tint || values.gamma !== 100 || values.fade || values.sharpness || effect?.preset === 'duotone');
}

function pixelPass(canvas: HTMLCanvasElement, values: Adjustments, effect?: EffectSettings): void {
  if (!needsPixelPass(values, effect)) return;
  const context = getContext(canvas, true);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const gamma = Math.max(0.1, values.gamma / 100);
  const temperature = values.temperature * 0.55;
  const tint = values.tint * 0.4;
  const fade = values.fade / 100;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    let red = image.data[offset];
    let green = image.data[offset + 1];
    let blue = image.data[offset + 2];
    const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
    const shadowWeight = Math.pow(1 - luminance, 2);
    const highlightWeight = Math.pow(luminance, 2);
    const tone = values.shadows * shadowWeight * 1.2 + values.highlights * highlightWeight * 1.2;
    const endpoint = values.blacks * (1 - luminance) + values.whites * luminance;
    red += tone + endpoint + temperature + tint * 0.35;
    green += tone + endpoint - tint * 0.55;
    blue += tone + endpoint - temperature + tint * 0.35;
    const maxChannel = Math.max(red, green, blue);
    const average = (red + green + blue) / 3;
    const vibrance = values.vibrance / 100 * (1 - Math.max(0, maxChannel - average) / 255);
    red += (red - average) * vibrance;
    green += (green - average) * vibrance;
    blue += (blue - average) * vibrance;
    red = 255 * Math.pow(Math.max(0, Math.min(1, red / 255)), 1 / gamma);
    green = 255 * Math.pow(Math.max(0, Math.min(1, green / 255)), 1 / gamma);
    blue = 255 * Math.pow(Math.max(0, Math.min(1, blue / 255)), 1 / gamma);
    if (effect?.preset === 'duotone') {
      const dark = hexChannels(effect.duotoneA);
      const light = hexChannels(effect.duotoneB);
      red = dark[0] + (light[0] - dark[0]) * luminance;
      green = dark[1] + (light[1] - dark[1]) * luminance;
      blue = dark[2] + (light[2] - dark[2]) * luminance;
    }
    image.data[offset] = red * (1 - fade) + 235 * fade;
    image.data[offset + 1] = green * (1 - fade) + 238 * fade;
    image.data[offset + 2] = blue * (1 - fade) + 242 * fade;
  }
  context.putImageData(image, 0, 0);
  if (values.sharpness > 0) sharpen(canvas, values.sharpness / 100);
}

function hexChannels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').padEnd(6, '0');
  const number = Number.parseInt(clean.slice(0, 6), 16);
  return [number >> 16 & 255, number >> 8 & 255, number & 255];
}

function sharpen(canvas: HTMLCanvasElement, amount: number): void {
  const context = getContext(canvas, true);
  const source = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  const strength = Math.min(1.5, amount * 1.5);
  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < canvas.width - 1; x += 1) {
      const index = (y * canvas.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = source.data[index + channel];
        const neighbors = source.data[index - 4 + channel] + source.data[index + 4 + channel] +
          source.data[index - canvas.width * 4 + channel] + source.data[index + canvas.width * 4 + channel];
        result.data[index + channel] = center + (center * 4 - neighbors) * strength;
      }
    }
  }
  context.putImageData(result, 0, 0);
}

function adjusted(source: HTMLCanvasElement, values: Adjustments, effect?: EffectSettings): HTMLCanvasElement {
  const output = createCanvas(source.width, source.height);
  const context = getContext(output);
  context.filter = adjustmentFilter(values, effect);
  context.drawImage(source, 0, 0);
  context.filter = 'none';
  pixelPass(output, values, effect);
  return output;
}

function drawCover(context: CanvasRenderingContext2D, image: CanvasImageSource, imageWidth: number, imageHeight: number, width: number, height: number): void {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function backgroundCanvas(state: EditorState, width: number, height: number): HTMLCanvasElement {
  const output = createCanvas(width, height);
  const context = getContext(output);
  const background: BackgroundSettings = state.background;
  if (background.mode === 'transparent') return output;
  if (background.mode === 'solid') {
    context.fillStyle = background.color;
    context.fillRect(0, 0, width, height);
  } else if (background.mode === 'gradient') {
    const sorted = [...background.gradientStops].sort((a, b) => a.offset - b.offset);
    let gradient: CanvasGradient;
    if (background.gradientType === 'radial') gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
    else {
      const radians = (background.gradientAngle - 90) * Math.PI / 180;
      const radius = Math.max(width, height);
      gradient = context.createLinearGradient(
        width / 2 - Math.cos(radians) * radius,
        height / 2 - Math.sin(radians) * radius,
        width / 2 + Math.cos(radians) * radius,
        height / 2 + Math.sin(radians) * radius
      );
    }
    sorted.forEach((stop) => gradient.addColorStop(stop.offset, stop.color));
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  } else if (background.mode === 'original-blur' && state.originalImage) {
    context.filter = `blur(${background.blur}px)`;
    drawCover(context, state.originalImage, state.originalWidth, state.originalHeight, width, height);
    context.filter = 'none';
  } else if (background.mode === 'image' && background.image) {
    context.save();
    context.translate(width / 2 + background.imageX, height / 2 + background.imageY);
    context.rotate(background.imageRotation * Math.PI / 180);
    context.scale(background.imageFlipX ? -1 : 1, background.imageFlipY ? -1 : 1);
    const fitScale = background.imageFit === 'fill'
      ? Math.max(width / background.image.naturalWidth, height / background.image.naturalHeight)
      : Math.min(width / background.image.naturalWidth, height / background.image.naturalHeight);
    const scale = fitScale * background.imageScale;
    context.filter = `blur(${background.blur}px) brightness(${background.brightness}%) contrast(${background.contrast}%) saturate(${background.saturation}%)`;
    context.drawImage(background.image, -background.image.naturalWidth * scale / 2, -background.image.naturalHeight * scale / 2, background.image.naturalWidth * scale, background.image.naturalHeight * scale);
    context.restore();
  }
  if (background.overlayOpacity > 0) {
    context.fillStyle = rgba(background.overlayColor, background.overlayOpacity / 100);
    context.fillRect(0, 0, width, height);
  }
  return adjusted(output, state.adjustments.background);
}

function subjectCanvas(state: EditorState, width: number, height: number): HTMLCanvasElement {
  const output = createCanvas(width, height);
  if (!state.originalImage || !state.workingMask) return output;
  const context = getContext(output);
  context.drawImage(state.originalImage, 0, 0, width, height);
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(state.workingMask, 0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
  return adjusted(output, state.adjustments.subject);
}

function drawTransformedSubject(context: CanvasRenderingContext2D, subjectImage: HTMLCanvasElement, width: number, height: number, transform: SubjectTransform, coordinateScale: number): void {
  const fit = Math.min(width / subjectImage.width, height / subjectImage.height);
  const scale = fit * transform.scale;
  context.save();
  context.translate(width / 2 + transform.x * coordinateScale, height / 2 + transform.y * coordinateScale);
  context.rotate(transform.rotation * Math.PI / 180);
  context.scale(transform.flipX ? -scale : scale, transform.flipY ? -scale : scale);
  context.globalAlpha = transform.opacity;
  context.drawImage(subjectImage, -subjectImage.width / 2, -subjectImage.height / 2);
  context.restore();
}

function drawSubjectStyling(context: CanvasRenderingContext2D, subject: HTMLCanvasElement, width: number, height: number, transform: SubjectTransform, coordinateScale: number): void {
  if (transform.groundShadow) {
    context.save();
    context.translate(width / 2 + transform.x * coordinateScale, height / 2 + transform.y * coordinateScale + height * 0.3 * transform.scale);
    context.scale(1, 0.28);
    context.filter = `blur(${transform.shadowBlur * coordinateScale}px)`;
    context.globalAlpha = transform.shadowOpacity / 100;
    context.fillStyle = transform.shadowColor;
    context.beginPath();
    context.ellipse(0, 0, width * 0.2 * transform.scale, height * 0.08 * transform.scale, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  if (transform.shadow) {
    context.save();
    context.shadowColor = rgba(transform.shadowColor, transform.shadowOpacity / 100);
    context.shadowBlur = transform.shadowBlur * coordinateScale;
    context.shadowOffsetX = transform.shadowX * coordinateScale;
    context.shadowOffsetY = transform.shadowY * coordinateScale;
    drawTransformedSubject(context, subject, width, height, transform, coordinateScale);
    context.restore();
  }
  if (transform.outline || transform.glow) {
    const silhouette = createCanvas(subject.width, subject.height);
    const silhouetteContext = getContext(silhouette);
    silhouetteContext.drawImage(subject, 0, 0);
    silhouetteContext.globalCompositeOperation = 'source-in';
    silhouetteContext.fillStyle = transform.outlineColor;
    silhouetteContext.fillRect(0, 0, silhouette.width, silhouette.height);
    if (transform.glow) {
      context.save();
      context.shadowColor = transform.glowColor;
      context.shadowBlur = transform.glowBlur * coordinateScale;
      drawTransformedSubject(context, silhouette, width, height, transform, coordinateScale);
      context.restore();
    }
    if (transform.outline) {
      const radius = Math.max(1, Math.round(transform.outlineWidth / 3));
      for (let x = -radius; x <= radius; x += 1) {
        for (let y = -radius; y <= radius; y += 1) {
          if (!x && !y) continue;
          drawTransformedSubject(context, silhouette, width, height, { ...transform, x: transform.x + x * 3, y: transform.y + y * 3 }, coordinateScale);
        }
      }
    }
  }
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect(x, y, width, height, r);
}

function drawLayers(context: CanvasRenderingContext2D, layers: DesignLayer[], coordinateScale: number): void {
  layers.forEach((layer) => {
    if (!layer.visible) return;
    context.save();
    context.translate(layer.x * coordinateScale, layer.y * coordinateScale);
    context.rotate(layer.rotation * Math.PI / 180);
    context.globalAlpha = layer.opacity;
    if (layer.type === 'text') {
      context.font = `${layer.weight} ${layer.size * coordinateScale}px ${layer.font}`;
      context.textAlign = layer.align;
      context.textBaseline = 'middle';
      if (layer.shadow) {
        context.shadowColor = 'rgba(15,23,42,.45)';
        context.shadowBlur = 12 * coordinateScale;
        context.shadowOffsetY = 8 * coordinateScale;
      }
      if (layer.outline) {
        context.strokeStyle = layer.outlineColor;
        context.lineWidth = 6 * coordinateScale;
        context.strokeText(layer.text, 0, 0);
      }
      context.fillStyle = layer.color;
      context.fillText(layer.text, 0, 0);
    } else if (layer.type === 'shape') {
      const width = layer.width * coordinateScale;
      const height = layer.height * coordinateScale;
      context.fillStyle = layer.fill;
      context.strokeStyle = layer.stroke;
      context.lineWidth = layer.strokeWidth * coordinateScale;
      if (layer.shape === 'circle') {
        context.beginPath();
        context.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      } else if (layer.shape === 'line' || layer.shape === 'arrow') {
        context.beginPath();
        context.moveTo(-width / 2, 0);
        context.lineTo(width / 2, 0);
        context.strokeStyle = layer.fill;
        context.lineWidth = Math.max(2, layer.strokeWidth * coordinateScale || 8 * coordinateScale);
        context.stroke();
        if (layer.shape === 'arrow') {
          context.beginPath();
          context.moveTo(width / 2, 0);
          context.lineTo(width / 2 - 24 * coordinateScale, -16 * coordinateScale);
          context.lineTo(width / 2 - 24 * coordinateScale, 16 * coordinateScale);
          context.closePath();
          context.fill();
        }
        context.restore();
        return;
      } else {
        roundedRect(context, -width / 2, -height / 2, width, height, layer.shape === 'rounded-rectangle' ? 28 * coordinateScale : 0);
      }
      context.fill();
      if (layer.strokeWidth) context.stroke();
    } else {
      context.drawImage(layer.image, -layer.width * coordinateScale / 2, -layer.height * coordinateScale / 2, layer.width * coordinateScale, layer.height * coordinateScale);
    }
    context.restore();
  });
}

export interface CompositionOptions {
  fullResolution?: boolean;
  includeCrop?: boolean;
  forceOpaque?: boolean;
}

export function renderComposition(state: EditorState, options: CompositionOptions = {}): HTMLCanvasElement {
  if (!state.originalImage || !state.workingMask) return createCanvas(1, 1);
  const coordinateScale = options.fullResolution
    ? Math.max(state.originalWidth / state.workingMask.width, state.originalHeight / state.workingMask.height)
    : 1;
  const baseWidth = Math.max(1, Math.round(state.canvasSize.width * coordinateScale));
  const baseHeight = Math.max(1, Math.round(state.canvasSize.height * coordinateScale));
  const sourceWidth = options.fullResolution ? state.originalWidth : state.workingMask.width;
  const sourceHeight = options.fullResolution ? state.originalHeight : state.workingMask.height;
  const base = createCanvas(baseWidth, baseHeight);
  const context = getContext(base);
  const background = backgroundCanvas(state, baseWidth, baseHeight);
  context.drawImage(background, 0, 0);
  const subject = subjectCanvas(state, sourceWidth, sourceHeight);
  drawSubjectStyling(context, subject, baseWidth, baseHeight, state.subject, coordinateScale);
  drawTransformedSubject(context, subject, baseWidth, baseHeight, state.subject, coordinateScale);
  drawLayers(context, state.layers, coordinateScale);
  const final = adjusted(base, state.adjustments.entire, state.effect);
  if (options.forceOpaque && state.background.mode === 'transparent') {
    const opaque = createCanvas(final.width, final.height);
    const opaqueContext = getContext(opaque);
    opaqueContext.fillStyle = state.background.color || '#ffffff';
    opaqueContext.fillRect(0, 0, opaque.width, opaque.height);
    opaqueContext.drawImage(final, 0, 0);
    return cropComposition(opaque, state, coordinateScale, options.includeCrop !== false);
  }
  return cropComposition(final, state, coordinateScale, options.includeCrop !== false);
}

function cropComposition(source: HTMLCanvasElement, state: EditorState, coordinateScale: number, includeCrop: boolean): HTMLCanvasElement {
  if (!includeCrop || !state.crop) return source;
  const crop = state.crop;
  const output = createCanvas(crop.width * coordinateScale, crop.height * coordinateScale);
  getContext(output).drawImage(
    source,
    crop.x * coordinateScale,
    crop.y * coordinateScale,
    crop.width * coordinateScale,
    crop.height * coordinateScale,
    0,
    0,
    output.width,
    output.height
  );
  return output;
}

export function renderOriginal(state: EditorState): HTMLCanvasElement {
  const output = createCanvas(state.canvasSize.width, state.canvasSize.height);
  if (!state.originalImage) return output;
  drawCover(getContext(output), state.originalImage, state.originalWidth, state.originalHeight, output.width, output.height);
  return output;
}

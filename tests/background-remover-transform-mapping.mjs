import assert from 'node:assert/strict';

function canvasPoint({ canvasWidth, canvasHeight, zoom, rect }, event) {
  return {
    x: (event.clientX - rect.left) * canvasWidth / rect.width / zoom,
    y: (event.clientY - rect.top) * canvasHeight / rect.height / zoom
  };
}

function brushMaskPoint({ maskWidth, maskHeight, canvasWidth, canvasHeight }, point) {
  const scaleX = maskWidth / canvasWidth;
  const scaleY = maskHeight / canvasHeight;
  return {
    x: point.x * scaleX,
    y: point.y * scaleY
  };
}

function resizeCrop({ canvasWidth, canvasHeight, crop, start, point, handle }) {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  const minSize = Math.max(16, Math.min(canvasWidth, canvasHeight) * 0.02);
  let { x, y, w, h } = crop;

  if (handle === 'move') {
    x = crop.x + dx;
    y = crop.y + dy;
  } else {
    if (handle.includes('w')) {
      x = crop.x + dx;
      w = crop.w - dx;
    }
    if (handle.includes('e')) w = crop.w + dx;
    if (handle.includes('n')) {
      y = crop.y + dy;
      h = crop.h - dy;
    }
    if (handle.includes('s')) h = crop.h + dy;
  }

  if (w < minSize) {
    if (handle.includes('w')) x -= minSize - w;
    w = minSize;
  }
  if (h < minSize) {
    if (handle.includes('n')) y -= minSize - h;
    h = minSize;
  }

  if (handle === 'move') {
    x = Math.max(0, Math.min(canvasWidth - w, x));
    y = Math.max(0, Math.min(canvasHeight - h, y));
  } else {
    x = Math.max(0, Math.min(canvasWidth - minSize, x));
    y = Math.max(0, Math.min(canvasHeight - minSize, y));
    w = Math.max(minSize, Math.min(canvasWidth - x, w));
    h = Math.max(minSize, Math.min(canvasHeight - y, h));
  }

  return { x, y, w, h };
}

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 0.001, `${label}: expected ${expected}, got ${actual}`);
}

for (const zoom of [0.5, 1, 2]) {
  const point = canvasPoint({
    canvasWidth: 1000 * zoom,
    canvasHeight: 600 * zoom,
    zoom,
    rect: { left: 100, top: 40, width: 1000 * zoom, height: 600 * zoom }
  }, { clientX: 100 + 400 * zoom, clientY: 40 + 240 * zoom });
  close(point.x, 400, `canvas x at ${zoom}x`);
  close(point.y, 240, `canvas y at ${zoom}x`);
}

const fitPoint = canvasPoint({
  canvasWidth: 880,
  canvasHeight: 495,
  zoom: 1,
  rect: { left: 12, top: 18, width: 880, height: 495 }
}, { clientX: 452, clientY: 265.5 });
close(fitPoint.x, 440, 'fit x');
close(fitPoint.y, 247.5, 'fit y');

const portraitBrush = brushMaskPoint({
  maskWidth: 2160,
  maskHeight: 3840,
  canvasWidth: 540,
  canvasHeight: 960
}, { x: 135, y: 720 });
close(portraitBrush.x, 540, 'portrait mask x');
close(portraitBrush.y, 2880, 'portrait mask y');

const landscapeBrush = brushMaskPoint({
  maskWidth: 3840,
  maskHeight: 2160,
  canvasWidth: 960,
  canvasHeight: 540
}, { x: 720, y: 135 });
close(landscapeBrush.x, 2880, 'landscape mask x');
close(landscapeBrush.y, 540, 'landscape mask y');

const croppedBrush = brushMaskPoint({
  maskWidth: 1920,
  maskHeight: 1080,
  canvasWidth: 960,
  canvasHeight: 540
}, { x: 320, y: 180 });
close(croppedBrush.x, 640, 'cropped mask x');
close(croppedBrush.y, 360, 'cropped mask y');

const transformedBrush = brushMaskPoint({
  maskWidth: 1920,
  maskHeight: 1280,
  canvasWidth: 1920,
  canvasHeight: 1280
}, { x: 880, y: 470 });
close(transformedBrush.x, 880, 'transformed subject mask x');
close(transformedBrush.y, 470, 'transformed subject mask y');

const moved = resizeCrop({
  canvasWidth: 1000,
  canvasHeight: 800,
  crop: { x: 100, y: 100, w: 300, h: 240 },
  start: { x: 200, y: 200 },
  point: { x: 950, y: 760 },
  handle: 'move'
});
assert.deepEqual(moved, { x: 700, y: 560, w: 300, h: 240 });

const resized = resizeCrop({
  canvasWidth: 1000,
  canvasHeight: 800,
  crop: { x: 100, y: 100, w: 300, h: 240 },
  start: { x: 400, y: 340 },
  point: { x: 1040, y: 860 },
  handle: 'se'
});
assert.deepEqual(resized, { x: 100, y: 100, w: 900, h: 700 });

const minClamped = resizeCrop({
  canvasWidth: 1000,
  canvasHeight: 800,
  crop: { x: 100, y: 100, w: 300, h: 240 },
  start: { x: 100, y: 100 },
  point: { x: 380, y: 320 },
  handle: 'nw'
});
assert.deepEqual(minClamped, { x: 380, y: 320, w: 20, h: 20 });

console.log('Background Remover transform mapping tests passed.');

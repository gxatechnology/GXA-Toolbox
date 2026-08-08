(function () {
  'use strict';

  const ROOT = '/assets/models/background-remover/';
  const MODEL_URL = ROOT + 'u2netp-web.onnx';
  const CONFIG_URL = ROOT + 'model-config.json';
  const ORT_URL = '/assets/vendor/onnxruntime-web/ort.all.min.js';
  const ORT_WASM_PATH = '/assets/vendor/onnxruntime-web/';
  const MODEL_SIZE_BYTES = 4574267;
  const INPUT_SIZE = 320;
  const MEAN = [0.485, 0.456, 0.406];
  const STD = [0.229, 0.224, 0.225];

  let ortPromise = null;
  let sessionPromise = null;
  let lastEngine = null;

  function emit(status, message, detail) {
    document.documentElement.dataset.gxaSegmentationStatus = message || '';
    document.documentElement.dataset.gxaSegmentationDetail = detail || '';
    if (typeof status === 'function') status({ message, detail });
  }

  function loadScript(src) {
    const existing = document.querySelector(`script[data-gxa-seg-src="${src}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (window.ort) resolve(window.ort);
        existing.addEventListener('load', () => resolve(window.ort), { once: true });
        existing.addEventListener('error', reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.dataset.gxaSegSrc = src;
      script.onload = () => resolve(window.ort);
      script.onerror = () => reject(new Error('The local segmentation runtime could not be loaded.'));
      document.head.appendChild(script);
    });
  }

  async function ensureOrt(status) {
    if (!ortPromise) {
      emit(status, 'Loading removal engine', 'Loading the local ONNX Runtime Web assets.');
      ortPromise = loadScript(ORT_URL).then((ort) => {
        if (!ort) throw new Error('ONNX Runtime Web did not initialize.');
        ort.env.wasm.wasmPaths = ORT_WASM_PATH;
        ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1)) : 1;
        return ort;
      });
    }
    return ortPromise;
  }

  async function providerOrder() {
    const providers = [];
    if ('gpu' in navigator) providers.push('webgpu');
    providers.push('wasm');
    return providers;
  }

  async function createSession(status, forceProvider) {
    const ort = await ensureOrt(status);
    const preferred = forceProvider ? [forceProvider] : await providerOrder();
    const errors = [];
    for (const provider of preferred) {
      try {
        emit(status, 'Loading removal engine', provider === 'webgpu' ? 'Trying browser GPU acceleration.' : 'Using browser compatibility mode.');
        const session = await ort.InferenceSession.create(MODEL_URL, {
          executionProviders: [provider],
          graphOptimizationLevel: 'all'
        });
        lastEngine = provider;
        return { ort, session, provider };
      } catch (error) {
        errors.push(`${provider}: ${error.message || error}`);
      }
    }
    throw new Error(`Segmentation engine failed to initialize. ${errors.join(' | ')}`);
  }

  async function ensureSession(status, forceProvider) {
    if (forceProvider) return createSession(status, forceProvider);
    if (!sessionPromise) sessionPromise = createSession(status);
    return sessionPromise;
  }

  function validateImageFile(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Select a supported image file.');
    if (!/image\/(jpeg|png|webp)/i.test(file.type)) throw new Error('Supported formats: JPG, PNG, and WEBP.');
    if (file.size <= 0 || file.size > 25 * 1024 * 1024) throw new Error('Image must be between 1 byte and 25 MB.');
  }

  async function decodeImage(file) {
    validateImageFile(file);
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('The browser could not decode this image. It may be corrupted or unsupported.'));
        img.src = url;
      });
      return { image, url };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  function makeInputTensor(ort, image) {
    const sourceW = image.naturalWidth;
    const sourceH = image.naturalHeight;
    const scale = Math.min(INPUT_SIZE / sourceW, INPUT_SIZE / sourceH);
    const drawW = Math.round(sourceW * scale);
    const drawH = Math.round(sourceH * scale);
    const padX = Math.floor((INPUT_SIZE - drawW) / 2);
    const padY = Math.floor((INPUT_SIZE - drawH) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    ctx.drawImage(image, padX, padY, drawW, drawH);
    const pixels = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const data = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
    const plane = INPUT_SIZE * INPUT_SIZE;
    for (let i = 0; i < plane; i += 1) {
      data[i] = ((pixels[i * 4] / 255) - MEAN[0]) / STD[0];
      data[plane + i] = ((pixels[i * 4 + 1] / 255) - MEAN[1]) / STD[1];
      data[plane * 2 + i] = ((pixels[i * 4 + 2] / 255) - MEAN[2]) / STD[2];
    }
    return {
      tensor: new ort.Tensor('float32', data, [1, 3, INPUT_SIZE, INPUT_SIZE]),
      transform: { sourceW, sourceH, drawW, drawH, padX, padY, inputSize: INPUT_SIZE }
    };
  }

  function firstOutput(outputs) {
    const names = Object.keys(outputs || {});
    if (!names.length) throw new Error('The segmentation model returned no output.');
    return outputs[names[0]];
  }

  function normalizeMask(tensor) {
    const raw = tensor.data;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < raw.length; i += 1) {
      if (raw[i] < min) min = raw[i];
      if (raw[i] > max) max = raw[i];
    }
    const range = Math.max(1e-8, max - min);
    const out = new Uint8ClampedArray(INPUT_SIZE * INPUT_SIZE);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = Math.max(0, Math.min(255, Math.round(((raw[i] - min) / range) * 255)));
    }
    return out;
  }

  function postProcessMask(mask, transform) {
    const source = document.createElement('canvas');
    source.width = INPUT_SIZE;
    source.height = INPUT_SIZE;
    const sctx = source.getContext('2d');
    const imageData = sctx.createImageData(INPUT_SIZE, INPUT_SIZE);
    for (let i = 0; i < mask.length; i += 1) {
      const value = mask[i];
      imageData.data[i * 4] = value;
      imageData.data[i * 4 + 1] = value;
      imageData.data[i * 4 + 2] = value;
      imageData.data[i * 4 + 3] = 255;
    }
    sctx.putImageData(imageData, 0, 0);

    const unpadded = document.createElement('canvas');
    unpadded.width = transform.drawW;
    unpadded.height = transform.drawH;
    unpadded.getContext('2d').drawImage(source, transform.padX, transform.padY, transform.drawW, transform.drawH, 0, 0, transform.drawW, transform.drawH);

    const finalMask = document.createElement('canvas');
    finalMask.width = transform.sourceW;
    finalMask.height = transform.sourceH;
    const fctx = finalMask.getContext('2d', { willReadFrequently: true });
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = 'high';
    fctx.drawImage(unpadded, 0, 0, transform.sourceW, transform.sourceH);
    smoothMask(finalMask);
    return finalMask;
  }

  function smoothMask(maskCanvas) {
    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    const data = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const pixels = data.data;
    let transparent = 0;
    let opaque = 0;
    let partial = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      let value = pixels[i];
      if (value < 4) value = 0;
      else if (value > 251) value = 255;
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
      pixels[i + 3] = 255;
      if (value === 0) transparent += 1;
      else if (value === 255) opaque += 1;
      else partial += 1;
    }
    ctx.putImageData(data, 0, 0);
    return { transparent, opaque, partial };
  }

  function statsForMask(maskCanvas) {
    const data = maskCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    let min = 255;
    let max = 0;
    let sum = 0;
    let transparent = 0;
    let opaque = 0;
    let partial = 0;
    const total = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i];
      min = Math.min(min, a);
      max = Math.max(max, a);
      sum += a;
      if (a <= 4) transparent += 1;
      else if (a >= 251) opaque += 1;
      else partial += 1;
    }
    const stats = {
      min,
      max,
      mean: sum / total,
      transparentPct: transparent / total * 100,
      opaquePct: opaque / total * 100,
      partialPct: partial / total * 100,
      totalPixels: total
    };
    if (stats.max - stats.min < 8) throw new Error('The segmentation mask is uniform, so the cutout was rejected.');
    if (Math.max(stats.transparentPct, stats.opaquePct) > 99.9) throw new Error('The segmentation mask is suspiciously one-sided, so the cutout was rejected.');
    return stats;
  }

  function buildCutout(original, maskCanvas) {
    const out = document.createElement('canvas');
    out.width = original.naturalWidth;
    out.height = original.naturalHeight;
    const ctx = out.getContext('2d');
    ctx.drawImage(original, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return new Promise((resolve, reject) => {
      out.toBlob(blob => blob ? resolve({ blob, canvas: out }) : reject(new Error('Could not create transparent cutout.')), 'image/png');
    });
  }

  async function segment(file, options = {}) {
    const started = performance.now();
    emit(options.status, 'Preparing image', 'Decoding the source image and preserving its original dimensions.');
    const decoded = await decodeImage(file);
    try {
      const { ort, session, provider } = await ensureSession(options.status, options.forceProvider);
      emit(options.status, 'Preparing image', 'Letterboxing and normalizing RGB pixels for U2NetP.');
      const { tensor, transform } = makeInputTensor(ort, decoded.image);
      emit(options.status, 'Analyzing subject', 'Running the foreground segmentation model in this browser.');
      const inferenceStarted = performance.now();
      const feeds = {};
      feeds[session.inputNames?.[0] || 'input.1'] = tensor;
      const outputs = await session.run(feeds);
      const inferenceMs = performance.now() - inferenceStarted;
      emit(options.status, 'Creating cutout', 'Mapping the soft alpha mask back to the original image dimensions.');
      const mask = postProcessMask(normalizeMask(firstOutput(outputs)), transform);
      const stats = statsForMask(mask);
      const { blob } = await buildCutout(decoded.image, mask);
      const cutoutUrl = URL.createObjectURL(blob);
      URL.revokeObjectURL(decoded.url);
      return {
        blob,
        cutoutUrl,
        maskCanvas: mask,
        filename: file.name.replace(/\.[^.]+$/, '') + '_segmented.png',
        provider,
        stats,
        performance: {
          modelSizeBytes: MODEL_SIZE_BYTES,
          totalMs: performance.now() - started,
          inferenceMs,
          inputResolution: `${INPUT_SIZE}x${INPUT_SIZE}`,
          outputMaskResolution: `${transform.sourceW}x${transform.sourceH}`
        }
      };
    } catch (error) {
      URL.revokeObjectURL(decoded.url);
      throw error;
    }
  }

  async function loadConfig() {
    const response = await fetch(CONFIG_URL, { cache: 'force-cache' });
    if (!response.ok) throw new Error('Segmentation model configuration could not be loaded.');
    return response.json();
  }

  window.GxaBackgroundSegmentation = {
    segment,
    loadConfig,
    getLastEngine: () => lastEngine,
    modelUrl: MODEL_URL,
    modelSizeBytes: MODEL_SIZE_BYTES
  };
})();

(function (root) {
  'use strict';
  const names = { qr_code: 'QR_CODE', code_128: 'CODE_128', code_39: 'CODE_39', ean_13: 'EAN_13', ean_8: 'EAN_8', upc_a: 'UPC_A', upc_e: 'UPC_E', itf: 'ITF', codabar: 'CODABAR', data_matrix: 'DATA_MATRIX', pdf417: 'PDF_417', aztec: 'AZTEC' };
  async function decode(file, formats, dependencies = {}) {
    const env = dependencies.env || root;
    const image = new env.Image();
    const url = env.URL.createObjectURL(file);
    try {
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 24000000) throw new Error('Choose an image with at most 24 megapixels.');
      if (typeof env.BarcodeDetector === 'function') {
        try {
          const supported = await env.BarcodeDetector.getSupportedFormats();
          const selected = formats.filter(format => supported.includes(format));
          if (selected.length) {
            const hits = await new env.BarcodeDetector({ formats: selected }).detect(image);
            if (hits.length) return hits[0];
          }
        } catch { /* Native implementations can lack a format or fail; try the local decoder. */ }
      }
      let lib;
      try { lib = dependencies.library || await env.GxaWorkspace.loadScriptOnce('/assets/vendor/zxing/index.min.js', 'ZXing'); }
      catch { throw new Error('The local barcode decoder could not load. Check your connection and retry. No image was uploaded.'); }
      if (!lib?.BrowserMultiFormatReader) throw new Error('Local barcode decoding is unavailable in this browser.');
      const hints = new Map();
      hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, formats.map(format => lib.BarcodeFormat[names[format]]).filter(value => value !== undefined));
      hints.set(lib.DecodeHintType.TRY_HARDER, true);
      const reader = new lib.BrowserMultiFormatReader(hints);
      try {
        const result = await reader.decodeFromImageElement(image);
        return { rawValue: result.getText(), format: lib.BarcodeFormat[result.getBarcodeFormat()] };
      } catch { throw new Error('No readable code was found. Use a sharp image showing the entire supported code.'); }
      finally { reader.reset(); }
    } finally { env.URL.revokeObjectURL(url); }
  }
  root.GxaBarcodeReader = Object.freeze({ decode });
})(globalThis);

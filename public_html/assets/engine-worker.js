/* Bounded, disposable worker. User code is parsed, never evaluated. */
'use strict';
self.onmessage = async ({ data }) => {
  try {
    const { kind, input, options = {} } = data;
    let result;
    if (['javascript', 'css', 'html', 'sql'].includes(kind)) {
      if (typeof input !== 'string' || input.length > 500000) throw new Error('Formatting is limited to 500,000 characters.');
      if (kind === 'sql') {
        importScripts('/assets/vendor/sql-formatter/sql-formatter.min.js');
        result = self.sqlFormatter.format(input, { language: 'sql', keywordCase: 'preserve', tabWidth: 2 });
      } else {
        importScripts('/assets/vendor/prettier/standalone.js');
        const plugins = kind === 'javascript' ? ['babel', 'estree'] : kind === 'css' ? ['postcss'] : ['html', 'babel', 'estree', 'postcss'];
        importScripts(...plugins.map(name => `/assets/vendor/prettier/${name}.js`));
        result = await self.prettier.format(input, {
          parser: { javascript: 'babel', css: 'css', html: 'html' }[kind],
          plugins: Object.values(self.prettierPlugins), tabWidth: 2,
          htmlWhitespaceSensitivity: 'strict'
        });
      }
    } else if (kind === 'regex') {
      if (input.subject.length > 500000 || input.pattern.length > 10000) throw new Error('Pattern or subject exceeds the safe test limit.');
      const flags = input.flags.includes('g') ? input.flags : input.flags + 'g';
      const regex = new RegExp(input.pattern, flags);
      result = [];
      let match;
      while (result.length < 100 && (match = regex.exec(input.subject)) !== null) {
        result.push({ value: match[0], index: match.index, groups: Array.from(match).slice(1) });
        // AdvanceStringIndex: do not split surrogate pairs in Unicode mode.
        if (!match[0]) regex.lastIndex += (regex.unicode || flags.includes('v')) && input.subject.codePointAt(regex.lastIndex) > 0xffff ? 2 : 1;
      }
    } else if (kind === 'ocr-preprocess') {
      const { width, height, data: pixels } = input;
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 8000000 || pixels.length !== width * height * 4) throw new Error('Preprocessing is limited to 8 megapixels.');
      const histogram = new Uint32Array(256), gray = new Uint8Array(width * height);
      for (let i = 0; i < gray.length; i++) { gray[i] = Math.round(0.2126 * pixels[i * 4] + 0.7152 * pixels[i * 4 + 1] + 0.0722 * pixels[i * 4 + 2]); histogram[gray[i]]++; }
      let low = 0, high = 255, sum = 0;
      while (low < 255 && sum + histogram[low] < gray.length * 0.01) sum += histogram[low++];
      sum = 0;
      while (high > low && sum + histogram[high] < gray.length * 0.01) sum += histogram[high--];
      if (high > low) for (let i = 0; i < gray.length; i++) gray[i] = Math.max(0, Math.min(255, Math.round((gray[i] - low) * 255 / (high - low))));
      let integral;
      if (options.mode === 'adaptive') {
        integral = new Uint32Array((width + 1) * (height + 1));
        for (let y = 1; y <= height; y++) {
          let rowSum = 0;
          for (let x = 1; x <= width; x++) { rowSum += gray[(y - 1) * width + x - 1]; integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum; }
        }
      }
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x; let value = gray[i];
        if (integral) {
          const x0 = Math.max(0, x - 15), y0 = Math.max(0, y - 15), x1 = Math.min(width, x + 16), y1 = Math.min(height, y + 16), stride = width + 1;
          const total = integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0];
          value = value < total / ((x1 - x0) * (y1 - y0)) - 12 ? 0 : 255;
        }
        pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = value; pixels[i * 4 + 3] = 255;
      }
      result = pixels;
    } else if (kind === 'trace') {
      const { width, height, data: pixels } = input;
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 1048576 || pixels.length !== width * height * 4) throw new Error('Tracing input must contain at most one megapixel.');
      importScripts('/assets/vendor/imagetracer/imagetracer.js');
      const threshold = Math.max(0, Math.min(255, Number.isFinite(Number(options.threshold)) ? Number(options.threshold) : 128));
      for (let i = 0; i < pixels.length; i += 4) {
        if (options.background === 'white') {
          const alpha = pixels[i + 3] / 255;
          for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(pixels[i + c] * alpha + 255 * (1 - alpha));
          pixels[i + 3] = 255;
        }
        if (options.mode === 'bw') {
          const value = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2] < threshold ? 0 : 255;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
        }
      }
      result = self.ImageTracer.imagedataToSVG({ width, height, data: pixels }, {
        colorsampling: 2, mincolorratio: 0, numberofcolors: options.mode === 'bw' ? 2 : 16,
        colorquantcycles: 3, pathomit: Math.max(0, Math.min(32, Number(options.noise) || 0)),
        ltres: Math.max(0.1, Math.min(5, Number(options.smoothing) || 1)),
        qtres: Math.max(0.1, Math.min(5, Number(options.smoothing) || 1)),
        roundcoords: 2, viewbox: true, desc: false,
        // Deterministic palette; avoid ImageTracer's random palette initialization.
        pal: options.mode === 'bw' ? [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }, { r: 0, g: 0, b: 0, a: 0 }] : undefined
      });
      if (result.length > 8000000 || !/<path\b/.test(result) || /<(?:image|script|foreignObject)\b/i.test(result)) throw new Error('Tracing could not produce a safe path-only SVG. Try a simpler image.');
    } else throw new Error('Unsupported local engine.');
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: String(error.message || 'Local processing failed.').slice(0, 2000) });
  }
};

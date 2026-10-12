/* Deliberately narrow native PDF text rewriting. Unsupported streams stay untouched. */
(function (root) {
  'use strict';
  const standard = new Set(['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique', 'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic', 'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique']);
  const latin = bytes => Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  // Offsets refer to decoded bytes, not Unicode string indices. Literal strings,
  // comments and hex strings are consumed atomically, never searched as operators.
  function tokens(source) {
    const result = []; let i = 0;
    while (i < source.length) {
      if (/\s|\0/.test(source[i])) { i++; continue; }
      if (source[i] === '%') { while (i < source.length && !/[\r\n]/.test(source[i])) i++; continue; }
      const start = i;
      if (source[i] === '(') {
        let depth = 1; i++;
        while (i < source.length && depth) { if (source[i] === '\\') { i += 2; continue; } if (source[i] === '(') depth++; if (source[i] === ')') depth--; i++; }
        if (depth) throw new Error('Unterminated string');
      } else if (source[i] === '<' && source[i + 1] !== '<') {
        i = source.indexOf('>', i) + 1; if (!i) throw new Error('Unterminated hex string');
      } else if ('[]<>'.includes(source[i])) { i++; }
      else { i++; while (i < source.length && !/[\s\0()[\]<>%/]/.test(source[i])) i++; }
      result.push({ raw: source.slice(start, i), start, end: i });
      if (result.length > 200000) throw new Error('Complex stream');
    }
    return result;
  }
  function inspectPage(doc, pageIndex, lib) {
    const page = doc.getPage(pageIndex), content = page.node.Contents();
    const refs = content instanceof lib.PDFArray ? content.asArray() : content ? [content] : [];
    const found = [];
    const resources = page.node.Resources();
    const fonts = resources?.lookupMaybe(lib.PDFName.of('Font'), lib.PDFDict);
    // Content arrays share graphics state. Reject the entire page on uncertain
    // text spacing, clipping, transforms, marked content or graphics state.
    const streams = [];
    try {
      let total = 0;
      for (const ref of refs) {
        const stream = doc.context.lookup(ref);
        const bytes = stream instanceof lib.PDFRawStream ? lib.decodePDFRawStream(stream).decode() : stream.getContents();
        total += bytes.length; if (total > 4 * 1024 * 1024) return [];
        const source = latin(bytes), ts = tokens(source);
        if (ts.some(t => ['cm','gs','Tc','Tw','Tz','Ts','Tr','BI','W','W*','BDC','BMC'].includes(t.raw))) return [];
        streams.push({ source, ts });
      }
      streams.forEach(({ source, ts }, streamIndex) => {
        for (let i = 0; i < ts.length; i++) {
          if (ts[i].raw !== 'BT') continue;
          let end = i + 1;
          while (end < ts.length && ts[end].raw !== 'ET') end++;
          if (end === ts.length) return;
          const body = ts.slice(i + 1, end); i = end;
          let fontName, size, matrix, textToken, invalid = false, seenShow = false;
          let args = [];
          for (const t of body) {
            if (/^[-+]?(\d*\.)?\d+$/.test(t.raw) || /^[/(<]/.test(t.raw)) { args.push(t); continue; }
            const nums = args.map(a => Number(a.raw));
            if (t.raw === 'Tf' && !seenShow && args.length === 2 && args[0].raw.startsWith('/')) { fontName = args[0].raw.slice(1); size = nums[1]; }
            else if (t.raw === 'Tm' && !seenShow && args.length === 6 && nums.every(Number.isFinite)) matrix = nums;
            else if (t.raw === 'Tj' && !seenShow && args.length === 1 && /^[<(]/.test(args[0].raw)) { textToken = args[0]; seenShow = true; }
            else if (['rg','g','k','TL'].includes(t.raw) && !seenShow && nums.every(Number.isFinite) && args.length === ({ rg:3,g:1,k:4,TL:1 }[t.raw])) { /* unchanged appearance */ }
            else if (t.raw === 'T*' && seenShow && !args.length) { /* final line advance, no subsequent show allowed */ }
            else invalid = true;
            args = [];
          }
          if (invalid || args.length || !textToken || !matrix || !fontName || !Number.isFinite(size) || size < 6 || size > 144) continue;
          const [a,b,c,d,x,y] = matrix;
          if (Math.abs(a*d-b*c-1) > 1e-5 || Math.abs(a*a+b*b-1) > 1e-5 || Math.abs(c*c+d*d-1) > 1e-5 || !Number.isFinite(x+y)) continue;
          const font = fonts?.lookupMaybe(lib.PDFName.of(fontName), lib.PDFDict);
          if (!font || font.get(lib.PDFName.of('Subtype'))?.toString() !== '/Type1') continue;
          const base = font.get(lib.PDFName.of('BaseFont'))?.decodeText();
          const encoding = font.get(lib.PDFName.of('Encoding'))?.toString();
          if (!standard.has(base) || encoding !== '/WinAnsiEncoding' || font.has(lib.PDFName.of('FontDescriptor')) || font.has(lib.PDFName.of('ToUnicode')) || font.has(lib.PDFName.of('Widths'))) continue;
          let text;
          try { text = textToken.raw[0] === '<' ? lib.PDFHexString.of(textToken.raw.slice(1,-1)).decodeText() : lib.PDFString.of(textToken.raw.slice(1,-1)).decodeText(); } catch { continue; }
          // ASCII only: PDFDocEncoding and WinAnsi agree here. Other glyph maps
          // must not be guessed, even when PDF.js can extract their Unicode.
          if (!text || /[^\x20-\x7e]/.test(text)) continue;
          found.push({ key: `${streamIndex}:${textToken.start}`, text, font: base, fontSize: size, matrix, streamIndex, start: textToken.start, end: textToken.end, source });
        }
      });
    } catch { return []; }
    return found;
  }
  async function inspect(input, lib, pageIndex = null) {
    const doc = await lib.PDFDocument.load(input, { updateMetadata: false });
    if (pageIndex !== null) return inspectPage(doc, pageIndex, lib).map(({ source, ...item }) => item);
    return doc.getPages().map((_, i) => inspectPage(doc, i, lib).map(({ source, ...item }) => item));
  }
  async function apply(doc, edits, lib) {
    if (!Array.isArray(edits) || edits.length > 300) throw new Error('Use up to 300 native text replacements.');
    const groups = new Map(), pageRuns = new Map();
    for (const edit of edits) {
      if (!Number.isInteger(edit.pageIndex) || edit.pageIndex < 0 || edit.pageIndex >= doc.getPageCount()) throw new Error('Invalid text page.');
      if (typeof edit.text !== 'string' || edit.text.length > 5000 || /[^\x20-\x7e]/.test(edit.text)) throw new Error('Native replacement supports printable Latin ASCII text only. Use Replace visually for other supported text.');
      if (!pageRuns.has(edit.pageIndex)) pageRuns.set(edit.pageIndex, inspectPage(doc, edit.pageIndex, lib));
      const runs = pageRuns.get(edit.pageIndex);
      const run = runs.find(item => item.key === edit.key && item.text === edit.original);
      if (!run) throw new Error('This text object cannot be rewritten safely. Use Replace visually.');
      const id = `${edit.pageIndex}:${run.streamIndex}`;
      if (!groups.has(id)) groups.set(id, { pageIndex: edit.pageIndex, run, changes: [] });
      const group = groups.get(id);
      if (group.changes.some(item => item.run.key === run.key)) throw new Error('Duplicate native text replacement.');
      group.changes.push({ run, text: edit.text });
    }
    for (const { pageIndex, run, changes } of groups.values()) {
      let result = run.source;
      for (const change of changes.sort((a,b) => b.run.start-a.run.start)) {
        const hex = Array.from(change.text, char => char.charCodeAt(0).toString(16).padStart(2,'0')).join('');
        result = result.slice(0,change.run.start) + `<${hex}>` + result.slice(change.run.end);
      }
      const page = doc.getPage(pageIndex), old = page.node.Contents();
      const refs = old instanceof lib.PDFArray ? [...old.asArray()] : [old];
      refs[run.streamIndex] = doc.context.register(doc.context.flateStream(Uint8Array.from(result, char => char.charCodeAt(0))));
      page.node.set(lib.PDFName.of('Contents'), doc.context.obj(refs));
    }
  }
  root.GxaPdfTextCore = Object.freeze({ inspect, apply });
})(typeof window !== 'undefined' ? window : globalThis);

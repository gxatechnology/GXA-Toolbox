(function (root) {
  'use strict';
  const MAX_BYTES = 2 * 1024 * 1024;
  const MAX_PAGES = 500;
  const blocks = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'CAPTION', 'DL', 'DT', 'DD', 'FIGURE', 'FIGCAPTION']);
  const inline = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SMALL', 'MARK', 'CODE', 'A', 'BR', 'HR', 'TD', 'TH', 'SUB', 'SUP', 'ABBR', 'TIME', 'WBR']);

  function parse(source, doc = document) {
    if (!String(source || '').trim()) throw new Error('Enter HTML or choose a non-empty HTML file.');
    if (new TextEncoder().encode(source).length > MAX_BYTES) throw new Error('HTML input exceeds the 2 MB conversion limit.');
    // A template is inert: source elements are never attached to a live document.
    // No resources, handlers, CSS, or scripts from the source are activated.
    const template = doc.createElement('template');
    template.innerHTML = source;
    const runs = [];
    const add = (text, style) => { if (text) runs.push({ text, ...style }); };
    const newline = () => add('\n', { size: 11 });
    function visit(node, style = { size: 11, bold: false, italic: false, pre: false }, depth = 0) {
      if (depth > 100) throw new Error('HTML nesting exceeds the supported limit (100 levels).');
      if (node.nodeType === 3) { add(style.pre ? node.nodeValue : node.nodeValue.replace(/\s+/g, ' '), style); return; }
      if (node.nodeType !== 1 && node.nodeType !== 11) return;
      if (node.nodeType === 11) { for (const child of node.childNodes) visit(child, style, depth + 1); return; }
      const tag = node.tagName;
      if (['META', 'TITLE', 'STYLE', 'LINK', 'BASE', 'COL', 'COLGROUP'].includes(tag)) return;
      if (['HTML', 'HEAD', 'BODY'].includes(tag)) { if (tag !== 'HEAD') for (const child of node.childNodes) visit(child, style, depth + 1); return; }
      if (!blocks.has(tag) && !inline.has(tag)) throw new Error(`Unsupported HTML element <${tag.toLowerCase()}>. Remove embedded media, scripts, forms, or custom elements before exporting text.`);
      if (tag === 'BR' || tag === 'HR') { newline(); return; }
      const next = { ...style, bold: style.bold || ['B', 'STRONG', 'TH'].includes(tag), italic: style.italic || ['I', 'EM'].includes(tag), pre: style.pre || tag === 'PRE' };
      if (/^H[1-6]$/.test(tag)) { next.size = 24 - Number(tag[1]) * 2; next.bold = true; }
      if (blocks.has(tag)) newline();
      if (tag === 'LI') add('- ', next);
      for (const child of node.childNodes) visit(child, next, depth + 1);
      if (tag === 'TD' || tag === 'TH') add(' | ', next);
      if (blocks.has(tag)) newline();
    }
    visit(template.content);
    if (!runs.some(run => run.text.trim())) throw new Error('No supported visible text was found in the HTML.');
    return runs;
  }

  async function convert(source, options = {}) {
    const PDFLib = options.PDFLib || root.PDFLib;
    if (!PDFLib) throw new Error('The PDF engine is unavailable. Reload and try again.');
    const runs = parse(source, options.document || document);
    const pdf = await PDFLib.PDFDocument.create();
    const fonts = await Promise.all(['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'].map(name => pdf.embedFont(PDFLib.StandardFonts[name])));
    const fontFor = run => fonts[(run.bold ? 1 : 0) + (run.italic ? 2 : 0)];
    // Validate the entire document before producing any output. Never strip,
    // transliterate, or replace characters that the bundled font cannot encode.
    for (const run of runs) {
      try { fontFor(run).encodeText(run.text.replace(/[\r\n\t]/g, ' ')); }
      catch { throw new Error('The PDF font cannot preserve one or more Unicode characters. This text-reflow tool supports Windows-1252/Latin text only. No PDF was exported; use a Unicode-capable print application for this document.'); }
    }
    const width = 595.28, height = 841.89, margin = 48;
    let page, x = margin, y, lineHeight = 16, pages = 0;
    const newPage = () => {
      if (++pages > MAX_PAGES) throw new Error('Output exceeds 500 pages. No incomplete PDF was exported; split the source document.');
      page = pdf.addPage(); page.setSize(width, height); y = height - margin - 24; x = margin;
    };
    const newLine = () => { x = margin; y -= lineHeight; lineHeight = 16; if (y < margin + 24) newPage(); };
    newPage();
    let pendingBreak = false;
    for (const run of runs) {
      const font = fontFor(run), size = run.size;
      for (const token of run.text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split(/(\n|[^\S\n]+)/)) {
        if (!token) continue;
        if (token === '\n') { if (!pendingBreak || run.pre) newLine(); pendingBreak = true; continue; }
        if (!token.trim() && x === margin && !run.pre) continue;
        pendingBreak = false;
        lineHeight = Math.max(lineHeight, size * 1.4);
        if (x > margin && x + font.widthOfTextAtSize(token, size) > width - margin) newLine();
        // Split even an unbroken URL/word by Unicode character, never substring
        // truncation. Every source character is drawn or export fails explicitly.
        let segment = '', segmentWidth = 0;
        const flush = () => {
          if (segment) page.drawText(segment, { x, y, size, font });
          x += segmentWidth; segment = ''; segmentWidth = 0;
        };
        for (const character of token) {
          const advance = font.widthOfTextAtSize(character, size);
          if (x + segmentWidth + advance > width - margin) { flush(); newLine(); }
          lineHeight = Math.max(lineHeight, size * 1.4);
          segment += character; segmentWidth += advance;
        }
        flush();
      }
    }
    return new Blob([await pdf.save()], { type: 'application/pdf' });
  }
  root.GxaHtmlToPdf = Object.freeze({ MAX_BYTES, MAX_PAGES, parse, convert });
})(globalThis);

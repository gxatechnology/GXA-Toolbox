(function (root) {
  'use strict';
  // Explicit audited baseline: newly registered tools fail closed until reviewed.
  const audited = new Set(('merge-pdf organize-pdf compress-image resize-image image-converter gps-map-camera crop-image image-ocr background-remover password-generator barcode-generator color-extractor zip-manager split-pdf protect-pdf unlock-pdf pdf-to-jpg jpg-to-pdf word-to-pdf pdf-to-word epub-to-pdf pdf-to-epub gif-maker zip-extractor compress-pdf edit-pdf rotate-pdf watermark-pdf pagenumber-pdf pdf-metadata excel-to-pdf ppt-to-pdf pdf-to-text html-to-pdf pdf-to-html markdown-to-pdf pdf-to-markdown svg-to-png png-to-svg webp-to-jpg gif-to-png text-to-speech qr-reader barcode-reader base64-tool url-tool json-tool hash-tool case-converter word-counter lorem-ipsum diff-checker sql-formatter xml-to-json uuid-generator user-agent regex-tester markdown-editor css-beautifier js-beautifier html-beautifier cron-generator color-converter exif-viewer timestamp-converter remove-pdf-pages extract-pdf-pages extract-images-pdf crop-pdf header-footer-pdf sign-pdf repair-pdf ocr-pdf image-to-pdf png-to-pdf txt-to-pdf pdf-to-image pdf-to-png pdf-to-excel pdf-to-ppt calculator scientific-calculator percentage-calculator age-calculator date-calculator emi-calculator loan-calculator interest-calculator gst-calculator sip-calculator bmi-calculator discount-calculator unit-converter currency-converter time-calculator').split(' '));
  const bounded = new Set(('edit-pdf image-converter gps-map-camera image-ocr word-to-pdf pdf-to-word epub-to-pdf pdf-to-epub excel-to-pdf ppt-to-pdf pdf-to-text pdf-to-html markdown-to-pdf pdf-to-markdown png-to-svg text-to-speech markdown-editor extract-images-pdf sign-pdf repair-pdf ocr-pdf pdf-to-excel pdf-to-ppt').split(' '));
  // Publication review is independent of engine availability. Keep these routes
  // usable until a separate editorial/functional review approves publication.
  const review = Object.freeze({
    'qr-reader': 'Reader compatibility and output safety review',
    'barcode-reader': 'Reader compatibility and output safety review',
    'base64-tool': 'Output safety and content review',
    'url-tool': 'Output safety and content review',
    'case-converter': 'Output safety and content review',
    'cron-generator': 'Input validation, output safety and scope review',
    'css-beautifier': 'Formatter fidelity and output safety review',
    'js-beautifier': 'Formatter fidelity and output safety review',
    'html-beautifier': 'Formatter fidelity and output safety review',
    'sql-formatter': 'Formatter fidelity and output safety review',
    'xml-to-json': 'Output safety and content review',
    'user-agent': 'Display-only scope and output safety review',
    'html-to-pdf': 'Bounded conversion and content review',
    'uuid-generator': 'Secure fallback and content review'
  });
  const approved = Object.freeze({ productionReady: true, indexable: true, adsEligible: true, contentReady: true, functionalityVerified: true, reason: 'Approved within documented scope by the repository audit' });
  const denied = Object.freeze({ productionReady: false, indexable: false, adsEligible: false, contentReady: false, functionalityVerified: false, reason: 'Unknown or non-public tool' });
  function forTool(id, known = true) {
    if (!known || !audited.has(id)) return denied;
    if (!Object.hasOwn(review, id)) return bounded.has(id)
      ? Object.freeze({ ...approved, functionalityVerified: false, reason: 'Indexable within documented limits; the original audit records partial functionality' })
      : approved;
    return Object.freeze({ ...denied, reason: review[id] });
  }
  function forPage(pageId, tools = []) {
    if (pageId === 'home' || /^content-(help|about|careers|security|privacy-policy|terms|gdpr)$/.test(pageId)) return approved;
    if (root.GXA_EDITORIAL_PAGES?.some(page => pageId === `content-${page.id}`)) return approved;
    const id = pageId?.startsWith('tool-') ? pageId.slice(5) : '';
    return forTool(id, tools.some(tool => tool.id === id));
  }
  root.GxaToolQuality = Object.freeze({ review, forTool, forPage });
})(globalThis);

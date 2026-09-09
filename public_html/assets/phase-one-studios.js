(function () {
  'use strict';

  // Routes are independent tools. The shared layer classifies each workspace
  // without adding cross-tool navigation, unrelated controls, or processing claims.
  const FAMILY_IDS = Object.freeze({
    'security-password': ['password-generator'],
    'security-file': ['protect-pdf', 'unlock-pdf'],
    'developer-text': [
      'base64-tool', 'url-tool', 'json-tool', 'hash-tool', 'case-converter',
      'word-counter', 'diff-checker', 'sql-formatter', 'xml-to-json',
      'regex-tester', 'markdown-editor', 'css-beautifier', 'js-beautifier',
      'html-beautifier', 'timestamp-converter', 'user-agent', 'remove-spaces'
    ],
    generator: ['barcode-generator', 'qr-generator', 'lorem-ipsum', 'uuid-generator', 'cron-generator', 'color-converter', 'text-to-speech'],
    calculator: [
      'calculator', 'scientific-calculator', 'percentage-calculator', 'age-calculator',
      'date-calculator', 'emi-calculator', 'loan-calculator', 'interest-calculator',
      'gst-calculator', 'sip-calculator', 'bmi-calculator', 'discount-calculator',
      'unit-converter', 'currency-converter', 'time-calculator'
    ],
    'pdf-multi-file': ['merge-pdf', 'organize-pdf', 'jpg-to-pdf', 'image-to-pdf', 'png-to-pdf'],
    'pdf-file': [
      'split-pdf', 'compress-pdf', 'rotate-pdf', 'watermark-pdf', 'pagenumber-pdf',
      'remove-pdf-pages', 'extract-pdf-pages', 'extract-images-pdf', 'crop-pdf',
      'header-footer-pdf', 'sign-pdf', 'repair-pdf', 'pdf-to-jpg', 'pdf-to-image',
      'pdf-to-png', 'pdf-to-word', 'pdf-to-text', 'pdf-to-html', 'pdf-to-markdown',
      'pdf-to-excel', 'pdf-to-ppt', 'word-to-pdf', 'excel-to-pdf', 'ppt-to-pdf',
      'txt-to-pdf', 'pdf-to-epub', 'epub-to-pdf', 'html-to-pdf', 'markdown-to-pdf'
    ],
    'image-file': [
      'compress-image', 'resize-image', 'webp-to-jpg', 'svg-to-png', 'png-to-svg',
      'gif-maker', 'gif-to-png', 'png-to-ico', 'heic-to-jpg', 'image-to-base64'
    ],
    metadata: ['pdf-metadata', 'exif-viewer', 'color-extractor', 'barcode-reader', 'qr-reader'],
    ocr: ['ocr-pdf', 'image-ocr'],
    archive: ['zip-manager', 'zip-extractor'],
    'file-converter': [
      'csv-to-excel', 'excel-to-csv', 'csv-to-json', 'json-to-csv', 'html-to-pdf',
      'epub-to-pdf', 'json-to-xml', 'xml-to-csv'
    ],
    'writing-text': ['grammar-checker', 'plagiarism-checker', 'ai-resume-builder']
  });

  const FAMILY_BY_ROUTE = new Map();
  Object.entries(FAMILY_IDS).forEach(([family, ids]) => ids.forEach(id => FAMILY_BY_ROUTE.set(id, family)));

  const DEDICATED_FAMILIES = Object.freeze({
    'edit-pdf': 'preview-heavy-pdf-editor',
    'image-converter': 'preview-heavy-image-converter',
    'gps-map-camera': 'gps-camera',
    'crop-image': 'preview-heavy-image-editor',
    'background-remover': 'preview-heavy-image-editor'
  });

  function familyForRoute(toolId) {
    return DEDICATED_FAMILIES[toolId] || FAMILY_BY_ROUTE.get(toolId) || 'utility';
  }

  function dispose() {
    // Stable API retained for route disposal. This layer owns no global listeners.
  }

  function decorate(toolId) {
    const container = document.querySelector('.tool-container, .background-remover-page');
    if (!container) return false;
    const workspace = container.querySelector('.tool-workspace, .crop-editor-grid');
    const family = familyForRoute(toolId);
    container.classList.add('tool-architecture-page', `tool-family-${family}`);
    container.dataset.workspaceFamily = family;
    if (workspace) {
      workspace.dataset.workspaceFamily = family;
      workspace.setAttribute('aria-label', `${toolId.replaceAll('-', ' ')} workspace`);
    }
    return true;
  }

  window.GxaPhaseOneStudios = Object.freeze({
    decorate,
    dispose,
    closeDrawer() {},
    familyForRoute,
    families: FAMILY_IDS,
    // Compatibility properties intentionally expose no route-switching modes.
    imageRoutes: Object.freeze([]),
    pdfRoutes: Object.freeze([])
  });
})();

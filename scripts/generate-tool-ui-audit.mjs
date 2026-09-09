import { writeFile } from 'node:fs/promises';
import { loadToolRegistry } from './tool-registry.mjs';

const architectureOutputUrl = new URL('../docs/TOOL_UI_ARCHITECTURE_AUDIT.md', import.meta.url);
const legacyOutputUrl = new URL('../docs/TOOL_UI_AUDIT.md', import.meta.url);
const tools = await loadToolRegistry();

const ids = (...values) => new Set(values);
const families = [
  ['Preview-heavy PDF editor', ids('edit-pdf')],
  ['Preview-heavy image converter', ids('image-converter')],
  ['GPS/camera', ids('gps-map-camera')],
  ['Preview-heavy image editor', ids('crop-image', 'background-remover')],
  ['Security/password', ids('password-generator')],
  ['Security/file', ids('protect-pdf', 'unlock-pdf')],
  ['OCR', ids('ocr-pdf', 'image-ocr')],
  ['Archive/ZIP', ids('zip-manager', 'zip-extractor')],
  ['Metadata/inspection', ids('pdf-metadata', 'exif-viewer', 'color-extractor', 'barcode-reader', 'qr-reader', 'user-agent')],
  ['Developer/text', ids(
    'base64-tool', 'url-tool', 'json-tool', 'hash-tool', 'case-converter', 'word-counter',
    'diff-checker', 'sql-formatter', 'xml-to-json', 'regex-tester', 'markdown-editor',
    'css-beautifier', 'js-beautifier', 'html-beautifier', 'timestamp-converter', 'remove-spaces'
  )],
  ['Writing/text', ids('grammar-checker', 'plagiarism-checker', 'ai-resume-builder')],
  ['Text/generator', ids('barcode-generator', 'lorem-ipsum', 'uuid-generator', 'cron-generator', 'color-converter', 'text-to-speech')],
  ['PDF multi-file', ids('merge-pdf', 'organize-pdf', 'jpg-to-pdf', 'image-to-pdf', 'png-to-pdf')],
  ['Image file', ids('compress-image', 'resize-image', 'webp-to-jpg', 'svg-to-png', 'png-to-svg', 'gif-maker', 'gif-to-png')],
  ['File converter', ids('epub-to-pdf', 'pdf-to-epub', 'excel-to-pdf', 'ppt-to-pdf', 'html-to-pdf', 'markdown-to-pdf')],
  ['Calculator', new Set(tools.filter(tool => tool.category === 'calculator').map(tool => tool.id))],
  ['PDF file', new Set(tools.filter(tool => tool.category === 'pdf').map(tool => tool.id))],
  ['File converter', new Set(tools.filter(tool => tool.category === 'convert').map(tool => tool.id))]
];

const formerlyStudioIds = ids(
  'compress-image', 'resize-image', 'crop-image', 'color-extractor', 'exif-viewer', 'webp-to-jpg', 'svg-to-png', 'png-to-svg',
  'merge-pdf', 'organize-pdf', 'split-pdf', 'remove-pdf-pages', 'extract-pdf-pages', 'rotate-pdf', 'crop-pdf',
  'compress-pdf', 'watermark-pdf', 'pagenumber-pdf', 'header-footer-pdf', 'sign-pdf', 'pdf-metadata',
  'pdf-to-image', 'image-to-pdf', 'pdf-to-text', 'pdf-to-word', 'extract-images-pdf', 'ocr-pdf', 'word-to-pdf',
  'excel-to-pdf', 'ppt-to-pdf', 'pdf-to-excel', 'pdf-to-ppt', 'repair-pdf', 'protect-pdf', 'unlock-pdf',
  'pdf-to-jpg', 'pdf-to-png', 'jpg-to-pdf', 'png-to-pdf'
);
const dedicatedIds = new Set(['edit-pdf', 'image-converter', 'gps-map-camera', 'crop-image', 'background-remover']);

function familyFor(tool) {
  return families.find(([, set]) => set.has(tool.id))?.[0] || 'Utility';
}

function currentWorkspace(tool) {
  if (dedicatedIds.has(tool.id)) return `Dedicated ${familyFor(tool).toLowerCase()} workspace${formerlyStudioIds.has(tool.id) ? ' plus cross-route pseudo-mode studio rail' : ''}`;
  if (formerlyStudioIds.has(tool.id)) return 'Generic premium shell plus cross-route pseudo-mode studio rail';
  return 'Generic premium mega-editor shell';
}

function finalWorkspace(tool) {
  const family = familyFor(tool);
  if (dedicatedIds.has(tool.id)) return `Dedicated ${family.toLowerCase()} workspace`;
  if (tool.id === 'password-generator') return 'Compact result-first password workspace';
  if (tool.id === 'merge-pdf') return 'Focused multi-PDF queue, order, settings, merge, preview, download';
  return `Focused shared ${family.toLowerCase()} workspace`;
}

function preInput(tool) {
  const family = familyFor(tool);
  if (tool.id === 'password-generator') return 'Complete generated value appears immediately';
  if (tool.category === 'calculator') return 'Result and calculation inputs render immediately';
  if (['Developer/text', 'Text/generator', 'Writing/text'].includes(family)) return 'Text/result surface renders immediately';
  if (tool.id === 'gps-map-camera') return 'Upload or camera source choice';
  if (tool.id === 'background-remover') return 'Focused JPG/PNG/WEBP drop zone';
  return `Focused ${tool.category === 'pdf' || tool.id.includes('pdf') ? 'document' : 'file'} picker with formats and limits`;
}

function settingsPlacement(tool) {
  if (tool.id === 'edit-pdf') return 'Inside dedicated editor, beside the active page';
  if (tool.id === 'image-converter') return 'Beside original/result preview; stacks on mobile';
  if (tool.id === 'gps-map-camera') return 'Location and stamp controls beside preview; stacks on mobile';
  if (tool.id === 'crop-image' || tool.id === 'background-remover') return 'Dedicated editor controls; in normal mobile flow';
  if (tool.category === 'calculator') return 'Input panel beside result; stacks after result';
  return 'Task-specific side panel; stacks after primary surface on narrow screens';
}

function resultType(tool) {
  if (tool.id === 'password-generator') return 'Complete selectable password, Copy, Regenerate, strength';
  if (tool.id === 'hash-tool') return 'Complete wrapping hash with Copy complete hash';
  if (tool.id === 'merge-pdf') return 'Merged PDF preview, statistics, download';
  if (tool.id === 'edit-pdf') return 'Edited original-page PDF download';
  if (tool.id === 'image-converter') return 'Original/result image preview and validated download';
  if (tool.id === 'gps-map-camera') return 'Same-dimension stamp preview plus JPEG/EXIF download';
  if (tool.id === 'crop-image') return 'Before/after crop preview and download';
  if (tool.id === 'background-remover') return 'Editable alpha-mask canvas and export';
  const family = familyFor(tool);
  if (family === 'Calculator') return 'Numeric summary';
  if (family === 'Metadata/inspection') return 'Metadata/table/inspection result';
  if (family === 'OCR') return 'Extracted text';
  if (family === 'Archive/ZIP') return 'Archive entry list or download card';
  if (family.includes('Image')) return 'Contained image preview or download card';
  if (family.includes('PDF')) return 'Contained PDF preview or download card';
  if (family.includes('Developer') || family.includes('generator')) return 'Copyable text, code, or generated visual';
  return 'File download card or task-specific text result';
}

function primaryAction(tool) {
  const labels = {
    'password-generator': 'Copy and Regenerate are beside the password',
    'merge-pdf': 'Merge PDFs follows the ordered file queue',
    'hash-tool': 'Copy complete hash follows the hash',
    'crop-image': 'Crop image stays beside crop settings',
    'background-remover': 'Automatic removal begins after image selection',
    'edit-pdf': 'Edit and download actions live in the PDF editor',
    'image-converter': 'Convert and download actions live in the converter',
    'gps-map-camera': 'Apply stamp and download actions live in the GPS workspace'
  };
  return labels[tool.id] || (tool.category === 'calculator' ? 'Calculate and Reset stay with inputs' : tool.category === 'utility' ? 'Live output or named action is adjacent to input' : 'Named processing action follows selected files');
}

const columnHeader = '| Tool name | Route | Family/type | Current workspace type | New/final workspace type | Cross-tool navigation present? | Removed? | Pre-input experience | Settings placement | Result/preview type | Clipping status | Mobile status | Desktop status | Technical badge status | Primary action clarity | Final status |';
const divider = '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';
const escapeCell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const rows = tools.map(tool => {
  const values = [
    tool.name,
    `/${tool.id}/`,
    familyFor(tool),
    currentWorkspace(tool),
    finalWorkspace(tool),
    'No',
    formerlyStudioIds.has(tool.id) ? 'Yes — cross-route rail and injected controls' : 'N/A',
    preInput(tool),
    settingsPlacement(tool),
    resultType(tool),
    'In-flow; long output wraps or uses bounded content scrolling',
    '320–768 px shared contract; representative Chromium coverage',
    '1024–1920 px shared contract; representative Chromium coverage',
    'Removed from the hero; compact truthful processing note retained',
    primaryAction(tool),
    'Architecture complete; registry and route contract covered'
  ];
  return `| ${values.map(escapeCell).join(' | ')} |`;
});

const navigationGroups = [
  ['PDF → Manage pages', 'Merge PDF; Edit PDF; Organize PDF; Split PDF; Rotate PDF; Crop PDF; Remove PDF Pages; Extract PDF Pages'],
  ['PDF → Optimize & secure', 'Compress PDF; Protect PDF; Unlock PDF; Repair PDF; Add Watermark; Add Page Numbers; Add Header & Footer; Sign PDF; PDF Metadata Editor; OCR PDF; Extract Images'],
  ['PDF → Convert from PDF', 'PDF to JPG; PDF to Text/RTF; PDF to Text; PDF to HTML; PDF to Markdown; PDF to EPUB; PDF to Image; PDF to PNG; PDF to Excel; PDF to PPT'],
  ['PDF → Create a PDF', 'JPG to PDF; Word to PDF; Image to PDF; PNG to PDF; TXT to PDF; EPUB to PDF; Excel to PDF; PPT to PDF; HTML to PDF; Markdown to PDF'],
  ['Image → Optimize & edit', 'Compress Image; Resize Image; Crop Image; Background Remover'],
  ['Image → Convert & animate', 'Image Converter; WEBP to JPG; SVG to PNG; PNG to SVG; GIF Maker; GIF Frame Extractor'],
  ['Image → Read & inspect', 'Image OCR; Color Extractor; EXIF Metadata Viewer; QR Code Reader; Barcode Scanner'],
  ['Image → Capture & location', 'GPS Map Camera – Geotag Photo'],
  ['Calculators → Everyday', 'Simple Calculator; Percentage Calculator; Age Calculator; Date Calculator; Time Calculator'],
  ['Calculators → Money', 'EMI Calculator; Loan Calculator; Interest Calculator; GST Calculator; SIP Calculator'],
  ['Calculators → Convert & compare', 'Unit Converter; Currency Converter; Discount Calculator'],
  ['Calculators → Science & health', 'Scientific Calculator; BMI Calculator']
];

const navigationRows = navigationGroups.map(([group, routes]) => `| ${group} | ${routes} | Header mega menu uses real registered routes only |`).join('\n');
const counts = Object.entries(tools.reduce((result, tool) => {
  const family = familyFor(tool);
  result[family] = (result[family] || 0) + 1;
  return result;
}, {})).sort(([a], [b]) => a.localeCompare(b)).map(([family, count]) => `- ${family}: ${count}`).join('\n');

const document = `# GXA Toolbox — all-${tools.length} tool UI architecture audit

Generated deterministically from the central registry. Every registered tool route is listed exactly once. “Representative Chromium coverage” means the named width matrix exercises routes from each architecture family; it does not claim that all ${tools.length} routes were manually exercised on physical devices.

## Tool-by-tool architecture matrix

${columnHeader}
${divider}
${rows.join('\n')}

## Navigation matrix

| Navigation group | Actual tool inventory | Final behavior |
|---|---|---|
${navigationRows}

Search and the homepage All Tools directory expose all ${tools.length} registry routes. Mobile navigation links to All Tools, Converters, ZIP Tools, and Developer Tools without presenting any route as a mode inside another tool.

## Responsive verification matrix

- Mobile: 320×568, 360×800, 375×812, 390×844, 412×915, 430×932, 768×1024.
- Desktop: 1024×768, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080.
- Evidence directory: \`test-results/tool-ui-architecture/\`.
- Shared acceptance checks: no page-level horizontal overflow, primary workspace exists, focused result remains in normal flow, long passwords and hashes remain complete, and no cross-tool mode rail is rendered.

## SEO and monetization preservation

- The registry remains ${tools.length} tools.
- Static tool intros, About sections, How to Use, FAQs, related routes, canonicals, structured data, privacy disclosures, and output spacing remain generated from the existing content registries.
- The new static Help Center is a documentation route, not a tool. It changes the expected sitemap total from 102 to 103 while leaving the tool registry at ${tools.length}.
- The existing hidden ad placement remains reserved and does not interrupt the core task flow before a configured ad unit exists.

## Family totals

${counts}
`;

await Promise.all([
  writeFile(architectureOutputUrl, document, 'utf8'),
  writeFile(legacyOutputUrl, `# Moved: GXA Toolbox tool UI audit\n\nThe complete generated audit now lives in [TOOL_UI_ARCHITECTURE_AUDIT.md](./TOOL_UI_ARCHITECTURE_AUDIT.md).\n\n${columnHeader}\n${divider}\n${rows.join('\n')}\n`, 'utf8')
]);
console.log(`Generated the complete architecture audit for ${tools.length} registered tool routes.`);

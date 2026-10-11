// Evidence inventory, not a claim of full advanced-workflow certification.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { loadToolRegistry, loadToolQuality, loadToolContentRegistry } from './tool-registry.mjs';
const tools = await loadToolRegistry(), quality = await loadToolQuality(), content = await loadToolContentRegistry();
const ledger = await readFile(new URL('../docs/TOOL_FUNCTIONALITY_MATRIX.md', import.meta.url), 'utf8');
const oldRows = new Map(ledger.split('\n').filter(line => /^\| \/[^ ]+\/ \|/.test(line)).map(line => { const cells = line.split('|').slice(1,-1).map(cell => cell.trim()); return [cells[0].replace(/^\/|\/$/g,''), cells]; }));
const plans = new Map();
function group(ids, engine, deferred) {
  for (const id of ids.split(' ')) { assert.ok(!plans.has(id), `Duplicate plan ${id}`); plans.set(id,{engine,deferred}); }
}
group('edit-pdf','pdf-edit-core.js + pdf-edit.js; pdf-lib/PDF.js','Original text-stream rewriting/font reuse; explicit visual-replace selection; OCR regions; original embedded-image editing; freehand/comments; new fields; secure redaction; unrestricted page+overlay rotation. See PDF_EDITOR_TECHNICAL_PLAN.md.');
group('merge-pdf','app.js / runPDFMerge, pdf-lib','Live AcroForm/XFA preservation, interactive page-level merge plan thumbnails, destination/bookmark/tagged-PDF fidelity, cross-browser large-file corpus and full advanced-control certification');
group('organize-pdf','app.js / runPDFOrganize; pdf-lib/PDF.js','Final-plan visual preview, independent per-copy rotations, arbitrary thumbnail duplicate/blank editing, live field-tree preservation, document-level destinations/tags and wider browser/file corpus');
group('split-pdf','app.js / planPdfSplit + runPDFSplit; pdf-lib/PDF.js/JSZip','Rendered preview of each final output, live form/annotation/destination fidelity, cancellable worker export and wider browser/large-file corpus');
group('compress-pdf','app.js / runPDFCompress + qpdf-worker.js; qpdf WASM','Image downsampling with independent visual-quality evidence; estimates must not be invented; complete level-by-level workflow validation');
group('protect-pdf unlock-pdf','app.js / runQpdfOperation + qpdf-worker.js','Independent owner/user passwords and permissions UI where supported; wrong-password/correct-password real-browser reopen matrix');
group('ocr-pdf','app.js / runPDFOCR; PDF.js/Tesseract','Searchable PDF text layer (current transcript is not searchable PDF); page ranges; coordinate fidelity; full language/output tests');
group('pdf-to-word pdf-to-excel pdf-to-ppt','app.js + PDF.js, text/RTF/worksheet/slide writers','Source-layout reconstruction, table/image segmentation and reading order; do not claim faithful Office round trips');
group('word-to-pdf excel-to-pdf ppt-to-pdf epub-to-pdf','app.js; Mammoth/SheetJS/JSZip, bounded PPTX renderer, pdf-lib','Complex layouts, native print pagination/themes/charts/fonts; faithful native Office rendering needs separately reviewed server/SDK work');
group('pdf-to-jpg pdf-to-image pdf-to-png','app.js + tool-workspace.js; PDF.js/Canvas/JSZip','Full page-range/DPI/quality/naming combinations, very large pages and ZIP contents verification');
group('jpg-to-pdf image-to-pdf png-to-pdf','app.js; Canvas/pdf-lib','Fit/fill, page size/margins/background/compression and separate-PDF mode, preserving order; all combinations need output tests');
group('rotate-pdf remove-pdf-pages extract-pdf-pages crop-pdf','app.js; pdf-lib','Batch page selection/rotation/crop precision, form/annotation preservation, edge-case and touch/reset certification');
group('watermark-pdf','app.js; pdf-lib/Canvas','Complete tiled/text/image/scale/opacity/rotation/page-range visual matrix');
group('pagenumber-pdf header-footer-pdf','app.js; pdf-lib','Format/start/alignment/margin/font controls coverage and rotated/cropped-page layout checks');
group('pdf-metadata','app.js; pdf-lib','Selected metadata clearing/readback controls; document-info versus XMP/attachments boundaries');
group('sign-pdf','app.js; pdf-lib/Canvas','Multiple signature/initial/date workflow; explicit-consent reusable signature storage; no certificate claim');
group('repair-pdf','app.js / runPDFRepair; pdf-lib','Structural recovery corpus; preserve honest parse-and-resave scope, no recovery guarantee');
group('extract-images-pdf','tool-workspace.js + app.js; PDF.js/Canvas/JSZip','Image masks/color spaces/transforms and duplicate resources corpus; actual pixel/export fidelity');
group('pdf-to-text pdf-to-html pdf-to-markdown pdf-to-epub','app.js; PDF.js/JSZip','Complex text reading order/columns/Unicode/scans; format limitations remain');
group('html-to-pdf markdown-to-pdf txt-to-pdf','html-to-pdf.js + app.js; pdf-lib text paginator','Full Unicode fonts, richer Markdown lists/tables/code/links, safe images and HTML/CSS page layout; no silent fallback');
group('crop-image','app.js crop editor; Canvas/Pointer Events','Full exact-pixel/ratio/straighten/flip/pinch/grid/format/transparency/quality edge corpus');
group('resize-image compress-image','app.js; Canvas/JSZip','Contain/cover/interpolation/presets and target-size search where meaningful; all batch/transparency/size comparisons');
group('image-converter','image-converter-core.js + image-converter.js; browser/custom codecs','Batch output/ZIP, metadata decisions, all codec/alpha/orientation combinations; no fabricated codecs');
group('background-remover','background-remover-app; React/ONNX WASM/WebGPU','Brush/restore/refine/crop/pinch with varied real photographs and large-image memory/device coverage');
group('image-ocr','app.js / runImageOCR; Tesseract worker','Language/confidence disclosure, copy/TXT/multiple images; broad language/quality/invalid-input matrix');
group('gps-map-camera','gps-map-camera.js/gps-export-renderer.js/gps-photo-core.js; Canvas/EXIF','Real-device GPS/camera permission flows; external provider availability, large images and privacy race cases');
group('color-extractor','app.js; Canvas quantization','HEX/RGB/HSL, palette export and exact-image picker coverage');
group('exif-viewer','app.js; EXIF reader','Metadata stripping/cleaned-image export; pixel/orientation retention tests');
group('barcode-generator','app.js; QRCode/JsBarcode/Canvas','URL/text/email/phone/SMS/Wi-Fi/vCard payload presets; SVG+PNG, colors/margins/error correction and barcode validation corpus');
group('qr-reader barcode-reader','barcode-reader.js; BarcodeDetector/local ZXing','Camera flow/permissions and all supported symbologies on physical devices; untrusted decoded text stays inert');
group('zip-manager','app.js; JSZip','Folder creation/rename/removal/compression/progress with real Unicode/duplicate archives');
group('zip-extractor','app.js; JSZip','Folder tree/selective/download-all, traversal and expansion-budget tests; malformed/encrypted archives');
group('json-tool','app.js; JSON.parse/JSON.stringify','Error-location UX, copy/download/reset and duplicate-key/large-number semantics; no schema-validation claim');
group('base64-tool','app.js + tool-safety.js; UTF-8 and Base64 helpers','Binary decoded-file export with correct MIME/name, text/file round trips and limits');
group('hash-tool','app.js; Web Crypto digest','Compare-hash control, stale file/text races, large-file memory budgets');
group('uuid-generator','tool-safety.js; Web Crypto','Bulk-copy/download/reset and missing-crypto real-browser error verification');
group('password-generator','app.js; Web Crypto','Exclude-ambiguous and disclosed entropy estimate; secure-distribution/constraints/copy workflow');
group('css-beautifier js-beautifier html-beautifier sql-formatter','app.js; bounded textual formatting','Parser-backed syntax validation/formatting with permissive dependencies and adversarial string/comment/template fixtures');
group('xml-to-json','app.js; DOMParser','Mixed content/attributes/namespaces/repeated elements, parser errors and round-trip scope');
group('regex-tester','app.js; JavaScript RegExp','Worker cancellation/time budget for pathological patterns, groups/zero-length/flags validation');
group('markdown-editor','app.js; bounded Markdown preview','Supported lists/tables/code/links with safe rendering and download parity');
group('diff-checker','app.js; positional line comparison','Real alignment-aware diff, insertion/deletion/whitespace handling and large-input limits');
group('url-tool case-converter word-counter lorem-ipsum','app.js; text algorithms','Locale/Unicode and malformed input limits; copy/download/reset; no overstated linguistic/parser claim');
group('user-agent cron-generator','app.js; navigator display / cron construction','Actual UA parser only after safe engine choice; validated cron dialect/ranges and next-run semantics');
group('color-converter timestamp-converter','app.js; color math / Date','Full alpha/color range and epoch timezone/unit validation; copy/export/reset');
group('text-to-speech','app.js; SpeechSynthesis','Installed-voice/device/permission interruption matrix; no audio-file export without an actual synthesis engine');
group('svg-to-png webp-to-jpg png-to-svg','app.js; Canvas / raster SVG wrapper','Large/external SVG/alpha/color-profile tests; true vector tracing is not implemented or claimed');
group('gif-maker gif-to-png','gif-encoder-worker.js/gif-decoder.js + app.js','Frame timing/disposal/transparency/palette and memory/cancel/reset corpus');
group('calculator scientific-calculator percentage-calculator age-calculator date-calculator emi-calculator loan-calculator interest-calculator gst-calculator sip-calculator bmi-calculator discount-calculator unit-converter currency-converter time-calculator','app.js; client-side calculation functions','Per-route advanced formula/units/rounding/result-breakdown and invalid/reset matrix; EMI amortization, GST IGST and next-birthday work where absent; no live-rate/advisory claims');
assert.equal(tools.length,95); assert.equal(plans.size,95);
for (const tool of tools) { assert.ok(plans.has(tool.id),tool.id); assert.ok(oldRows.has(tool.id),tool.id); }
const cell = value => String(value).replaceAll('|','/').replace(/\r?\n/g,' ');
const lines = [
  '# Advanced tool feature matrix — Phase 4C IN PROGRESS', '',
  'Snapshot: 2026-10-11. All 95 registry entries are inventoried against existing content and the Phase 4A evidence ledger. This is NOT a claim that all 95 advanced workflows have been audited or upgraded. Edit PDF, Merge PDF, Split PDF and Organize PDF have new implementation; 91 other routes remain queued in priority order. Existing evidence is explicitly inherited, not relabeled as new certification.', '',
  'Current policy: 81 indexable/ads-eligible tools, 14 noindex/ad-free. No publication flag changed. Browser checks and actual command results are in ADVANCED_TOOLS_PHASE4C.md; route/width passes do not prove processing or advanced-control correctness.', '',
  '| Tool / route | Existing core function | Added in Phase 4C | Advanced work deferred / verification still required | Implementation engine / source | Limitations | Output evidence | Mobile evidence | Browser limitations | Final status |',
  '|---|---|---|---|---|---|---|---|---|---|'
];
for (const tool of tools) {
  const p=plans.get(tool.id), c=content[tool.id], old=oldRows.get(tool.id), edit=tool.id==='edit-pdf', merge=tool.id==='merge-pdf', split=tool.id==='split-pdf', organize=tool.id==='organize-pdf', upgraded=edit||merge||split||organize;
  lines.push('| '+[
    `${tool.name} /${tool.id}/`, `${tool.desc} Input: ${c.supportedFormats.input.join(', ')}. Output: ${c.supportedFormats.output.join(', ')}`,
    edit?'Page management, bounded thumbnails, 12 fonts, text underline/line spacing, 6 extra drawing marks, opacity/fill/stroke, overlay layering/duplication, inserted-image crop/quarter-turn rotation/replace/restore':merge?'Per-file page selections/repeated pages/omissions/relative rotations tied to File identity; reopened output; explicit live-form/corrupt/encrypted guards; correct PDF extension':split?'Bounded validated output plan, non-contiguous/repeated custom groups, inspect first source page per group, reopen every output, form/encryption guards, adjust/retry and clean reset':organize?'Selected-source relative rotation, strict blank/rotation/watermark validation, independent repeated-page watermark, reopen count, reorder beyond 60 thumbnails without loss, keyboard movement, adjust/retry and clean reset':'None in this increment; existing functionality preserved',
    p.deferred,p.engine,c.limitations.join(' '),
    upgraded?'New parsed-output tests and browser download/reopen; see Phase 4C validation log':'Inherited Phase 4A: '+old[4],
    upgraded?'New populated workspace: 320/360/375/390/412/430/768/1440; touch and existing keyboard controls':'Route layout rerun at eight widths; per-control advanced QA pending',
    'Chromium emulation only; physical devices, Firefox/Safari and live services not certified',
    upgraded?'PARTIALLY ADVANCED — bounded increment verified; requested features deferred':'ADVANCED REVIEW PENDING — not a broken-tool classification'
  ].map(cell).join(' | ')+' |');
}
await writeFile(new URL('../docs/ADVANCED_TOOL_FEATURE_MATRIX.md',import.meta.url),lines.join('\n')+'\n');
console.log('Phase 4C inventory: 95 rows, 4 partially advanced increments, 91 advanced reviews pending; 81 indexable/ads-eligible, 14 noindex/ad-free unchanged.');
